import { AICourseDetails } from "./ai-service";
import { GoogleGenAI } from "@google/genai";

export async function askCourseTutor(question: string, course: AICourseDetails): Promise<string> {
  const geminiApiKey = import.meta.env.VITE_GEMINI_API_KEY;
  const MODELS = ["gemini-1.5-flash", "gemini-2.0-flash", "gemini-1.5-flash-8b", "gemini-1.5-pro"];
  const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

  if (geminiApiKey) {
    const genAI = new GoogleGenAI({ apiKey: geminiApiKey });
    const MODELS = ["gemini-1.5-flash", "gemini-2.0-flash", "gemini-1.5-pro"];

    for (const modelName of MODELS) {
      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          console.log(`AI Tutor attempting with model: ${modelName} (Attempt ${attempt + 1})`);
          
          // Clean context to reduce tokens as suggested by user
          const miniContext = `Course: ${course.title}. Topic: ${course.topic}. Goal: ${course.learningGoal}`;
          const prompt = `${miniContext}\n\nUser Question: ${question}\n\nProvide a helpful, educational response.`;

          const response = await genAI.models.generateContent({
            model: modelName,
            contents: [{ role: 'user', parts: [{ text: prompt }] }]
          });
          
          if (response.text) {
            return response.text;
          }
        } catch (error: any) {
          const msg = error?.message || "";
          console.warn(`AI Tutor failed with ${modelName}:`, msg);
          
          if (msg.includes("429") || msg.includes("RESOURCE_EXHAUSTED")) {
            console.log("Quota exceeded. Waiting 10s before retry...");
            await sleep(10000);
            continue; 
          }
          
          break; 
        }
      }
    }
  }

  // FALLBACK ALGORITHM
  // Simulate network delay for effect
  await new Promise((resolve) => setTimeout(resolve, 1500));

  const lowerQuestion = question.toLowerCase();

  // Contextual Modules Question
  if (lowerQuestion.includes("module") || lowerQuestion.includes("what will i learn")) {
    const moduleTitles = course.modules.map((m, i) => `${i + 1}. ${m.title}`).join('\n');
    return `This course contains ${course.modules.length} modules tailored to your goals. Here is the breakdown:\n\n${moduleTitles}\n\nWhich module would you like to start with?`;
  }

  // Contextual Lessons Question
  if (lowerQuestion.includes("lesson") || lowerQuestion.includes("first module")) {
    const firstModule = course.modules[0];
    if (firstModule && firstModule.lessons) {
      const lessonTitles = firstModule.lessons.map((l, i) => `- ${l.title} (${l.durationMinutes}m)`).join('\n');
      return `In the first module "${firstModule.title}", you will go through these lessons:\n\n${lessonTitles}\n\nLet me know if you need help with any of these concepts!`;
    }
  }

  // Broad Course Objective Question
  if (lowerQuestion.includes("about") || lowerQuestion.includes("summary")) {
    return `This is a ${course.difficulty}-level course on ${course.topic} designed to take about ${course.duration}. Your main objective is: "${course.learningGoal}". I'm here to ensure you hit that goal!`;
  }

  // Basic keyword matching for more contextual "mock" responses
  if (lowerQuestion.includes("what is") || lowerQuestion.includes("define")) {
    return `Based on "${course.title}", this concept is a fundamental part of ${course.topic}. In simple terms, it's one of the core building blocks we cover in the introductory modules.`;
  }
  
  if (lowerQuestion.includes("how") || lowerQuestion.includes("example")) {
    return `That's a great practical question! In the context of ${course.topic}, you can think of it like this: just as we discussed in the 'Practical Applications' module, you apply this by breaking it down step-by-step.`;
  }

  if (lowerQuestion.includes("why") || lowerQuestion.includes("important")) {
    return `Understanding this is crucial for mastering ${course.topic}. As we established in the course goals (${course.learningGoal}), grasping the "why" allows you to build more advanced skills later on.`;
  }

  if (/\b(hello|hi|hey)\b/i.test(question)) {
    return `Hello! I'm your AI Tutor for the "${course.title}" course. I'm here to help you understand ${course.topic} better. What would you like to know? You can ask me about the modules, the lessons, or specific concepts!`;
  }

  // Default fallback response
  return `That's a very good question regarding ${course.topic}. The course materials dive deeper into this in the advanced modules, but essentially, it relates back to your main learning goal: ${course.learningGoal}. Feel free to ask about specific modules or lessons!`;
}
