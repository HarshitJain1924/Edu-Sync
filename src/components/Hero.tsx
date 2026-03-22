import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

const Hero = () => {
  const navigate = useNavigate();
  const rotatingWords = ["Education", "Classrooms", "Careers", "Outcomes"];
  const [activeWord, setActiveWord] = useState(0);

  useEffect(() => {
    const interval = window.setInterval(() => {
      setActiveWord((prev) => (prev + 1) % rotatingWords.length);
    }, 2200);

    return () => window.clearInterval(interval);
  }, [rotatingWords.length]);

  return (
    <section className="relative z-10 mx-auto grid w-full max-w-7xl items-center gap-10 px-6 pt-32 md:pt-40 pb-20 md:grid-cols-12">
      <div className="md:col-span-7 relative z-20">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-slate-100 dark:bg-surface-container-high border border-slate-200 dark:border-white/10 mb-8 shadow-sm dark:shadow-[0_0_15px_rgba(204,151,255,0.2)]">
          <span className="w-2 h-2 rounded-full bg-secondary shadow-[0_0_8px_#699cff] animate-pulse-subtle" />
          <span className="text-xs font-headline font-bold uppercase tracking-widest text-slate-700 dark:text-secondary">EduSync 2026</span>
        </div>

        <h1 className="font-headline font-bold text-5xl md:text-7xl tracking-tight leading-[1.02] mb-8 max-w-3xl text-slate-900 dark:text-white">
          The Operating System for <br className="hidden md:block" />
          <span key={activeWord} className="inline-block text-transparent bg-clip-text bg-gradient-to-r from-primary via-secondary to-primary pb-2" style={{ animation: "fadeSlideUp 0.5s ease-out forwards" }}>
            {rotatingWords[activeWord]}
          </span>
          <span className="text-primary/70">.</span>
        </h1>

        <p className="text-slate-600 dark:text-slate-400 text-lg md:text-xl max-w-2xl mb-10 font-medium">
          A premium, high-speed platform with AI-powered conversational assistance, collaborative whiteboards, and intelligent classrooms.
        </p>

        <div className="flex flex-wrap gap-4 mb-12">
          <button
            onClick={() => navigate("/auth")}
            className="bg-gradient-to-r from-primary to-secondary text-on-primary-fixed font-headline font-extrabold text-sm px-8 py-4 rounded-full hover:scale-[1.02] transition-all duration-300 shadow-[0_0_40px_rgba(204,151,255,0.4)] hover:shadow-[0_0_60px_rgba(204,151,255,0.6)]"
          >
            Start Learning
          </button>
          <button
            onClick={() => navigate("/dashboard")}
            className="border border-slate-200 dark:border-white/20 bg-white dark:bg-white/5 text-slate-700 dark:text-white font-headline font-bold text-sm px-8 py-4 rounded-full hover:scale-[1.02] hover:bg-slate-50 transition-all duration-300 shadow-sm dark:shadow-none"
          >
            View Dashboard
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 mt-4" id="results">
          <div className="bg-white dark:bg-[#111113]/60 border border-slate-200 dark:border-white/5 rounded-2xl p-5 hover:bg-slate-50 dark:hover:bg-white/5 transition-all duration-300 group/stat relative overflow-hidden backdrop-blur-md cursor-default shadow-sm dark:shadow-sm min-h-[110px] flex flex-col justify-center">
            <div className="absolute -right-4 -top-4 w-16 h-16 bg-primary/20 rounded-full blur-xl opacity-0 group-hover/stat:opacity-100 transition-opacity"></div>
            <p className="font-headline text-3xl font-bold text-primary mb-1 relative z-10">78%</p>
            <p className="text-sm font-medium text-slate-600 dark:text-slate-400 relative z-10">Higher weekly consistency</p>
          </div>
          <div className="bg-white dark:bg-[#111113]/60 border border-slate-200 dark:border-white/5 rounded-2xl p-5 hover:bg-slate-50 dark:hover:bg-white/5 transition-all duration-300 group/stat relative overflow-hidden backdrop-blur-md cursor-default shadow-sm dark:shadow-sm min-h-[110px] flex flex-col justify-center">
            <div className="absolute -right-4 -top-4 w-16 h-16 bg-secondary/20 rounded-full blur-xl opacity-0 group-hover/stat:opacity-100 transition-opacity"></div>
            <p className="font-headline text-3xl font-bold text-secondary mb-1 relative z-10">2.4x</p>
            <p className="text-sm font-medium text-slate-600 dark:text-slate-400 relative z-10">Faster revision cycles</p>
          </div>
          <div className="bg-white dark:bg-[#111113]/60 border border-slate-200 dark:border-white/5 rounded-2xl p-5 hover:bg-slate-50 dark:hover:bg-white/5 transition-all duration-300 group/stat relative overflow-hidden backdrop-blur-md cursor-default shadow-sm dark:shadow-sm min-h-[110px] flex flex-col justify-center">
            <div className="absolute -right-4 -top-4 w-16 h-16 bg-tertiary/20 rounded-full blur-xl opacity-0 group-hover/stat:opacity-100 transition-opacity"></div>
            <p className="font-headline text-3xl font-bold text-tertiary mb-1 relative z-10">96%</p>
            <p className="text-sm font-medium text-slate-600 dark:text-slate-400 relative z-10">Cleaner workflow score</p>
          </div>
        </div>
      </div>

      <div className="md:col-span-5 w-full relative mt-16 md:mt-0 flex justify-center items-center">
        {/* Glow behind */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[90%] h-[90%] bg-primary/20 blur-[120px] rounded-full point-events-none -z-10 mix-blend-screen" />
        
        {/* Premium Dashboard Preview */}
        <div className="w-full max-w-[420px] bg-white/90 dark:bg-[#0b0b0e]/95 backdrop-blur-3xl rounded-[2.5rem] border border-slate-200 dark:border-white/10 p-8 shadow-[0_20px_40px_-5px_rgba(0,0,0,0.1)] dark:shadow-[0_30px_60px_-15px_rgba(0,0,0,0.9)] relative group transition-transform duration-700 hover:-translate-y-2">
          
          <div className="flex justify-between items-center mb-8">
             <div className="flex items-center gap-3 bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/5 px-3 py-1.5 rounded-full">
               <div className="w-2.5 h-2.5 rounded-full bg-red-500 animate-[pulse-subtle_2s_infinite] shadow-[0_0_8px_rgba(239,68,68,0.8)]"></div>
               <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-700 dark:text-white">Live Activity</span>
             </div>
             <span className="text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400 tracking-wider">Today on EduSync</span>
          </div>

          <div className="space-y-4 mb-10">
            <div className="bg-slate-50 dark:bg-[#131315]/80 border border-slate-100 dark:border-white/5 rounded-2xl p-4 flex items-center justify-between group/item hover:border-primary/30 transition-all duration-300 hover:bg-slate-100 dark:hover:bg-[#1a1a1f] cursor-default shadow-sm dark:shadow-md">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary group-hover/item:scale-110 group-hover/item:bg-primary/20 transition-all duration-300">
                  <span className="material-symbols-outlined text-[18px]">videocam</span>
                </div>
                <div className="flex flex-col">
                  <span className="text-sm font-headline font-bold text-slate-900 dark:text-white">Physics Protocol</span>
                  <span className="text-[11px] font-medium text-slate-500">Spatial Room Alpha</span>
                </div>
              </div>
              <span className="text-xs font-bold text-primary font-body tracking-wider">09:30</span>
            </div>
            
            <div className="bg-slate-50 dark:bg-[#131315]/80 border border-slate-100 dark:border-white/5 rounded-2xl p-4 flex items-center justify-between group/item hover:border-secondary/30 transition-all duration-300 hover:bg-slate-100 dark:hover:bg-[#1a1a1f] cursor-default shadow-sm dark:shadow-md">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl bg-secondary/10 flex items-center justify-center text-secondary group-hover/item:scale-110 group-hover/item:bg-secondary/20 transition-all duration-300">
                  <span className="material-symbols-outlined text-[18px]">code</span>
                </div>
                <div className="flex flex-col">
                  <span className="text-sm font-headline font-bold text-slate-900 dark:text-white">Algorithm Sprint</span>
                  <span className="text-[11px] font-medium text-slate-500">Placement Hub</span>
                </div>
              </div>
              <span className="text-xs font-bold text-secondary font-body tracking-wider">12:00</span>
            </div>
          </div>
          
          <div className="pt-6 border-t border-slate-200 dark:border-white/5 relative">
            <div className="flex justify-between items-end mb-4">
              <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[14px]">rocket_launch</span> Readiness
              </span>
              <span className="text-3xl font-headline font-black text-slate-900 dark:text-white tracking-tight drop-shadow-none dark:drop-shadow-[0_0_10px_rgba(255,255,255,0.2)]">81%</span>
            </div>
            <div className="w-full h-2 bg-slate-200 dark:bg-white/5 rounded-full overflow-hidden shadow-inner relative">
               <div className="absolute top-0 left-0 h-full bg-gradient-to-r from-secondary via-primary to-primary w-[81%] rounded-full shadow-[0_0_15px_rgba(204,151,255,0.6)]" style={{ animation: "progressFill 1.5s ease-out forwards" }}></div>
            </div>
          </div>
          
          {/* Floating Element Overlap to add depth */}
          <div className="absolute -right-8 -bottom-8 bg-white/95 dark:bg-[#1a1a20]/95 border border-slate-200 dark:border-white/10 rounded-2xl p-4 md:p-5 shadow-[0_20px_40px_-10px_rgba(0,0,0,0.2)] dark:shadow-[0_20px_40px_-10px_rgba(0,0,0,0.8)] backdrop-blur-3xl animate-float-slow group-hover:scale-105 transition-transform duration-700 z-20">
            <div className="flex items-center gap-3 sm:gap-4">
              <div className="w-10 h-10 rounded-full bg-tertiary/10 border border-tertiary/20 flex items-center justify-center text-tertiary drop-shadow-none dark:drop-shadow-[0_0_8px_rgba(255,111,126,0.6)]">
                <span className="material-symbols-outlined text-xl">psychology</span>
              </div>
              <div>
                <p className="text-xs font-headline font-bold text-slate-900 dark:text-white mb-0.5 tracking-wide">Memory Engine</p>
                <p className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">14 concepts enforced</p>
              </div>
            </div>
          </div>
          
        </div>
      </div>

    </section>
  );
};

export default Hero;
