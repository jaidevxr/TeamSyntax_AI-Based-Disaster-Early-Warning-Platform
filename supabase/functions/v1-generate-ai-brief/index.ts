import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
  "Access-Control-Allow-Headers": "*",
};

// Simple in-memory rate limiter per edge node worker (5 req / minute)
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
    const ip = req.headers.get("x-forwarded-for") || "unknown_ip";
    // More strict limit: 5 brief generations per minute
    if (!checkRateLimit(ip, 5, 60 * 1000)) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Please wait a minute before generating another brief." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }
    
    const { messages, model = "llama-3.3-70b-versatile" } = await req.json();

    const GROQ_API_KEY = Deno.env.get("GROQ_API_KEY");
    if (!GROQ_API_KEY) {
      throw new Error("GROQ_API_KEY secret is not configured in Supabase");
    }

    const groqResponse = await fetch(
      "https://api.groq.com/openai/v1/chat/completions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${GROQ_API_KEY}`,
        },
        body: JSON.stringify({
          model,
          messages,
          max_tokens: 1024,
        }),
      }
    );

    const groqData = await groqResponse.json();

    if (!groqResponse.ok) {
      throw new Error(groqData.error?.message || "Groq request failed");
    }

    if (!groqData.choices || groqData.choices.length === 0) {
      throw new Error("Empty response from Groq");
    }

    const aiText = groqData.choices[0].message.content;

    return new Response(
      JSON.stringify({ message: aiText }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Generate Brief error:", error);

    return new Response(
      JSON.stringify({
        message: "Failed to generate AI brief.",
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
