import { GoogleGenAI } from "@google/genai";

export interface CourseRecommendation {
  title: string;
  description: string;
}

/**
 * Uses Gemini to recommend next courses based on what the student has already completed.
 * Falls back to simple topic-based suggestions if AI is unavailable.
 */
export async function getAIRecommendations(
  completedTopics: string[]
): Promise<CourseRecommendation[]> {
  const geminiApiKey = import.meta.env.VITE_GEMINI_API_KEY;

  if (geminiApiKey && completedTopics.length > 0) {
    try {
      const ai = new GoogleGenAI({ apiKey: geminiApiKey });

      const prompt = `The student has completed courses on the following topics:

${completedTopics.join(", ")}

Recommend exactly 3 next learning topics that logically follow these skills.

Return ONLY a JSON array with objects containing "title" and "description". Example:
[
  { "title": "Advanced React Patterns", "description": "Build on your React knowledge with render props, compound components, and hooks patterns." }
]

Keep descriptions under 30 words. Return ONLY valid JSON.`;

      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
        config: {
          responseMimeType: "application/json",
        }
      });

      const text = response.text || "[]";
      const recommendations = JSON.parse(text);

      if (Array.isArray(recommendations) && recommendations.length > 0) {
        return recommendations.slice(0, 3);
      }
    } catch (error) {
      console.error("AI Recommendation failed, using fallback:", error);
    }
  }

  // FALLBACK: Generate simple recommendations based on completed topics
  return generateFallbackRecommendations(completedTopics);
}

function generateFallbackRecommendations(
  completedTopics: string[]
): CourseRecommendation[] {
  const topicMap: Record<string, CourseRecommendation[]> = {
    default: [
      { title: "Introduction to Web Development", description: "Learn HTML, CSS, and JavaScript from scratch." },
      { title: "Data Science Fundamentals", description: "Explore data analysis, visualization, and basic statistics." },
      { title: "Digital Marketing Essentials", description: "Master SEO, social media, and content strategy." },
    ],
    react: [
      { title: "Next.js Full-Stack Development", description: "Build server-rendered React apps with API routes." },
      { title: "React Native Mobile Apps", description: "Create cross-platform mobile apps using React Native." },
      { title: "Advanced State Management", description: "Master Redux Toolkit, Zustand, and React Query." },
    ],
    python: [
      { title: "Machine Learning with Python", description: "Build ML models using scikit-learn and TensorFlow." },
      { title: "Django Web Framework", description: "Create full-stack web applications with Django." },
      { title: "Data Engineering with Python", description: "ETL pipelines, pandas, and database integration." },
    ],
    javascript: [
      { title: "TypeScript Mastery", description: "Add type safety to your JavaScript projects." },
      { title: "Node.js Backend Development", description: "Build REST APIs and real-time servers with Node." },
      { title: "Testing JavaScript Applications", description: "Unit, integration, and E2E testing with Jest and Cypress." },
    ],
  };

  // Try to match a topic keyword
  const lowerTopics = completedTopics.map(t => t.toLowerCase()).join(" ");
  for (const [key, recs] of Object.entries(topicMap)) {
    if (key !== "default" && lowerTopics.includes(key)) {
      return recs;
    }
  }

  return topicMap.default;
}
