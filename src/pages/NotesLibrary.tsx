import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence, useMotionValue, useMotionTemplate } from "framer-motion";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { 
  FileText, 
  Search, 
  BookOpen, 
  Sparkles, 
  ChevronRight, 
  Download, 
  ExternalLink,
  Users,
  Calendar,
  Layers,
  FileImage,
  Video,
  FileCode,
  File,
  Eye,
  Home,
  TrendingUp
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/components/ui/use-toast";
import AppSidebar from "@/components/AppSidebar";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Link } from "react-router-dom";

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

const floatingGlassCardClass =
  "rounded-3xl bg-white dark:bg-white/[0.03] backdrop-blur-xl border border-slate-200 dark:border-white/10 shadow-[0_20px_40px_rgba(0,0,0,0.1)] dark:shadow-[0_20px_40px_rgba(0,0,0,0.4)] transition-all duration-300";

const SpotlightCard = ({ children, className }: { children: React.ReactNode; className?: string }) => {
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);

  function handleMouseMove({ currentTarget, clientX, clientY }: React.MouseEvent) {
    const { left, top } = currentTarget.getBoundingClientRect();
    mouseX.set(clientX - left);
    mouseY.set(clientY - top);
  }

  return (
    <motion.div
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
      {children}
    </motion.div>
  );
};

const getFileTypeDetails = (url: string) => {
  const ext = url.split('.').pop()?.toLowerCase() || '';
  if (['jpg', 'jpeg', 'png', 'gif', 'svg', 'webp'].includes(ext)) return { icon: FileImage, label: 'Image', color: 'text-blue-500', bg: 'bg-blue-500/10' };
  if (['mp4', 'webm', 'ogg'].includes(ext)) return { icon: Video, label: 'Video', color: 'text-amber-500', bg: 'bg-amber-500/10' };
  if (['pdf'].includes(ext)) return { icon: FileText, label: 'PDF', color: 'text-rose-500', bg: 'bg-rose-500/10' };
  if (['js', 'ts', 'tsx', 'py', 'cpp', 'html', 'css'].includes(ext)) return { icon: FileCode, label: 'Code', color: 'text-emerald-500', bg: 'bg-emerald-500/10' };
  if (['doc', 'docx'].includes(ext)) return { icon: FileText, label: 'Doc', color: 'text-blue-600', bg: 'bg-blue-600/10' };
  return { icon: File, label: 'File', color: 'text-slate-500', bg: 'bg-slate-500/10' };
};

export default function NotesLibrary() {
  const { toast } = useToast();
  const [materials, setMaterials] = useState<Material[]>([]);
  const [query, setQuery] = useState("");
  const [selectedTeacher, setSelectedTeacher] = useState<string>("all");
  const [loading, setLoading] = useState(true);

  const uniqueTeachers = useMemo(() => {
    const teachers = new Set(materials.map(m => m.uploader_name).filter(Boolean));
    return ["all", ...Array.from(teachers)];
  }, [materials]);

  const filtered = useMemo(() => {
    let result = materials;

    // Apply Teacher Filter
    if (selectedTeacher !== "all") {
      result = result.filter(m => m.uploader_name === selectedTeacher);
    }

    // Apply Search Query
    const q = query.trim().toLowerCase();
    if (q) {
      result = result.filter((m) =>
        m.title.toLowerCase().includes(q) ||
        (m.room_name || "").toLowerCase().includes(q) ||
        (m.uploader_name || "").toLowerCase().includes(q)
      );
    }

    return result;
  }, [materials, query, selectedTeacher]);

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
    <div className="min-h-screen bg-background flex">
      <AppSidebar />
      <main className="flex-1 ml-64 p-8 relative overflow-hidden">
        {/* Background Highlight */}
        <div className="absolute top-0 right-0 -translate-y-1/2 translate-x-1/2 w-[600px] h-[600px] bg-violet-500/10 rounded-full blur-[120px] pointer-events-none" />
        <div className="absolute bottom-0 left-0 translate-y-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-blue-500/10 rounded-full blur-[120px] pointer-events-none" />

        <div className="max-w-6xl mx-auto space-y-12 relative z-10">
          {/* Breadcrumbs */}
          <nav className="flex items-center gap-2 text-xs font-medium text-slate-500 px-1">
            <Link to="/dashboard" className="hover:text-violet-500 transition-colors flex items-center gap-1">
              <Home className="h-3 w-3" />
              Dashboard
            </Link>
            <ChevronRight className="h-3 w-3" />
            <span className="text-slate-400">Knowledge Hub</span>
            <ChevronRight className="h-3 w-3" />
            <span className="text-violet-500 font-bold">Notes Library</span>
          </nav>

          {/* Premium Header */}
          <header className="flex flex-col md:flex-row md:items-end justify-between gap-6">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-violet-500/20 text-violet-500">
                  <BookOpen className="h-6 w-6" />
                </div>
                <h2 className="text-[10px] tracking-[0.2em] font-black text-slate-500 uppercase">Resource Center</h2>
              </div>
              <h1 className="text-4xl md:text-5xl font-black tracking-tight text-slate-900 dark:text-white">
                Notes <span className="text-violet-500">Library</span>
              </h1>
              <p className="text-slate-500 text-sm max-w-md">
                Access curated study materials, lecture notes, and research documents uploaded by your mentors.
              </p>
            </div>

            <div className="relative group w-full md:w-80">
              <Search className="h-4 w-4 absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-violet-500 transition-colors" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search materials..."
                className="pl-11 h-12 bg-white/5 backdrop-blur-md border-slate-200 dark:border-white/10 rounded-2xl focus-visible:ring-violet-500 transition-all"
              />
            </div>
          </header>

          <section>
            <div className="space-y-6">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 px-2">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-violet-500" />
                  <h3 className="text-[10px] tracking-[0.2em] font-black text-slate-500 uppercase">
                    {loading ? "Loading..." : `${filtered.length} Material(s) Available`}
                  </h3>
                </div>

                {!loading && uniqueTeachers.length > 2 && (
                  <div className="flex items-center gap-2 overflow-x-auto pb-2 no-scrollbar scroll-smooth">
                    {uniqueTeachers.map((teacher) => (
                      <button
                        key={teacher}
                        onClick={() => setSelectedTeacher(teacher)}
                        className={cn(
                          "px-4 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all border shrink-0",
                          selectedTeacher === teacher
                            ? "bg-violet-500 border-violet-500 text-white shadow-lg shadow-violet-500/20"
                            : "bg-white/5 border-slate-200 dark:border-white/10 text-slate-500 hover:border-violet-500/50"
                        )}
                      >
                        {teacher === "all" ? "All Teachers" : teacher}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {loading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {[1, 2, 3, 4, 5, 6].map((i) => (
                  <div key={i} className={cn(floatingGlassCardClass, "h-40 animate-pulse")} />
                ))}
              </div>
            ) : filtered.length === 0 ? (
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className={cn(floatingGlassCardClass, "p-12 text-center space-y-4")}
              >
                <div className="w-16 h-16 bg-slate-100 dark:bg-white/5 rounded-full flex items-center justify-center mx-auto">
                  <Search className="h-8 w-8 text-slate-400" />
                </div>
                <div>
                  <h4 className="font-bold text-lg">No materials found</h4>
                  <p className="text-sm text-slate-500">Try adjusting your search query or check back later.</p>
                </div>
              </motion.div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <AnimatePresence mode="popLayout">
                  {filtered.map((material, idx) => {
                    const fileInfo = getFileTypeDetails(material.file_url);
                    const FileIcon = fileInfo.icon;
                    // Mocking high download count if not in schema for visual demo
                    const isPopular = material.id.length % 5 === 0; 

                    return (
                      <SpotlightCard key={material.id} className={cn(floatingGlassCardClass, "p-6 flex flex-col justify-between group h-full")}>
                        <div className="space-y-4">
                          <div className="flex items-start justify-between">
                            <div className={cn("p-3 rounded-2xl", fileInfo.bg, fileInfo.color)}>
                              <FileIcon className="h-6 w-6" />
                            </div>
                            <div className="flex flex-col items-end gap-2">
                              <Badge className={cn("border-none", fileInfo.bg, fileInfo.color)}>{fileInfo.label}</Badge>
                              {isPopular && (
                                <Badge className="bg-orange-500/10 text-orange-500 border-none flex items-center gap-1">
                                  <TrendingUp className="h-3 w-3" />
                                  Popular
                                </Badge>
                              )}
                            </div>
                          </div>
                          
                          <div>
                            <h4 className="font-bold text-lg leading-tight group-hover:text-violet-500 transition-colors line-clamp-2">
                              {material.title}
                            </h4>
                          </div>

                          <div className="space-y-2">
                            <div className="flex items-center gap-2 text-xs text-slate-500">
                              <Layers className="h-3 w-3" />
                              <span>{material.room_name}</span>
                            </div>
                            <div className="flex items-center gap-2 text-xs text-slate-500">
                              <Users className="h-3 w-3" />
                              <span>{material.uploader_name}</span>
                            </div>
                            <div className="flex items-center gap-2 text-xs text-slate-500">
                              <Calendar className="h-3 w-3" />
                              <span>{new Date(material.created_at).toLocaleDateString()}</span>
                            </div>
                          </div>
                        </div>

                        <div className="mt-6 pt-6 border-t border-slate-200 dark:border-white/5 flex items-center gap-3">
                          <Dialog>
                            <DialogTrigger asChild>
                              <Button 
                                variant="outline"
                                className="flex-1 h-11 rounded-xl border-slate-200 dark:border-white/10 font-bold hover:bg-violet-500/5 hover:text-violet-500 transition-all"
                              >
                                <Eye className="mr-2 h-4 w-4" />
                                Preview
                              </Button>
                            </DialogTrigger>
                            <DialogContent className="max-w-4xl h-[80vh] bg-background/95 backdrop-blur-xl border-white/10 p-0 overflow-hidden">
                              <DialogHeader className="p-4 border-b border-white/5">
                                <DialogTitle className="flex items-center gap-2">
                                  <FileIcon className={cn("h-5 w-5", fileInfo.color)} />
                                  {material.title}
                                </DialogTitle>
                              </DialogHeader>
                              <div className="flex-1 w-full h-full relative bg-white/5">
                                {fileInfo.label === 'PDF' ? (
                                  <iframe 
                                    src={`${material.file_url}#toolbar=0`} 
                                    className="w-full h-full border-none"
                                    title={material.title}
                                  />
                                ) : fileInfo.label === 'Image' ? (
                                  <div className="flex items-center justify-center h-full p-8">
                                    <img src={material.file_url} alt={material.title} className="max-w-full max-h-full object-contain rounded-lg shadow-2xl" />
                                  </div>
                                ) : fileInfo.label === 'Video' ? (
                                  <div className="flex items-center justify-center h-full bg-black">
                                    <video src={material.file_url} controls className="max-w-full max-h-full" />
                                  </div>
                                ) : (
                                  <div className="flex flex-col items-center justify-center h-full space-y-4 p-12 text-center">
                                    <div className={cn("p-6 rounded-3xl", fileInfo.bg, fileInfo.color)}>
                                      <FileIcon className="h-12 w-12" />
                                    </div>
                                    <div className="space-y-2">
                                      <h3 className="text-xl font-bold">Preview not available</h3>
                                      <p className="text-sm text-slate-500 max-w-xs">
                                        This file type ({fileInfo.label}) cannot be previewed directly. Please download or open it in a new tab.
                                      </p>
                                    </div>
                                    <a href={material.file_url} target="_blank" rel="noopener noreferrer">
                                      <Button className="bg-violet-500 hover:bg-violet-600 rounded-xl px-8">
                                        Open Original
                                      </Button>
                                    </a>
                                  </div>
                                )}
                              </div>
                            </DialogContent>
                          </Dialog>

                          <a 
                            href={material.file_url} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="flex-shrink-0"
                          >
                            <Button 
                              size="icon"
                              className="h-11 w-11 rounded-xl bg-violet-500 hover:bg-violet-600 text-white font-bold transition-all shadow-lg shadow-violet-500/20"
                            >
                              <Download className="h-4 w-4" />
                            </Button>
                          </a>
                        </div>
                      </SpotlightCard>
                    );
                  })}
                </AnimatePresence>
              </div>
            )}
          </section>
        </div>
      </main>
    </div>
  );
}

function Badge({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <span className={cn("px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider border", className)}>
      {children}
    </span>
  );
}
