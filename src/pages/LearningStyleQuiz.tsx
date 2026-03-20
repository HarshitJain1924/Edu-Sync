import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Brain, ArrowLeft, CheckCircle2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Progress } from "@/components/ui/progress";

interface Question {
  id: number;
  question: string;
  options: {
    text: string;
    type: 'visual' | 'auditory' | 'kinesthetic' | 'reading_writing';
  }[];
}

const learningStyleQuestions: Question[] = [
  {
    id: 1,
    question: "When learning something new, I prefer to:",
    options: [
      { text: "Watch videos or look at diagrams", type: "visual" },
      { text: "Listen to explanations or discussions", type: "auditory" },
      { text: "Try it out hands-on", type: "kinesthetic" },
      { text: "Read instructions or articles", type: "reading_writing" }
    ]
  },
  {
    id: 2,
    question: "I remember information best when:",
    options: [
      { text: "I see pictures or charts", type: "visual" },
      { text: "I hear someone explain it", type: "auditory" },
      { text: "I practice doing it", type: "kinesthetic" },
      { text: "I take notes or write about it", type: "reading_writing" }
    ]
  },
  {
    id: 3,
    question: "In a classroom, I prefer:",
    options: [
      { text: "Visual presentations with slides", type: "visual" },
      { text: "Lectures and group discussions", type: "auditory" },
      { text: "Lab work and experiments", type: "kinesthetic" },
      { text: "Reading textbooks and written materials", type: "reading_writing" }
    ]
  },
  {
    id: 4,
    question: "When studying for an exam, I:",
    options: [
      { text: "Use colorful notes and mind maps", type: "visual" },
      { text: "Record myself and listen back", type: "auditory" },
      { text: "Create flashcards and move around", type: "kinesthetic" },
      { text: "Write summaries and essays", type: "reading_writing" }
    ]
  },
  {
    id: 5,
    question: "I understand concepts better through:",
    options: [
      { text: "Graphs, charts, and images", type: "visual" },
      { text: "Verbal explanations", type: "auditory" },
      { text: "Physical activities and demonstrations", type: "kinesthetic" },
      { text: "Reading detailed descriptions", type: "reading_writing" }
    ]
  },
  {
    id: 6,
    question: "When following directions, I prefer:",
    options: [
      { text: "Looking at a map or diagram", type: "visual" },
      { text: "Having someone tell me the way", type: "auditory" },
      { text: "Walking through it myself", type: "kinesthetic" },
      { text: "Written step-by-step instructions", type: "reading_writing" }
    ]
  },
  {
    id: 7,
    question: "I concentrate best when:",
    options: [
      { text: "My workspace is visually organized", type: "visual" },
      { text: "I can listen to music or ambient sounds", type: "auditory" },
      { text: "I can move around or use a fidget", type: "kinesthetic" },
      { text: "I have clear written objectives", type: "reading_writing" }
    ]
  },
  {
    id: 8,
    question: "When solving a problem, I tend to:",
    options: [
      { text: "Visualize the solution in my mind", type: "visual" },
      { text: "Talk it through out loud", type: "auditory" },
      { text: "Work with physical models or examples", type: "kinesthetic" },
      { text: "Write down pros and cons", type: "reading_writing" }
    ]
  },
  {
    id: 9,
    question: "I prefer teachers who:",
    options: [
      { text: "Use plenty of visual aids", type: "visual" },
      { text: "Explain things verbally", type: "auditory" },
      { text: "Include hands-on activities", type: "kinesthetic" },
      { text: "Provide reading materials", type: "reading_writing" }
    ]
  },
  {
    id: 10,
    question: "When remembering a phone number, I:",
    options: [
      { text: "Picture it written down", type: "visual" },
      { text: "Say it out loud repeatedly", type: "auditory" },
      { text: "Type it out with my fingers", type: "kinesthetic" },
      { text: "Write it down immediately", type: "reading_writing" }
    ]
  }
];

export default function LearningStyleQuiz() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [showResults, setShowResults] = useState(false);
  const [results, setResults] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const handleAnswer = (questionId: number, answerType: string) => {
    setAnswers({ ...answers, [questionId]: answerType });
  };

  const handleNext = () => {
    console.log("handleNext called");
    console.log("Current question:", currentQuestion);
    console.log("Total questions:", learningStyleQuestions.length);
    console.log("Current answer:", answers[learningStyleQuestions[currentQuestion].id]);
    
    if (currentQuestion < learningStyleQuestions.length - 1) {
      console.log("Moving to next question");
      setCurrentQuestion(currentQuestion + 1);
    } else {
      console.log("Last question reached, checking answers");
      // Validate all questions are answered before calculating
      const answeredCount = Object.keys(answers).length;
      console.log("Answered questions:", answeredCount, "of", learningStyleQuestions.length);
      
      if (answeredCount < learningStyleQuestions.length) {
        console.log("Not all questions answered");
        toast({
          title: "Incomplete Quiz",
          description: "Please answer all questions before viewing results.",
          variant: "destructive"
        });
        return;
      }
      console.log("All questions answered, calculating results");
      calculateResults();
    }
  };

  const handlePrevious = () => {
    if (currentQuestion > 0) {
      setCurrentQuestion(currentQuestion - 1);
    }
  };

  const calculateResults = async () => {
    setLoading(true);
    
    console.log("Starting calculateResults");
    console.log("All answers:", answers);
    console.log("Number of answers:", Object.keys(answers).length);
    
    const scores = {
      visual: 0,
      auditory: 0,
      kinesthetic: 0,
      reading_writing: 0
    };

    Object.values(answers).forEach((answer) => {
      scores[answer as keyof typeof scores]++;
    });

    console.log("Calculated scores:", scores);

    const sortedStyles = Object.entries(scores)
      .sort(([, a], [, b]) => b - a)
      .map(([style]) => style);

    const primaryStyle = sortedStyles[0];
    const secondaryStyle = sortedStyles[1];

    console.log("Primary style:", primaryStyle);
    console.log("Secondary style:", secondaryStyle);

    const resultData = {
      primary_style: primaryStyle,
      secondary_style: secondaryStyle,
      visual_score: scores.visual,
      auditory_score: scores.auditory,
      kinesthetic_score: scores.kinesthetic,
      reading_writing_score: scores.reading_writing,
      scores
    };

    console.log("Result data prepared:", resultData);

    // Save to database BEFORE showing results
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error("User not authenticated");
      }

      console.log("Saving learning style for user:", user.id);
      console.log("Data to save:", {
        user_id: user.id,
        primary_style: primaryStyle,
        secondary_style: secondaryStyle,
        visual_score: scores.visual,
        auditory_score: scores.auditory,
        kinesthetic_score: scores.kinesthetic,
        reading_writing_score: scores.reading_writing
      });

      const { data, error } = await supabase
        .from('learning_styles')
        .upsert({
          user_id: user.id,
          primary_style: primaryStyle,
          secondary_style: secondaryStyle,
          visual_score: scores.visual,
          auditory_score: scores.auditory,
          kinesthetic_score: scores.kinesthetic,
          reading_writing_score: scores.reading_writing,
          quiz_answers: answers,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'user_id'
        })
        .select();

      if (error) {
        console.error("Database error:", error);
        throw error;
      }

      console.log("Successfully saved:", data);

      toast({
        title: "Success!",
        description: "Your learning style has been saved.",
      });

      // Show results only after successful save
      console.log("Setting results state:", resultData);
      setResults(resultData);
      console.log("Setting showResults to true");
      setShowResults(true);
    } catch (error: any) {
      console.error('Error saving learning style:', error);
      toast({
        title: "Error",
        description: error?.message || "Failed to save your learning style. Please try again.",
        variant: "destructive"
      });
      
      // Still show results even if save failed
      console.log("Error occurred, still showing results");
      setResults(resultData);
      setShowResults(true);
    } finally {
      console.log("Setting loading to false");
      setLoading(false);
    }
  };

  const getStyleDescription = (style: string) => {
    const descriptions = {
      visual: {
        title: "Visual Learner",
        description: "You learn best through seeing. Visual aids like diagrams, charts, and videos help you understand and remember information.",
        tips: [
          "Use color-coded notes and highlighters",
          "Create mind maps and diagrams",
          "Watch educational videos",
          "Use flashcards with images"
        ]
      },
      auditory: {
        title: "Auditory Learner",
        description: "You learn best through listening. Lectures, discussions, and audio materials are most effective for you.",
        tips: [
          "Record lectures and listen back",
          "Participate in group discussions",
          "Read your notes aloud",
          "Use mnemonic devices and rhymes"
        ]
      },
      kinesthetic: {
        title: "Kinesthetic Learner",
        description: "You learn best through doing and movement. Hands-on activities and practical experiences help you retain information.",
        tips: [
          "Take frequent breaks and move around",
          "Use physical objects and models",
          "Practice with real-world applications",
          "Study in short, active sessions"
        ]
      },
      reading_writing: {
        title: "Reading/Writing Learner",
        description: "You learn best through words. Reading and writing are your preferred methods of learning and expressing knowledge.",
        tips: [
          "Take detailed written notes",
          "Write summaries and essays",
          "Create lists and outlines",
          "Read extensively on topics"
        ]
      }
    };
    return descriptions[style as keyof typeof descriptions];
  };

  const progress = ((currentQuestion + 1) / learningStyleQuestions.length) * 100;

  console.log("Render - showResults:", showResults, "results:", results);

  if (showResults && results) {
    console.log("Rendering results page");
    const primaryStyleInfo = getStyleDescription(results.primary_style);
    const secondaryStyleInfo = getStyleDescription(results.secondary_style);

    console.log("Primary style info:", primaryStyleInfo);
    console.log("Secondary style info:", secondaryStyleInfo);

    if (!primaryStyleInfo || !secondaryStyleInfo) {
      console.log("Missing style info, showing error");
      return (
        <div className="min-h-screen bg-background p-8">
          <div className="max-w-4xl mx-auto">
            <Card>
              <CardContent className="p-8 text-center">
                <p className="text-red-500">Error displaying results. Please try again.</p>
                <Button onClick={() => { setShowResults(false); setCurrentQuestion(0); setAnswers({}); }} className="mt-4">
                  Retake Quiz
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      );
    }

    return (
      <div className="min-h-screen bg-background p-8">
        <div className="max-w-4xl mx-auto">
          <Button variant="outline" className="mb-6" onClick={() => navigate("/dashboard")}>
            <ArrowLeft className="mr-2 h-5 w-5" />Back to Dashboard
          </Button>

          <Card className="mb-6">
            <CardHeader className="text-center">
              <div className="mx-auto w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mb-4">
                <CheckCircle2 className="h-8 w-8 text-primary" />
              </div>
              <CardTitle className="text-3xl">Your Learning Style Profile</CardTitle>
              <CardDescription>Understanding how you learn best</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Primary Learning Style */}
              <div className="p-6 bg-primary/5 rounded-lg border-2 border-primary">
                <h3 className="text-xl font-bold mb-2">Primary: {primaryStyleInfo.title}</h3>
                <p className="text-muted-foreground mb-4">{primaryStyleInfo.description}</p>
                <div className="space-y-2">
                  <h4 className="font-semibold">Study Tips:</h4>
                  <ul className="list-disc list-inside space-y-1 text-sm">
                    {primaryStyleInfo.tips.map((tip, index) => (
                      <li key={index}>{tip}</li>
                    ))}
                  </ul>
                </div>
              </div>

              {/* Secondary Learning Style */}
              <div className="p-6 bg-muted rounded-lg border">
                <h3 className="text-lg font-bold mb-2">Secondary: {secondaryStyleInfo.title}</h3>
                <p className="text-sm text-muted-foreground mb-3">{secondaryStyleInfo.description}</p>
              </div>

              {/* Score Breakdown */}
              <div className="space-y-4">
                <h3 className="text-lg font-bold">Score Breakdown</h3>
                {Object.entries(results.scores).map(([style, score]) => {
                  const styleInfo = getStyleDescription(style);
                  const scoreValue = score as number;
                  const percentage = (scoreValue / learningStyleQuestions.length) * 100;
                  return (
                    <div key={style}>
                      <div className="flex justify-between mb-2">
                        <span className="text-sm font-medium">{styleInfo.title}</span>
                        <span className="text-sm text-primary font-semibold">{scoreValue}/{learningStyleQuestions.length}</span>
                      </div>
                      <Progress value={percentage} className="h-2" />
                    </div>
                  );
                })}
              </div>

              <div className="flex gap-4 pt-4">
                <Button onClick={() => { setShowResults(false); setCurrentQuestion(0); setAnswers({}); }} className="flex-1">
                  Retake Quiz
                </Button>
                <Button variant="outline" onClick={() => navigate("/dashboard")} className="flex-1">
                  Back to Dashboard
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  const question = learningStyleQuestions[currentQuestion];
  const currentAnswer = answers[question.id] || "";

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-3xl mx-auto">
        <Button variant="outline" className="mb-6" onClick={() => navigate("/dashboard")}>
          <ArrowLeft className="mr-2 h-5 w-5" />Back
        </Button>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-3 mb-4">
              <Brain className="h-8 w-8 text-primary" />
              <div>
                <CardTitle>Learning Style Assessment</CardTitle>
                <CardDescription>Discover how you learn best</CardDescription>
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Question {currentQuestion + 1} of {learningStyleQuestions.length}</span>
                <span className="text-primary font-semibold">{Math.round(progress)}%</span>
              </div>
              <Progress value={progress} />
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            <div>
              <h3 className="text-lg font-semibold mb-4">{question.question}</h3>
              <RadioGroup value={currentAnswer || ""} onValueChange={(value) => handleAnswer(question.id, value)}>
                <div className="space-y-3">
                  {question.options.map((option, index) => (
                    <div key={index} className="flex items-center space-x-3 p-4 rounded-lg border hover:bg-muted cursor-pointer transition-colors">
                      <RadioGroupItem value={option.type} id={`q${question.id}-${index}`} />
                      <Label htmlFor={`q${question.id}-${index}`} className="cursor-pointer flex-1">
                        {option.text}
                      </Label>
                    </div>
                  ))}
                </div>
              </RadioGroup>
            </div>

            <div className="flex justify-between pt-4">
              <Button
                variant="outline"
                onClick={handlePrevious}
                disabled={currentQuestion === 0 || loading}
              >
                Previous
              </Button>
              <Button
                onClick={handleNext}
                disabled={!currentAnswer || currentAnswer === "" || loading}
              >
                {loading ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Processing...
                  </>
                ) : currentQuestion === learningStyleQuestions.length - 1 ? (
                  "View Results"
                ) : (
                  "Next"
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
