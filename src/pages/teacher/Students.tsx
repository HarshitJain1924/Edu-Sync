import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Users, ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/components/ui/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useRequireRole } from "@/hooks/useRequireRole";

interface StudentProgress {
  user_id: string;
  username: string | null;
  quizzes_taken: number;
  average_score: number;
  latest_quiz: string | null;
}

export default function TeacherStudents() {
  useRequireRole("teacher");
  const navigate = useNavigate();
  const { toast } = useToast();

  const [students, setStudents] = useState<StudentProgress[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        // 1. Fetch rooms owned by this teacher (creator OR host)
        const { data: rooms } = await supabase
          .from('study_rooms')
          .select('id')
          .or(`created_by.eq.${user.id},host_id.eq.${user.id}`);
        
        const roomIds = rooms?.map(r => r.id) || [];

        // 2. Fetch all unique participants with 'student' role in those rooms
        const { data: participants } = await supabase
          .from('room_participants')
          .select('user_id, profiles(username)')
          .in('room_id', roomIds)
          .eq('role', 'student');
        
        // Remove duplicates and initialize student data
        const studentMap = new Map<string, any>();
        (participants || []).forEach((p: any) => {
          if (!studentMap.has(p.user_id)) {
            studentMap.set(p.user_id, {
              user_id: p.user_id,
              username: p.profiles?.username || 'Unknown student',
              quizzes_taken: 0,
              total_score: 0,
              latest_quiz: 'None',
              latest_date: null
            });
          }
        });

        // 3. Fetch quiz progress and merge
        const { data: quizData, error: quizError } = await supabase
          .from("user_progress")
          .select("user_id, progress_data, updated_at")
          .eq("content_type", "quiz_set")
          .in("user_id", Array.from(studentMap.keys()));

        if (quizError) throw quizError;

        (quizData || []).forEach((row: any) => {
          const student = studentMap.get(row.user_id);
          if (student) {
            const score = row.progress_data?.score || 0;
            const quizTitle = row.progress_data?.quiz_title || 'Unknown Quiz';
            const updatedAt = row.updated_at;
            
            student.quizzes_taken++;
            student.total_score += score;
            
            if (!student.latest_date || new Date(updatedAt) > new Date(student.latest_date)) {
              student.latest_quiz = quizTitle;
              student.latest_date = updatedAt;
            }
          }
        });

        const studentsData: StudentProgress[] = Array.from(studentMap.values()).map(s => ({
          user_id: s.user_id,
          username: s.username,
          quizzes_taken: s.quizzes_taken,
          average_score: s.quizzes_taken > 0 ? Math.round(s.total_score / s.quizzes_taken) : 0,
          latest_quiz: s.latest_quiz
        })).sort((a, b) => b.average_score - a.average_score);

        setStudents(studentsData);
      } catch (error: any) {
        console.error('Error loading students:', error);
        toast({
          title: "Error",
          description: error?.message || "Failed to load students.",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    })();
  }, [toast]);

  return (
    <div className="min-h-screen bg-background">
      <header className="bg-card border-b border-border px-6 py-4 flex items-center justify-between shadow-soft">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => navigate("/teacher")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-xl font-bold">Students</h1>
            <p className="text-sm text-muted-foreground">Overview of students who have taken quizzes.</p>
          </div>
        </div>
      </header>

      <main className="p-8 max-w-5xl mx-auto">
        <Card>
          <CardHeader>
            <CardTitle>
              <div className="flex items-center gap-2">
                <Users className="h-5 w-5 text-primary" />
                Students & Quiz Activity
              </div>
            </CardTitle>
            <CardDescription>
              This is a basic view built from the `user_progress` table. You can extend it with more metrics later.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className="text-sm text-muted-foreground">Loading...</p>
            ) : students.length === 0 ? (
              <p className="text-sm text-muted-foreground">No quiz activity yet.</p>
            ) : (
              <div className="space-y-3">
                {students.map((s, index) => (
                  <div key={s.user_id} className="flex items-center justify-between p-4 bg-muted rounded-lg hover:bg-muted/80 transition-colors">
                    <div className="flex items-center gap-3">
                      <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/10 text-primary font-bold">
                        {index + 1}
                      </div>
                      <div>
                        <p className="font-medium">{s.username || "Unknown user"}</p>
                        <p className="text-xs text-muted-foreground mt-1">Latest: {s.latest_quiz}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-2xl font-bold text-primary">{s.average_score}%</div>
                      <p className="text-xs text-muted-foreground">
                        {s.quizzes_taken} quiz{s.quizzes_taken === 1 ? "" : "zes"} taken
                      </p>
                    </div>
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
