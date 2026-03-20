import { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Brain, BookOpen, Video, TrendingUp, Users, Settings, LogOut, Gamepad2, GraduationCap, Briefcase, Sparkles, ChevronLeft, ChevronRight, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

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
      } catch {
        // ignore storage errors
      }
      return next;
    });
  };

  const navItemClass = (path: string) =>
    `w-full ${isCollapsed ? "justify-center" : "justify-start"} gap-3 relative overflow-hidden h-10 ${isCollapsed ? "px-2" : "px-3"} rounded-lg transition-all duration-200 ${
      isActive(path)
        ? "bg-[#1a263f] text-[#60a5fa] border border-[#2563eb]/40 font-semibold"
        : "text-gray-300 hover:text-white hover:bg-white/5"
    }`;

  const renderNavItem = (item: { path: string; label: string; icon: any }) => (
    <Button
      key={item.path}
      variant="ghost"
      className={navItemClass(item.path)}
      onClick={() => navigate(item.path)}
      title={item.label}
    >
      {isActive(item.path) && <div className="absolute left-0 top-1/2 -translate-y-1/2 h-6 w-1 rounded-r bg-[#3b82f6]" />}
      <item.icon className={`h-4.5 w-4.5 ${isActive(item.path) ? "text-[#60a5fa]" : "text-gray-400"}`} />
      {!isCollapsed && <span className="text-sm truncate">{item.label}</span>}
    </Button>
  );

  const learningItems = [
    { path: getHomePath(), label: "Dashboard", icon: BookOpen },
    { path: "/study-rooms", label: "Study Rooms", icon: Video },
    { path: "/videos", label: "Video Learning", icon: Video },
    { path: "/analytics", label: "Analytics", icon: TrendingUp },
    { path: "/flashcards", label: "Flashcards", icon: BookOpen },
    { path: "/quiz", label: "Quizzes", icon: Brain },
    { path: "/games", label: "Play & Prepare", icon: Gamepad2 },
  ];

  const placementItems = [
    { path: "/placement-prep", label: "Placement Prep", icon: GraduationCap },
    { path: "/jobs", label: "Job Updates", icon: Briefcase },
    { path: "/resume-builder", label: "Resume Builder", icon: FileText },
  ];

  const skillItems = [{ path: "/ai-course-creator", label: "Learn A Skill", icon: Sparkles }];

  return (
    <aside className={`fixed left-0 top-0 h-full ${isCollapsed ? "w-16" : "w-64"} bg-[#0b1224]/95 backdrop-blur-xl border-r border-white/10 z-50 flex flex-col transition-all duration-300`}>
      <div className={`${isCollapsed ? "p-3" : "p-5"} flex-1 flex flex-col`}> 
        <button
          type="button"
          onClick={() => navigate("/dashboard")}
          className={`flex items-center ${isCollapsed ? "justify-center" : "gap-2"} mb-5 cursor-pointer group`}
          title="EduSync"
        >
          <div className="p-2 bg-gradient-to-br from-primary to-indigo-600 rounded-lg shadow-md transition-all duration-300">
            <Brain className="h-5 w-5 text-white" />
          </div>
          {!isCollapsed && <span className="text-3xl font-extrabold text-white tracking-tight">EduSync</span>}
        </button>

        <Button
          type="button"
          variant="ghost"
          onClick={toggleCollapsed}
          className={`mb-4 h-9 ${isCollapsed ? "w-full justify-center px-0" : "w-full justify-start px-3"} text-gray-300 hover:text-white hover:bg-white/5`}
          title={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {isCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4 mr-2" />}
          {!isCollapsed && <span className="text-sm">Collapse</span>}
        </Button>

        <nav className="space-y-4 flex-1 overflow-y-auto pr-1">
          <div className="space-y-1">{renderNavItem({ path: getHomePath(), label: "Home", icon: BookOpen })}</div>

          <div>
            {!isCollapsed && <p className="px-2 mb-1 text-[11px] uppercase tracking-wider text-gray-500 font-semibold">Learning</p>}
            <div className="space-y-1">{learningItems.slice(1).map(renderNavItem)}</div>
          </div>

          <div>
            {!isCollapsed && <p className="px-2 mb-1 text-[11px] uppercase tracking-wider text-gray-500 font-semibold">Placements</p>}
            <div className="space-y-1">{placementItems.map(renderNavItem)}</div>
          </div>

          <div>
            {!isCollapsed && <p className="px-2 mb-1 text-[11px] uppercase tracking-wider text-gray-500 font-semibold">Skills</p>}
            <div className="space-y-1">{skillItems.map(renderNavItem)}</div>
          </div>

          {(role === "teacher" || role === "admin") && (
            <div>
              {!isCollapsed && <p className="px-2 mb-1 text-[11px] uppercase tracking-wider text-gray-500 font-semibold">Panels</p>}
              <div className="space-y-1">
                {role === "teacher" && renderNavItem({ path: "/teacher", label: "Teacher Panel", icon: Users })}
                {role === "admin" && renderNavItem({ path: "/admin", label: "Admin Panel", icon: Settings })}
              </div>
            </div>
          )}

          <div>
            {!isCollapsed && <p className="px-2 mb-1 text-[11px] uppercase tracking-wider text-gray-500 font-semibold">System</p>}
            <div className="space-y-1">{renderNavItem({ path: "/settings", label: "Settings", icon: Settings })}</div>
          </div>
        </nav>

        {/* User Profile Section */}
        <div className="mt-4 pt-4 border-t border-white/10 space-y-3">
          <button
            onClick={() => navigate("/settings")}
            className={`w-full flex items-center ${isCollapsed ? "justify-center" : "gap-3"} p-3 rounded-xl hover:bg-white/5 transition-colors cursor-pointer group`}
            title={userName || "Profile"}
          >
            <Avatar className="h-10 w-10 ring-2 ring-transparent group-hover:ring-primary transition-all">
              {avatarUrl && <AvatarImage src={avatarUrl} alt={userName} />}
              <AvatarFallback className="bg-gradient-to-br from-primary to-purple-600 text-white">
                {userName.charAt(0).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            {!isCollapsed && (
              <div className="flex-1 text-left min-w-0">
                <p className="text-sm font-medium leading-none text-white group-hover:text-primary transition-colors">{userName}</p>
                <p className="text-xs text-gray-500 mt-1 capitalize group-hover:text-gray-400">{role || "student"}</p>
              </div>
            )}
          </button>

          <Button 
            variant="ghost" 
            className={`w-full ${isCollapsed ? "justify-center px-0" : "justify-start gap-3"} text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-colors`} 
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
