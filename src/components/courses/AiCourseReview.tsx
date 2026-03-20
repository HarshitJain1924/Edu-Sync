import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { AICourseDetails, AIModule } from "@/lib/ai-service";
import { 
  CheckCircle, Share2, ArrowLeft, Loader2, Sparkles, 
  Clock, BookOpen, Presentation, Video, FileText, 
  HelpCircle, PenTool, PlayCircle, ChevronRight
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";

interface Props {
  course: AICourseDetails;
  onBack: () => void;
}

export default function AiCourseReview({ course, onBack }: Props) {
  const [courseState, setCourseState] = useState(course);
  const [visibility, setVisibility] = useState("community");
  const [isPublishing, setIsPublishing] = useState(false);
  const navigate = useNavigate();

  const handleModuleChange = (index: number, field: string, value: string) => {
    const updatedModules = [...courseState.modules];
    updatedModules[index] = { ...updatedModules[index], [field]: value };
    setCourseState({ ...courseState, modules: updatedModules });
  };

  const handlePublish = async () => {
    setIsPublishing(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      
      if (!userData.user) {
        toast.error("You must be logged in to publish a course.");
        setIsPublishing(false);
        return;
      }

      const { error } = await supabase.from('ai_generated_courses').insert({
        title: courseState.title,
        description: courseState.description,
        topic: courseState.topic,
        difficulty: courseState.difficulty,
        duration: courseState.duration,
        learning_goal: courseState.learningGoal,
        status: visibility,
        modules: courseState.modules,
        created_by: userData.user.id
      });

      if (error) throw error;

      toast.success("Course published successfully!");
      navigate("/");
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Failed to publish course. Returning to dashboard.");
      setTimeout(() => navigate("/"), 2000);
    } finally {
      setIsPublishing(false);
    }
  };

  const getResourceIcon = (type: string) => {
    switch (type) {
      case 'video': return <Video className="w-4 h-4 text-blue-400" />;
      case 'article': return <FileText className="w-4 h-4 text-green-400" />;
      case 'exercise': return <PenTool className="w-4 h-4 text-orange-400" />;
      case 'quiz': return <HelpCircle className="w-4 h-4 text-purple-400" />;
      default: return <BookOpen className="w-4 h-4 text-gray-400" />;
    }
  };

  const totalLessons = courseState.modules.reduce((acc, mod) => acc + (mod.lessons?.length || 0), 0);
  const totalResources = courseState.modules.reduce((acc, mod) => acc + (mod.resources?.length || 0), 0);

  return (
    <div className="container max-w-5xl py-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <Button variant="ghost" onClick={onBack} className="mb-6 hover:bg-white/5">
        <ArrowLeft className="mr-2 h-4 w-4" />
        Back to Generator
      </Button>

      {/* Hero Header Section */}
      <div className="relative rounded-2xl overflow-hidden mb-8 border border-white/10 shadow-2xl bg-gradient-to-br from-indigo-900/40 via-purple-900/40 to-background backdrop-blur-xl">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500" />
        
        <div className="p-8 md:p-10 space-y-6">
          <div className="flex flex-wrap items-center gap-3">
            <Badge className="bg-gradient-to-r from-indigo-500 to-purple-500 text-white border-0 py-1 px-3">
              <Sparkles className="w-3 h-3 mr-1.5" /> AI Generated
            </Badge>
            <Badge variant="outline" className="border-indigo-500/30 text-indigo-300 backdrop-blur-sm">
              {courseState.topic}
            </Badge>
            <Badge variant="outline" className="border-purple-500/30 text-purple-300 backdrop-blur-sm">
              {courseState.difficulty}
            </Badge>
          </div>

          <div className="space-y-4 max-w-3xl">
            <Input 
              value={courseState.title}
              onChange={(e) => setCourseState({...courseState, title: e.target.value})}
              className="text-3xl md:text-5xl font-extrabold tracking-tight bg-transparent border-none p-0 focus-visible:ring-0 h-auto shadow-none text-white selection:bg-purple-500/30"
            />
            <Textarea 
              value={courseState.description}
              onChange={(e) => setCourseState({...courseState, description: e.target.value})}
              className="text-lg md:text-xl text-gray-300 bg-transparent border-none p-0 focus-visible:ring-0 resize-none h-auto min-h-[80px] shadow-none"
            />
          </div>

          <div className="flex flex-wrap items-center gap-6 pt-2">
            <div className="flex items-center gap-2 text-gray-300 font-medium">
              <Clock className="w-5 h-5 text-indigo-400" />
              <span>{courseState.duration}</span>
            </div>
            <div className="flex items-center gap-2 text-gray-300 font-medium">
              <Presentation className="w-5 h-5 text-purple-400" />
              <span>{courseState.modules.length} Modules</span>
            </div>
            <div className="flex items-center gap-2 text-gray-300 font-medium">
              <BookOpen className="w-5 h-5 text-pink-400" />
              <span>{totalLessons} Lessons</span>
            </div>
          </div>
          
          <div className="pt-6 flex flex-wrap gap-4 items-center">
             <Button 
               size="lg" 
               onClick={() => navigate("/course-view", { state: course })}
               className="rounded-full px-8 bg-white text-black hover:bg-gray-200 text-base font-semibold transition-all hover:scale-105 active:scale-95 shadow-[0_0_20px_rgba(255,255,255,0.3)]"
             >
                <PlayCircle className="w-5 h-5 mr-2" />
                Start Course View
             </Button>
             <Button size="lg" variant="outline" onClick={onBack} className="rounded-full px-8 bg-white/5 border-white/20 hover:bg-white/10 text-base">
                Regenerate Course
             </Button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Main Content: Course Curriculum */}
        <div className="lg:col-span-2 space-y-8">
          
          {/* Progress Section */}
          <div className="space-y-3">
             <div className="flex justify-between items-end">
                <h3 className="text-xl font-bold flex items-center gap-2">
                  <CheckCircle className="w-5 h-5 text-emerald-500" />
                  Course Curriculum
                </h3>
                <span className="text-sm font-medium text-emerald-500">0% Completed</span>
             </div>
             <Progress value={0} className="h-2 bg-white/5 [&>div]:bg-emerald-500" />
          </div>

          <Accordion type="multiple" defaultValue={["module-0"]} className="space-y-4">
            {courseState.modules.map((mod, i) => (
              <AccordionItem key={mod.id} value={`module-${i}`} className="border border-white/10 bg-white/[0.02] rounded-xl overflow-hidden shadow-sm data-[state=open]:bg-white/[0.04] data-[state=open]:border-primary/30 transition-all">
                <AccordionTrigger className="px-6 py-4 hover:no-underline hover:bg-white/[0.02]">
                  <div className="flex justify-between items-center w-full pr-4 gap-4">
                     <div className="flex items-center gap-4 text-left">
                        <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/10 text-primary font-bold text-sm shrink-0">
                           {i + 1}
                        </div>
                        <div className="space-y-1">
                           <Input 
                              value={mod.title}
                              onChange={(e) => handleModuleChange(i, "title", e.target.value)}
                              onClick={(e) => e.stopPropagation()}
                              className="text-lg font-bold bg-transparent border-none p-0 h-auto focus-visible:ring-1 focus-visible:ring-primary/50"
                            />
                           <p className="text-sm text-gray-400 font-normal line-clamp-1">{mod.description}</p>
                        </div>
                     </div>
                     <div className="hidden sm:flex items-center gap-4 text-sm text-gray-400 font-normal shrink-0">
                        <span className="flex items-center gap-1.5"><PlayCircle className="w-4 h-4"/> {mod.lessons?.length || 0} Lessons</span>
                        <span className="flex items-center gap-1.5"><Clock className="w-4 h-4"/> {mod.durationMinutes}m</span>
                     </div>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="px-6 pb-6 pt-2">
                   <div className="space-y-6">
                      <Textarea 
                        value={mod.description}
                        onChange={(e) => handleModuleChange(i, "description", e.target.value)}
                        className="bg-black/20 resize-none h-20 text-sm text-gray-300 border-white/5 focus-visible:ring-primary/30"
                      />
                      
                      {/* Interactive Lessons List */}
                      {mod.lessons && mod.lessons.length > 0 && (
                        <div className="space-y-3 pl-2">
                           <h4 className="text-sm font-semibold text-gray-300 uppercase tracking-wider">Lessons</h4>
                           <div className="space-y-2">
                              {mod.lessons.map((lesson, idx) => (
                                 <div key={lesson.id} className="group flex items-center justify-between p-3 rounded-lg bg-black/20 border border-white/5 hover:border-primary/30 hover:bg-primary/5 transition-all cursor-pointer">
                                    <div className="flex items-center gap-3">
                                       <div className="w-6 text-center text-xs font-medium text-gray-500">{idx + 1}</div>
                                       <PlayCircle className="w-4 h-4 text-gray-400 group-hover:text-primary" />
                                       <span className="font-medium text-gray-200 group-hover:text-white transition-colors">{lesson.title}</span>
                                    </div>
                                    <span className="text-xs text-gray-500 font-medium">{lesson.durationMinutes} min</span>
                                 </div>
                              ))}
                           </div>
                        </div>
                      )}

                      {/* Rich Resources Grid */}
                      {mod.resources && mod.resources.length > 0 && (
                        <div className="space-y-3 pl-2">
                           <h4 className="text-sm font-semibold text-gray-300 uppercase tracking-wider">Resources & Practice</h4>
                           <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                              {mod.resources.map((resource) => (
                                 <a 
                                   key={resource.id} 
                                   href={resource.url || "#"} 
                                   target={resource.url ? "_blank" : undefined}
                                   rel={resource.url ? "noopener noreferrer" : undefined}
                                   className="flex items-center gap-3 p-3 rounded-lg bg-black/20 border border-white/5 hover:bg-white/5 transition-colors group cursor-pointer"
                                 >
                                    <div className="p-2 rounded-md bg-white/5 group-hover:bg-background transition-colors shrink-0">
                                       {getResourceIcon(resource.type)}
                                    </div>
                                    <div className="overflow-hidden">
                                       <p className="text-sm font-medium text-gray-200 truncate group-hover:text-white transition-colors">{resource.title}</p>
                                       <p className="text-xs text-gray-500 capitalize">{resource.type}</p>
                                    </div>
                                    <ChevronRight className="w-4 h-4 text-gray-500 ml-auto hidden sm:block group-hover:text-white transition-colors shrink-0" />
                                 </a>
                              ))}
                           </div>
                        </div>
                      )}
                   </div>
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>

        {/* Sidebar: Publishing & Metadata Tracker */}
        <div className="lg:col-span-1 space-y-6">
          <Card className="sticky top-6 border-white/10 bg-background/50 backdrop-blur-xl shadow-xl">
            <CardHeader className="border-b border-white/5 pb-6">
              <CardTitle className="text-xl">Course Settings</CardTitle>
              <CardDescription>Finalize visibility and publish</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6 pt-6">
              <div className="space-y-3">
                <label className="text-sm font-medium flex items-center gap-2 text-gray-300">
                  <Share2 className="w-4 h-4 text-purple-400" />
                  Visibility & Sharing
                </label>
                <Select value={visibility} onValueChange={setVisibility}>
                  <SelectTrigger className="bg-black/30 border-white/10 h-12">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="community">
                       <span className="flex items-center gap-2 font-medium"><Sparkles className="w-4 h-4 text-purple-400"/> Community Hub (Public)</span>
                    </SelectItem>
                    <SelectItem value="private">
                       <span className="flex items-center gap-2 font-medium">Private (Only me)</span>
                    </SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-gray-500 leading-relaxed">
                  Community courses are visible to peers and can be promoted to "Official" by platform admins.
                </p>
              </div>

              <div className="p-4 rounded-xl bg-black/20 border border-white/5 space-y-3">
                 <h4 className="text-sm font-semibold text-gray-300">Overview Stats</h4>
                 <div className="space-y-2 text-sm">
                   <div className="flex justify-between items-center text-gray-400">
                     <span>Modules</span>
                     <span className="font-semibold text-white">{courseState.modules.length}</span>
                   </div>
                   <div className="flex justify-between items-center text-gray-400">
                     <span>Total Lessons</span>
                     <span className="font-semibold text-white">{totalLessons}</span>
                   </div>
                   <div className="flex justify-between items-center text-gray-400">
                     <span>Extra Resources</span>
                     <span className="font-semibold text-white">{totalResources}</span>
                   </div>
                 </div>
              </div>

              <Button 
                onClick={handlePublish}
                disabled={isPublishing}
                className="w-full h-12 text-base font-semibold shadow-[0_0_15px_hsl(var(--primary)/0.3)] hover:shadow-[0_0_25px_hsl(var(--primary)/0.5)] transition-shadow"
              >
                {isPublishing ? (
                  <>
                     <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                     Publishing...
                  </>
                ) : (
                  "Publish Course to Platform"
                )}
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
