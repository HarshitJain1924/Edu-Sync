import { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Brain, BookOpen, Video, TrendingUp, Users, Settings, LogOut, Gamepad2, GraduationCap, Briefcase, Sparkles, ChevronLeft, ChevronRight, FileText, LayoutGrid } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";

type AppRole = "student" | "teacher" | "admin";
type NavItem = { path: string; label: string; icon: LucideIcon };
type NavSection = { title: string; items: NavItem[] };

export const AppSidebar = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [role, setRole] = useState<AppRole | null>(null);
  const [userName, setUserName] = useState<string>("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [isCollapsed, setIsCollapsed] = useState(false);

  const SIDEBAR_COLLAPSE_KEY = "edusync.sidebar.collapsed";

  useEffect(() => {
    const loadRole = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: userRoleRow } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .maybeSingle();

      // Load profile info
      const { data: profile } = await supabase
        .from("profiles")
        .select("username, avatar_url, role")
        .eq("id", user.id)
        .maybeSingle();

      // Prefer user_roles, but fall back to profiles.role for compatibility.
      const resolvedRole =
        userRoleRow?.role ||
        (profile?.role === "teacher" || profile?.role === "admin" || profile?.role === "student"
          ? profile.role
          : "student");

      if (resolvedRole === "teacher" || resolvedRole === "admin" || resolvedRole === "student") {
        setRole(resolvedRole);
      } else {
        setRole("student");
      }

      const username = profile?.username || user.user_metadata?.username || user.email?.split("@")[0] || "User";
      setUserName(username);

      if (profile?.avatar_url) {
        setAvatarUrl(profile.avatar_url);
      }
    };

    loadRole();
  }, []);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(SIDEBAR_COLLAPSE_KEY);
      setIsCollapsed(raw === "1");
    } catch {
      setIsCollapsed(false);
    }
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/");
  };

  const isActive = (path: string) => location.pathname === path;
  const activeRole: AppRole = role ?? "student";

  const getHomePath = () => {
    if (activeRole === "admin") return "/admin";
    if (activeRole === "teacher") return "/teacher";
    return "/dashboard";
  };

  const toggleCollapsed = () => {
    setIsCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(SIDEBAR_COLLAPSE_KEY, next ? "1" : "0");
        window.dispatchEvent(new Event("edusync:sidebar-toggled"));
      } catch {
        // ignore storage errors
      }
      return next;
    });
  };

  const navItemClass = (path: string) =>
    `w-full ${isCollapsed ? "justify-center" : "justify-start"} gap-2.5 relative overflow-hidden h-9 ${isCollapsed ? "px-2" : "px-3"} rounded-lg transition-all duration-200 ${isActive(path)
      ? "bg-slate-900/10 dark:bg-white/10 text-slate-900 dark:text-white border border-slate-300 dark:border-white/15 font-semibold"
      : "text-slate-600 dark:text-zinc-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-900/5 dark:hover:bg-white/5"
    }`;

  const renderNavItem = (item: { path: string; label: string; icon: LucideIcon }) => (
    <TooltipProvider key={item.path} delayDuration={0}>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            className={cn(
              "w-full h-11 transition-all duration-200 relative group shrink-0 rounded-xl mb-1",
              isCollapsed ? "justify-center px-0" : "justify-start px-4 gap-3",
              isActive(item.path)
                ? "bg-slate-900/10 dark:bg-white/10 text-slate-900 dark:text-white border border-slate-300 dark:border-white/15 font-semibold"
                : "text-slate-600 dark:text-zinc-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-900/5 dark:hover:bg-white/5"
            )}
            onClick={() => navigate(item.path)}
          >
            <item.icon className={cn(
              "h-5 w-5 transition-transform duration-200",
              isActive(item.path) ? "text-slate-900 dark:text-white" : ""
            )} />
            {!isCollapsed && (
              <motion.span 
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                className="text-sm truncate"
              >
                {item.label}
              </motion.span>
            )}
          </Button>
        </TooltipTrigger>
        {isCollapsed && (
          <TooltipContent side="right" className="bg-slate-900 text-white border-white/10 text-[10px] font-bold px-3 py-1.5 rounded-lg shadow-xl">
            {item.label}
          </TooltipContent>
        )}
      </Tooltip>
    </TooltipProvider>
  );

  const navSectionsByRole: Record<AppRole, NavSection[]> = {
    student: [
      {
        title: "Learning",
        items: [
          { path: "/dashboard", label: "Dashboard", icon: BookOpen },
          { path: "/study-rooms", label: "Study Rooms", icon: Users },
          { path: "/notes", label: "Notes", icon: FileText },
          { path: "/videos", label: "Video Learning", icon: Video },
          { path: "/analytics", label: "Analytics", icon: TrendingUp },
          { path: "/quiz", label: "Practice Hub", icon: Brain },
          { path: "/games", label: "Play & Prepare", icon: Gamepad2 },
        ],
      },
      {
        title: "Placements",
        items: [
          { path: "/placement-prep", label: "Placement Prep", icon: GraduationCap },
          { path: "/jobs", label: "Job Updates", icon: Briefcase },
          { path: "/resume-builder", label: "Resume Builder", icon: FileText },
        ],
      },
      {
        title: "Skills",
        items: [{ path: "/ai-course-creator", label: "Learn A Skill", icon: Sparkles }],
      },
    ],
    teacher: [
      {
        title: "Teaching",
        items: [
          { path: "/teacher", label: "Teacher Dashboard", icon: LayoutGrid },
          { path: "/teacher/students", label: "Students", icon: Users },
          { path: "/teacher/quizzes", label: "Quizzes", icon: Brain },
          { path: "/teacher/notes", label: "Teaching Notes", icon: FileText },
          { path: "/teacher/learning-styles", label: "Learning Styles", icon: TrendingUp },
          { path: "/study-rooms", label: "Classrooms", icon: Video },
        ],
      },
      {
        title: "Resources",
        items: [
          { path: "/notes", label: "Notes Library", icon: BookOpen },
          { path: "/videos", label: "Video Library", icon: Video },
        ],
      },
    ],
    admin: [
      {
        title: "Administration",
        items: [
          { path: "/admin", label: "Admin Dashboard", icon: Settings },
          { path: "/admin/users", label: "User Management", icon: Users },
          { path: "/admin/rooms", label: "Room Management", icon: Video },
          { path: "/admin/sessions", label: "Session Management", icon: LayoutGrid },
          { path: "/admin/content", label: "Content Moderation", icon: FileText },
          { path: "/admin/analytics", label: "Platform Analytics", icon: TrendingUp },
          { path: "/admin/learning-styles", label: "Learning Styles", icon: Brain },
          { path: "/admin/ai-courses", label: "AI Course Oversight", icon: Sparkles },
          { path: "/placement-prep", label: "Placement Question Bank", icon: GraduationCap },
        ],
      },
      {
        title: "Workspace",
        items: [
          { path: "/study-rooms", label: "Study Rooms", icon: Users },
          { path: "/notes", label: "Notes Library", icon: BookOpen },
        ],
      },
    ],
  };

  const navSections = navSectionsByRole[activeRole];

  return (
    <aside className={cn(
      "fixed left-0 top-0 h-full overflow-visible transition-all duration-300 z-50 flex flex-col",
      isCollapsed ? "w-16" : "w-64",
      "bg-[linear-gradient(180deg,rgba(250,251,255,0.98)_0%,rgba(244,246,252,0.98)_56%,rgba(239,242,250,0.99)_100%)] dark:bg-[linear-gradient(180deg,rgba(17,18,24,0.98)_0%,rgba(12,13,18,0.98)_56%,rgba(10,11,16,0.99)_100%)] backdrop-blur-md border-r border-slate-200/80 dark:border-white/10"
    )}>
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-12 -right-10 h-40 w-40 rounded-full bg-violet-500/8 dark:bg-violet-500/10 blur-3xl" />
        <div className="absolute top-1/2 -left-10 h-36 w-36 rounded-full bg-indigo-500/[0.06] dark:bg-indigo-500/[0.08] blur-3xl" />
        <div className="absolute bottom-8 right-0 h-28 w-28 rounded-full bg-violet-400/[0.06] dark:bg-violet-400/[0.08] blur-3xl" />
      </div>

      {/* Floating Toggle Button */}
      <button
        onClick={toggleCollapsed}
        className="absolute -right-3.5 top-10 h-7 w-7 rounded-full bg-slate-100 dark:bg-[#1e2330] border border-slate-300 dark:border-white/10 flex items-center justify-center text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:border-slate-400 dark:hover:border-blue-500/50 shadow-lg shadow-black/10 dark:shadow-black/50 transition-all z-[70] translate-x-1"
      >
        {isCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
      </button>

      <div className={cn("p-3 flex-1 min-h-0 flex flex-col", isCollapsed ? "p-3" : "p-4")}>
        {/* Logo Section */}
        <button
          type="button"
          onClick={() => navigate(getHomePath())}
          className={cn(
            "flex items-center mb-6 cursor-pointer group",
            isCollapsed ? "justify-center" : "gap-2"
          )}
          title="EduSync"
        >
          <div className="p-2 bg-slate-100 dark:bg-zinc-900 rounded-lg border border-slate-300 dark:border-white/10 transition-all duration-300 group-hover:bg-slate-200 dark:group-hover:bg-zinc-800">
            <Brain className="h-5 w-5 text-slate-900 dark:text-white" />
          </div>
          {!isCollapsed && <span className="text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">EduSync</span>}
        </button>

        {/* Toggle Button removed from inside */}

        <ScrollArea className="flex-1 min-h-0 pr-1">
          <nav className="space-y-3 pb-2">
            {navSections.map((section) => (
              <div key={section.title}>
                {!isCollapsed && (
                  <p className="px-2 mb-1 text-[10px] uppercase tracking-wider text-slate-500 dark:text-zinc-500 font-semibold">
                    {section.title}
                  </p>
                )}
                <div className="space-y-1">{section.items.map(renderNavItem)}</div>
              </div>
            ))}
          </nav>
        </ScrollArea>

        {/* User Profile Section */}
        <div className="mt-2 pt-3 border-t border-slate-300 dark:border-white/10 space-y-2 shrink-0">
          <div
            className={cn(
              "w-full flex items-center",
              isCollapsed ? "justify-center py-1" : "justify-between px-2 py-1"
            )}
            title="Theme"
          >
            {!isCollapsed && <span className="text-sm text-slate-500 dark:text-zinc-400">Theme</span>}
            <ThemeToggle compact={isCollapsed} />
          </div>

          <button
            onClick={() => navigate("/settings")}
            className={cn(
              "w-full flex items-center p-2.5 rounded-xl hover:bg-slate-900/5 dark:hover:bg-white/5 transition-colors cursor-pointer group border border-transparent hover:border-slate-300 dark:hover:border-white/10",
              isCollapsed ? "justify-center" : "gap-3"
            )}
            title={userName || "Profile"}
          >
            <Avatar className="h-10 w-10 ring-1 ring-slate-300 dark:ring-white/10 transition-all">
              {avatarUrl && <AvatarImage src={avatarUrl} alt={userName} />}
              <AvatarFallback className="bg-slate-200 dark:bg-zinc-800 text-slate-900 dark:text-white">
                {userName.charAt(0).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            {!isCollapsed && (
              <div className="flex-1 text-left min-w-0">
                <p className="text-sm font-medium leading-none text-slate-900 dark:text-white transition-colors">{userName}</p>
                <p className="text-xs text-slate-500 dark:text-zinc-500 mt-1 capitalize">{role || "student"}</p>
              </div>
            )}
          </button>

          <Button
            variant="ghost"
            className={cn(
              "w-full text-slate-600 dark:text-zinc-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-900/5 dark:hover:bg-white/5 transition-colors border border-transparent hover:border-slate-300 dark:hover:border-white/10",
              isCollapsed ? "justify-center px-0" : "justify-start gap-3"
            )}
            onClick={handleLogout}
            title="Logout"
          >
            <LogOut className="h-5 w-5" />
            {!isCollapsed && "Logout"}
          </Button>
        </div>
      </div>
    </aside>
  );
};

export default AppSidebar;
