import { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Brain, BookOpen, Video, TrendingUp, Users, Settings, LogOut, Gamepad2, GraduationCap, Briefcase, Sparkles, ChevronLeft, ChevronRight, FileText } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ThemeToggle } from "@/components/ThemeToggle";

type AppRole = "student" | "teacher" | "admin";

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

      const { data } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .maybeSingle();

      if (data?.role === "teacher" || data?.role === "admin" || data?.role === "student") {
        setRole(data.role);
      } else {
        setRole("student");
      }

      // Load profile info
      const { data: profile } = await supabase
        .from("profiles")
        .select("username, avatar_url")
        .eq("id", user.id)
        .maybeSingle();

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

  const getHomePath = () => {
    if (role === "admin") return "/admin";
    if (role === "teacher") return "/teacher";
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
    `w-full ${isCollapsed ? "justify-center" : "justify-start"} gap-2.5 relative overflow-hidden h-9 ${isCollapsed ? "px-2" : "px-3"} rounded-lg transition-all duration-200 ${
      isActive(path)
        ? "bg-slate-900/10 dark:bg-white/10 text-slate-900 dark:text-white border border-slate-300 dark:border-white/15 font-semibold"
        : "text-slate-600 dark:text-zinc-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-900/5 dark:hover:bg-white/5"
    }`;

  const renderNavItem = (item: { path: string; label: string; icon: LucideIcon }) => (
    <Button
      key={item.path}
      variant="ghost"
      className={navItemClass(item.path)}
      onClick={() => navigate(item.path)}
      title={item.label}
    >
      <item.icon className={`h-4.5 w-4.5 ${isActive(item.path) ? "text-slate-900 dark:text-white" : "text-slate-500 dark:text-zinc-400"}`} />
      {!isCollapsed && <span className="text-sm truncate">{item.label}</span>}
    </Button>
  );

  const learningItems = [
    { path: getHomePath(), label: "Dashboard", icon: BookOpen },
    { path: "/study-rooms", label: "Study Rooms", icon: Users },
    { path: "/videos", label: "Video Learning", icon: Video },
    { path: "/analytics", label: "Analytics", icon: TrendingUp },
    { path: "/quiz", label: "Practice Hub", icon: Brain },
    { path: "/games", label: "Play & Prepare", icon: Gamepad2 },
  ];

  const placementItems = [
    { path: "/placement-prep", label: "Placement Prep", icon: GraduationCap },
    { path: "/jobs", label: "Job Updates", icon: Briefcase },
    { path: "/resume-builder", label: "Resume Builder", icon: FileText },
  ];

  const skillItems = [{ path: "/ai-course-creator", label: "Learn A Skill", icon: Sparkles }];

  return (
    <aside className={`fixed left-0 top-0 h-full overflow-hidden ${isCollapsed ? "w-16" : "w-64"} bg-[linear-gradient(180deg,rgba(250,251,255,0.98)_0%,rgba(244,246,252,0.98)_56%,rgba(239,242,250,0.99)_100%)] dark:bg-[linear-gradient(180deg,rgba(17,18,24,0.98)_0%,rgba(12,13,18,0.98)_56%,rgba(10,11,16,0.99)_100%)] backdrop-blur-md border-r border-slate-200/80 dark:border-white/10 z-50 flex flex-col transition-all duration-300`}>
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-12 -right-10 h-40 w-40 rounded-full bg-violet-500/8 dark:bg-violet-500/10 blur-3xl" />
        <div className="absolute top-1/2 -left-10 h-36 w-36 rounded-full bg-indigo-500/[0.06] dark:bg-indigo-500/[0.08] blur-3xl" />
        <div className="absolute bottom-8 right-0 h-28 w-28 rounded-full bg-violet-400/[0.06] dark:bg-violet-400/[0.08] blur-3xl" />
      </div>
      <div className={`${isCollapsed ? "p-3" : "p-4"} flex-1 min-h-0 flex flex-col`}>
        <button
          type="button"
          onClick={() => navigate("/dashboard")}
          className={`flex items-center ${isCollapsed ? "justify-center" : "gap-2"} mb-3 cursor-pointer group`}
          title="EduSync"
        >
          <div className="p-2 bg-slate-100 dark:bg-zinc-900 rounded-lg border border-slate-300 dark:border-white/10 transition-all duration-300 group-hover:bg-slate-200 dark:group-hover:bg-zinc-800">
            <Brain className="h-5 w-5 text-slate-900 dark:text-white" />
          </div>
          {!isCollapsed && <span className="text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">EduSync</span>}
        </button>

        <Button
          type="button"
          variant="ghost"
          onClick={toggleCollapsed}
          className={`mb-2 h-8 ${isCollapsed ? "w-full justify-center px-0" : "w-full justify-start px-3"} text-slate-600 dark:text-zinc-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-900/5 dark:hover:bg-white/5`}
          title={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {isCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4 mr-2" />}
          {!isCollapsed && <span className="text-sm">Collapse</span>}
        </Button>

        <ScrollArea className="flex-1 min-h-0 pr-1">
          <nav className="space-y-3 pb-2">
            <div className="space-y-1">{renderNavItem({ path: getHomePath(), label: "Home", icon: BookOpen })}</div>

            <div>
              {!isCollapsed && <p className="px-2 mb-1 text-[10px] uppercase tracking-wider text-slate-500 dark:text-zinc-500 font-semibold">Learning</p>}
              <div className="space-y-1">{learningItems.slice(1).map(renderNavItem)}</div>
            </div>

            <div>
              {!isCollapsed && <p className="px-2 mb-1 text-[10px] uppercase tracking-wider text-slate-500 dark:text-zinc-500 font-semibold">Placements</p>}
              <div className="space-y-1">{placementItems.map(renderNavItem)}</div>
            </div>

            <div>
              {!isCollapsed && <p className="px-2 mb-1 text-[10px] uppercase tracking-wider text-slate-500 dark:text-zinc-500 font-semibold">Skills</p>}
              <div className="space-y-1">{skillItems.map(renderNavItem)}</div>
            </div>

            {(role === "teacher" || role === "admin") && (
              <div>
                {!isCollapsed && <p className="px-2 mb-1 text-[10px] uppercase tracking-wider text-slate-500 dark:text-zinc-500 font-semibold">Panels</p>}
                <div className="space-y-1">
                  {role === "teacher" && renderNavItem({ path: "/teacher", label: "Teacher Panel", icon: Users })}
                  {role === "admin" && renderNavItem({ path: "/admin", label: "Admin Panel", icon: Settings })}
                </div>
              </div>
            )}

          </nav>
        </ScrollArea>

        {/* User Profile Section */}
        <div className="mt-2 pt-3 border-t border-slate-300 dark:border-white/10 space-y-2 shrink-0">
          <div
            className={`w-full flex items-center ${isCollapsed ? "justify-center py-1" : "justify-between px-2 py-1"}`}
            title="Theme"
          >
            {!isCollapsed && <span className="text-sm text-slate-500 dark:text-zinc-400">Theme</span>}
            <ThemeToggle compact={isCollapsed} />
          </div>

          <button
            onClick={() => navigate("/settings")}
            className={`w-full flex items-center ${isCollapsed ? "justify-center" : "gap-3"} p-2.5 rounded-xl hover:bg-slate-900/5 dark:hover:bg-white/5 transition-colors cursor-pointer group border border-transparent hover:border-slate-300 dark:hover:border-white/10`}
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
            className={`w-full ${isCollapsed ? "justify-center px-0" : "justify-start gap-3"} text-slate-600 dark:text-zinc-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-900/5 dark:hover:bg-white/5 transition-colors border border-transparent hover:border-slate-300 dark:hover:border-white/10`} 
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
