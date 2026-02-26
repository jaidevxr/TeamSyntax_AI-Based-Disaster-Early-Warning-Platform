import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messages, location, language = "en" } = await req.json();

    // GROQ_API_KEY is stored as a Supabase secret — never in client code or GitHub
    const GROQ_API_KEY = Deno.env.get("GROQ_API_KEY");
    if (!GROQ_API_KEY) {
      throw new Error("GROQ_API_KEY secret is not configured in Supabase");
    }

    const languageNames: Record<string, string> = {
      en: "English",
      hi: "Hindi (हिन्दी)",
      ta: "Tamil (தமிழ்)",
      bn: "Bengali (বাংলা)",
      te: "Telugu (తెలుగు)",
      mr: "Marathi (मराठी)",
      gu: "Gujarati (ગુજરાતી)",
      kn: "Kannada (ಕನ್ನಡ)",
      ml: "Malayalam (മലയാളം)",
      pa: "Punjabi (ਪੰਜਾਬੀ)",
    };

    const selectedLanguage = languageNames[language] || "English";

    const systemPrompt = `You are Saarthi, an advanced disaster response and medical AI assistant for India.
You ONLY respond to disaster-related and medical/health-related queries. Respond strictly in ${selectedLanguage}.
${location ? `User coordinates: ${location.lat}, ${location.lng}` : ""}

If unrelated question, respond: "I'm Saarthi, specialized in disaster response and medical emergencies."`;

    // Build messages array for Groq (OpenAI-compatible)
    const groqMessages = [
      { role: "system", content: systemPrompt },
      ...(messages || []).map((m: any) => ({ role: m.role, content: m.content })),
    ];

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
        error: error.message,
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});