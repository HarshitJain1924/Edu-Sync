import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      status: 200,
      headers: {
        ...corsHeaders,
        "Access-Control-Allow-Methods": "POST, OPTIONS",
      },
    });
  }

  if (req.method !== "POST") {
    return new Response("Method not allowed", {
      status: 405,
      headers: corsHeaders,
    });
  }

  try {
    // Get auth token from request
    const authHeader = req.headers.get("authorization");
    const token = authHeader?.replace("Bearer ", "");
    
    if (!token) {
      return new Response(JSON.stringify({ error: "Missing authorization" }), {
        status: 401,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    // Verify the user is authenticated using service role to validate JWT
    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    
    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token);
    
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized", details: userError?.message || "Invalid token" }), {
        status: 401,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const { topic, numCards = 8 } = await req.json();

    if (!topic || typeof topic !== "string") {
      return new Response(JSON.stringify({ error: "Missing topic" }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    if (!GEMINI_API_KEY) {
      return new Response(JSON.stringify({ error: "Missing GEMINI_API_KEY" }), {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const prompt = `You are a study assistant. Create ${numCards} concise flashcards for the topic: "${topic}".

Return ONLY strict JSON in this exact format (no backticks, no explanation):
{
  "cards": [
    { "question": "Question 1?", "answer": "Answer 1" },
    { "question": "Question 2?", "answer": "Answer 2" }
  ]
}`;

    const llmRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text: prompt,
                },
              ],
            },
          ],
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 2048,
          },
        }),
      }
    );

    if (!llmRes.ok) {
      const text = await llmRes.text();
      console.error("Gemini error", text);
      return new Response(JSON.stringify({ 
        error: "LLM request failed", 
        details: `Status ${llmRes.status}: ${text.substring(0, 200)}` 
      }), {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const llmJson = await llmRes.json();
    const content: string = llmJson.candidates?.[0]?.content?.parts?.[0]?.text ?? "";

    let parsed: any = null;
    try {
      parsed = JSON.parse(content);
    } catch {
      const match = content.match(/\{[\s\S]*\}/);
      if (match) {
        parsed = JSON.parse(match[0]);
      }
    }

    if (!parsed || !Array.isArray(parsed.cards)) {
      return new Response(JSON.stringify({ error: "Bad LLM response" }), {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    // Save flashcards to database
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: {
        headers: { Authorization: `Bearer ${token}` },
      },
    });

    const { data: flashcardSet, error: setError } = await supabase
      .from("flashcard_sets")
      .insert({
        title: `Flashcards: ${topic.substring(0, 100)}`,
        description: `AI-generated flashcards about ${topic}`,
        topic: topic.substring(0, 200),
        created_by: user.id,
      })
      .select()
      .single();

    if (setError || !flashcardSet) {
      console.error("Error creating flashcard set:", setError);
      return new Response(JSON.stringify({ error: "Failed to save flashcards", details: setError?.message }), {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    // Save cards
    const cardsToInsert = parsed.cards.map((card: any, index: number) => ({
      set_id: flashcardSet.id,
      question: card.question,
      answer: card.answer,
      order_index: index,
    }));

    const { error: cardsError } = await supabase
      .from("flashcards")
      .insert(cardsToInsert);

    if (cardsError) {
      console.error("Error saving flashcards:", cardsError);
      // Still return success with cards, even if DB save failed
    }

    return new Response(JSON.stringify({ 
      cards: parsed.cards, 
      set_id: flashcardSet.id 
    }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (err) {
    console.error(err);
    return new Response(JSON.stringify({ error: "Server error" }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
});
