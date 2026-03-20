import { GoogleGenAI } from "@google/genai";
import { getUnsplashImage } from "./unsplash";

export interface AIQuizQuestion {
  question: string;
  options: string[];
  correctAnswer: string;
}

export interface AILesson {
  id: string;
  title: string;
  durationMinutes: number;
  explanation?: string;
  keyPoints?: string[];
  practiceQuestion?: string;
  quiz?: AIQuizQuestion[];
  videoId?: string;
}

export type AIResourceType = 'video' | 'article' | 'exercise' | 'quiz';

export interface AIResource {
  id: string;
  title: string;
  type: AIResourceType;
  url?: string;
}

export interface AIModule {
  id: string;
  title: string;
  description: string;
  content: string;
  durationMinutes: number;
  lessons: AILesson[];
  resources: AIResource[];
}

export interface AICourseDetails {
  title: string;
  description: string;
  topic: string;
  difficulty: string;
  duration: string;
  learningGoal: string;
  modules: AIModule[];
  thumbnailUrl?: string;
  tags?: string[];
}

// Language code mapping for YouTube API
const LANG_CODES: Record<string, string> = {
  "English": "en", "Hindi": "hi", "Spanish": "es", "French": "fr",
  "German": "de", "Japanese": "ja", "Korean": "ko", "Chinese": "zh",
  "Arabic": "ar", "Portuguese": "pt", "Russian": "ru", "Tamil": "ta",
  "Telugu": "te", "Bengali": "bn", "Marathi": "mr", "Gujarati": "gu",
  "Kannada": "kn", "Malayalam": "ml", "Punjabi": "pa", "Urdu": "ur",
};

// Helper to fetch the BEST YouTube video by relevance + view count
// Returns videoId and actual duration in minutes
async function fetchYouTubeVideoId(query: string, language: string = "English"): Promise<{ videoId: string; durationMins: number } | undefined> {
  try {
    const apiKey = import.meta.env.VITE_YOUTUBE_API_KEY;
    if (!apiKey) return undefined;

    const langCode = LANG_CODES[language] || "en";

    // Step 1: Search for top 5 relevant educational videos in the chosen language
    const searchRes = await fetch(
      `https://www.googleapis.com/youtube/v3/search?part=snippet&q=${encodeURIComponent(query + ' tutorial ' + language)}&type=video&order=relevance&videoDuration=medium&relevanceLanguage=${langCode}&maxResults=5&key=${apiKey}`
    );
    const searchData = await searchRes.json();
    const items = searchData.items || [];
    if (items.length === 0) return undefined;

    const videoIds = items.map((item: any) => item.id?.videoId).filter(Boolean);
    if (videoIds.length === 0) return undefined;

    // Step 2: Get view counts AND duration for these videos
    const statsRes = await fetch(
      `https://www.googleapis.com/youtube/v3/videos?part=statistics,contentDetails&id=${videoIds.join(',')}&key=${apiKey}`
    );
    const statsData = await statsRes.json();
    const statsItems = statsData.items || [];

    // Pick the video with the most views (proxy for quality/rating)
    let bestVideoId = videoIds[0];
    let bestViews = 0;
    let bestDuration = 0;

    for (const stat of statsItems) {
      const views = parseInt(stat.statistics?.viewCount || '0', 10);
      if (views > bestViews) {
        bestViews = views;
        bestVideoId = stat.id;
        // Parse ISO 8601 duration (PT19M27S → 19.45 mins)
        bestDuration = parseISO8601Duration(stat.contentDetails?.duration || '');
      }
    }

    return { videoId: bestVideoId, durationMins: bestDuration || 10 };
  } catch (error) {
    console.error("YouTube fetch error:", error);
    return undefined;
  }
}

// Parse ISO 8601 duration (PT1H2M30S) → minutes
function parseISO8601Duration(iso: string): number {
  const match = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return 0;
  const hours = parseInt(match[1] || '0', 10);
  const mins = parseInt(match[2] || '0', 10);
  const secs = parseInt(match[3] || '0', 10);
  return Math.ceil(hours * 60 + mins + secs / 60);
}

// Generate thumbnail URL: Unsplash API (primary) → Picsum Photos (fallback)
async function generateThumbnailUrl(topic: string, courseTitle: string): Promise<string> {
  // Try Unsplash first (topic-relevant, high quality)
  const unsplashUrl = await getUnsplashImage(topic);
  if (unsplashUrl) return unsplashUrl;

  // Fallback to Picsum (deterministic, always works)
  const seed = `${topic}-${courseTitle}`.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 60);
  return `https://picsum.photos/seed/${seed}/800/400`;
}

// Extract topic tags from course content
function generateTags(topic: string, modules: any[]): string[] {
  const tags = new Set<string>();
  // Add the main topic as tags (split multi-word topics)
  topic.toLowerCase().split(/[\s,&]+/).forEach(t => {
    if (t.length > 2) tags.add(t);
  });
  // Add module titles as tags
  modules.forEach(m => {
    if (m.title) {
      m.title.toLowerCase().split(/[\s,&]+/).forEach((w: string) => {
        if (w.length > 3) tags.add(w);
      });
    }
  });
  return Array.from(tags).slice(0, 8);
}

export const generateCourseWithAI = async (
  topic: string,
  difficulty: string,
  duration: string,
  learningGoal: string,
  onProgress?: (step: string) => void,
  language: string = "English"
): Promise<AICourseDetails> => {
  const geminiApiKey = import.meta.env.VITE_GEMINI_API_KEY;
  
  // Try Live Gemini Generation first
  if (geminiApiKey) {
    try {
      if (onProgress) onProgress("Initializing AI connection...");
      const ai = new GoogleGenAI({ apiKey: geminiApiKey });

      if (onProgress) onProgress("Drafting syllabus structure via Gemini...");
      const prompt = `
Generate a structured educational course in JSON format.

Topic: ${topic}
Difficulty: ${difficulty}
Duration: ${duration}
Goal: ${learningGoal}
Language: ${language}

IMPORTANT: Generate ALL content (title, descriptions, explanations, questions, key points) in ${language} language.
However, for each lesson you MUST also include a "youtubeSearchQuery" field which is an ENGLISH search query suitable for finding a relevant educational YouTube video for that specific lesson. This should describe the lesson topic clearly in English.

Return JSON strictly matching this structure:
{
  "title": "Course Title in ${language}",
  "description": "Short description in ${language}.",
  "modules": [
    {
      "title": "Module Title in ${language}",
      "description": "Short module description in ${language}.",
      "content": "A brief intro paragraph in ${language}.",
      "durationMinutes": 60,
      "lessons": [
        {
          "title": "Lesson Title in ${language}",
          "youtubeSearchQuery": "English search query for finding YouTube tutorial video about this lesson topic",
          "durationMinutes": 15,
          "explanation": "Detailed explanation in ${language}.",
          "keyPoints": ["Point 1 in ${language}", "Point 2", "Point 3"],
          "practiceQuestion": "A question in ${language}.",
          "quiz": [
             {
               "question": "A multiple choice question in ${language}?",
               "options": ["Option A", "Option B", "Option C", "Option D"],
               "correctAnswer": "Option B"
             }
          ]
        }
      ]
    }
  ]
}

The youtubeSearchQuery MUST always be in English regardless of the course language. Example: if the lesson is about Python variables in Hindi, the youtubeSearchQuery should be "Python variables tutorial for beginners".
All other text content must be in ${language}. Explanations should be rich and self-contained. Ensure the output is ONLY valid JSON.`;

      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
        config: {
            responseMimeType: "application/json",
        }
      });
      
      const rawText = response.text || "{}";
      const courseData = JSON.parse(rawText);

      // Post-Processing: Add UUIDs, Resources, and YouTube videos
      if (onProgress) onProgress("Curating multimedia resources...");
      
      const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
      const processedModules: AIModule[] = [];

      for (const mod of (courseData.modules || [])) {
        const processedLessons: AILesson[] = [];
        
        for (const lesson of (mod.lessons || [])) {
          let videoId;
          let videoDurationMins = 0;
          try {
            // Use the English youtubeSearchQuery from Gemini (not the translated title)
            const searchQuery = lesson.youtubeSearchQuery || `${topic} ${lesson.title}`;
            const result = await fetchYouTubeVideoId(searchQuery, language);
            if (result) {
              videoId = result.videoId;
              videoDurationMins = result.durationMins;
            }
            // Wait a bit so YouTube doesn't rate limit you too
            await sleep(150); 
          } catch (e) {
            console.warn("Skipping video fetch due to rate limiting");
          }

          // Calculate reading time: ~200 words per minute
          const explanationText = lesson.explanation || '';
          const wordCount = explanationText.split(/\s+/).length;
          const readingMins = Math.ceil(wordCount / 200);

          // Total lesson time = video duration + reading time (minimum 5 min)
          const totalMins = Math.max(5, videoDurationMins + readingMins);

          processedLessons.push({
            id: crypto.randomUUID(),
            title: lesson.title || "Untitled Lesson",
            durationMinutes: totalMins,
            explanation: lesson.explanation || "Content missing.",
            keyPoints: lesson.keyPoints || [],
            practiceQuestion: lesson.practiceQuestion || "Reflect on this concept.",
            quiz: lesson.quiz || [],
            videoId
          });
        }
        
        // Module duration = sum of its lessons
        const moduleDuration = processedLessons.reduce((sum, l) => sum + l.durationMinutes, 0);

        processedModules.push({
          id: crypto.randomUUID(),
          title: mod.title || "Untitled Module",
          description: mod.description || "Module description missing.",
          durationMinutes: moduleDuration,
          content: mod.content || "Module content block.",
          lessons: processedLessons,
          resources: [] // Kept for backwards compatibility if needed, but no external links generated
        });
      }

      if (onProgress) onProgress("Finalizing course layout...");

      const courseTitle = courseData.title || `Mastering ${topic}: A ${difficulty} Guide`;
      if (onProgress) onProgress("Fetching course thumbnail...");
      const thumbnailUrl = await generateThumbnailUrl(topic, courseTitle);
      const tags = generateTags(topic, courseData.modules || []);
      
      return {
        title: courseTitle,
        description: courseData.description || `A comprehensive ${duration} course designed to help you achieve: ${learningGoal}.`,
        topic,
        difficulty,
        duration,
        learningGoal,
        modules: processedModules,
        thumbnailUrl,
        tags
      };

    } catch (error) {
       console.error("Live AI Generation Failed, falling back to mock:", error);
       if (onProgress) onProgress("Live API limit reached. Using dynamic fallback engine...");
       await new Promise((resolve) => setTimeout(resolve, 800));
    }
  }

  // FALLBACK: Deterministic mock Data (runs if no API key or API fails)
  if (onProgress) onProgress("Designing modules and lesson plans...");
  await new Promise((resolve) => setTimeout(resolve, 800));
  
  if (onProgress) onProgress("Drafting syllabus structure...");
  await new Promise((resolve) => setTimeout(resolve, 800));

  if (onProgress) onProgress("Designing modules and lesson plans...");
  await new Promise((resolve) => setTimeout(resolve, 1000));

  if (onProgress) onProgress("Gathering relevant resources and quizzes...");
  await new Promise((resolve) => setTimeout(resolve, 800));

  if (onProgress) onProgress("Finalizing course layout...");
  await new Promise((resolve) => setTimeout(resolve, 500));

  // Generate deterministic but dynamic-looking mock data based on input
  const mockTitle = `Mastering ${topic}: A ${difficulty} Guide`;
  const thumbnailUrl = await generateThumbnailUrl(topic, mockTitle);
  const tags = generateTags(topic, []);

  return {
    title: mockTitle,
    description: `A comprehensive ${duration} course designed to help you achieve: ${learningGoal}. This course breaks down complex topics into easy-to-digest modules with interactive lessons and varied resources to match your learning style.`,
    topic,
    difficulty,
    duration,
    learningGoal,
    thumbnailUrl,
    tags,
    modules: [
      {
        id: crypto.randomUUID(),
        title: `Introduction to ${topic}`,
        description: `Understanding the fundamental concepts, history, and why this matters.`,
        content: `Welcome to the first module of ${topic}. Here we will explore the basic building blocks and why it is so important in today's world...`,
        durationMinutes: 45,
        lessons: [
           {
              id: crypto.randomUUID(),
              title: `What is ${topic}?`,
              durationMinutes: 15,
              explanation: `An introductory overview of ${topic}, discussing its origins, core definition, and primary use cases in modern environments.`,
              keyPoints: ["Definition", "Origin", "Primary use case"],
              practiceQuestion: "In your own words, how would you define this topic to a beginner?",
              quiz: [
                { question: `What is the primary focus of ${topic}?`, options: ["The core concepts", "Unrelated history", "Advanced math", "Nothing"], correctAnswer: "The core concepts" }
              ]
           },
           {
              id: crypto.randomUUID(),
              title: "History and Evolution",
              durationMinutes: 20,
              explanation: "Exploring how this field has evolved over the past decade, highlighting major milestones and paradigm shifts.",
              keyPoints: ["Early beginnings", "Major milestones", "Current state"],
              practiceQuestion: "What do you think is the most significant milestone mentioned?",
              quiz: [
                { question: "How has this field changed recently?", options: ["It hasn't", "Rapid evolution", "Declined", "Paused"], correctAnswer: "Rapid evolution" }
              ]
           },
           {
              id: crypto.randomUUID(),
              title: "Key Terminology",
              durationMinutes: 10,
              explanation: "A breakdown of the essential vocabulary you need to master this topic.",
              keyPoints: ["Jargon 1", "Jargon 2", "Jargon 3"],
              practiceQuestion: "Write a sentence using at least two of the key terms.",
              quiz: [
                 { question: "Why is terminology important?", options: ["It sounds smart", "Clear communication", "To confuse people", "It is not"], correctAnswer: "Clear communication" }
              ]
           }
        ],
        resources: []
      },
      {
        id: crypto.randomUUID(),
        title: `Core Principles & Mechanics`,
        description: `Deep dive into the how and why behind ${topic}.`,
        content: `Now that we understand the basics, let's look at the underlying mechanics. The core principles revolve around...`,
        durationMinutes: 60,
        lessons: [
           {
              id: crypto.randomUUID(),
              title: "The 3 Pillars of the Topic",
              durationMinutes: 25,
              explanation: "Analyzing the foundational pillars that uphold these concepts.",
              keyPoints: ["Pillar 1", "Pillar 2", "Pillar 3"],
              practiceQuestion: "Which pillar do you find most interesting?",
              quiz: [{ question: "How many pillars are there?", options: ["1", "2", "3", "4"], correctAnswer: "3" }]
           },
           {
              id: crypto.randomUUID(),
              title: "How it works behind the scenes",
              durationMinutes: 20,
              explanation: "Looking under the hood to see the internal mechanisms and processes.",
              keyPoints: ["Internal logic", "Data flow", "State management"],
              practiceQuestion: "Draw a simple diagram of the internal process.",
              quiz: [{ question: "What does looking under the hood mean here?", options: ["Car repair", "Understanding internals", "Hiding", "Nothing"], correctAnswer: "Understanding internals" }]
           },
           {
              id: crypto.randomUUID(),
              title: "Common Misconceptions",
              durationMinutes: 15,
              explanation: "Addressing and debunking the most frequent misunderstandings.",
              keyPoints: ["Myth 1", "Truth 1", "Myth 2", "Truth 2"],
              practiceQuestion: "Did you hold any of these misconceptions before today?",
              quiz: [{ question: "Why address misconceptions?", options: ["To argue", "To clarify truth", "To confuse", "To waste time"], correctAnswer: "To clarify truth" }]
           }
        ],
        resources: []
      },
      {
        id: crypto.randomUUID(),
        title: `Practical Applications & Examples`,
        description: `Applying what you've learned to real-world scenarios.`,
        content: `Theory is great, but practice is better. In this module, we will run through 3 specific examples where ${topic} is used.`,
        durationMinutes: 90,
        lessons: [
           {
              id: crypto.randomUUID(),
              title: "Case Study 1: Industry Application",
              durationMinutes: 30,
              explanation: "Reviewing how a major corporation implemented these features to increase efficiency.",
              keyPoints: ["The Problem", "The Solution", "The Result"],
              practiceQuestion: "How could this apply to your own projects?",
              quiz: [{ question: "What did the corporation achieve?", options: ["Bankruptcy", "Efficiency", "Nothing", "More problems"], correctAnswer: "Efficiency" }]
           },
           {
              id: crypto.randomUUID(),
              title: "Case Study 2: Daily Life",
              durationMinutes: 25,
              explanation: "Seeing how these concepts impact our day-to-day routines without us realizing.",
              keyPoints: ["Hidden impacts", "User experience", "Subtle design"],
              practiceQuestion: "Can you spot another example in your daily life?",
              quiz: [{ question: "Does this topic impact daily life?", options: ["Yes, often subtly", "No, never", "Only for experts", "Only on weekends"], correctAnswer: "Yes, often subtly" }]
           },
           {
              id: crypto.randomUUID(),
              title: "Hands-on Exercise Setup",
              durationMinutes: 35,
              explanation: "Preparing your local environment to start building.",
              keyPoints: ["Installations", "Configuration", "First run"],
              practiceQuestion: "Were there any issues during your setup process?",
              quiz: [{ question: "What is the goal of this lesson?", options: ["Reading", "Sleeping", "Environment setup", "Eating"], correctAnswer: "Environment setup" }]
           }
        ],
        resources: []
      },
      {
        id: crypto.randomUUID(),
        title: `Next Steps and Advanced Concepts`,
        description: `What to learn next to truly master ${topic}.`,
        content: `You've built a solid foundation. To continue your journey in ${topic}, consider exploring these advanced topics...`,
        durationMinutes: 40,
        lessons: [
          { id: crypto.randomUUID(), title: "Advanced Techniques", durationMinutes: 25 },
          { id: crypto.randomUUID(), title: "Where to go from here", durationMinutes: 15 },
        ],
        resources: [
          { 
            id: crypto.randomUUID(), 
            title: "Final Assessment", 
            type: 'quiz',
            url: `/learning-style-quiz`
          },
          { 
            id: crypto.randomUUID(), 
            title: "Further Reading List", 
            type: 'article',
            url: `https://www.google.com/search?q=best+books+and+resources+to+learn+advanced+${encodeURIComponent(topic)}`
          },
        ]
      },
    ],
  };
};
