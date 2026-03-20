import { useState, useEffect } from "react";
import { useRequireRole } from "@/hooks/useRequireRole";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ShieldAlert, CheckCircle, Globe, Lock, Sparkles, Filter } from "lucide-react";
import AppSidebar from "@/components/AppSidebar";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

// Mock data to simulate the expo if DB doesn't have courses yet
const MOCK_COURSES = [
  { id: '1', title: 'React Performance Optimization', topic: 'Programming', difficulty: 'Advanced', duration: '3 Hours', status: 'community', author: 'Alice Student' },
  { id: '2', title: 'History of Ancient Rome', topic: 'History', difficulty: 'Beginner', duration: '1 Hour', status: 'draft', author: 'Bob Builder' },
  { id: '3', title: 'Inappropriate Content Subject', topic: 'Other', difficulty: 'Beginner', duration: '1 Week', status: 'private', author: 'Charlie Troll' },
];

export default function AiCourseOversight() {
  const { isAuthorized, isLoading } = useRequireRole('admin');
  const [courses, setCourses] = useState<any[]>([]);
  const [loadingCourses, setLoadingCourses] = useState(true);
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    if (isAuthorized) {
      fetchCourses();
    }
  }, [isAuthorized]);

  const fetchCourses = async () => {
    try {
      // In a real expo, we attempt to fetch from DB. If empty/fails, fallback to MOCK
      const { data, error } = await supabase
        .from('ai_generated_courses')
        .select(`
          *,
          profiles:created_by (username)
        `)
        .order('created_at', { ascending: false });
        
      if (error || !data || data.length === 0) {
        setCourses(MOCK_COURSES); // Fallback for expo demo if no real data
      } else {
        const formatted = data.map(d => ({
          id: d.id,
          title: d.title,
          topic: d.topic,
          difficulty: d.difficulty,
          duration: d.duration,
          status: d.status,
          author: d.profiles?.username || 'Unknown Student'
        }));
        setCourses(formatted);
      }
    } catch {
      setCourses(MOCK_COURSES);
    } finally {
      setLoadingCourses(false);
    }
  };

  const handleUpdateStatus = async (id: string, newStatus: string) => {
    try {
      // Optimistic update
      setCourses(courses.map(c => c.id === id ? { ...c, status: newStatus } : c));
      
      // Attempt DB update
      await supabase
        .from('ai_generated_courses')
        .update({ status: newStatus })
        .eq('id', id);

      toast.success(`Course successfully marked as ${newStatus}`);
    } catch (e) {
      toast.error('Failed to update status');
      fetchCourses(); // Revert on failure
    }
  };

  const filteredCourses = courses.filter(c => filter === 'all' || c.status === filter);

  if (isLoading) return null;
  if (!isAuthorized) return null;

  return (
    <div className="min-h-screen bg-background">
      <AppSidebar />
      <main className="ml-64 p-8 animate-in fade-in duration-500">
        <div className="max-w-7xl mx-auto space-y-8">
          
          <header className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold flex items-center gap-3">
                <Sparkles className="h-8 w-8 text-indigo-500" />
                AI Course Oversight
              </h1>
              <p className="text-muted-foreground mt-2">
                Manage, review, and promote student-generated AI courses.
              </p>
            </div>
          </header>

          <Card className="bg-background/60 backdrop-blur-md">
            <CardHeader className="flex flex-row flex-wrap justify-between items-center bg-muted/20 border-b">
              <div>
                <CardTitle>Course Pipeline</CardTitle>
                <CardDescription>Review drafts and manage community visibility</CardDescription>
              </div>
              <div className="flex gap-2 p-1 bg-muted rounded-lg">
                <Button variant={filter === 'all' ? 'default' : 'ghost'} size="sm" onClick={() => setFilter('all')}>All</Button>
                <Button variant={filter === 'community' ? 'default' : 'ghost'} size="sm" onClick={() => setFilter('community')}>Community</Button>
                <Button variant={filter === 'official' ? 'default' : 'ghost'} size="sm" onClick={() => setFilter('official')}>Official</Button>
                <Button variant={filter === 'draft' ? 'default' : 'ghost'} size="sm" onClick={() => setFilter('draft')}>Pending Drafts</Button>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {loadingCourses ? (
                <div className="p-8 text-center text-muted-foreground">Loading pipeline...</div>
              ) : filteredCourses.length === 0 ? (
                <div className="p-12 text-center flex flex-col items-center">
                  <Filter className="h-12 w-12 text-muted-foreground/30 mb-4" />
                  <p className="text-lg font-medium">No courses in this category</p>
                </div>
              ) : (
                <div className="divide-y divide-border">
                  {filteredCourses.map((course) => (
                    <div key={course.id} className="p-6 hover:bg-muted/10 transition-colors flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold text-lg">{course.title}</h3>
                          {course.status === 'official' && <Badge className="bg-green-500"><CheckCircle className="w-3 h-3 mr-1"/> Official</Badge>}
                          {course.status === 'community' && <Badge variant="secondary" className="bg-purple-500/20 text-purple-400"><Globe className="w-3 h-3 mr-1"/> Community</Badge>}
                          {course.status === 'draft' && <Badge variant="outline" className="border-yellow-500/50 text-yellow-500">Draft (Pending Review)</Badge>}
                          {course.status === 'private' && <Badge variant="outline" className="border-red-500/50 text-red-500"><Lock className="w-3 h-3 mr-1"/> Blocked/Private</Badge>}
                        </div>
                        <p className="text-sm text-muted-foreground">
                          By <span className="text-foreground font-medium">{course.author}</span> • {course.topic} • {course.difficulty} • {course.duration}
                        </p>
                      </div>

                      <div className="flex gap-2">
                        {course.status !== 'official' && (
                          <Button size="sm" className="bg-green-500 hover:bg-green-600 shadow-md" onClick={() => handleUpdateStatus(course.id, 'official')}>
                            Promote to Official
                          </Button>
                        )}
                        {course.status !== 'community' && course.status !== 'private' && (
                          <Button size="sm" variant="outline" onClick={() => handleUpdateStatus(course.id, 'community')}>
                            Approve for Community
                          </Button>
                        )}
                        {course.status !== 'private' && (
                          <Button size="sm" variant="outline" className="text-red-500 border-red-500/30 hover:bg-red-500/10" onClick={() => handleUpdateStatus(course.id, 'private')}>
                            Block/Remove
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
