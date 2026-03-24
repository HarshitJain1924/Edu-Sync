import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { FileText, ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/components/ui/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useRequireRole } from "@/hooks/useRequireRole";

interface TeacherRoom {
  id: string;
  name: string;
  is_active?: boolean;
}

interface Material {
  id: string;
  title: string;
  room_id: string | null;
  file_url: string;
  created_at: string;
  room_name?: string;
}

export default function TeacherNotes() {
  useRequireRole("teacher");
  const navigate = useNavigate();
  const { toast } = useToast();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [selectedRoomId, setSelectedRoomId] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [rooms, setRooms] = useState<TeacherRoom[]>([]);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchRoomsAndMaterials = async () => {
    const { data: authData } = await supabase.auth.getUser();
    const user = authData.user;
    if (!user) return;

    const { data: roomData, error: roomError } = await supabase
      .from("study_rooms")
      .select("id, name, is_active")
      .or(`created_by.eq.${user.id},host_id.eq.${user.id}`)
      .eq("is_active", true)
      .order("created_at", { ascending: false });

    if (roomError) throw roomError;

    const teacherRooms = (roomData || []) as TeacherRoom[];
    setRooms(teacherRooms);
    if (!selectedRoomId && teacherRooms.length > 0) {
      setSelectedRoomId(teacherRooms[0].id);
    }

    const { data: materialRows, error: materialError } = await supabase
      .from("session_materials" as any)
      .select("id, title, room_id, file_url, created_at")
      .eq("uploaded_by", user.id)
      .order("created_at", { ascending: false });

    if (materialError) throw materialError;

    const roomNameMap = new Map(teacherRooms.map((r) => [r.id, r.name]));
    setMaterials(
      ((materialRows || []) as Material[]).map((row) => ({
        ...row,
        room_name: roomNameMap.get(row.room_id) || "Room",
      }))
    );
  };

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        await fetchRoomsAndMaterials();
      } catch (error: any) {
        toast({
          title: "Error",
          description: error?.message || "Failed to load notes.",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    })();
  }, [toast]);

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      toast({ title: "Missing title", description: "Enter a title for the material.", variant: "destructive" });
      return;
    }
    if (!file) {
      toast({ title: "Missing file", description: "Choose a PDF or document file.", variant: "destructive" });
      return;
    }

    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const roomSegment = selectedRoomId || "general";
      const filePath = `${roomSegment}/${Date.now()}_${file.name}`;
      const { error: uploadError } = await supabase.storage
        .from("session-materials")
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: publicData } = supabase.storage
        .from("session-materials")
        .getPublicUrl(filePath);

      const savedTitle = description.trim() ? `${title.trim()} - ${description.trim()}` : title.trim();
      const { error } = await supabase
        .from("session_materials" as any)
        .insert({
          room_id: selectedRoomId || null,
          uploaded_by: user.id,
          title: savedTitle,
          file_url: publicData.publicUrl,
        });

      if (error) throw error;

      setTitle("");
      setDescription("");
      setFile(null);
      await fetchRoomsAndMaterials();

      toast({
        title: "File uploaded",
        description: "Students can now view this material from Notes.",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error?.message || "Failed to upload file.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const getStoragePathFromPublicUrl = (publicUrl: string): string | null => {
    const marker = "/object/public/session-materials/";
    const idx = publicUrl.indexOf(marker);
    if (idx === -1) return null;
    return decodeURIComponent(publicUrl.slice(idx + marker.length));
  };

  const handleDeleteMaterial = async (material: Material) => {
    try {
      setLoading(true);

      const storagePath = getStoragePathFromPublicUrl(material.file_url);
      if (storagePath) {
        await supabase.storage.from("session-materials").remove([storagePath]);
      }

      const { error } = await supabase
        .from("session_materials")
        .delete()
        .eq("id", material.id);

      if (error) throw error;

      setMaterials((prev) => prev.filter((m) => m.id !== material.id));
      toast({ title: "Material deleted" });
    } catch (error: any) {
      toast({
        title: "Delete failed",
        description: error?.message || "Failed to delete material.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="bg-card border-b border-border px-6 py-4 flex items-center justify-between shadow-soft">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => navigate("/teacher")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-xl font-bold">Teacher Notes</h1>
            <p className="text-sm text-muted-foreground">Upload PDFs/documents and manage downloadable materials.</p>
          </div>
        </div>
      </header>

      <main className="p-8 max-w-4xl mx-auto space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Upload Material</CardTitle>
            <CardDescription>Select room, attach file, and publish notes for students.</CardDescription>
          </CardHeader>
          <CardContent>
            <form className="space-y-4" onSubmit={handleUpload}>
              <div className="space-y-2">
                <Label htmlFor="title">Title</Label>
                <Input
                  id="title"
                  placeholder="e.g. Calculus Week 1 Notes"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="room">Room</Label>
                <select
                  id="room"
                  value={selectedRoomId}
                  onChange={(e) => setSelectedRoomId(e.target.value)}
                  className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
                >
                  <option value="">No room (general notes)</option>
                  {rooms.map((room) => (
                    <option key={room.id} value={room.id}>{room.name}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  placeholder="Optional short context"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="file">File</Label>
                <Input
                  id="file"
                  type="file"
                  accept=".pdf,.doc,.docx,.ppt,.pptx,.txt"
                  onChange={(e) => setFile(e.target.files?.[0] || null)}
                />
              </div>
              <Button type="submit" disabled={loading}>
                <FileText className="mr-2 h-4 w-4" />
                {loading ? "Uploading..." : "Upload Note"}
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Your Uploaded Notes</CardTitle>
            <CardDescription>Manage published materials and remove outdated files.</CardDescription>
          </CardHeader>
          <CardContent>
            {materials.length === 0 ? (
              <p className="text-sm text-muted-foreground">No uploads yet. Upload your first PDF/document above.</p>
            ) : (
              <div className="space-y-3">
                {materials.map((material) => (
                  <div key={material.id} className="flex items-center justify-between p-3 bg-muted rounded-lg gap-3">
                    <div>
                      <p className="font-medium">{material.title}</p>
                      <p className="text-xs text-muted-foreground line-clamp-2">Room: {material.room_name || "General"}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <a href={material.file_url} target="_blank" rel="noopener noreferrer">
                        <Button variant="outline" size="sm">Open</Button>
                      </a>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDeleteMaterial(material)}
                        disabled={loading}
                      >
                        Delete
                      </Button>
                      <span className="text-xs text-muted-foreground">
                        {new Date(material.created_at).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
