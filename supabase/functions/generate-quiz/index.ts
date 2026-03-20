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

    const { topic, numQuestions = 5 } = await req.json();

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

    const prompt = `You are a quiz generator. Create ${numQuestions} multiple-choice questions for the topic: "${topic}".

Each question should have exactly 4 options (A, B, C, D) and one correct answer.

Return ONLY strict JSON in this exact format (no backticks, no explanation):
{
  "questions": [
    {
      "question": "What is the question?",
      "options": ["Option A", "Option B", "Option C", "Option D"],
      "correctAnswer": "Option A"
    }
  ]
}

IMPORTANT: The correctAnswer must exactly match one of the options in the options array.`;

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

    if (!parsed || !Array.isArray(parsed.questions)) {
      return new Response(JSON.stringify({ error: "Bad LLM response" }), {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    // Save quiz to database
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: {
        headers: { Authorization: `Bearer ${token}` },
      },
    });

    const { data: quizSet, error: quizSetError } = await supabase
      .from("quiz_sets")
      .insert({
        title: `Quiz: ${topic.substring(0, 100)}`,
        description: `AI-generated quiz about ${topic}`,
        topic: topic.substring(0, 200),
        created_by: user.id,
      })
      .select()
      .single();

    if (quizSetError || !quizSet) {
      console.error("Error creating quiz set:", quizSetError);
      return new Response(JSON.stringify({ error: "Failed to save quiz", details: quizSetError?.message }), {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    // Save questions
    const questionsToInsert = parsed.questions.map((q: any, index: number) => ({
      quiz_id: quizSet.id,
      question: q.question,
      options: q.options,
      correct_answer: q.correctAnswer,
      order_index: index,
    }));

    const { error: questionsError } = await supabase
      .from("quiz_questions")
      .insert(questionsToInsert);

    if (questionsError) {
      console.error("Error saving questions:", questionsError);
      // Still return success with questions, even if DB save failed
    }

    return new Response(JSON.stringify({ 
      questions: parsed.questions, 
      quiz_id: quizSet.id 
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
