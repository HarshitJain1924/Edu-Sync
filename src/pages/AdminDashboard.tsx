import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Users, Video, TrendingUp, Shield, AlertTriangle, Calendar, Brain, Sparkles } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useRequireRole } from "@/hooks/useRequireRole";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import AppSidebar from "@/components/AppSidebar";

const AdminDashboard = () => {
  const { isAuthorized, isLoading } = useRequireRole('admin');
  const navigate = useNavigate();
  const { toast } = useToast();

  const [totalUsers, setTotalUsers] = useState<number | null>(null);
  const [activeRooms, setActiveRooms] = useState<number | null>(null);
  const [totalQuizzes, setTotalQuizzes] = useState<number | null>(null);
  const [activeUsers, setActiveUsers] = useState<number | null>(null);
  const [recentUsers, setRecentUsers] = useState<any[]>([]);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const [
          { count: userCount, error: userError },
          { count: roomsCount, error: roomsError },
          { count: quizzesCount, error: quizzesError },
        ] = await Promise.all([
          supabase.from("profiles").select("id", { count: "exact", head: true }),
          supabase.from("study_rooms").select("id", { count: "exact", head: true }),
          supabase.from("quiz_sets").select("id", { count: "exact", head: true }),
        ]);

        if (userError || roomsError || quizzesError) {
          throw userError || roomsError || quizzesError;
        }

        setTotalUsers(userCount ?? 0);
        setActiveRooms(roomsCount ?? 0);
        setTotalQuizzes(quizzesCount ?? 0);
        setActiveUsers(userCount ?? 0);

        const { data: recent, error: recentError } = await supabase
          .from("profile_with_role")
          .select("id, username, role")
          .order("id", { ascending: false })
          .limit(3);

        if (!recentError) {
          setRecentUsers(recent || []);
        }
      } catch (error: any) {
        if (import.meta.env.DEV) {
          console.error("Error loading admin stats:", error);
        }
        toast({
          title: "Error",
          description: "Failed to load admin statistics.",
          variant: "destructive",
        });
      }
    };

    if (isAuthorized) {
      fetchStats();
    }
  }, [isAuthorized, toast]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-lg">Checking permissions...</p>
      </div>
    );
  }

  if (!isAuthorized) return null;

  const stats = [
    { label: "Total Users", value: totalUsers ?? "--", icon: Users, color: "from-blue-500 to-cyan-500" },
    { label: "Active Rooms", value: activeRooms ?? "--", icon: Video, color: "from-purple-500 to-pink-500" },
    { label: "Total Quizzes", value: totalQuizzes ?? "--", icon: Brain, color: "from-green-500 to-emerald-500" },
    { label: "Active Users", value: activeUsers ?? "--", icon: TrendingUp, color: "from-yellow-500 to-orange-500" }
  ];

  const flaggedContent = [
    { id: 1, type: "Note", title: "Chemistry Lab Report", reporter: "John Doe", reason: "Inappropriate content" },
    { id: 2, type: "Message", title: "Study Room Chat", reporter: "Jane Smith", reason: "Spam" }
  ];

  return (
    <div className="min-h-screen bg-background">
      <AppSidebar />

      <main className="ml-64 p-8">
        <div className="max-w-7xl mx-auto">
          <header className="mb-8">
            <h1 className="text-3xl font-bold mb-2">Admin Dashboard 🛡️</h1>
            <p className="text-muted-foreground">Platform management and oversight</p>
          </header>

          {/* Stats Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            {stats.map((stat, index) => (
              <Card key={index} className="shadow-soft hover:shadow-medium transition-all">
                <CardContent className="p-6">
                    <div className="flex items-center justify-between mb-4">
                    <div className={`p-3 rounded-xl bg-gradient-to-br ${stat.color} shadow-medium`}>
                      <stat.icon className="h-6 w-6 text-white" />
                    </div>
                  </div>
                  <div>
                    <p className="text-3xl font-bold mb-1">{stat.value}</p>
                    <p className="text-sm text-muted-foreground">{stat.label}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
            {/* Recent Users */}
            <Card className="shadow-soft">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5 text-primary" />
                  Recent Users
                </CardTitle>
                <CardDescription>Latest user registrations</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {recentUsers.map((user) => (
                    <div key={user.id} className="flex items-center justify-between p-4 bg-muted rounded-lg hover:shadow-medium transition-all">
                      <div>
                        <h3 className="font-semibold">{user.username}</h3>
                        <p className="text-sm text-muted-foreground">Profile ID: {user.id}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-1 bg-primary/10 text-primary rounded-full text-xs">
                          {user.role || "Unknown"}
                        </span>
                        <Button size="sm" variant="outline">View</Button>
                      </div>
                    </div>
                  ))}
                  <Button variant="outline" className="w-full" onClick={() => navigate("/admin/users")}>
                    View All Users
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Flagged Content */}
            <Card className="shadow-soft border-yellow-500/50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-yellow-500" />
                  Flagged Content
                </CardTitle>
                <CardDescription>Requires moderation</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {flaggedContent.map((item) => (
                    <div key={item.id} className="p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <span className="text-xs font-semibold text-yellow-500">{item.type}</span>
                          <h3 className="font-semibold">{item.title}</h3>
                        </div>
                        <Button size="sm" variant="outline">Review</Button>
                      </div>
                      <p className="text-sm text-muted-foreground">Reported by: {item.reporter}</p>
                      <p className="text-sm text-muted-foreground">Reason: {item.reason}</p>
                    </div>
                  ))}
                  <Button variant="outline" className="w-full" onClick={() => navigate("/admin/content")}>
                    View All Flagged Content
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Simple Platform Analytics from Supabase */}
          <Card className="shadow-soft">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-primary" />
                Platform Analytics
              </CardTitle>
              <CardDescription>Key metrics from the database</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-4 bg-muted rounded-lg">
                  <p className="text-sm text-muted-foreground mb-1">Total Users</p>
                  <p className="text-2xl font-bold">{totalUsers ?? "--"}</p>
                </div>
                <div className="p-4 bg-muted rounded-lg">
                  <p className="text-sm text-muted-foreground mb-1">Active Rooms</p>
                  <p className="text-2xl font-bold">{activeRooms ?? "--"}</p>
                </div>
                <div className="p-4 bg-muted rounded-lg">
                  <p className="text-sm text-muted-foreground mb-1">Active Users</p>
                  <p className="text-2xl font-bold">{activeUsers ?? "--"}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Quick Actions */}
          <div className="mt-8">
            <h2 className="text-xl font-bold mb-4">Management Tools</h2>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Card className="hover:shadow-medium transition-all cursor-pointer" onClick={() => navigate('/admin/users')}>
                <CardContent className="p-6">
                  <div className="flex items-center gap-4">
                    <div className="p-3 bg-blue-100 rounded-lg">
                      <Users className="h-6 w-6 text-blue-600" />
                    </div>
                    <div>
                      <h3 className="font-semibold">User Management</h3>
                      <p className="text-sm text-muted-foreground">Manage users and roles</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="hover:shadow-medium transition-all cursor-pointer" onClick={() => navigate('/admin/sessions')}>
                <CardContent className="p-6">
                  <div className="flex items-center gap-4">
                    <div className="p-3 bg-green-100 rounded-lg">
                      <Calendar className="h-6 w-6 text-green-600" />
                    </div>
                    <div>
                      <h3 className="font-semibold">Session Scheduling</h3>
                      <p className="text-sm text-muted-foreground">Schedule study sessions</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="hover:shadow-medium transition-all cursor-pointer" onClick={() => navigate('/admin/content')}>
                <CardContent className="p-6">
                  <div className="flex items-center gap-4">
                    <div className="p-3 bg-yellow-100 rounded-lg">
                      <Shield className="h-6 w-6 text-yellow-600" />
                    </div>
                    <div>
                      <h3 className="font-semibold">Content Moderation</h3>
                      <p className="text-sm text-muted-foreground">Review flagged content</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="hover:shadow-medium transition-all cursor-pointer" onClick={() => navigate('/admin/learning-styles')}>
                <CardContent className="p-6">
                  <div className="flex items-center gap-4">
                    <div className="p-3 bg-purple-100 rounded-lg">
                      <Brain className="h-6 w-6 text-purple-600" />
                    </div>
                    <div>
                      <h3 className="font-semibold">Learning Styles</h3>
                      <p className="text-sm text-muted-foreground">View student preferences</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="hover:shadow-medium transition-all cursor-pointer border-indigo-500/30" onClick={() => navigate('/admin/ai-courses')}>
                <CardContent className="p-6">
                  <div className="flex items-center gap-4">
                    <div className="p-3 bg-indigo-100 rounded-lg">
                      <Sparkles className="h-6 w-6 text-indigo-600" />
                    </div>
                    <div>
                      <h3 className="font-semibold">AI Course Review</h3>
                      <p className="text-sm text-muted-foreground">Manage student courses</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default AdminDashboard;
