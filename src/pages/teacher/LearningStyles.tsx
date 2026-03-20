import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Brain, ArrowLeft, Users } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useRequireRole } from "@/hooks/useRequireRole";
import { Progress } from "@/components/ui/progress";

interface StudentLearningStyle {
  user_id: string;
  username: string;
  primary_style: string;
  secondary_style: string;
  visual_score: number;
  auditory_score: number;
  kinesthetic_score: number;
  reading_writing_score: number;
  updated_at: string;
}

export default function StudentLearningStyles() {
  useRequireRole("teacher");
  const navigate = useNavigate();
  const { toast } = useToast();
  const [students, setStudents] = useState<StudentLearningStyle[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>("all");

  useEffect(() => {
    fetchStudentLearningStyles();
  }, []);

  const fetchStudentLearningStyles = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from("learning_styles")
        .select("*, profiles(username)")
        .order("updated_at", { ascending: false });

      if (error) throw error;

      const formattedData: StudentLearningStyle[] = (data || []).map((item: any) => ({
        user_id: item.user_id,
        username: item.profiles?.username || "Unknown Student",
        primary_style: item.primary_style,
        secondary_style: item.secondary_style,
        visual_score: item.visual_score || 0,
        auditory_score: item.auditory_score || 0,
        kinesthetic_score: item.kinesthetic_score || 0,
        reading_writing_score: item.reading_writing_score || 0,
        updated_at: item.updated_at
      }));

      setStudents(formattedData);
    } catch (error) {
      console.error("Error fetching learning styles:", error);
      toast({
        title: "Error",
        description: "Failed to load student learning styles",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const getStyleColor = (style: string) => {
    const colors = {
      visual: "bg-blue-500/10 text-blue-500 border-blue-500/20",
      auditory: "bg-purple-500/10 text-purple-500 border-purple-500/20",
      kinesthetic: "bg-green-500/10 text-green-500 border-green-500/20",
      reading_writing: "bg-orange-500/10 text-orange-500 border-orange-500/20"
    };
    return colors[style as keyof typeof colors] || "bg-muted";
  };

  const getStyleLabel = (style: string) => {
    const labels = {
      visual: "Visual",
      auditory: "Auditory",
      kinesthetic: "Kinesthetic",
      reading_writing: "Reading/Writing"
    };
    return labels[style as keyof typeof labels] || style;
  };

  const filteredStudents = filter === "all" 
    ? students 
    : students.filter(s => s.primary_style === filter);

  const styleCounts = {
    visual: students.filter(s => s.primary_style === "visual").length,
    auditory: students.filter(s => s.primary_style === "auditory").length,
    kinesthetic: students.filter(s => s.primary_style === "kinesthetic").length,
    reading_writing: students.filter(s => s.primary_style === "reading_writing").length
  };

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-7xl mx-auto">
        <Button variant="outline" className="mb-6" onClick={() => navigate("/teacher")}>
          <ArrowLeft className="mr-2 h-5 w-5" />Back to Dashboard
        </Button>

        <div className="mb-6">
          <h1 className="text-3xl font-bold mb-2">Student Learning Styles</h1>
          <p className="text-muted-foreground">View and analyze student learning preferences</p>
        </div>

        {/* Statistics Overview */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <Card className="border-blue-500/20 bg-blue-500/5">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Visual Learners</p>
                  <p className="text-2xl font-bold text-blue-500">{styleCounts.visual}</p>
                </div>
                <Brain className="h-8 w-8 text-blue-500" />
              </div>
            </CardContent>
          </Card>

          <Card className="border-purple-500/20 bg-purple-500/5">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Auditory Learners</p>
                  <p className="text-2xl font-bold text-purple-500">{styleCounts.auditory}</p>
                </div>
                <Brain className="h-8 w-8 text-purple-500" />
              </div>
            </CardContent>
          </Card>

          <Card className="border-green-500/20 bg-green-500/5">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Kinesthetic Learners</p>
                  <p className="text-2xl font-bold text-green-500">{styleCounts.kinesthetic}</p>
                </div>
                <Brain className="h-8 w-8 text-green-500" />
              </div>
            </CardContent>
          </Card>

          <Card className="border-orange-500/20 bg-orange-500/5">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Reading/Writing</p>
                  <p className="text-2xl font-bold text-orange-500">{styleCounts.reading_writing}</p>
                </div>
                <Brain className="h-8 w-8 text-orange-500" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filter Buttons */}
        <div className="flex flex-wrap gap-2 mb-6">
          <Button
            variant={filter === "all" ? "default" : "outline"}
            onClick={() => setFilter("all")}
            size="sm"
          >
            All Students ({students.length})
          </Button>
          <Button
            variant={filter === "visual" ? "default" : "outline"}
            onClick={() => setFilter("visual")}
            size="sm"
          >
            Visual ({styleCounts.visual})
          </Button>
          <Button
            variant={filter === "auditory" ? "default" : "outline"}
            onClick={() => setFilter("auditory")}
            size="sm"
          >
            Auditory ({styleCounts.auditory})
          </Button>
          <Button
            variant={filter === "kinesthetic" ? "default" : "outline"}
            onClick={() => setFilter("kinesthetic")}
            size="sm"
          >
            Kinesthetic ({styleCounts.kinesthetic})
          </Button>
          <Button
            variant={filter === "reading_writing" ? "default" : "outline"}
            onClick={() => setFilter("reading_writing")}
            size="sm"
          >
            Reading/Writing ({styleCounts.reading_writing})
          </Button>
        </div>

        {/* Student List */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Student Learning Profiles
            </CardTitle>
            <CardDescription>
              {filteredStudents.length} student{filteredStudents.length !== 1 ? "s" : ""} found
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className="text-center text-muted-foreground py-8">Loading...</p>
            ) : filteredStudents.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">
                No students have completed the learning style quiz yet.
              </p>
            ) : (
              <div className="space-y-4">
                {filteredStudents.map((student) => (
                  <div
                    key={student.user_id}
                    className="p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <h3 className="font-semibold text-lg">{student.username}</h3>
                        <p className="text-sm text-muted-foreground">
                          Last updated: {new Date(student.updated_at).toLocaleDateString()}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <span className={`px-3 py-1 rounded-full text-xs font-semibold border ${getStyleColor(student.primary_style)}`}>
                          Primary: {getStyleLabel(student.primary_style)}
                        </span>
                        {student.secondary_style && (
                          <span className={`px-3 py-1 rounded-full text-xs font-semibold border ${getStyleColor(student.secondary_style)}`}>
                            Secondary: {getStyleLabel(student.secondary_style)}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      <div>
                        <div className="flex justify-between mb-1">
                          <span className="text-xs font-medium">Visual</span>
                          <span className="text-xs text-blue-500 font-semibold">{student.visual_score}</span>
                        </div>
                        <Progress value={(student.visual_score / 10) * 100} className="h-2 bg-blue-100" />
                      </div>

                      <div>
                        <div className="flex justify-between mb-1">
                          <span className="text-xs font-medium">Auditory</span>
                          <span className="text-xs text-purple-500 font-semibold">{student.auditory_score}</span>
                        </div>
                        <Progress value={(student.auditory_score / 10) * 100} className="h-2 bg-purple-100" />
                      </div>

                      <div>
                        <div className="flex justify-between mb-1">
                          <span className="text-xs font-medium">Kinesthetic</span>
                          <span className="text-xs text-green-500 font-semibold">{student.kinesthetic_score}</span>
                        </div>
                        <Progress value={(student.kinesthetic_score / 10) * 100} className="h-2 bg-green-100" />
                      </div>

                      <div>
                        <div className="flex justify-between mb-1">
                          <span className="text-xs font-medium">Reading/Writing</span>
                          <span className="text-xs text-orange-500 font-semibold">{student.reading_writing_score}</span>
                        </div>
                        <Progress value={(student.reading_writing_score / 10) * 100} className="h-2 bg-orange-100" />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
