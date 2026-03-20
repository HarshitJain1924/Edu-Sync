import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Brain, ChevronLeft, ChevronRight, RotateCw, CheckCircle2, XCircle, Heart, Shuffle, Home, Trash2, Sparkles } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

interface Flashcard {
  id: string;
  question: string;
  answer: string;
  order_index: number;
}

interface FlashcardSet {
  id: string;
  title: string;
  description: string | null;
  topic: string;
}

type CardStatus = 'unknown' | 'learning' | 'mastered';

const Flashcards = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [flashcardSets, setFlashcardSets] = useState<FlashcardSet[]>([]);
  const [selectedSet, setSelectedSet] = useState<FlashcardSet | null>(null);
  const [flashcards, setFlashcards] = useState<Flashcard[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [cardStatuses, setCardStatuses] = useState<Map<number, CardStatus>>(new Map());
  const [favorites, setFavorites] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(true);
  const [newQuestion, setNewQuestion] = useState("");
  const [newAnswer, setNewAnswer] = useState("");
  const [isTeacher, setIsTeacher] = useState(false);
  const [aiTopic, setAiTopic] = useState("");
  const [aiLoading, setAiLoading] = useState(false);

  useEffect(() => {
    fetchFlashcardSets();
  }, []);

  useEffect(() => {
    const checkRole = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          setIsTeacher(false);
          return;
        }

        const { data: roles, error } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", user.id);

        if (error || !roles) {
          setIsTeacher(false);
          return;
        }

        const hasTeacher = roles.some((r: any) => r.role === "teacher" || r.role === "admin");
        setIsTeacher(hasTeacher);
      } catch {
        setIsTeacher(false);
      }
    };

    checkRole();
  }, []);

  const fetchFlashcardSets = async () => {
    try {
      const { data, error } = await supabase
        .from("flashcard_sets")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setFlashcardSets(data || []);
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error("Error fetching flashcard sets:", error);
      }
      toast({
        title: "Error",
        description: "Failed to load flashcard sets",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchFlashcards = async (setId: string) => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("flashcards")
        .select("*")
        .eq("set_id", setId)
        .order("order_index", { ascending: true });

      if (error) throw error;
      setFlashcards(data || []);
      setCurrentIndex(0);
      setIsFlipped(false);
      setCardStatuses(new Map());
      setFavorites(new Set());
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error("Error fetching flashcards:", error);
      }
      toast({
        title: "Error",
        description: "Failed to load flashcards",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSetSelect = (set: FlashcardSet) => {
    setSelectedSet(set);
    fetchFlashcards(set.id);
  };

  const handleFlip = () => {
    setIsFlipped(!isFlipped);
  };

  const handleKnown = () => {
    const newStatuses = new Map(cardStatuses);
    const currentStatus = newStatuses.get(currentIndex) || 'unknown';
    if (currentStatus === 'learning') {
      newStatuses.set(currentIndex, 'mastered');
    } else {
      newStatuses.set(currentIndex, 'learning');
    }
    setCardStatuses(newStatuses);
    if (currentIndex < flashcards.length - 1) {
      setCurrentIndex(currentIndex + 1);
      setIsFlipped(false);
    }
  };

  const handleUnknown = () => {
    const newStatuses = new Map(cardStatuses);
    newStatuses.set(currentIndex, 'unknown');
    setCardStatuses(newStatuses);
    if (currentIndex < flashcards.length - 1) {
      setCurrentIndex(currentIndex + 1);
      setIsFlipped(false);
    }
  };

  const handleNext = () => {
    if (currentIndex < flashcards.length - 1) {
      setCurrentIndex(currentIndex + 1);
      setIsFlipped(false);
    }
  };

  const handlePrevious = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
      setIsFlipped(false);
    }
  };

  const handleReset = () => {
    setCurrentIndex(0);
    setIsFlipped(false);
    setCardStatuses(new Map());
  };

  const handleShuffle = () => {
    const shuffled = [...flashcards].sort(() => Math.random() - 0.5);
    setFlashcards(shuffled);
    setCurrentIndex(0);
    setIsFlipped(false);
  };

  const toggleFavorite = () => {
    const newFavorites = new Set(favorites);
    if (newFavorites.has(currentIndex)) {
      newFavorites.delete(currentIndex);
    } else {
      newFavorites.add(currentIndex);
    }
    setFavorites(newFavorites);
  };

  const getMasteredCount = () => {
    return Array.from(cardStatuses.values()).filter(s => s === 'mastered').length;
  };

  const getLearningCount = () => {
    return Array.from(cardStatuses.values()).filter(s => s === 'learning').length;
  };

  const progressPercentage = flashcards.length > 0 
    ? ((currentIndex + 1) / flashcards.length) * 100 
    : 0;

  const currentStatus = cardStatuses.get(currentIndex) || 'unknown';
  const statusColors = {
    mastered: 'border-green-500 bg-green-500/10',
    learning: 'border-yellow-500 bg-yellow-500/10',
    unknown: 'border-red-500 bg-red-500/10'
  };

  const handleAddFlashcard = async () => {
    if (!selectedSet) return;
    const question = newQuestion.trim();
    const answer = newAnswer.trim();
    if (!question || !answer) {
      toast({
        title: "Missing fields",
        description: "Please provide both a question and an answer.",
        variant: "destructive",
      });
      return;
    }

    try {
      const nextOrderIndex = flashcards.length;

      const { error } = await supabase
        .from("flashcards")
        .insert({
          set_id: selectedSet.id,
          question,
          answer,
          order_index: nextOrderIndex,
        });

      if (error) throw error;

      setNewQuestion("");
      setNewAnswer("");
      await fetchFlashcards(selectedSet.id);

      toast({
        title: "Flashcard added",
        description: "Your new flashcard has been added to this set.",
      });
    } catch (error: any) {
      if (import.meta.env.DEV) {
        console.error("Error adding flashcard:", error);
      }
      toast({
        title: "Error",
        description: error?.message || "Failed to add flashcard.",
        variant: "destructive",
      });
    }
  };

  const handleDeleteCurrent = async () => {
    if (!selectedSet || flashcards.length === 0) return;
    const card = flashcards[currentIndex];
    if (!card) return;

    try {
      const { error } = await supabase
        .from("flashcards")
        .delete()
        .eq("id", card.id);

      if (error) throw error;

      toast({
        title: "Flashcard deleted",
        description: "The flashcard has been removed from this set.",
      });

      // Adjust index to avoid going out of bounds
      const nextIndex = currentIndex > 0 ? currentIndex - 1 : 0;
      setCurrentIndex(nextIndex);
      await fetchFlashcards(selectedSet.id);
    } catch (error: any) {
      if (import.meta.env.DEV) {
        console.error("Error deleting flashcard:", error);
      }
      toast({
        title: "Error",
        description: error?.message || "Failed to delete flashcard.",
        variant: "destructive",
      });
    }
  };

  if (loading && !selectedSet) {
    return (
      <div className="min-h-screen bg-[#0f172a] flex items-center justify-center">
        <Brain className="h-12 w-12 animate-pulse text-primary" />
      </div>
    );
  }

  if (!selectedSet) {
    return (
      <div className="min-h-screen bg-[#0f172a] p-8 text-white relative overflow-hidden">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-primary/20 rounded-full blur-[120px] pointer-events-none" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-indigo-500/20 rounded-full blur-[120px] pointer-events-none" />

        <div className="max-w-5xl mx-auto relative z-10">
          <Button variant="ghost" className="mb-6 bg-white/5 border border-white/10 text-gray-200 hover:bg-white/10 hover:text-white" onClick={() => navigate("/dashboard")}>
            <Home className="mr-2 h-5 w-5" />
            Back to Dashboard
          </Button>

          <div className="mb-10 text-center">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary to-indigo-600 flex items-center justify-center mb-4 mx-auto shadow-lg shadow-primary/20">
              <Brain className="h-8 w-8 text-white" />
            </div>
            <h1 className="text-4xl md:text-5xl font-bold mb-3 tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white to-gray-400">
              Flashcard Sets
            </h1>
            <p className="text-gray-400 max-w-xl mx-auto text-lg">Practice active recall with curated and AI-generated flashcards.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {flashcardSets.map((set) => (
              <Card
                key={set.id}
                className="cursor-pointer bg-white/5 backdrop-blur-xl border border-white/10 hover:border-primary/50 hover:bg-white/10 transition-all duration-300 transform hover:-translate-y-1"
                onClick={() => handleSetSelect(set)}
              >
                <CardHeader>
                  <CardTitle className="text-white">{set.title}</CardTitle>
                  <CardDescription className="text-gray-400">{set.description || "Practice this set to strengthen memory retention."}</CardDescription>
                </CardHeader>
              </Card>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (flashcards.length === 0) {
    return (
      <div className="min-h-screen bg-[#0f172a] p-8 text-white relative overflow-hidden">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-primary/20 rounded-full blur-[120px] pointer-events-none" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-indigo-500/20 rounded-full blur-[120px] pointer-events-none" />

        <div className="max-w-2xl mx-auto relative z-10">
          <Button variant="ghost" className="mb-6 bg-white/5 border border-white/10 text-gray-200 hover:bg-white/10 hover:text-white" onClick={() => setSelectedSet(null)}>
            <ChevronLeft className="mr-2 h-5 w-5" />
            Back
          </Button>

          <div className="text-center mb-6 bg-white/5 border border-white/10 rounded-xl p-6">
            <p className="text-lg text-gray-300">
              No flashcards available in this set yet.
            </p>
          </div>

          {isTeacher && (
            <div className="mt-4 border border-white/10 bg-white/5 backdrop-blur-xl rounded-lg p-4 space-y-4">
              <h2 className="text-lg font-semibold text-white">Add the first flashcard</h2>
              <div className="space-y-2">
                <Label htmlFor="new-question">Question</Label>
                <Input
                  id="new-question"
                  value={newQuestion}
                  onChange={(e) => setNewQuestion(e.target.value)}
                  placeholder="Enter the question"
                  className="bg-black/20 border-white/15 text-white placeholder:text-gray-400"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="new-answer">Answer</Label>
                <Input
                  id="new-answer"
                  value={newAnswer}
                  onChange={(e) => setNewAnswer(e.target.value)}
                  placeholder="Enter the answer"
                  className="bg-black/20 border-white/15 text-white placeholder:text-gray-400"
                />
              </div>
              <Button className="bg-primary hover:bg-primary/90 text-white" onClick={handleAddFlashcard}>
                Add Flashcard
              </Button>
            </div>
          )}
        </div>
      </div>
    );
  }

  const currentCard = flashcards[currentIndex];

  return (
    <div className="min-h-screen bg-[#0f172a] p-8 text-white relative overflow-hidden">
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-primary/20 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-indigo-500/20 rounded-full blur-[120px] pointer-events-none" />

      <div className="max-w-3xl mx-auto relative z-10">
        <Button variant="ghost" className="mb-6 bg-white/5 border border-white/10 text-gray-200 hover:bg-white/10 hover:text-white" onClick={() => setSelectedSet(null)}>
          <ChevronLeft className="mr-2 h-5 w-5" />
          Back
        </Button>
        
        <div className="mb-6 bg-white/5 border border-white/10 backdrop-blur-xl rounded-xl p-4">
          <div className="flex justify-between mb-2 text-sm text-gray-300">
            <span>Card {currentIndex + 1} of {flashcards.length}</span>
            <span>{Math.round(progressPercentage)}%</span>
          </div>
          <Progress value={progressPercentage} className="h-2 bg-white/10 [&>div]:bg-gradient-to-r [&>div]:from-indigo-500 [&>div]:to-primary" />
          <div className="flex gap-4 mt-4">
            <Button size="sm" variant="outline" className="border-white/20 text-gray-100 hover:bg-white/10" onClick={handleShuffle}><Shuffle className="mr-2 h-4 w-4" />Shuffle</Button>
            <Button size="sm" variant="outline" className="border-white/20 text-gray-100 hover:bg-white/10" onClick={handleReset}><RotateCw className="mr-2 h-4 w-4" />Restart</Button>
          </div>
        </div>

        <Card className={cn("h-96 cursor-pointer mb-6 border-2 bg-white/5 backdrop-blur-xl", statusColors[currentStatus])} onClick={handleFlip}>
          <CardContent className="flex items-center justify-center h-full relative">
            <Button size="icon" variant="ghost" className="absolute top-4 right-4 text-gray-200 hover:text-white hover:bg-white/10" onClick={(e) => { e.stopPropagation(); toggleFavorite(); }}>
              <Heart className={favorites.has(currentIndex) ? "fill-red-500 text-red-500" : ""} />
            </Button>
            {isTeacher && (
              <Button
                size="icon"
                variant="ghost"
                className="absolute top-4 left-4 text-destructive hover:bg-red-500/10"
                onClick={(e) => { e.stopPropagation(); handleDeleteCurrent(); }}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
            <div className="text-center">
              <p className="text-xs uppercase tracking-widest text-primary mb-4">{isFlipped ? "Answer" : "Question"}</p>
              <p className="text-xl text-white px-4">{isFlipped ? currentCard.answer : currentCard.question}</p>
            </div>
          </CardContent>
        </Card>

        {isFlipped && (
          <div className="flex gap-4 mb-4">
            <Button variant="outline" className="flex-1 border-red-500/50 bg-red-500/10 text-red-300 hover:bg-red-500/20" onClick={handleUnknown}>
              <XCircle className="mr-2" />Unknown
            </Button>
            <Button variant="outline" className="flex-1 border-green-500/50 bg-green-500/10 text-green-300 hover:bg-green-500/20" onClick={handleKnown}>
              <CheckCircle2 className="mr-2" />Known
            </Button>
          </div>
        )}

        <div className="flex justify-between">
          <Button variant="outline" className="border-white/20 text-gray-100 hover:bg-white/10" onClick={handlePrevious} disabled={currentIndex === 0}>
            <ChevronLeft className="mr-2" />Previous
          </Button>
          <Button className="bg-primary hover:bg-primary/90 text-white" onClick={handleNext} disabled={currentIndex === flashcards.length - 1}>
            Next<ChevronRight className="ml-2" />
          </Button>
        </div>

        {isTeacher && (
          <div className="mt-8 border border-white/10 bg-white/5 backdrop-blur-xl rounded-lg p-4 space-y-4">
            <h2 className="text-lg font-semibold text-white">Add Flashcard to this Set</h2>
            <div className="space-y-2">
              <Label htmlFor="new-question">Question</Label>
              <Input
                id="new-question"
                value={newQuestion}
                onChange={(e) => setNewQuestion(e.target.value)}
                placeholder="Enter the question"
                className="bg-black/20 border-white/15 text-white placeholder:text-gray-400"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-answer">Answer</Label>
              <Input
                id="new-answer"
                value={newAnswer}
                onChange={(e) => setNewAnswer(e.target.value)}
                placeholder="Enter the answer"
                className="bg-black/20 border-white/15 text-white placeholder:text-gray-400"
              />
            </div>
            <Button className="bg-primary hover:bg-primary/90 text-white" onClick={handleAddFlashcard}>
              Add Flashcard
            </Button>
            <div className="pt-4 mt-4 border-t space-y-4">
              <h3 className="text-md font-semibold flex items-center gap-2 text-white">
                <Brain className="h-4 w-4 text-primary" />
                Generate Flashcards with AI
                <Sparkles className="h-3 w-3 text-primary/70" />
              </h3>
              <div className="space-y-2">
                <Label htmlFor="ai-topic">Topic / chapter</Label>
                <Input
                  id="ai-topic"
                  value={aiTopic}
                  onChange={(e) => setAiTopic(e.target.value)}
                  placeholder="e.g. Newton's Laws of Motion"
                  className="bg-black/20 border-white/15 text-white placeholder:text-gray-400"
                />
              </div>
              <Button
                className="bg-indigo-600 hover:bg-indigo-500 text-white"
                disabled={aiLoading || !aiTopic.trim() || !selectedSet}
                onClick={async () => {
                  if (!selectedSet) return;
                  setAiLoading(true);
                  try {
                    const { data: { session } } = await supabase.auth.getSession();
                    if (!session) {
                      throw new Error("Not authenticated");
                    }

                    const res = await fetch(
                      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-flashcards`,
                      {
                        method: "POST",
                        headers: {
                          "Content-Type": "application/json",
                          Authorization: `Bearer ${session.access_token}`,
                        },
                        body: JSON.stringify({ topic: aiTopic.trim(), numCards: 8 }),
                      }
                    );

                    const data = await res.json();
                    if (!res.ok) {
                      console.error("Edge Function error:", data);
                      throw new Error(data.error || "Failed to generate flashcards");
                    }

                    const cards = (data.cards || []) as { question: string; answer: string }[];

                    if (!cards.length) {
                      toast({
                        title: "No cards generated",
                        description: "Try a more specific topic.",
                      });
                      return;
                    }

                    const inserts = cards.map((c, idx) => ({
                      set_id: selectedSet.id,
                      question: c.question,
                      answer: c.answer,
                      order_index: flashcards.length + idx,
                    }));

                    const { error } = await supabase.from("flashcards").insert(inserts);
                    if (error) throw error;

                    toast({
                      title: "AI flashcards added",
                      description: `Added ${cards.length} cards to this set.`,
                    });

                    setAiTopic("");
                    await fetchFlashcards(selectedSet.id);
                  } catch (err: any) {
                    if (import.meta.env.DEV) console.error("AI flashcards error", err);
                    toast({
                      title: "Generation failed",
                      description: err?.message || "Could not generate flashcards.",
                      variant: "destructive",
                    });
                  } finally {
                    setAiLoading(false);
                  }
                }}
              >
                {aiLoading ? "Generating..." : "Generate with AI"}
              </Button>
            </div>
          </div>
        )}

        <div className="mt-6 grid grid-cols-3 gap-4">
          <div className="text-center p-4 bg-green-500/10 border border-green-500/20 rounded-lg">
            <div className="text-2xl font-bold text-green-500">{getMasteredCount()}</div>
            <p className="text-sm text-gray-200">Mastered</p>
          </div>
          <div className="text-center p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
            <div className="text-2xl font-bold text-yellow-500">{getLearningCount()}</div>
            <p className="text-sm text-gray-200">Learning</p>
          </div>
          <div className="text-center p-4 bg-red-500/10 border border-red-500/20 rounded-lg">
            <div className="text-2xl font-bold text-red-500">{flashcards.length - getMasteredCount() - getLearningCount()}</div>
            <p className="text-sm text-gray-200">Unknown</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Flashcards;
