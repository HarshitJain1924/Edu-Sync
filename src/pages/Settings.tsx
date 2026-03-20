import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ArrowLeft, Loader2, Upload } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/components/ui/use-toast";
import { useRequireAuth } from "@/hooks/useRequireAuth";
import { supabase } from "@/integrations/supabase/client";
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
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-card border-b border-border px-6 py-4 flex items-center justify-between shadow-soft">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => navigate("/dashboard")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-xl font-bold">Settings</h1>
            <p className="text-sm text-muted-foreground">Manage your account and preferences</p>
          </div>
        </div>
      </header>

      <main className="p-8 max-w-4xl mx-auto space-y-6">
        {/* Profile */}
        <Card className="shadow-medium">
          <CardHeader>
            <CardTitle>Profile</CardTitle>
            <CardDescription>Update your personal information</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center gap-6">
              <Avatar className="h-24 w-24">
                {avatarUrl && (
                  <AvatarImage src={avatarUrl} alt="Profile avatar" />
                )}
                <AvatarFallback className="bg-gradient-hero text-primary-foreground text-2xl font-bold">
                  {firstName.charAt(0).toUpperCase() || "U"}
                </AvatarFallback>
              </Avatar>
              <input
                id={fileInputId}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleAvatarChange}
              />
              <Button
                variant="outline"
                className="gap-2"
                type="button"
                disabled={uploadingAvatar || profileLoading}
                onClick={() => document.getElementById(fileInputId)?.click()}
              >
                {uploadingAvatar ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                {uploadingAvatar ? "Uploading..." : "Upload Photo"}
              </Button>
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="firstName">First Name</Label>
                <Input
                  id="firstName"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  disabled={profileLoading}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="lastName">Last Name</Label>
                <Input
                  id="lastName"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  disabled={profileLoading}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                disabled
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="bio">Bio</Label>
              <Textarea
                id="bio"
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                disabled={profileLoading}
                maxLength={280}
                placeholder="Tell others what you're learning..."
                className="min-h-24"
              />
              <p className="text-xs text-muted-foreground text-right">{bio.length}/280</p>
            </div>
          </CardContent>
        </Card>

        {/* Preferences */}
        <Card className="shadow-medium">
          <CardHeader>
            <CardTitle>Preferences</CardTitle>
            <CardDescription>Customize your learning experience</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Email Notifications</Label>
                <p className="text-sm text-muted-foreground">Receive updates about your classes</p>
              </div>
              <Switch defaultChecked />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>AI Study Assistant</Label>
                <p className="text-sm text-muted-foreground">Enable AI-powered help in study rooms</p>
              </div>
              <Switch defaultChecked />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Auto-join Sessions</Label>
                <p className="text-sm text-muted-foreground">Automatically join scheduled classes</p>
              </div>
              <Switch />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Show Online Status</Label>
                <p className="text-sm text-muted-foreground">Let others see when you're online</p>
              </div>
              <Switch defaultChecked />
            </div>
          </CardContent>
        </Card>

        {/* Privacy */}
        <Card className="shadow-medium">
          <CardHeader>
            <CardTitle>Privacy & Security</CardTitle>
            <CardDescription>Manage your account security</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button variant="outline" className="w-full justify-start">
              Change Password
            </Button>
            <Button variant="outline" className="w-full justify-start">
              Two-Factor Authentication
            </Button>
            <Button variant="outline" className="w-full justify-start">
              Connected Accounts
            </Button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" className="w-full justify-start">
                  Delete Account
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This action cannot be undone. This will permanently delete your account
                    and remove all your data from our servers including:
                    <ul className="list-disc list-inside mt-2 space-y-1">
                      <li>Your profile information</li>
                      <li>Video progress and interactions</li>
                      <li>Quiz attempts and scores</li>
                      <li>Study rooms and sessions</li>
                      <li>All uploaded content</li>
                    </ul>
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleDeleteAccount}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    Delete Account
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </CardContent>
        </Card>

        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={() => navigate("/dashboard")}>
            Cancel
          </Button>
          <Button variant="hero" onClick={handleSave} disabled={profileLoading || saving}>
            {saving ? (
              <span className="inline-flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                Saving...
              </span>
            ) : (
              "Save Changes"
            )}
          </Button>
        </div>
      </main>
    </div>
  );
};

export default Settings;
