import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
  "Access-Control-Allow-Headers": "*",
};

// Simple in-memory rate limiter (Token Bucket per isolate)
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();

function checkRateLimit(ip: string, maxRequests: number, windowMs: number): boolean {
  const now = Date.now();
  const userData = rateLimitMap.get(ip);
  if (!userData || now > userData.resetTime) {
    rateLimitMap.set(ip, { count: 1, resetTime: now + windowMs });
    return true;
  }
  if (userData.count >= maxRequests) {
    return false;
  }
  userData.count++;
  return true;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // 1. Rate Limiting Check (15 requests per minute per IP)
    const ip = req.headers.get("x-forwarded-for") || "unknown_ip";
    if (!checkRateLimit(ip, 15, 60 * 1000)) {
      return new Response(
        JSON.stringify({ error: "Rate limit exceeded. Please wait a moment." }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { messages } = await req.json();

    // GROQ_API_KEY is stored as a Supabase secret — never in client code or GitHub
    const GROQ_API_KEY = Deno.env.get("GROQ_API_KEY");
    if (!GROQ_API_KEY) {
      throw new Error("GROQ_API_KEY secret is not configured in Supabase");
    }

    // Build messages array strictly from client request to support dynamic prompts
    const groqMessages = (messages || []).map((m: any) => ({ role: m.role, content: m.content }));

    const groqResponse = await fetch(
      "https://api.groq.com/openai/v1/chat/completions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${GROQ_API_KEY}`,
        },
        body: JSON.stringify({
          model: "llama-3.3-70b-versatile",
          messages: groqMessages,
          max_tokens: 1024,
        }),
      }
    );

    const groqData = await groqResponse.json();

    if (!groqData.choices || groqData.choices.length === 0) {
      throw new Error(groqData.error?.message || JSON.stringify(groqData));
    }

    const aiText = groqData.choices[0].message.content;

    return new Response(
      JSON.stringify({ message: aiText }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Copilot error:", error);

    return new Response(
      JSON.stringify({
        message: "AI temporarily unavailable. Please call 112 in emergency.",
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});