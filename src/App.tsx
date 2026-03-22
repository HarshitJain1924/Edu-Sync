import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, useLocation, Navigate } from "react-router-dom";
import { lazy, Suspense, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

type AppRole = "student" | "teacher" | "admin";

const queryClient = new QueryClient();

const Index = lazy(() => import("./pages/Index"));
const Auth = lazy(() => import("./pages/Auth"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const StudyRooms = lazy(() => import("./pages/StudyRooms"));
const StudyRoom = lazy(() => import("./pages/StudyRoom"));
const Analytics = lazy(() => import("./pages/Analytics"));
const Settings = lazy(() => import("./pages/Settings"));
const Flashcards = lazy(() => import("./pages/Flashcards"));
const Quiz = lazy(() => import("./pages/Quiz"));
const Games = lazy(() => import("./pages/Games"));
const GameTemplate = lazy(() => import("./pages/games/GameTemplate"));
const VideoLibrary = lazy(() => import("./pages/VideoLibrary"));
const VideoPlayer = lazy(() => import("./pages/VideoPlayer"));
const TeacherDashboard = lazy(() => import("./pages/TeacherDashboard"));
const TeacherNotes = lazy(() => import("./pages/teacher/Notes"));
const TeacherQuizzes = lazy(() => import("./pages/teacher/Quizzes"));
const TeacherStudents = lazy(() => import("./pages/teacher/Students"));
const TeacherLearningStyles = lazy(() => import("./pages/teacher/LearningStyles"));
const AdminDashboard = lazy(() => import("./pages/AdminDashboard"));
const UserManagement = lazy(() => import("./pages/admin/UserManagement"));
const RoomManagement = lazy(() => import("./pages/admin/RoomManagement"));
const ContentModeration = lazy(() => import("./pages/admin/ContentModeration"));
const PlatformAnalytics = lazy(() => import("./pages/admin/PlatformAnalytics"));
const SessionManagement = lazy(() => import("./pages/admin/SessionManagement"));
const AdminLearningStyles = lazy(() => import("./pages/admin/LearningStyles"));
const AiCourseOversight = lazy(() => import("./pages/admin/AiCourseOversight"));
const LearningStyleQuiz = lazy(() => import("./pages/LearningStyleQuiz"));
const NotFound = lazy(() => import("./pages/NotFound"));
const AiCourseCreator = lazy(() => import("./pages/AiCourseCreator"));
const CoursePlayer = lazy(() => import("./pages/courses/CoursePlayer"));
const PlacementPrep = lazy(() => import("./pages/PlacementPrep"));
const JobUpdates = lazy(() => import("./pages/JobUpdates"));
const JobDetail = lazy(() => import("./pages/JobDetail"));
const ResumeBuilder = lazy(() => import("./pages/ResumeBuilder"));
const SupabaseStatus = lazy(() => import("./pages/dev/SupabaseStatus"));

function ScrollToHash() {
  const { hash } = useLocation();
  useEffect(() => {
    if (hash) {
      const id = hash.replace('#', '');
      const el = document.getElementById(id);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }
  }, [hash]);
  return null;
}

function RoleLanding() {
  const [role, setRole] = useState<AppRole | null>(null);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setChecked(true);
        return;
      }

      const { data } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .maybeSingle();

      if (data?.role === "admin" || data?.role === "teacher" || data?.role === "student") {
        setRole(data.role);
      }
      setChecked(true);
    };

    load();
  }, []);

  if (!checked) return null;

  if (!role || role === "student") {
    return <Navigate to="/dashboard" replace />;
  }

  if (role === "teacher") {
    return <Navigate to="/teacher" replace />;
  }

  if (role === "admin") {
    return <Navigate to="/admin" replace />;
  }

  return <Navigate to="/dashboard" replace />;
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <ScrollToHash />
        <Suspense fallback={<div className="min-h-screen bg-[#0a0a0c] text-white grid place-items-center">Loading...</div>}>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/auth" element={<Auth />} />
            <Route path="/login" element={<Navigate to="/auth?tab=login" replace />} />
            <Route path="/signup" element={<Navigate to="/auth?tab=signup" replace />} />
            <Route path="/home" element={<RoleLanding />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/study-rooms" element={<StudyRooms />} />
            <Route path="/study-room/:roomId" element={<StudyRoom />} />
            <Route path="/analytics" element={<Analytics />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="/flashcards" element={<Flashcards />} />
            <Route path="/quiz" element={<Quiz />} />
            <Route path="/games" element={<Games />} />
            <Route path="/games/:gameId" element={<GameTemplate />} />
            <Route path="/videos" element={<VideoLibrary />} />
            <Route path="/video/:videoId" element={<VideoPlayer />} />
            <Route path="/teacher" element={<TeacherDashboard />} />
            <Route path="/admin" element={<AdminDashboard />} />
            <Route path="/admin/users" element={<UserManagement />} />
            <Route path="/admin/rooms" element={<RoomManagement />} />
            <Route path="/admin/content" element={<ContentModeration />} />
            <Route path="/admin/analytics" element={<PlatformAnalytics />} />
            <Route path="/admin/sessions" element={<SessionManagement />} />
            {import.meta.env.DEV && (
              <Route path="/dev/supabase" element={<SupabaseStatus />} />
            )}
            <Route path="/teacher/notes" element={<TeacherNotes />} />
            <Route path="/teacher/quizzes" element={<TeacherQuizzes />} />
            <Route path="/teacher/students" element={<TeacherStudents />} />
            <Route path="/teacher/learning-styles" element={<TeacherLearningStyles />} />
            <Route path="/admin/learning-styles" element={<AdminLearningStyles />} />
            <Route path="/admin/ai-courses" element={<AiCourseOversight />} />
            <Route path="/learning-style-quiz" element={<LearningStyleQuiz />} />
            <Route path="/ai-course-creator" element={<AiCourseCreator />} />
            <Route path="/course-view" element={<CoursePlayer />} />
            <Route path="/placement-prep" element={<PlacementPrep />} />
            <Route path="/jobs" element={<JobUpdates />} />
            <Route path="/jobs/:jobId" element={<JobDetail />} />
            <Route path="/resume-builder" element={<ResumeBuilder />} />
            <Route path="/video-library" element={<Navigate to="/videos" replace />} />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
