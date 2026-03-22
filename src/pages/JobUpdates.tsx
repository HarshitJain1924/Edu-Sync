import { useState, useEffect, useRef, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Briefcase, MapPin, Clock, ExternalLink, Search, Building2, Filter,
  TrendingUp, Code2, Palette, Server, BarChart3, Globe, ChevronRight,
  CheckCircle, ChevronLeft, DollarSign, Layout, Users, Zap
} from "lucide-react";
import { useNavigate, useLocation } from "react-router-dom";
import { useRequireAuth } from "@/hooks/useRequireAuth";
import AppSidebar from "@/components/AppSidebar";
import { jobService, Job } from "@/lib/job-service";
import { marked } from "marked";

const CATEGORIES = [
  { id: "all", label: "All Jobs", icon: Briefcase },
  { id: "software-dev", label: "Software Dev", icon: Code2 },
  { id: "data", label: "Data Science", icon: BarChart3 },
  { id: "design", label: "UI/UX Design", icon: Palette },
  { id: "devops", label: "DevOps & Cloud", icon: Server },
  { id: "product", label: "Product Mgmt", icon: Globe },
  { id: "qa", label: "Quality Assurance", icon: CheckCircle },
  { id: "writing", label: "Tech Writing", icon: Clock },
];

const TOP_SKILLS = [
  "React", "Node.js", "Python", "Java", "AWS", "UI/UX", "TypeScript", "Docker", "SQL", "Next.js"
];

const JobUpdates = () => {
  useRequireAuth();
  const navigate = useNavigate();
  const scrollRef = useRef<HTMLDivElement>(null);
  const observer = useRef<IntersectionObserver>();

  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [locationSearch, setLocationSearch] = useState("India");
  const [activeCategory, setActiveCategory] = useState("all");
  const [selectedSkills, setSelectedSkills] = useState<string[]>([]);
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [remoteOnly, setRemoteOnly] = useState(false);

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
    }, 500);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => { 
    setJobs([]);
    setPage(1);
    setHasMore(true);
    fetchJobs(1, true); 
  }, [debouncedSearch, locationSearch, activeCategory, selectedSkills, remoteOnly]);

  const fetchJobs = async (pageToFetch: number, isInitial: boolean = false) => {
    if (isInitial) setLoading(true);
    else setLoadingMore(true);
    
    setError("");
    try {
      const combinedSearch = [debouncedSearch, ...selectedSkills].filter(Boolean).join(" ");
      const newJobs = await jobService.fetchJobs(pageToFetch, {
        role: combinedSearch,
        location: remoteOnly ? "Remote" : locationSearch,
        category: activeCategory !== "all" ? activeCategory : undefined
      });
      
      if (newJobs.length === 0) {
        setHasMore(false);
      } else {
        setJobs(prev => isInitial ? newJobs : [...prev, ...newJobs]);
        // Auto-select first job on initial load if none selected
        if (isInitial && newJobs.length > 0) {
          setSelectedJob(newJobs[0]);
        }
        setHasMore(newJobs.length >= 20); // Adjust based on API page size
      }
    } catch (err: any) {
      setError("Failed to load jobs. Please try again.");
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  const lastJobElementRef = useCallback((node: any) => {
    if (loading || loadingMore) return;
    if (observer.current) observer.current.disconnect();
    observer.current = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting && hasMore) {
        setPage(prevPage => prevPage + 1);
      }
    });
    if (node) observer.current.observe(node);
  }, [loading, loadingMore, hasMore]);

  useEffect(() => {
    if (page > 1) {
      fetchJobs(page);
    }
  }, [page]);

  const timeAgo = (dateStr: string) => {
    if (!dateStr) return "Recent";
    const diff = Date.now() - new Date(dateStr).getTime();
    const days = Math.floor(diff / 86400000);
    if (days === 0) return "Today";
    if (days === 1) return "Yesterday";
    if (days < 7) return `${days} days ago`;
    return `${Math.floor(days / 7)} weeks ago`;
  };

  const formatSalary = (salary: string | undefined) => {
    if (!salary) return "Competitive";
    if (salary.includes("$")) return salary;
    if (salary.toLowerCase().includes("lpa") || salary.toLowerCase().includes("l") && !salary.toLowerCase().includes("hour")) return salary;

    // Extract numbers and convert to L (Lakhs) format if it's a large number
    const matches = salary.match(/\d+/g);
    if (matches && matches.length > 0) {
      const formatted = matches.map(n => {
        const val = parseInt(n);
        if (val >= 100000) return `₹${(val / 100000).toFixed(1)}L`;
        return `₹${val}`;
      }).join(" - ");
      return `${formatted} ${salary.toLowerCase().includes("hour") ? "/ hr" : "/ year"}`;
    }
    return salary;
  };

  const getLogoUrl = (company: string) => {
    const domain = company.toLowerCase().replace(/\s+/g, '') + ".com";
    return `https://logo.clearbit.com/${domain}`;
  };

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-[#0f0f0f] flex relative overflow-hidden h-screen transition-colors duration-500">
      {/* Background Glows */}
      <div className="fixed top-0 right-0 w-[600px] h-[600px] bg-[rgba(194,132,255,0.14)] rounded-full blur-[200px] translate-x-1/3 -translate-y-1/3 pointer-events-none" />
      <div className="fixed bottom-0 left-0 w-[600px] h-[600px] bg-violet-500/10 rounded-full blur-[200px] -translate-x-1/3 translate-y-1/3 pointer-events-none" />
      
      <AppSidebar />
      
      <main className="ml-64 flex-1 flex flex-col relative z-10 overflow-hidden text-slate-900 dark:text-white">
        {/* Header & Stats */}
        <header className="p-6 border-b border-slate-300 dark:border-white/10 bg-slate-100/90 dark:bg-[#0f0f0f]/85 backdrop-blur-xl">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-3xl font-black text-slate-900 dark:text-white flex items-center gap-3 tracking-tight">
                <div className="p-2.5 bg-gradient-to-br from-purple-300 to-indigo-500 rounded-xl shadow-lg shadow-purple-500/20">
                  <Briefcase className="h-6 w-6 text-white" />
                </div>
                Job Updates
              </h1>
              <p className="text-slate-600 dark:text-gray-300 mt-1 text-sm font-medium">Find your next career move in tech</p>
            </div>
            
            <div className="flex gap-6">
              <div className="text-center">
                <p className="text-2xl font-black text-purple-300">{jobs.length > 0 ? jobs.length : "-"}</p>
                <p className="text-[10px] text-slate-600 dark:text-gray-200 uppercase tracking-widest font-bold">Jobs</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-black text-purple-300">{jobs.length > 0 ? new Set(jobs.map(j => j.company)).size : "-"}</p>
                <p className="text-[10px] text-slate-600 dark:text-gray-200 uppercase tracking-widest font-bold">Companies</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-black text-purple-400">{jobs.length > 0 ? new Set(jobs.map(j => j.category)).size : "-"}</p>
                <p className="text-[10px] text-slate-600 dark:text-gray-200 uppercase tracking-widest font-bold">Categories</p>
              </div>
            </div>
          </div>
        </header>

        {/* 3-Column Layout Container */}
        <div className="flex-1 flex overflow-hidden">
          
          {/* Column 1: Filters (300px) */}
          <aside className="w-[300px] border-r border-slate-300 dark:border-white/10 p-6 flex flex-col gap-8 overflow-y-auto no-scrollbar bg-slate-100/70 dark:bg-white/[0.03]">
            {/* Search */}
            <div className="space-y-3">
              <label className="text-xs font-bold text-slate-600 dark:text-gray-200 uppercase tracking-wider">Search</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500 dark:text-gray-500" />
                <input
                  type="text"
                  placeholder="Role, skills..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-white/5 border border-slate-300 dark:border-white/10 rounded-xl text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-400/40"
                />
              </div>
              <div className="relative">
                <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500 dark:text-gray-500" />
                <input
                  type="text"
                  placeholder="Location..."
                  value={locationSearch}
                  disabled={remoteOnly}
                  onChange={(e) => setLocationSearch(e.target.value)}
                  className={`w-full pl-10 pr-4 py-2.5 bg-white dark:bg-white/5 border border-slate-300 dark:border-white/10 rounded-xl text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-400/40 ${remoteOnly ? "opacity-50 cursor-not-allowed" : ""}`}
                />
              </div>
            </div>

            {/* Categories */}
            <div className="space-y-3">
              <label className="text-xs font-bold text-slate-500 dark:text-gray-500 uppercase tracking-wider">Category</label>
              <div className="space-y-1.5">
                {CATEGORIES.map(cat => (
                  <button
                    key={cat.id}
                    onClick={() => setActiveCategory(cat.id)}
                    className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all ${
                      activeCategory === cat.id 
                        ? "bg-purple-500/10 text-purple-300 border border-purple-400/25 shadow-[0_0_15px_rgba(168,85,247,0.12)]" 
                        : "text-slate-600 dark:text-gray-400 hover:bg-slate-200 dark:hover:bg-white/5 hover:text-slate-900 dark:hover:text-white border border-transparent"
                    }`}
                  >
                    <cat.icon className="h-4 w-4" />
                    {cat.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Skills */}
            <div className="space-y-3">
              <label className="text-xs font-bold text-slate-500 dark:text-gray-500 uppercase tracking-wider">Top Skills</label>
              <div className="flex flex-wrap gap-2">
                {TOP_SKILLS.map(skill => (
                  <Badge
                    key={skill}
                    variant="outline"
                    className={`cursor-pointer border-slate-300 dark:border-white/10 hover:border-purple-400/50 hover:bg-purple-400/10 transition-all ${
                      selectedSkills.includes(skill) ? "bg-purple-400/20 border-purple-300 text-purple-200" : "text-slate-700 dark:text-gray-300"
                    }`}
                    onClick={() => setSelectedSkills(prev => 
                      prev.includes(skill) ? prev.filter(s => s !== skill) : [...prev, skill]
                    )}
                  >
                    {skill}
                  </Badge>
                ))}
              </div>
            </div>

            {/* Remote Toggle */}
            <div className="space-y-4 pt-4 border-t border-slate-200 dark:border-white/5">
              <div className="flex items-center justify-between cursor-pointer group" onClick={() => setRemoteOnly(!remoteOnly)}>
                <span className="text-sm text-slate-600 dark:text-gray-400 group-hover:text-slate-800 dark:group-hover:text-gray-300 transition-colors">Remote Only</span>
                <div className={`h-5 w-10 rounded-full relative transition-colors duration-300 ${remoteOnly ? 'bg-purple-400/30' : 'bg-slate-300 dark:bg-white/10'}`}>
                  <div className={`absolute top-1 h-3 w-3 rounded-full shadow-glow transition-all duration-300 ${remoteOnly ? 'bg-purple-300 right-1' : 'bg-slate-500 dark:bg-gray-400 left-1 shadow-none'}`} />
                </div>
              </div>
            </div>
          </aside>

          {/* Column 2: Job Feed (Scrollable) */}
          <section className="flex-1 flex flex-col border-r border-slate-300 dark:border-white/10 bg-slate-200/40 dark:bg-slate-900/40 min-w-[450px]">
            <div className="p-4 border-b border-slate-200 dark:border-white/5 flex items-center justify-between bg-slate-100/40 dark:bg-white/[0.01]">
              <p className="text-xs font-bold text-slate-700 dark:text-gray-200 uppercase tracking-widest">{jobs.length} Results Found</p>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-[10px] border-slate-300 dark:border-white/5 bg-white dark:bg-white/5 text-slate-600 dark:text-gray-300">Sort: Newest</Badge>
              </div>
            </div>

            <ScrollArea className="flex-1 px-4 py-6">
              <div className="space-y-3">
                {loading && (
                   <div className="space-y-3">
                    {[1,2,3,4,5].map(i => (
                      <div key={i} className="h-28 bg-slate-200 dark:bg-white/5 rounded-2xl animate-pulse" />
                    ))}
                  </div>
                )}
                
                {jobs.map((job, index) => (
                  <div 
                    key={job.id}
                    ref={index === jobs.length - 1 ? lastJobElementRef : null}
                    onClick={() => setSelectedJob(job)}
                    className={`p-5 rounded-2xl border transition-all duration-300 cursor-pointer group flex items-start gap-4 relative overflow-hidden ${
                      selectedJob?.id === job.id 
                        ? "bg-purple-400/[0.08] border-purple-400/60 shadow-[0_0_25px_rgba(168,85,247,0.15)] ring-1 ring-purple-300/20" 
                        : "bg-white dark:bg-white/[0.05] border-slate-300 dark:border-white/10 hover:border-slate-400 dark:hover:border-white/30 hover:bg-slate-100 dark:hover:bg-white/[0.08]"
                    }`}
                  >
                    {/* Hover Shimmer Effect */}
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/[0.03] to-transparent -translate-x-full group-hover:animate-shimmer pointer-events-none" />
                    {/* Horizontal Card Content */}
                    <div className="w-14 h-14 rounded-xl overflow-hidden bg-slate-100 dark:bg-white/10 flex-shrink-0 flex items-center justify-center p-1 border border-slate-300 dark:border-white/10">
                      <img 
                        src={getLogoUrl(job.company)} 
                        alt={job.company} 
                        className="w-full h-full object-contain"
                        onError={(e) => {
                          (e.target as HTMLImageElement).src = `https://ui-avatars.com/api/?name=${encodeURIComponent(job.company)}&background=9c48ea&color=fff&bold=true`;
                        }}
                      />
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <h3 className={`text-base font-bold truncate transition-colors ${selectedJob?.id === job.id ? "text-amber-700 dark:text-amber-200" : "text-slate-900 dark:text-white group-hover:text-amber-700 dark:group-hover:text-amber-100"}`}>
                        {job.title}
                      </h3>
                      <p className="text-sm font-semibold text-slate-600 dark:text-gray-400">{job.company}</p>
                      
                      <div className="flex items-center gap-4 mt-2 text-[11px] text-slate-500 dark:text-gray-500 font-medium">
                        <span className="flex items-center gap-1.5"><MapPin className="h-3 w-3 text-amber-400/80" /> {job.location}</span>
                        <span className="flex items-center gap-1.5"><Clock className="h-3 w-3 text-purple-400/70" /> {timeAgo(job.posted_date)}</span>
                        {job.salary && <span className="text-amber-300/90 font-bold">{formatSalary(job.salary)}</span>}
                      </div>

                      <div className="flex flex-wrap gap-1.5 mt-3">
                        {job.tags?.slice(0, 3).map(tag => (
                          <span key={tag} className="text-[10px] px-2 py-0.5 rounded-md bg-slate-100 dark:bg-white/5 text-slate-500 dark:text-gray-400 border border-slate-300 dark:border-white/5 group-hover:border-slate-400 dark:group-hover:border-white/10">
                            {tag}
                          </span>
                        ))}
                      </div>
                    </div>

                    <div className="self-center">
                      <Button variant="ghost" size="sm" className="h-8 w-8 rounded-full p-0 text-slate-500 dark:text-gray-500 group-hover:text-purple-400">
                        <ChevronRight className="h-5 w-5" />
                      </Button>
                    </div>
                  </div>
                ))}

                {loadingMore && (
                  <div className="h-20 bg-slate-200 dark:bg-white/5 rounded-2xl animate-pulse mt-3" />
                )}
              </div>
            </ScrollArea>
          </section>

          {/* Column 3: Job Preview (Right Panel) */}
          <aside className="w-[450px] bg-slate-100/70 dark:bg-white/[0.03] flex flex-col overflow-hidden relative border-l border-slate-300 dark:border-white/5">
            {selectedJob ? (
              <>
                <ScrollArea className="flex-1 p-8">
                  {/* Hero Header */}
                  <div className="space-y-6">
                    <div className="flex items-center justify-between">
                      <div className="w-20 h-20 rounded-2xl overflow-hidden bg-slate-100 dark:bg-white/10 p-2 border border-slate-300 dark:border-white/10 shadow-2xl shadow-purple-400/10">
                        <img 
                          src={getLogoUrl(selectedJob.company)} 
                          alt={selectedJob.company} 
                          className="w-full h-full object-contain"
                          onError={(e) => {
                            (e.target as HTMLImageElement).src = `https://ui-avatars.com/api/?name=${encodeURIComponent(selectedJob.company)}&background=9c48ea&color=fff&bold=true`;
                          }}
                        />
                      </div>
                    </div>

                    <div>
                      <h2 className="text-2xl font-black text-slate-900 dark:text-white leading-tight">{selectedJob.title}</h2>
                      <div className="flex items-center gap-4 mt-2">
                        <p className="text-lg font-bold text-slate-600 dark:text-gray-400">{selectedJob.company}</p>
                        <Separator orientation="vertical" className="h-4 bg-slate-300 dark:bg-white/10" />
                        <p className="text-sm font-bold text-amber-300">{selectedJob.location}</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="p-4 rounded-2xl bg-slate-100 dark:bg-white/5 border border-slate-300 dark:border-white/5 space-y-1">
                        <p className="text-[10px] font-bold text-slate-500 dark:text-gray-500 uppercase tracking-widest">Experience</p>
                        <p className="text-sm font-bold text-slate-900 dark:text-white">Full-time</p>
                      </div>
                      <div className="p-4 rounded-2xl bg-slate-100 dark:bg-white/5 border border-slate-300 dark:border-white/5 space-y-1">
                        <p className="text-[10px] font-bold text-slate-500 dark:text-gray-500 uppercase tracking-widest">Salary</p>
                        <p className="text-sm font-bold text-slate-900 dark:text-white">{formatSalary(selectedJob.salary) || "Competitive"}</p>
                      </div>
                    </div>

                    <Separator className="bg-slate-200 dark:bg-white/5" />

                    <div className="space-y-4">
                      <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                        <Zap className="h-5 w-5 text-amber-300" />
                        Job Description
                      </h3>
                      <div 
                        className="text-slate-700 dark:text-gray-200 leading-relaxed text-sm space-y-4 whitespace-pre-wrap prose prose-slate dark:prose-invert prose-purple max-w-none job-description-html"
                        dangerouslySetInnerHTML={{ __html: marked.parse(selectedJob.description) as string }}
                      />
                      {selectedJob.source === "Adzuna" && (
                        <div className="mt-4 p-4 rounded-xl border border-purple-500/20 bg-purple-500/5 flex items-start gap-3">
                          <ExternalLink className="h-5 w-5 text-purple-400 shrink-0 mt-0.5" />
                          <div>
                            <p className="text-sm font-medium text-purple-200">Full Description Available on Adzuna</p>
                            <p className="text-xs text-purple-300/70 mt-1">This is an excerpt. Click apply to read the complete job requirements and details.</p>
                          </div>
                        </div>
                      )}
                    </div>
                    
                    <div className="space-y-4 pt-4">
                       <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                        <Code2 className="h-5 w-5 text-purple-400" />
                        Required Skills
                      </h3>
                      <div className="flex flex-wrap gap-2">
                        {selectedJob.tags?.map(tag => (
                          <Badge key={tag} variant="secondary" className="bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-gray-400 hover:text-slate-900 dark:hover:text-white transition-colors">{tag}</Badge>
                        ))}
                      </div>
                    </div>
                  </div>
                </ScrollArea>

                <div className="p-6 border-t border-slate-300 dark:border-white/10 bg-slate-100/90 dark:bg-[#0f0f0f]/90 backdrop-blur-2xl">
                  <Button 
                    className="w-full bg-gradient-to-r from-purple-500 to-indigo-600 hover:from-purple-400 hover:to-indigo-500 text-white py-7 rounded-2xl text-lg font-black shadow-2xl shadow-purple-500/30 group overflow-hidden relative transition-all active:scale-[0.98]"
                    onClick={() => window.open(selectedJob.apply_url, "_blank")}
                  >
                    <span className="relative z-10 flex items-center gap-3">
                      Apply on {selectedJob.source} <ExternalLink className="h-5 w-5" />
                    </span>
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent -translate-x-full group-hover:animate-shimmer" />
                  </Button>
                  <p className="text-[10px] text-center text-slate-500 dark:text-gray-500 mt-4 font-bold uppercase tracking-widest">
                    Listing aggregated from {selectedJob.source}
                  </p>
                </div>
              </>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center p-12 text-center text-slate-500 dark:text-gray-500 space-y-6">
                <div className="w-24 h-24 rounded-full bg-slate-100 dark:bg-white/5 border border-slate-300 dark:border-white/5 flex items-center justify-center animate-bounce">
                  <Layout className="h-10 w-10 text-slate-600 dark:text-gray-700" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-slate-600 dark:text-gray-400">Select a job to view details</h3>
                  <p className="text-sm mt-2 max-w-[250px] mx-auto">Click on any job card from the feed to see the full description and apply.</p>
                </div>
              </div>
            )}
          </aside>
        </div>
      </main>

      <style dangerouslySetInnerHTML={{ __html: `
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
        @keyframes shimmer {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
        .animate-shimmer {
          animation: shimmer 1.5s infinite;
        }
      `}} />
    </div>
  );
};

export default JobUpdates;
