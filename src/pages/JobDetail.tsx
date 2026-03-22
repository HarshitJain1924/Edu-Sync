import { useState, useEffect } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  Briefcase, MapPin, Clock, ExternalLink, Building2, 
  ChevronLeft, Share2, ShieldCheck, DollarSign, Filter
} from "lucide-react";
import AppSidebar from "@/components/AppSidebar";
import { jobService, Job } from "@/lib/job-service";
import { marked } from "marked";

const JobDetail = () => {
  const { jobId } = useParams<{ jobId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const [job, setJob] = useState<Job | null>(location.state?.job || null);
  const [loading, setLoading] = useState(!location.state?.job);

  useEffect(() => {
    const fetchDetail = async () => {
      if (!jobId || job) {
        if (job) setLoading(false);
        return;
      }
      setLoading(true);
      const data = await jobService.getJobById(jobId);
      setJob(data);
      setLoading(false);
    };
    fetchDetail();
  }, [jobId, job]);

  const timeAgo = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const days = Math.floor(diff / 86400000);
    if (days === 0) return "Today";
    if (days === 1) return "Yesterday";
    if (days < 7) return `${days} days ago`;
    return `${Math.floor(days / 7)} weeks ago`;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex">
        <AppSidebar />
        <main className="ml-64 flex-1 p-12 flex items-center justify-center">
          <div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full" />
        </main>
      </div>
    );
  }

  if (!job) {
    return (
      <div className="min-h-screen bg-background flex">
        <AppSidebar />
        <main className="ml-64 flex-1 p-12 text-center">
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-4">Job Not Found</h2>
          <Button onClick={() => navigate("/jobs")} variant="outline" className="text-emerald-400 border-emerald-500/30">
            <ChevronLeft className="mr-2 h-4 w-4" /> Back to Listings
          </Button>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-[#0f172a] flex relative overflow-x-hidden transition-colors duration-500">
      {/* Dynamic Background Glows - Fixed to avoid horizontal scroll */}
      <div className="fixed top-0 right-0 w-[500px] h-[500px] bg-emerald-500/10 rounded-full blur-[200px] translate-x-1/3 -translate-y-1/3 pointer-events-none" />
      <div className="fixed bottom-0 left-0 w-[500px] h-[500px] bg-primary/10 rounded-full blur-[200px] -translate-x-1/3 translate-y-1/3 pointer-events-none" />
      
      <AppSidebar />
      <main className="ml-64 flex-1 relative z-10 overflow-x-hidden">
        {/* Sticky Header */}
        <div className="sticky top-0 z-30 bg-slate-100/90 dark:bg-[#0f172a]/80 backdrop-blur-xl border-b border-slate-300 dark:border-white/10 px-8 py-4 flex items-center justify-between shadow-2xl">
          <Button 
            variant="ghost" 
            className="text-slate-600 dark:text-gray-300 hover:text-slate-900 dark:hover:text-white"
            onClick={() => navigate("/jobs")}
          >
            <ChevronLeft className="mr-2 h-4 w-4" /> Back to Jobs
          </Button>
          <div className="flex gap-3">
            <Button variant="outline" size="icon" className="bg-slate-100 dark:bg-white/5 border-slate-300 dark:border-white/10 text-slate-600 dark:text-gray-400">
              <Share2 className="h-4 w-4" />
            </Button>
            <Button 
              className="bg-emerald-500 hover:bg-emerald-600 text-white shadow-lg shadow-emerald-500/20"
              onClick={() => window.open(job.apply_url, "_blank")}
            >
              Apply Now
            </Button>
          </div>
        </div>

        <div className="p-8 max-w-5xl mx-auto">
          {/* Hero Section */}
          <div className="bg-gradient-to-br from-slate-50 via-slate-100 to-transparent dark:from-white/[0.12] dark:via-white/[0.05] dark:to-transparent border border-slate-300 dark:border-white/20 rounded-[2.5rem] p-10 mb-10 shadow-2xl shadow-emerald-500/5 overflow-hidden relative group hover:border-emerald-500/40 transition-all duration-700">
            <div className="absolute top-0 right-0 p-10 opacity-15 group-hover:opacity-25 transition-opacity">
              <Briefcase className="h-56 w-56 text-emerald-500" />
            </div>
            
            <div className="absolute -top-32 -left-32 w-80 h-80 bg-emerald-500/20 rounded-full blur-[100px]" />

            <div className="flex flex-col md:flex-row gap-8 items-start relative z-10">
              {job.company_logo_url ? (
                <div className="w-24 h-24 rounded-2xl overflow-hidden bg-slate-100 dark:bg-white/10 flex items-center justify-center p-2 border border-slate-200 dark:border-white/5 shadow-2xl">
                  <img src={job.company_logo_url} alt={job.company} className="w-full h-full object-contain" />
                </div>
              ) : (
                <div className="w-24 h-24 rounded-2xl bg-gradient-to-br from-emerald-500/20 to-teal-500/20 flex items-center justify-center border border-emerald-500/20 shadow-2xl text-3xl font-bold text-emerald-400">
                  {job.company.charAt(0)}
                </div>
              )}
              
              <div className="flex-1">
                <div className="flex flex-wrap items-center gap-2 mb-3">
                  <span className="text-[10px] uppercase tracking-widest px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 font-bold border border-emerald-500/10">
                    {job.source}
                  </span>
                  <span className="text-[10px] uppercase tracking-widest px-2 py-0.5 rounded-full bg-primary/10 text-primary font-bold border border-primary/10">
                    {job.category}
                  </span>
                </div>
                <h1 className="text-5xl font-extrabold text-slate-900 dark:text-white mb-6 leading-tight tracking-tight">{job.title}</h1>
                
                <div className="flex flex-wrap gap-4 text-slate-800 dark:text-white/90">
                  <div className="flex items-center gap-2.5 px-4 py-2 rounded-2xl bg-slate-100 dark:bg-white/10 border border-slate-300 dark:border-white/10 shadow-lg backdrop-blur-sm">
                    <Building2 className="h-5 w-5 text-emerald-300" />
                    <span className="font-bold">{job.company}</span>
                  </div>
                  <div className="flex items-center gap-2.5 px-4 py-2 rounded-2xl bg-slate-100 dark:bg-white/10 border border-slate-300 dark:border-white/10 shadow-lg backdrop-blur-sm">
                    <MapPin className="h-5 w-5 text-emerald-300" />
                    <span className="font-semibold">{job.location}</span>
                  </div>
                  <div className="flex items-center gap-2.5 px-4 py-2 rounded-2xl bg-slate-100 dark:bg-white/10 border border-slate-300 dark:border-white/10 shadow-lg backdrop-blur-sm">
                    <Clock className="h-5 w-5 text-emerald-300" />
                    <span className="font-semibold">Posted {timeAgo(job.posted_date)}</span>
                  </div>
                </div>
              </div>
            </div>

            {job.salary && (
              <div className="mt-8 pt-8 border-t border-slate-200 dark:border-white/5 flex items-center gap-3">
                <div className="p-2 bg-emerald-500/10 rounded-lg">
                  <DollarSign className="h-5 w-5 text-emerald-400" />
                </div>
                <div>
                  <p className="text-xs text-slate-600 dark:text-gray-400 font-medium">Expected Salary</p>
                  <p className="text-lg font-bold text-emerald-400">{job.salary}</p>
                </div>
              </div>
            )}
          </div>

          {/* Main Content Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-10 pb-32">
            {/* Left: Description */}
            <div className="lg:col-span-2 space-y-10">
              <section className="bg-slate-50 dark:bg-white/[0.12] border border-slate-300 dark:border-white/[0.2] rounded-[2rem] p-10 backdrop-blur-md shadow-2xl relative overflow-hidden group">
                <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/10 rounded-full blur-[50px] group-hover:bg-emerald-500/20 transition-colors" />
                <h2 className="text-2xl font-black text-slate-900 dark:text-white mb-8 flex items-center gap-4">
                  <div className="p-2.5 bg-gradient-to-br from-emerald-400 to-teal-500 rounded-xl shadow-lg shadow-emerald-500/20">
                    <Briefcase className="h-6 w-6 text-white" />
                  </div>
                  Detailed Overview
                </h2>
                <div 
                  className="prose prose-slate dark:prose-invert prose-emerald max-w-none leading-[1.8] font-medium job-description-html text-lg text-slate-700 dark:text-gray-200"
                  dangerouslySetInnerHTML={{ __html: marked.parse(job.description) as string }}
                />
                {job.source === "Adzuna" && (
                  <div className="mt-6 p-4 rounded-xl border border-blue-500/20 bg-blue-500/5 flex items-start gap-4">
                    <ExternalLink className="h-6 w-6 text-blue-400 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-base font-medium text-blue-200">Full Description Available on Adzuna</p>
                      <p className="text-sm text-blue-300/80 mt-1">This is an excerpt. Please proceed to the application link to review the comprehensive requirements and details.</p>
                    </div>
                  </div>
                )}
              </section>

              {job.tags && job.tags.length > 0 && (
                <section>
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-4">Required Skills</h3>
                  <div className="flex flex-wrap gap-2">
                    {job.tags.map(tag => (
                      <span key={tag} className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-white/5 text-slate-700 dark:text-gray-300 border border-slate-300 dark:border-white/5 font-medium hover:bg-slate-200 dark:hover:bg-white/10 transition-colors">
                        {tag}
                      </span>
                    ))}
                  </div>
                </section>
              )}
            </div>

            {/* Right: Sidebar Info */}
            <div className="space-y-6">
              <div className="bg-slate-50 dark:bg-white/10 border border-slate-300 dark:border-white/20 rounded-3xl p-6 backdrop-blur-sm shadow-xl">
                <h3 className="text-slate-900 dark:text-white font-bold text-lg mb-4 flex items-center gap-2">
                  <Filter className="h-5 w-5 text-emerald-400" />
                  Quick Info
                </h3>
                <div className="space-y-4">
                  <div className="flex items-center justify-between text-base py-3 border-b border-slate-200 dark:border-white/10">
                    <span className="text-slate-600 dark:text-gray-400 font-medium">Type</span>
                    <span className="text-slate-900 dark:text-white font-bold bg-slate-100 dark:bg-white/5 px-3 py-1 rounded-lg">Full Time</span>
                  </div>
                  <div className="flex items-center justify-between text-base py-3 border-b border-slate-200 dark:border-white/10">
                    <span className="text-slate-600 dark:text-gray-400 font-medium">Model</span>
                    <span className="text-slate-900 dark:text-white font-bold bg-slate-100 dark:bg-white/5 px-3 py-1 rounded-lg">{job.location === "Remote" ? "WFH" : "In-Office"}</span>
                  </div>
                  <div className="flex flex-col gap-2 pt-2">
                    <span className="text-slate-600 dark:text-gray-400 font-medium text-sm">Security Check</span>
                    <span className="text-emerald-400 flex items-center gap-2 font-bold bg-emerald-500/10 px-4 py-2 rounded-xl border border-emerald-500/20">
                      <ShieldCheck className="h-5 w-5" /> Verified Listing
                    </span>
                  </div>
                </div>
              </div>

              <div className="bg-gradient-to-br from-emerald-500/10 to-teal-500/10 border border-emerald-500/20 rounded-3xl p-6">
                <h3 className="text-slate-900 dark:text-white font-bold mb-2">Ready to Apply?</h3>
                <p className="text-slate-600 dark:text-gray-400 text-sm mb-6">Double check your resume before applying to increase your chances!</p>
                <div className="space-y-3">
                  <Button 
                    className="w-full bg-emerald-500 hover:bg-emerald-600 text-white h-11 rounded-xl font-bold text-base shadow-lg shadow-emerald-500/20"
                    onClick={() => window.open(job.apply_url, "_blank")}
                  >
                    Apply Directly <ExternalLink className="h-4 w-4 ml-2" />
                  </Button>
                  <Button
                    variant="outline"
                    className="w-full h-11 rounded-xl font-semibold text-emerald-200 border-emerald-400/40 bg-emerald-500/5 hover:bg-emerald-500/15"
                    onClick={() => navigate("/resume-builder", { state: { job } })}
                  >
                    Optimize My Resume For This Job
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default JobDetail;
