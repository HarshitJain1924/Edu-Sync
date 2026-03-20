import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { FileText, ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/components/ui/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useRequireRole } from "@/hooks/useRequireRole";

interface Note {
  id: string;
  title: string;
  description: string | null;
  created_at: string;
}

export default function TeacherNotes() {
  useRequireRole("teacher");
  const navigate = useNavigate();
  const { toast } = useToast();

  const [title, setTitle] = useState("");
  const [topic, setTopic] = useState("");
  const [description, setDescription] = useState("");
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { data, error } = await supabase
          .from("flashcard_sets")
          .select("id, title, description, created_at")
          .eq("created_by", user.id)
          .order("created_at", { ascending: false });

        if (error) throw error;
        setNotes(data || []);
      } catch (error: any) {
        toast({
          title: "Error",
          description: error?.message || "Failed to load notes.",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    })();
  }, [toast]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from("flashcard_sets")
        .insert({
          title: title.trim(),
          description: description.trim() || null,
          created_by: user.id,
          topic: topic.trim() || "General",
        })
        .select("id, title, description, created_at")
        .single();

      if (error) throw error;

      setNotes((prev) => [data, ...prev]);
      setTitle("");
      setDescription("");

      toast({
        title: "Note saved",
        description: "You can now attach flashcards to this set.",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error?.message || "Failed to save note.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="bg-card border-b border-border px-6 py-4 flex items-center justify-between shadow-soft">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => navigate("/teacher")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-xl font-bold">Upload Notes</h1>
            <p className="text-sm text-muted-foreground">Create note sets that feed into quizzes and flashcards.</p>
          </div>
        </div>
      </header>

      <main className="p-8 max-w-4xl mx-auto space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>New Note Set</CardTitle>
            <CardDescription>Just a title and short description for now.</CardDescription>
          </CardHeader>
          <CardContent>
            <form className="space-y-4" onSubmit={handleCreate}>
              <div className="space-y-2">
                <Label htmlFor="title">Title</Label>
                <Input
                  id="title"
                  placeholder="e.g. Calculus Basics"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="topic">Topic</Label>
                <Input
                  id="topic"
                  placeholder="e.g. Calculus"
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  placeholder="Short summary or chapter/topic list"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </div>
              <Button type="submit" disabled={loading}>
                <FileText className="mr-2 h-4 w-4" />
                {loading ? "Saving..." : "Save Note"}
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Your Note Sets</CardTitle>
            <CardDescription>Recent note sets you have created.</CardDescription>
          </CardHeader>
          <CardContent>
            {notes.length === 0 ? (
              <p className="text-sm text-muted-foreground">No notes yet. Create your first note set above.</p>
            ) : (
              <div className="space-y-3">
                {notes.map((note) => (
                  <div key={note.id} className="flex items-center justify-between p-3 bg-muted rounded-lg">
                    <div>
                      <p className="font-medium">{note.title}</p>
                      {note.description && (
                        <p className="text-xs text-muted-foreground line-clamp-2">{note.description}</p>
                      )}
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {new Date(note.created_at).toLocaleDateString()}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
