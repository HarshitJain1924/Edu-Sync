import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, useLocation, Navigate } from "react-router-dom";
import { useEffect, useState } from "react";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import StudyRooms from "./pages/StudyRooms";
import StudyRoom from "./pages/StudyRoom";
import Analytics from "./pages/Analytics";
import Settings from "./pages/Settings";
import Flashcards from "./pages/Flashcards";
import Quiz from "./pages/Quiz";
import Games from "./pages/Games";
import GameTemplate from "./pages/games/GameTemplate";
import VideoLibrary from "./pages/VideoLibrary";
import VideoPlayer from "./pages/VideoPlayer";
import TeacherDashboard from "./pages/TeacherDashboard";
import TeacherNotes from "./pages/teacher/Notes";
import TeacherQuizzes from "./pages/teacher/Quizzes";
import TeacherStudents from "./pages/teacher/Students";
import TeacherLearningStyles from "./pages/teacher/LearningStyles";
import AdminDashboard from "./pages/AdminDashboard";
import UserManagement from "./pages/admin/UserManagement";
import RoomManagement from "./pages/admin/RoomManagement";
import ContentModeration from "./pages/admin/ContentModeration";
import PlatformAnalytics from "./pages/admin/PlatformAnalytics";
import SessionManagement from "./pages/admin/SessionManagement";
import AdminLearningStyles from "./pages/admin/LearningStyles";
import AiCourseOversight from "./pages/admin/AiCourseOversight";
import LearningStyleQuiz from "./pages/LearningStyleQuiz";
import NotFound from "./pages/NotFound";
import AiCourseCreator from "./pages/AiCourseCreator";
import CoursePlayer from "./pages/courses/CoursePlayer";
import PlacementPrep from "./pages/PlacementPrep";
import JobUpdates from "./pages/JobUpdates";
import JobDetail from "./pages/JobDetail";
import ResumeBuilder from "./pages/ResumeBuilder";
import SupabaseStatus from "./pages/dev/SupabaseStatus";
import { supabase } from "@/integrations/supabase/client";

type AppRole = "student" | "teacher" | "admin";

const queryClient = new QueryClient();

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
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/auth" element={<Auth />} />
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
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
