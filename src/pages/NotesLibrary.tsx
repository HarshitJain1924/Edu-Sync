import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { FileText, Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/components/ui/use-toast";
import AppSidebar from "@/components/AppSidebar";

interface Material {
  id: string;
  title: string;
  file_url: string;
  created_at: string;
  room_id: string | null;
  uploaded_by: string;
  room_name?: string;
  uploader_name?: string;
}

type AppRole = "student" | "teacher" | "admin";

export default function NotesLibrary() {
  const { toast } = useToast();
  const [materials, setMaterials] = useState<Material[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return materials;
    return materials.filter((m) =>
      m.title.toLowerCase().includes(q) ||
      (m.room_name || "").toLowerCase().includes(q) ||
      (m.uploader_name || "").toLowerCase().includes(q)
    );
  }, [materials, query]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const { data: authData } = await supabase.auth.getUser();
        const user = authData.user;
        if (!user) {
          setMaterials([]);
          return;
        }

        const { data: roleData } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", user.id)
          .maybeSingle();

        const role = ((roleData?.role || "student") as AppRole);

        let roomRows: Array<{ id: string; name: string; created_by?: string; host_id?: string }> = [];

        if (role === "student") {
          const { data: assignmentRows } = await supabase
            .from("teacher_student_assignments" as any)
            .select("teacher_id")
            .eq("student_id", user.id);

          const teacherIds = Array.from(new Set((assignmentRows || []).map((r: any) => r.teacher_id)));
          if (teacherIds.length === 0) {
            setMaterials([]);
            return;
          }

          const { data: byCreator } = await supabase
            .from("study_rooms")
            .select("id, name, created_by, host_id, is_active")
            .in("created_by", teacherIds);

          const { data: byHost } = await supabase
            .from("study_rooms")
            .select("id, name, created_by, host_id, is_active")
            .in("host_id", teacherIds);

          const merged = [...(byCreator || []), ...(byHost || [])];
          const dedup = new Map<string, { id: string; name: string; created_by?: string; host_id?: string }>();
          merged
            .filter((r: any) => r?.is_active !== false)
            .forEach((r: any) => dedup.set(r.id, r));
          roomRows = Array.from(dedup.values());

          const roomIds = roomRows.map((r) => r.id);
          const roomPromise = roomIds.length > 0
            ? supabase
                .from("session_materials" as any)
                .select("id, title, file_url, created_at, room_id, uploaded_by")
                .in("room_id", roomIds)
            : Promise.resolve({ data: [], error: null } as any);

          const uploaderPromise = supabase
            .from("session_materials" as any)
            .select("id, title, file_url, created_at, room_id, uploaded_by")
            .in("uploaded_by", teacherIds);

          const [{ data: roomMaterials, error: roomMaterialsError }, { data: uploaderMaterials, error: uploaderMaterialsError }] =
            await Promise.all([roomPromise, uploaderPromise]);

          if (roomMaterialsError) throw roomMaterialsError;
          if (uploaderMaterialsError) throw uploaderMaterialsError;

          const mergedMaterialsMap = new Map<string, any>();
          [...(roomMaterials || []), ...(uploaderMaterials || [])].forEach((m: any) => {
            mergedMaterialsMap.set(m.id, m);
          });

          const materialRows = Array.from(mergedMaterialsMap.values());

          const uploaderIds = Array.from(new Set((materialRows || []).map((m: any) => m.uploaded_by)));
          let uploaderMap = new Map<string, string>();
          if (uploaderIds.length > 0) {
            const { data: profileRows } = await supabase
              .from("profiles")
              .select("id, username")
              .in("id", uploaderIds);
            uploaderMap = new Map((profileRows || []).map((p: any) => [p.id, p.username || "Teacher"]));
          }

          const roomNameMap = new Map(roomRows.map((r) => [r.id, r.name]));
          const parsed = (materialRows || []).map((m: any) => ({
            ...m,
            room_name: m.room_id ? (roomNameMap.get(m.room_id) || "Room") : "General",
            uploader_name: uploaderMap.get(m.uploaded_by) || "Teacher",
          }));

          setMaterials(parsed.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()));
          return;
        } else if (role === "teacher") {
          const { data: teacherRooms } = await supabase
            .from("study_rooms")
            .select("id, name, created_by, host_id, is_active")
            .or(`created_by.eq.${user.id},host_id.eq.${user.id}`)
            .eq("is_active", true);
          roomRows = (teacherRooms || []) as any[];
        } else {
          const { data: allRooms } = await supabase
            .from("study_rooms")
            .select("id, name, created_by, host_id, is_active")
            .eq("is_active", true)
            .limit(500);
          roomRows = (allRooms || []) as any[];
        }

        let materialRows: any[] = [];
        if (role === "teacher") {
          const { data: teacherMaterials, error: materialsError } = await supabase
            .from("session_materials" as any)
            .select("id, title, file_url, created_at, room_id, uploaded_by")
            .eq("uploaded_by", user.id)
            .order("created_at", { ascending: false });

          if (materialsError) throw materialsError;
          materialRows = teacherMaterials || [];
        } else {
          const roomIds = roomRows.map((r) => r.id);
          if (roomIds.length === 0) {
            setMaterials([]);
            return;
          }

          const { data, error: materialsError } = await supabase
            .from("session_materials" as any)
            .select("id, title, file_url, created_at, room_id, uploaded_by")
            .in("room_id", roomIds)
            .order("created_at", { ascending: false });

          if (materialsError) throw materialsError;
          materialRows = data || [];
        }

        const uploaderIds = Array.from(new Set((materialRows || []).map((m: any) => m.uploaded_by)));
        let uploaderMap = new Map<string, string>();
        if (uploaderIds.length > 0) {
          const { data: profileRows } = await supabase
            .from("profiles")
            .select("id, username")
            .in("id", uploaderIds);
          uploaderMap = new Map((profileRows || []).map((p: any) => [p.id, p.username || "Teacher"]));
        }

        const roomNameMap = new Map(roomRows.map((r) => [r.id, r.name]));
        const parsed = (materialRows || []).map((m: any) => ({
          ...m,
          room_name: m.room_id ? (roomNameMap.get(m.room_id) || "Room") : "General",
          uploader_name: uploaderMap.get(m.uploaded_by) || "Teacher",
        }));

        setMaterials(parsed);
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

  return (
    <div className="min-h-screen bg-background">
      <AppSidebar />
      <main className="ml-64 p-8">
        <div className="max-w-5xl mx-auto space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Notes Library</CardTitle>
              <CardDescription>View and download notes uploaded by your teachers.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="relative max-w-md">
                <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search by title, room, teacher"
                  className="pl-9"
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Available Notes</CardTitle>
              <CardDescription>{filtered.length} material(s)</CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <p className="text-sm text-muted-foreground">Loading notes...</p>
              ) : filtered.length === 0 ? (
                <p className="text-sm text-muted-foreground">No notes available yet.</p>
              ) : (
                <div className="space-y-3">
                  {filtered.map((material) => (
                    <div key={material.id} className="p-3 rounded-lg bg-muted flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-medium truncate">{material.title}</p>
                        <p className="text-xs text-muted-foreground">
                          {material.room_name} • {material.uploader_name} • {new Date(material.created_at).toLocaleDateString()}
                        </p>
                      </div>
                      <a href={material.file_url} target="_blank" rel="noopener noreferrer">
                        <Button size="sm" variant="outline">
                          <FileText className="mr-2 h-4 w-4" />
                          Open
                        </Button>
                      </a>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
