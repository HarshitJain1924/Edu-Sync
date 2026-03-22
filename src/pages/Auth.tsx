import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { User, Session } from "@supabase/supabase-js";
import { loginSchema, signupSchema } from "@/lib/validations";
import { z } from 'zod';

const Auth = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(false);

  // Login form state
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");

  // Signup form state
  const [signupEmail, setSignupEmail] = useState("");
  const [signupPassword, setSignupPassword] = useState("");
  const [signupUsername, setSignupUsername] = useState("");

  useEffect(() => {
    // Set up auth state listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        
        if (session?.user) {
          // Check user role and redirect to appropriate dashboard
          const { data: roleData } = await supabase
            .from("user_roles")
            .select("role")
            .eq("user_id", session.user.id)
            .maybeSingle();

          if (roleData?.role === "admin") {
            navigate("/admin");
          } else if (roleData?.role === "teacher") {
            navigate("/teacher");
          } else {
            navigate("/dashboard");
          }
        }
      }
    );

    // Check for existing session
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      
      if (session?.user) {
        // Check user role and redirect to appropriate dashboard
        const { data: roleData } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", session.user.id)
          .maybeSingle();

        if (roleData?.role === "admin") {
          navigate("/admin");
        } else if (roleData?.role === "teacher") {
          navigate("/teacher");
        } else {
          navigate("/dashboard");
        }
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const validated = loginSchema.parse({
        email: loginEmail,
        password: loginPassword,
      });

      const { error } = await supabase.auth.signInWithPassword({
        email: validated.email,
        password: validated.password,
      });

      if (error) throw error;

      toast({
        title: "Success",
        description: "Logged in successfully!",
      });
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        toast({
          title: "Validation Error",
          description: error.errors[0].message,
          variant: "destructive",
        });
      } else {
        toast({
          title: "Error",
          description: "Invalid email or password. Please try again.",
          variant: "destructive",
        });
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const validated = signupSchema.parse({
        email: signupEmail,
        password: signupPassword,
        username: signupUsername,
      });

      const redirectUrl = `${window.location.origin}/`;

      const { data, error } = await supabase.auth.signUp({
        email: validated.email,
        password: validated.password,
        options: {
          emailRedirectTo: redirectUrl,
          data: {
            username: validated.username,
          }
        }
      });

      if (error) throw error;

      if (data?.user && !data?.session) {
        toast({
          title: "Check your email",
          description: "We sent a confirmation link to complete signup.",
        });
      } else {
        toast({
          title: "Success",
          description: "Account created! You can now log in.",
        });
      }
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        toast({
          title: "Validation Error",
          description: error.errors[0].message,
          variant: "destructive",
        });
      } else {
        toast({
          title: "Signup failed",
          description: error?.message || "Failed to create account. Please try again.",
          variant: "destructive",
        });
        if (import.meta.env.DEV) {
          // Log full error in dev for easier debugging
          // eslint-disable-next-line no-console
          console.error("Signup error:", error);
        }
      }
    } finally {
      setLoading(false);
    }
  };

  const [activeTab, setActiveTab] = useState<"login" | "signup">("login");

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-[#020202] p-4 relative overflow-hidden transition-colors duration-500">
      {/* Ambient Depth Orbs */}
      <div className="absolute inset-0 -z-10 pointer-events-none overflow-hidden opacity-50 dark:opacity-100">
        <div className="absolute top-[-10%] left-[20%] w-[600px] h-[600px] bg-primary/25 blur-[150px] rounded-full mix-blend-screen animate-pulse" />
        <div className="absolute bottom-[-15%] right-[10%] w-[500px] h-[500px] bg-secondary/20 blur-[130px] rounded-full mix-blend-screen" />
        <div className="absolute top-[40%] right-[30%] w-[300px] h-[300px] bg-tertiary/15 blur-[100px] rounded-full mix-blend-screen" />
      </div>

      {/* Grid Dot Overlay (dark mode only) */}
      <div className="absolute inset-0 -z-[5] pointer-events-none dark:bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIzMCIgaGVpZ2h0PSIzMCI+CjxyZWN0IHdpZHRoPSIzMCIgaGVpZ2h0PSIzMCIgZmlsbD0ibm9uZSI+PC9yZWN0Pgo8Y2lyY2xlIGN4PSIyIiBjeT0iMiIgcj0iMC43IiBmaWxsPSJyZ2JhKDI1NSwyNTUsMjU1LDAuMDQpIj48L2NpcmNsZT4KPC9zdmc+')] dark:opacity-80"></div>

      <div className="w-full max-w-md relative z-10">
        {/* Logo & Branding */}
        <div className="flex flex-col items-center mb-10">
          <button onClick={() => navigate("/")} className="group flex items-center gap-3 mb-6 transition-transform duration-300 hover:scale-105">
            <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-fuchsia-500 to-indigo-500 text-sm font-bold text-white shadow-[0_0_20px_rgba(168,85,247,0.4)] group-hover:shadow-[0_0_30px_rgba(168,85,247,0.6)] transition-shadow duration-500">E</span>
            <span className="font-headline text-2xl font-bold tracking-tight text-slate-900 dark:text-white">EduSync</span>
            <span className="rounded-full border border-slate-200 dark:border-white/15 px-2 py-0.5 font-label text-[9px] font-semibold uppercase tracking-[0.14em] text-indigo-500 dark:text-indigo-300">2026</span>
          </button>
          <h1 className="text-3xl font-headline font-bold text-slate-900 dark:text-white tracking-tight mb-2">
            {activeTab === "login" ? "Welcome back." : "Join the nebula."}
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">
            {activeTab === "login" ? "Log in to continue your journey." : "Create your account and start learning."}
          </p>
        </div>

        {/* Glassmorphism Card */}
        <div className="bg-white/80 dark:bg-[#0a0a0c]/80 backdrop-blur-3xl rounded-[2rem] border border-slate-200 dark:border-white/[0.06] p-8 md:p-10 shadow-xl dark:shadow-[0_30px_60px_-15px_rgba(0,0,0,0.8)] transition-all duration-500 hover:shadow-2xl dark:hover:shadow-[0_40px_80px_-20px_rgba(204,151,255,0.1)] relative overflow-hidden">
          {/* Top gradient line */}
          <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-primary/50 to-transparent"></div>
          
          {/* Tab Switcher */}
          <div className="flex gap-1 bg-slate-100 dark:bg-white/5 rounded-full p-1 mb-8 border border-slate-200/50 dark:border-white/[0.03]">
            <button
              onClick={() => setActiveTab("login")}
              className={`flex-1 py-2.5 text-xs font-bold font-label uppercase tracking-[0.15em] rounded-full transition-all duration-300 ${
                activeTab === "login"
                  ? "bg-white dark:bg-white/10 text-slate-900 dark:text-white shadow-md dark:shadow-[0_0_15px_rgba(204,151,255,0.15)]"
                  : "text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
              }`}
            >
              Login
            </button>
            <button
              onClick={() => setActiveTab("signup")}
              className={`flex-1 py-2.5 text-xs font-bold font-label uppercase tracking-[0.15em] rounded-full transition-all duration-300 ${
                activeTab === "signup"
                  ? "bg-white dark:bg-white/10 text-slate-900 dark:text-white shadow-md dark:shadow-[0_0_15px_rgba(204,151,255,0.15)]"
                  : "text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
              }`}
            >
              Sign Up
            </button>
          </div>

          {/* Login Form */}
          {activeTab === "login" && (
            <form onSubmit={handleLogin} className="space-y-5 animate-[fadeSlideUp_0.4s_ease-out_forwards]">
              <div className="space-y-2">
                <label htmlFor="login-email" className="block text-xs font-bold font-label uppercase tracking-[0.15em] text-slate-500 dark:text-slate-400">Email</label>
                <input
                  id="login-email"
                  type="email"
                  placeholder="you@university.edu"
                  value={loginEmail}
                  onChange={(e) => setLoginEmail(e.target.value)}
                  required
                  className="w-full bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl px-4 py-3 text-sm text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 outline-none focus:border-primary/50 dark:focus:border-primary/40 focus:ring-2 focus:ring-primary/20 transition-all duration-300 font-medium shadow-inner"
                />
              </div>
              <div className="space-y-2">
                <label htmlFor="login-password" className="block text-xs font-bold font-label uppercase tracking-[0.15em] text-slate-500 dark:text-slate-400">Password</label>
                <input
                  id="login-password"
                  type="password"
                  placeholder="••••••••"
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  required
                  className="w-full bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl px-4 py-3 text-sm text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 outline-none focus:border-primary/50 dark:focus:border-primary/40 focus:ring-2 focus:ring-primary/20 transition-all duration-300 font-medium shadow-inner"
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-gradient-to-r from-fuchsia-500 to-indigo-500 text-white font-headline font-bold text-sm py-3.5 rounded-xl hover:scale-[1.02] active:scale-[0.98] transition-all duration-300 shadow-[0_8px_30px_-5px_rgba(168,85,247,0.4)] hover:shadow-[0_12px_40px_-5px_rgba(168,85,247,0.6)] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 relative overflow-hidden group"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/20 to-white/0 translate-x-[-200%] group-hover:translate-x-[200%] transition-transform duration-700"></div>
                <span className="relative z-10">{loading ? "Signing in..." : "Sign In"}</span>
              </button>
            </form>
          )}

          {/* Signup Form */}
          {activeTab === "signup" && (
            <form onSubmit={handleSignup} className="space-y-5 animate-[fadeSlideUp_0.4s_ease-out_forwards]">
              <div className="space-y-2">
                <label htmlFor="signup-username" className="block text-xs font-bold font-label uppercase tracking-[0.15em] text-slate-500 dark:text-slate-400">Username</label>
                <input
                  id="signup-username"
                  type="text"
                  placeholder="johndoe"
                  value={signupUsername}
                  onChange={(e) => setSignupUsername(e.target.value)}
                  required
                  className="w-full bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl px-4 py-3 text-sm text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 outline-none focus:border-primary/50 dark:focus:border-primary/40 focus:ring-2 focus:ring-primary/20 transition-all duration-300 font-medium shadow-inner"
                />
              </div>
              <div className="space-y-2">
                <label htmlFor="signup-email" className="block text-xs font-bold font-label uppercase tracking-[0.15em] text-slate-500 dark:text-slate-400">Email</label>
                <input
                  id="signup-email"
                  type="email"
                  placeholder="you@university.edu"
                  value={signupEmail}
                  onChange={(e) => setSignupEmail(e.target.value)}
                  required
                  className="w-full bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl px-4 py-3 text-sm text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 outline-none focus:border-primary/50 dark:focus:border-primary/40 focus:ring-2 focus:ring-primary/20 transition-all duration-300 font-medium shadow-inner"
                />
              </div>
              <div className="space-y-2">
                <label htmlFor="signup-password" className="block text-xs font-bold font-label uppercase tracking-[0.15em] text-slate-500 dark:text-slate-400">Password</label>
                <input
                  id="signup-password"
                  type="password"
                  placeholder="Min 8 characters"
                  value={signupPassword}
                  onChange={(e) => setSignupPassword(e.target.value)}
                  required
                  minLength={8}
                  className="w-full bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl px-4 py-3 text-sm text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 outline-none focus:border-primary/50 dark:focus:border-primary/40 focus:ring-2 focus:ring-primary/20 transition-all duration-300 font-medium shadow-inner"
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-gradient-to-r from-fuchsia-500 to-indigo-500 text-white font-headline font-bold text-sm py-3.5 rounded-xl hover:scale-[1.02] active:scale-[0.98] transition-all duration-300 shadow-[0_8px_30px_-5px_rgba(168,85,247,0.4)] hover:shadow-[0_12px_40px_-5px_rgba(168,85,247,0.6)] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 relative overflow-hidden group"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/20 to-white/0 translate-x-[-200%] group-hover:translate-x-[200%] transition-transform duration-700"></div>
                <span className="relative z-10">{loading ? "Creating account..." : "Create Account"}</span>
              </button>
            </form>
          )}

          {/* Divider */}
          <div className="flex items-center gap-4 my-6">
            <div className="flex-1 h-px bg-slate-200 dark:bg-white/5"></div>
            <span className="text-[10px] text-slate-400 uppercase tracking-[0.15em] font-bold">or</span>
            <div className="flex-1 h-px bg-slate-200 dark:bg-white/5"></div>
          </div>

          {/* Social Login Buttons */}
          <div className="flex gap-3">
            <button className="flex-1 flex items-center justify-center gap-2 border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 rounded-xl py-3 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/10 hover:border-slate-300 dark:hover:border-white/20 transition-all duration-300 shadow-sm">
              <svg className="w-4 h-4" viewBox="0 0 24 24"><path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/><path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
              Google
            </button>
            <button className="flex-1 flex items-center justify-center gap-2 border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 rounded-xl py-3 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/10 hover:border-slate-300 dark:hover:border-white/20 transition-all duration-300 shadow-sm">
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/></svg>
              GitHub
            </button>
          </div>
        </div>

        {/* Footer */}
        <p className="text-center text-xs text-slate-400 mt-8 font-medium">
          By continuing, you agree to our <a href="#" className="text-primary hover:underline">Terms</a> and <a href="#" className="text-primary hover:underline">Privacy Policy</a>.
        </p>
      </div>
    </div>
  );
};

export default Auth;
