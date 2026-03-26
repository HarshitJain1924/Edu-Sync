import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { 
  ArrowLeft, 
  Loader2, 
  Upload, 
  Shield, 
  Key, 
  Trash2, 
  Bell, 
  Sparkles, 
  Zap, 
  Users, 
  Settings as SettingsIcon, 
  TrendingUp 
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/components/ui/use-toast";
import { useRequireAuth } from "@/hooks/useRequireAuth";
import { supabase } from "@/integrations/supabase/client";
import React from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { motion, AnimatePresence, useMotionValue, useMotionTemplate } from "framer-motion";
import { cn } from "@/lib/utils";

const floatingGlassCardClass = "backdrop-blur-xl bg-white/[0.03] border border-white/10 shadow-[0_8px_32px_0_rgba(0,0,0,0.4)] rounded-3xl";

const SpotlightCard = React.forwardRef<HTMLDivElement, { children: React.ReactNode; className?: string }>(
  ({ children, className = "" }, ref) => {
    const mouseX = useMotionValue(0);
    const mouseY = useMotionValue(0);

    function handleMouseMove({ currentTarget, clientX, clientY }: React.MouseEvent) {
      const { left, top } = currentTarget.getBoundingClientRect();
      mouseX.set(clientX - left);
      mouseY.set(clientY - top);
    }

    return (
      <motion.div
        ref={ref}
        onMouseMove={handleMouseMove}
        whileHover={{ y: -5, scale: 1.01 }}
        transition={{ type: "spring", stiffness: 400, damping: 25 }}
        className={cn("group relative overflow-hidden", className)}
      >
        <motion.div
          className="pointer-events-none absolute -inset-px rounded-3xl opacity-0 transition duration-300 group-hover:opacity-100"
          style={{
            background: useMotionTemplate`
              radial-gradient(
                650px circle at ${mouseX}px ${mouseY}px,
                rgba(139, 92, 246, 0.15),
                transparent 80%
              )
            `,
          }}
        />
        <div className="relative z-10 h-full">{children}</div>
      </motion.div>
    );
  }
);

const Settings = () => {
  useRequireAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [profileLoading, setProfileLoading] = useState(true);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [bio, setBio] = useState("");
  const [userId, setUserId] = useState<string | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  const fileInputId = "avatar-upload-input";
  const AVATAR_BUCKET = "avatars";

  useEffect(() => {
    (async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        setUserId(user.id);
        setEmail(user.email ?? "");

        const { data: profile } = await supabase
          .from("profiles")
          .select("username, avatar_url")
          .eq("id", user.id)
          .maybeSingle();

        const username = profile?.username || user.user_metadata?.full_name || user.user_metadata?.username || user.email?.split("@")[0] || "";
        const [fn, ln] = username.split(" ");
        setFirstName(fn || "");
        setLastName(ln || "");
        setBio((user.user_metadata?.bio as string) || "");

        if (profile?.avatar_url) {
          setAvatarUrl(profile.avatar_url);
        }
      } catch (error) {
        // eslint-disable-next-line no-console
        console.error("Error loading profile settings:", error);
      } finally {
        setProfileLoading(false);
      }
    })();
  }, []);

  const handleSave = async () => {
    try {
      if (!userId) return;
      setSaving(true);

      const username = `${firstName} ${lastName}`.trim() || firstName || lastName;

      const { error: profileError } = await supabase
        .from("profiles")
        .update({ username: username || null })
        .eq("id", userId);

      if (profileError) throw profileError;

      const { error: authUpdateError } = await supabase.auth.updateUser({
        data: {
          username,
          full_name: username,
          first_name: firstName,
          last_name: lastName,
          bio,
        },
      });

      if (authUpdateError) throw authUpdateError;

      toast({
        title: "Settings saved",
        description: "Your profile has been updated.",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error?.message || "Failed to update profile.",
        variant: "destructive",
      });
      // eslint-disable-next-line no-console
      console.error("Error saving settings:", error);
    } finally {
      setSaving(false);
    }
  };

  const handleAvatarChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const inputEl = event.target;
    try {
      if (!userId) return;
      const file = event.target.files?.[0];
      if (!file) return;

      if (!file.type.startsWith("image/")) {
        throw new Error("Please select an image file.");
      }

      const maxSizeBytes = 5 * 1024 * 1024;
      if (file.size > maxSizeBytes) {
        throw new Error("Image size must be 5MB or less.");
      }

      setUploadingAvatar(true);

      const fileExt = file.name.split(".").pop();
      const filePath = `${userId}/${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from(AVATAR_BUCKET)
        .upload(filePath, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data } = supabase.storage.from(AVATAR_BUCKET).getPublicUrl(filePath);
      const publicUrl = data.publicUrl;

      const { error: profileError } = await supabase
        .from("profiles")
        .update({ avatar_url: publicUrl })
        .eq("id", userId);

      if (profileError) throw profileError;

      await supabase.auth.updateUser({
        data: { avatar_url: publicUrl },
      });

      setAvatarUrl(`${publicUrl}?t=${Date.now()}`);

      toast({
        title: "Avatar updated",
        description: "Your profile photo has been updated.",
      });
    } catch (error: any) {
      const rawMessage = error?.message || "Failed to upload avatar.";
      const isBucketMissing = /bucket not found/i.test(rawMessage);
      toast({
        title: "Error",
        description: isBucketMissing
          ? "Avatar storage is not configured yet. Create the 'avatars' bucket in Supabase and try again."
          : rawMessage,
        variant: "destructive",
      });
      console.error("Error uploading avatar:", error);
    } finally {
      setUploadingAvatar(false);
      // Reset the input so the same file can be selected again if needed
      inputEl.value = "";
    }
  };

  const handleDeleteAccount = async () => {
    try {
      if (!userId) return;

      // Delete user's profile data (cascade will handle related data)
      const { error: profileError } = await supabase
        .from("profiles")
        .delete()
        .eq("id", userId);

      if (profileError) throw profileError;

      // Sign out the user
      await supabase.auth.signOut();

      toast({
        title: "Account deleted",
        description: "Your account has been permanently deleted.",
      });

      // Redirect to home page
      navigate("/");
    } catch (error: any) {
      toast({
        title: "Error",
        description: error?.message || "Failed to delete account.",
        variant: "destructive",
      });
      console.error("Error deleting account:", error);
    }
  };

  return (
    <div className="min-h-screen bg-[#020617] text-slate-200 selection:bg-violet-500/30 overflow-x-hidden">
      {/* Background blobs */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-violet-600/10 rounded-full blur-[120px] animate-pulse" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-blue-600/10 rounded-full blur-[120px] animate-pulse" style={{ animationDelay: '2s' }} />
      </div>

      {/* Header */}
      <header className="px-8 py-6 flex items-center justify-between border-b border-white/5 bg-white/[0.02] backdrop-blur-md sticky top-0 z-50">
        <div className="flex items-center gap-6">
          <Button 
            variant="outline" 
            size="icon" 
            onClick={() => navigate("/dashboard")} 
            className="rounded-xl border-white/10 bg-white/5 hover:bg-white/10 hover:border-violet-500/50 transition-all group"
          >
            <ArrowLeft className="h-4 w-4 group-hover:-translate-x-1 transition-transform" />
          </Button>
          <div>
            <h1 className="text-2xl font-black text-white tracking-tight">Intelligence Config</h1>
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">Universal Session Preferences</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Button 
            variant="ghost" 
            onClick={() => navigate("/dashboard")}
            className="text-xs font-bold uppercase tracking-widest text-slate-400 hover:text-white transition-colors"
          >
            Cancel
          </Button>
          <Button 
            onClick={handleSave} 
            disabled={profileLoading || saving}
            className="h-10 bg-violet-600 hover:bg-violet-700 text-white rounded-xl px-6 font-black uppercase tracking-widest shadow-lg shadow-violet-600/20 transition-all active:scale-[0.98]"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            {saving ? "Deploying..." : "Save Changes"}
          </Button>
        </div>
      </header>

      <main className="relative z-10 p-8 max-w-5xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Left Side: Profile & Privacy */}
          <div className="lg:col-span-7 space-y-8">
            {/* Profile Section */}
            <SpotlightCard className={cn(floatingGlassCardClass, "p-8")}>
              <div className="flex items-center gap-6 mb-10">
                <div className="relative group">
                  <div className="absolute -inset-1 bg-gradient-to-r from-violet-600 to-blue-600 rounded-full opacity-25 group-hover:opacity-50 blur transition duration-500"></div>
                  <Avatar className="h-28 w-28 border-2 border-white/10 relative">
                    {avatarUrl && <AvatarImage src={avatarUrl} alt="Profile" />}
                    <AvatarFallback className="bg-slate-900 text-3xl font-black text-white">
                      {firstName.charAt(0).toUpperCase() || "U"}
                    </AvatarFallback>
                  </Avatar>
                  <label 
                    htmlFor={fileInputId}
                    className="absolute bottom-0 right-0 h-9 w-9 bg-violet-600 rounded-full flex items-center justify-center border-2 border-[#020617] cursor-pointer hover:bg-violet-700 transition-colors shadow-xl"
                  >
                    {uploadingAvatar ? <Loader2 className="h-4 w-4 animate-spin text-white" /> : <Upload className="h-4 w-4 text-white" />}
                  </label>
                  <input id={fileInputId} type="file" accept="image/*" className="hidden" onChange={handleAvatarChange} disabled={uploadingAvatar} />
                </div>
                <div>
                  <h2 className="text-xl font-black text-white uppercase tracking-tight">Identity Matrix</h2>
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Personnel data & visual identifier</p>
                  <div className="mt-2 text-xs font-bold text-violet-400 bg-violet-500/10 px-3 py-1 rounded-full border border-violet-500/20 inline-block capitalize">
                    {email}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1">First Name</Label>
                  <Input
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    disabled={profileLoading}
                    className="h-12 bg-white/5 border-white/10 rounded-xl focus:border-violet-500/50 transition-all font-medium"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1">Last Name</Label>
                  <Input
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    disabled={profileLoading}
                    className="h-12 bg-white/5 border-white/10 rounded-xl focus:border-violet-500/50 transition-all font-medium"
                  />
                </div>
              </div>

              <div className="mt-6 space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1">Personnel Intelligence (Bio)</Label>
                <Textarea
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  disabled={profileLoading}
                  maxLength={280}
                  placeholder="Operational background and expertise..."
                  className="min-h-[120px] bg-white/5 border-white/10 rounded-2xl focus:border-violet-500/50 transition-all resize-none font-medium p-4"
                />
                <div className="flex justify-between items-center px-1">
                  <p className="text-[9px] font-black text-slate-600 uppercase tracking-tighter">Maximum 280 characters</p>
                  <p className="text-[10px] font-bold text-slate-500">{bio.length}/280</p>
                </div>
              </div>
            </SpotlightCard>

            {/* Privacy Section */}
            <div className={cn(floatingGlassCardClass, "p-8 border-rose-500/10 bg-rose-500/[0.01]")}>
              <div className="flex items-center gap-4 mb-6">
                <div className="h-10 w-10 rounded-xl bg-rose-500/10 flex items-center justify-center border border-rose-500/20">
                  <Shield className="h-5 w-5 text-rose-500" />
                </div>
                <div>
                  <h2 className="text-lg font-black text-white uppercase tracking-tight">Security Protocol</h2>
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Account integrity & data deletion</p>
                </div>
              </div>

              <div className="space-y-3">
                <Button variant="outline" className="w-full h-11 justify-start gap-4 border-white/5 bg-white/[0.02] hover:bg-white/[0.05] rounded-xl text-xs font-bold uppercase tracking-widest transition-all">
                  <Key className="h-4 w-4 text-slate-500" />
                  Rotate Access Credentials
                </Button>
                <Button variant="outline" className="w-full h-11 justify-start gap-4 border-white/5 bg-white/[0.02] hover:bg-white/[0.05] rounded-xl text-xs font-bold uppercase tracking-widest transition-all">
                  <Shield className="h-4 w-4 text-slate-500" />
                  MFA Configuration
                </Button>
                
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="ghost" className="w-full h-11 justify-start gap-4 hover:bg-rose-500/10 hover:text-rose-400 rounded-xl text-xs font-bold uppercase tracking-widest text-slate-500 transition-all">
                      <Trash2 className="h-4 w-4" />
                      Decommission Account
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent className="bg-[#0a0c14] border border-white/10 text-slate-200 rounded-3xl">
                    <AlertDialogHeader>
                      <AlertDialogTitle className="text-xl font-black text-white uppercase tracking-tight">Immediate Decommissioning?</AlertDialogTitle>
                      <AlertDialogDescription className="text-slate-400 font-medium">
                        This action is irreversible. All student progress, generated intelligence, and neural training data will be purged.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter className="mt-6">
                      <AlertDialogCancel className="bg-white/5 border-white/10 rounded-xl font-bold uppercase tracking-widest h-10 px-6">Abort</AlertDialogCancel>
                      <AlertDialogAction onClick={handleDeleteAccount} className="bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-bold uppercase tracking-widest h-10 px-6">Commence Purge</AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </div>
          </div>

          {/* Right Side: Preferences */}
          <div className="lg:col-span-5 space-y-8">
            <SpotlightCard className={cn(floatingGlassCardClass, "p-8")}>
              <div className="flex items-center gap-4 mb-8">
                <div className="h-10 w-10 rounded-xl bg-violet-500/10 flex items-center justify-center border border-violet-500/20">
                  <SettingsIcon className="h-5 w-5 text-violet-400" />
                </div>
                <div>
                  <h2 className="text-lg font-black text-white uppercase tracking-tight">Neural Sync</h2>
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">UI/UX & Notification nodes</p>
                </div>
              </div>

              <div className="space-y-6">
                {[
                  { label: "Neural Feed Notifications", sub: "Priority updates via secure channels", icon: Bell },
                  { label: "AI Analytic Integration", sub: "Deep-layer learning assistance", icon: Sparkles },
                  { label: "Auto-Node Deployment", sub: "Join sessions automatically", icon: Zap },
                  { label: "Presence Propagation", sub: "Broadcast operational status", icon: Users },
                ].map((pref, i) => (
                  <div key={i} className="flex items-center justify-between p-4 rounded-2xl bg-white/[0.02] border border-white/5 hover:border-white/10 transition-all group">
                    <div className="flex items-center gap-4">
                      <div className="h-10 w-10 rounded-xl bg-slate-900 flex items-center justify-center border border-white/5 group-hover:border-violet-500/30 transition-all">
                        <pref.icon className="h-4 w-4 text-slate-500 group-hover:text-violet-400 transition-colors" />
                      </div>
                      <div className="space-y-0.5">
                        <Label className="text-[11px] font-black text-white uppercase tracking-tight">{pref.label}</Label>
                        <p className="text-[9px] font-bold text-slate-600 uppercase tracking-widest">{pref.sub}</p>
                      </div>
                    </div>
                    <Switch defaultChecked={i !== 2} className="data-[state=checked]:bg-violet-600" />
                  </div>
                ))}
              </div>

              <div className="mt-8 p-4 rounded-2xl bg-blue-500/5 border border-blue-500/10 flex items-center gap-4">
                <div className="h-8 w-8 rounded-lg bg-blue-500/20 flex items-center justify-center shrink-0">
                  <TrendingUp className="h-4 w-4 text-blue-400" />
                </div>
                <p className="text-[9px] font-bold text-blue-400/80 uppercase tracking-widest leading-relaxed">
                  Platform telemetry is optimized for low-latency assessment delivery.
                </p>
              </div>
            </SpotlightCard>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Settings;
