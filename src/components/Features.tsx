import { useNavigate } from "react-router-dom";

const Features = () => {
  const navigate = useNavigate();
  return (
    <>
      <section className="max-w-7xl mx-auto px-6 py-32" id="products">
        
        {/* Ambient Depth Backgrounds for the whole section */}
        <div className="absolute inset-0 -z-10 pointer-events-none opacity-50 dark:opacity-100 overflow-hidden">
          <div className="absolute top-[10%] left-1/2 -translate-x-1/2 w-[800px] h-[800px] bg-primary/20 blur-[150px] rounded-full mix-blend-screen" />
          <div className="absolute bottom-[20%] right-1/4 w-[600px] h-[600px] bg-secondary/15 blur-[120px] rounded-full mix-blend-screen" />
          <div className="absolute top-[40%] left-[-10%] w-[500px] h-[500px] bg-tertiary/10 blur-[130px] rounded-full mix-blend-screen" />
        </div>

        {/* Story 1: Conversational AI */}
        <div id="why-edusync" className="flex flex-col md:flex-row items-center gap-16 mb-40 relative">
          <div className="w-full md:w-1/2 order-2 md:order-1 relative group">
            {/* The Chat Application Container */}
            <div className="relative bg-white border border-slate-200 dark:bg-[#0a0a0c]/90 dark:border-white/5 rounded-[2.5rem] p-8 backdrop-blur-3xl shadow-2xl dark:shadow-[0_40px_80px_-20px_rgba(0,0,0,0.8)] transition-all duration-700 hover:-translate-y-3 hover:shadow-[0_40px_80px_-20px_rgba(204,151,255,0.15)] dark:hover:shadow-[0_50px_100px_-20px_rgba(204,151,255,0.2)] dark:hover:border-white/10 group-hover:scale-[1.01]">
              {/* Chat UI */}
              <div className="flex flex-col gap-6">
                {/* User */}
                <div className="flex items-start gap-4 animate-[fadeSlideUp_0.5s_ease-out_forwards]">
                  <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-surface-variant flex shrink-0 shadow-inner"></div>
                  <div className="bg-slate-50 dark:bg-surface-container-low border border-slate-100 dark:border-white/5 rounded-2xl p-4 text-sm text-slate-700 dark:text-slate-300 shadow-sm">
                    How does the memory engine track my revision schedule?
                  </div>
                </div>
                {/* AI */}
                <div className="flex items-start gap-4 flex-row-reverse animate-[fadeSlideUp_0.5s_ease-out_0.6s_both]">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center shrink-0 shadow-[0_0_15px_rgba(204,151,255,0.5)] animate-pulse border border-white/20">
                    <span className="material-symbols-outlined text-white text-[16px]">smart_toy</span>
                  </div>
                  <div className="relative group/message max-w-[85%]">
                    <div className="absolute inset-0 bg-gradient-to-r from-primary/30 to-secondary/30 blur-2xl opacity-0 group-hover/message:opacity-100 transition-opacity duration-500"></div>
                    <div className="relative bg-gradient-to-r from-primary/15 to-secondary/15 border border-primary/30 rounded-2xl p-4 text-sm text-slate-900 dark:text-white/95 shadow-[0_0_30px_rgba(204,151,255,0.1)] backdrop-blur-md">
                      It maps your quiz performance using spaced repetition algorithms. You'll see weak topics reappear right before you forget them.
                    </div>
                  </div>
                </div>
                {/* Typing Indicator */}
                <div className="flex items-start gap-4 flex-row-reverse animate-[fadeSlideUp_0.5s_ease-out_1.5s_both]">
                  <div className="relative group/typing">
                    <div className="flex gap-1.5 items-center px-4 py-3 bg-slate-100 dark:bg-[#1a1a20]/60 border border-slate-200 dark:border-white/5 rounded-2xl shadow-sm dark:shadow-md backdrop-blur-sm">
                      <div className="w-1.5 h-1.5 rounded-full bg-slate-400 dark:bg-slate-500 animate-[bounce_1s_infinite_0ms]"></div>
                      <div className="w-1.5 h-1.5 rounded-full bg-slate-400 dark:bg-slate-500 animate-[bounce_1s_infinite_150ms]"></div>
                      <div className="w-1.5 h-1.5 rounded-full bg-slate-400 dark:bg-slate-500 animate-[bounce_1s_infinite_300ms]"></div>
                    </div>
                  </div>
                </div>
              </div>
              
              {/* Sending Area Mockup */}
              <div className="mt-6 pt-4 border-t border-slate-100 dark:border-white/5 flex gap-3">
                <div className="flex-1 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-full h-10 px-4 flex items-center shadow-inner">
                   <span className="text-xs text-slate-400">Ask EduSync anything...</span>
                </div>
                <div className="w-10 h-10 rounded-full bg-primary/20 border border-primary/30 flex items-center justify-center text-primary shadow-[0_0_15px_rgba(204,151,255,0.3)] animate-pulse cursor-pointer">
                  <span className="material-symbols-outlined text-[16px]">send</span>
                </div>
              </div>
            </div>
          </div>
          
          <div className="w-full md:w-1/2 order-1 md:order-2">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 border border-primary/20 text-primary text-xs font-bold font-label mb-6 shadow-sm dark:shadow-[0_0_15px_rgba(204,151,255,0.15)]">
              Core Engine
            </div>
            <h2 className="text-4xl md:text-5xl font-headline font-bold mb-6 text-slate-900 dark:text-white tracking-tight">AI that genuinely understands your context.</h2>
            <p className="text-slate-600 dark:text-slate-400 text-lg leading-relaxed mb-8 font-medium">
              Not just a generic chatbot. The EduSync assistant reads your live codebase, tracks your active dashboard, and provides pinpointed contextual guidance exactly when you need it.
            </p>
          </div>
        </div>

        {/* Bento Grid */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-8 relative max-w-[1200px] mx-auto min-h-[600px]">
          
          {/* Card 1: THE DOMINANT ANCHOR (Placement Prep) */}
          <div className="md:col-span-8 md:row-span-2 bg-gradient-to-b from-white to-slate-50 dark:from-[#111115]/90 dark:to-[#0a0a0c]/90 border border-slate-200 dark:border-white/10 rounded-[2.5rem] p-12 relative overflow-hidden group transition-all duration-700 hover:-translate-y-2 hover:shadow-2xl dark:hover:shadow-[0_40px_80px_-20px_rgba(204,151,255,0.2)] dark:shadow-[0_20px_40px_-10px_rgba(0,0,0,0.8)] flex flex-col justify-end min-h-[500px]">
            <div className="absolute inset-0 bg-gradient-to-t from-white/90 dark:from-[#0a0a0c]/95 via-white/40 dark:via-black/20 to-transparent z-10 pointer-events-none"></div>
            <div className="absolute right-0 top-0 w-full h-full bg-[url('https://images.unsplash.com/photo-1551288049-bebda4e38f71?q=80&w=2070&auto=format&fit=crop')] bg-cover bg-center opacity-10 dark:opacity-20 group-hover:opacity-15 dark:group-hover:opacity-30 transition-all duration-1000 blur-[2px] group-hover:blur-0 mix-blend-luminosity group-hover:scale-105"></div>
            
            <div className="relative z-20 max-w-xl mb-8 md:mb-0">
              <div className="w-14 h-14 rounded-2xl border border-primary/20 bg-primary/10 flex items-center justify-center mb-8 backdrop-blur-md group-hover:scale-110 shadow-sm dark:shadow-[0_0_30px_rgba(204,151,255,0.2)] group-hover:shadow-[0_0_40px_rgba(204,151,255,0.4)] transition-all duration-500">
                <span className="material-symbols-outlined text-primary text-3xl">rocket_launch</span>
              </div>
              <h3 className="text-4xl font-headline font-bold mb-4 text-slate-900 dark:text-white tracking-tight">Placement Intelligence.</h3>
              <p className="text-slate-600 dark:text-slate-300 text-lg leading-relaxed font-medium">Adaptive practice loops mapping your aptitude to active job market requirements in real-time. Unfair advantages made standard.</p>
            </div>

            {/* Abstract UI Elements floating on the right side */}
            <div className="absolute right-10 top-1/2 -translate-y-1/2 w-[220px] h-auto hidden md:flex flex-col gap-4 opacity-80 group-hover:opacity-100 group-hover:-translate-x-2 transition-all duration-700 pointer-events-none z-20">
              <div className="w-full h-12 bg-white/5 backdrop-blur-xl border border-white/10 rounded-xl flex items-center px-4 gap-3 shadow-[0_0_20px_rgba(204,151,255,0.1)] group-hover:shadow-[0_0_30px_rgba(204,151,255,0.3)] group-hover:border-primary/40 transition-all duration-500">
                <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center">
                   <div className="w-2 h-2 rounded-full bg-primary animate-pulse"></div>
                </div>
                <div className="flex-1 h-1.5 bg-primary/40 rounded-full"></div>
              </div>
              <div className="w-[85%] h-12 bg-white/5 backdrop-blur-xl border border-white/10 rounded-xl flex items-center px-4 gap-3 shadow-[0_0_20px_rgba(105,156,255,0.1)] group-hover:shadow-[0_0_30px_rgba(105,156,255,0.3)] group-hover:border-secondary/40 transition-all duration-500 translate-x-4">
                <div className="w-4 h-4 rounded-full border-2 border-secondary"></div>
                <div className="flex-1 h-1.5 bg-secondary/40 rounded-full"></div>
              </div>
              <div className="w-[70%] h-12 bg-white/5 backdrop-blur-xl border border-white/10 rounded-xl flex items-center px-4 gap-3 shadow-[0_0_20px_rgba(255,111,126,0.1)] group-hover:shadow-[0_0_30px_rgba(255,111,126,0.3)] group-hover:border-tertiary/40 transition-all duration-500 translate-x-8">
                <div className="w-4 h-4 rounded-md bg-tertiary/60"></div>
                <div className="flex-1 h-1.5 bg-tertiary/30 rounded-full"></div>
              </div>
            </div>
          </div>

          {/* Card 2: Small Supporting Block (Streaks) */}
          <div className="md:col-span-4 bg-white/40 dark:bg-[#0d0d0f]/40 border border-slate-200/60 dark:border-white/[0.03] backdrop-blur-sm rounded-[2rem] p-8 relative overflow-hidden transition-all duration-500 hover:-translate-y-1 hover:bg-white/60 dark:hover:bg-[#111113]/60 dark:hover:border-white/[0.08] shadow-sm dark:shadow-none hover:shadow-lg dark:hover:shadow-[0_10px_30px_-10px_rgba(0,0,0,0.5)] opacity-90 hover:opacity-100">
            <div className="absolute top-0 right-0 w-full h-full bg-gradient-to-bl from-secondary/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none"></div>
            
            <div className="flex flex-col h-full justify-between relative z-10">
              <div>
                <h3 className="text-xl font-headline font-bold mb-2 text-slate-900 dark:text-white group-hover:text-secondary transition-colors">Gamified Velocity</h3>
                <p className="text-sm text-slate-600 dark:text-slate-400 font-medium">Build habits that stick with neuro-optimized streak tracking.</p>
              </div>

              {/* Heatmap Mockup to fill void */}
              <div className="flex-1 flex justify-center items-center mt-6 mb-2">
                <div className="grid grid-cols-7 gap-1.5 w-full opacity-70 group-hover:opacity-100 transition-all duration-500 group-hover:scale-[1.03]">
                  {Array.from({ length: 21 }).map((_, i) => (
                    <div key={i} className={`h-6 rounded-sm ${
                      i === 18 ? 'bg-primary shadow-[0_0_12px_rgba(204,151,255,0.8)] animate-pulse' :
                      i % 4 === 0 ? 'bg-secondary/60 shadow-[0_0_8px_rgba(105,156,255,0.4)]' : 
                      i % 3 === 0 ? 'bg-primary/40 shadow-[0_0_5px_rgba(204,151,255,0.2)]' : 
                      'bg-white/5 border border-white/5'
                    }`}></div>
                  ))}
                </div>
              </div>
              
              <div className="mt-4 bg-slate-50 dark:bg-black/40 border border-slate-100 dark:border-white/5 rounded-xl p-5 shadow-inner">
                <div className="flex justify-between items-center mb-3">
                  <span className="text-xs font-bold text-slate-700 dark:text-white uppercase tracking-wider">Focus Flow</span>
                  <span className="text-secondary text-xs font-bold flex items-center gap-1 animate-pulse-subtle bg-secondary/10 px-2 py-1 rounded-md border border-secondary/20 shadow-sm dark:shadow-[0_0_10px_rgba(105,156,255,0.2)]">
                    <span className="material-symbols-outlined text-[12px]">local_fire_department</span> 14 Days
                  </span>
                </div>
                <div className="w-full bg-white/5 h-2 rounded-full overflow-hidden relative">
                  <div className="absolute top-0 left-0 h-full bg-gradient-to-r from-secondary to-primary w-[70%] shadow-[0_0_10px_rgba(105,156,255,0.5)]"></div>
                </div>
              </div>
            </div>
          </div>

          {/* Card 3: Small Supporting Block (Memory Engine) */}
          <div className="md:col-span-4 bg-white/40 dark:bg-[#0d0d0f]/40 border border-slate-200/60 dark:border-white/[0.03] backdrop-blur-sm rounded-[2rem] p-8 relative overflow-hidden group transition-all duration-500 hover:-translate-y-1 hover:bg-white/60 dark:hover:bg-[#111113]/60 dark:hover:border-white/[0.08] shadow-sm dark:shadow-none hover:shadow-lg dark:hover:shadow-[0_10px_30px_-10px_rgba(0,0,0,0.5)] opacity-90 hover:opacity-100 flex flex-col justify-between min-h-[220px]">
            <div className="absolute inset-0 bg-gradient-to-tr from-tertiary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none"></div>
            
            <div className="relative z-20">
              <div className="w-12 h-12 rounded-2xl bg-tertiary/10 border border-tertiary/20 flex items-center justify-center mb-6 group-hover:rotate-12 group-hover:scale-110 shadow-sm dark:shadow-[0_0_20px_rgba(255,111,126,0.1)] transition-all duration-500">
                <span className="material-symbols-outlined text-tertiary text-2xl drop-shadow-none dark:drop-shadow-[0_0_8px_rgba(255,111,126,0.5)]">psychology</span>
              </div>
              <h3 className="text-xl font-headline font-bold mb-2 text-slate-900 dark:text-white group-hover:text-tertiary transition-colors">Memory Engine</h3>
              <p className="text-sm text-slate-600 dark:text-slate-400 font-medium">Spaced repetition flashcards that sync with your lowest-performing areas automatically.</p>
            </div>

            {/* Flashcards Mockup to fill void */}
            <div className="flex-1 mt-6 mb-2 relative min-h-[140px] flex items-center justify-center pointer-events-none z-10">
              <div className="absolute w-[80%] h-[90px] bg-gradient-to-br from-tertiary/20 to-tertiary/5 border border-tertiary/30 rounded-xl backdrop-blur-md transform -rotate-12 translate-y-6 -translate-x-4 shadow-xl group-hover:-translate-x-8 group-hover:-rotate-[15deg] transition-all duration-500 flex items-center justify-center">
                <span className="text-white/30 text-[10px] font-label font-bold tracking-widest uppercase">Algorithms</span>
              </div>
              <div className="absolute w-[80%] h-[90px] bg-gradient-to-br from-secondary/20 to-secondary/5 border border-secondary/30 rounded-xl backdrop-blur-md transform rotate-12 translate-y-4 translate-x-4 shadow-xl group-hover:translate-x-8 group-hover:rotate-[15deg] transition-all duration-500 flex items-center justify-center">
                <span className="text-white/30 text-[10px] font-label font-bold tracking-widest uppercase">System Design</span>
              </div>
              <div className="absolute w-[85%] h-[100px] bg-[#1a1a20] border border-white/10 rounded-xl shadow-2xl z-10 flex flex-col items-center justify-center group-hover:-translate-y-4 group-hover:shadow-[0_20px_40px_-5px_rgba(204,151,255,0.3)] group-hover:border-primary/50 transition-all duration-500 p-4">
                <span className="material-symbols-outlined text-primary mb-1">memory</span>
                <span className="text-[11px] text-white font-bold tracking-wide">Big O Notation</span>
              </div>
            </div>
          </div>

          {/* Card 4: Full Width Anchor (Live Classrooms) */}
          <div className="md:col-span-12 bg-white/80 dark:bg-[#111113]/80 border border-slate-200 dark:border-white/5 rounded-[2.5rem] p-10 md:p-14 relative overflow-hidden group transition-all duration-700 hover:-translate-y-2 hover:bg-white/95 dark:hover:bg-[#151518]/90 hover:border-slate-300 dark:hover:border-white/10 shadow-md hover:shadow-2xl dark:shadow-[0_10px_30px_rgba(0,0,0,0.5)] dark:hover:shadow-[0_30px_60px_-15px_rgba(99,102,241,0.15)] min-h-[280px] flex items-center justify-between">
            <div className="absolute -right-20 -bottom-20 w-[40%] h-[200%] bg-gradient-to-l from-indigo-500/10 to-transparent blur-[100px] group-hover:from-indigo-500/20 transition-all duration-1000 pointer-events-none"></div>
            
            <div className="flex flex-col md:flex-row gap-12 items-center relative z-10 w-full">
              <div className="w-full md:w-[60%]">
                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-500 dark:text-indigo-400 text-[10px] font-bold font-label mb-4 uppercase tracking-widest shadow-sm">
                  Collaborative
                </div>
                <h3 className="text-3xl md:text-4xl font-headline font-bold mb-4 text-slate-900 dark:text-white tracking-tight">Spatial Virtual Classrooms</h3>
                <p className="text-slate-600 dark:text-slate-400 text-lg leading-relaxed font-medium max-w-xl">
                  Immersive audio environments with zero-latency whiteboards. Drop into a session, split into break-out pods, and collaboratively solve algorithms in real-time.
                </p>
              </div>
              
              <div className="w-full md:w-[45%] flex justify-center md:justify-end">
                <div className="relative w-full max-w-[280px] h-[150px] bg-[#0a0a0c] border border-white/10 rounded-2xl overflow-hidden shadow-2xl group-hover:scale-[1.03] transition-transform duration-500 group-hover:border-white/20">
                  <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyMCIgaGVpZ2h0PSIyMCI+CjxyZWN0IHdpZHRoPSIyMCIgaGVpZ2h0PSIyMCIgZmlsbD0ibm9uZSI+PC9yZWN0Pgo8Y2lyY2xlIGN4PSIyIiBjeT0iMiIgcj0iMSIgZmlsbD0icmdiYSgyNTUsMjU1LDI1NSwwLjA1KSI+PC9jaXJjbGU+Cjwvc3ZnPg==')] opacity-50"></div>
                  <div className="absolute inset-0 flex items-center justify-center gap-3">
                    <div className="w-12 h-12 rounded-full border-2 border-primary bg-[#1f1f22] z-20 shadow-[0_0_20px_rgba(204,151,255,0.4)] flex items-center justify-center">
                      <span className="material-symbols-outlined text-[20px] text-white">mic</span>
                    </div>
                    <div className="w-10 h-10 rounded-full border border-white/20 bg-[#1f1f22] -ml-6 z-10 opacity-70 flex items-center justify-center">
                      <span className="material-symbols-outlined text-[18px] text-white">person</span>
                    </div>
                    <div className="w-10 h-10 rounded-full border border-white/20 bg-[#1f1f22] -ml-6 z-0 opacity-40 flex items-center justify-center">
                      <span className="material-symbols-outlined text-[18px] text-white">person</span>
                    </div>
                  </div>
                  <div className="absolute top-3 left-3 flex items-center gap-1.5 bg-red-500/20 text-red-500 text-[10px] uppercase font-bold px-2 py-1 rounded shadow-[0_0_10px_rgba(239,68,68,0.2)]">
                    <div className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse"></div> Live Session
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Deep Feature Section */}
        <div className="mt-32 max-w-[1000px] mx-auto relative group">
          <div className="absolute inset-0 bg-gradient-to-b from-primary/10 to-transparent rounded-[3rem] opacity-0 group-hover:opacity-100 transition-opacity duration-700 blur-[60px] pointer-events-none"></div>
          <div className="bg-white/80 dark:bg-[#0b0b0e]/80 backdrop-blur-3xl rounded-[3rem] p-12 md:p-20 relative overflow-hidden flex flex-col items-center text-center border border-slate-200 dark:border-white/5 transition-all duration-500 hover:border-slate-300 dark:group-hover:border-white/10 shadow-lg dark:shadow-none dark:group-hover:shadow-[0_30px_60px_-15px_rgba(0,0,0,0.8)]">
            <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-primary/50 to-transparent"></div>
            
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-indigo-500 dark:text-indigo-300 mb-6 flex items-center gap-2">
              <span className="w-8 h-[1px] bg-indigo-500/50"></span>
              For Educators
              <span className="w-8 h-[1px] bg-indigo-500/50"></span>
            </p>
            <h3 className="max-w-3xl font-headline text-4xl md:text-5xl font-bold text-slate-900 dark:text-white mb-6">
              The Teacher Cockpit
            </h3>
            <p className="max-w-2xl text-lg text-slate-600 dark:text-slate-400 mb-14 leading-relaxed font-medium">
              Command your entire cohort from a single surface. Monitor session health, intervene in struggling pods, and analyze micro-metrics without switching tabs.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 w-full max-w-4xl">
              <div className="bg-slate-50 dark:bg-[#050505]/50 border border-slate-200 dark:border-white/5 rounded-2xl p-8 hover:bg-slate-100 dark:hover:bg-white/5 hover:border-slate-300 dark:hover:border-white/10 transition-all duration-300 cursor-default group/stat relative overflow-hidden">
                <div className="absolute -right-4 -top-4 w-16 h-16 bg-primary/20 rounded-full blur-xl opacity-0 group-hover/stat:opacity-100 transition-opacity"></div>
                <p className="font-headline text-4xl font-bold text-primary mb-2">42%</p>
                <p className="text-sm font-medium text-slate-600 dark:text-slate-400">Lower no-show rate</p>
              </div>
              <div className="bg-slate-50 dark:bg-[#050505]/50 border border-slate-200 dark:border-white/5 rounded-2xl p-8 hover:bg-slate-100 dark:hover:bg-white/5 hover:border-slate-300 dark:hover:border-white/10 transition-all duration-300 cursor-default group/stat relative overflow-hidden">
                <div className="absolute -right-4 -top-4 w-16 h-16 bg-secondary/20 rounded-full blur-xl opacity-0 group-hover/stat:opacity-100 transition-opacity"></div>
                <p className="font-headline text-4xl font-bold text-secondary mb-2">Live</p>
                <p className="text-sm font-medium text-slate-600 dark:text-slate-400">Attention clustering</p>
              </div>
              <div className="bg-slate-50 dark:bg-[#050505]/50 border border-slate-200 dark:border-white/5 rounded-2xl p-8 hover:bg-slate-100 dark:hover:bg-white/5 hover:border-slate-300 dark:hover:border-white/10 transition-all duration-300 cursor-default group/stat relative overflow-hidden">
                <div className="absolute -right-4 -top-4 w-16 h-16 bg-tertiary/20 rounded-full blur-xl opacity-0 group-hover/stat:opacity-100 transition-opacity"></div>
                <p className="font-headline text-4xl font-bold text-tertiary mb-2">Auto</p>
                <p className="text-sm font-medium text-slate-600 dark:text-slate-400">Remedial assignment</p>
              </div>
            </div>
          </div>
        </div>

      </section>

      {/* Modern CTA */}
      <section id="faq" className="max-w-7xl mx-auto px-6 py-24 mb-16">
        <div className="bg-gradient-to-br from-indigo-900 dark:from-[#120a2e] to-slate-900 dark:to-[#0a1024] border border-slate-800 dark:border-white/10 rounded-[3rem] p-16 md:p-24 text-center relative overflow-hidden group">
          <div className="absolute inset-0 bg-transparent dark:bg-noisy dark:opacity-30 mix-blend-overlay pointer-events-none"></div>
          <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1451187580459-43490279c0fa?q=80&w=2072&auto=format&fit=crop')] bg-cover bg-center opacity-10 mix-blend-overlay group-hover:opacity-20 transition-opacity duration-1000 group-hover:scale-[1.02]"></div>
          <div className="absolute inset-0 bg-gradient-to-t from-slate-950 dark:from-[#020202] via-transparent to-transparent"></div>
          
          <div className="relative z-10">
            <h2 className="font-headline font-bold text-5xl md:text-6xl mb-6 leading-tight text-white tracking-tight">Access the Nebula.</h2>
            <p className="text-slate-300 text-lg md:text-xl max-w-2xl mx-auto mb-10 font-medium">
              Step into the definitive educational operating system. Sync your team, your students, and your workflows today.
            </p>
            <div className="flex flex-col sm:flex-row justify-center gap-5">
              <button 
                onClick={() => navigate("/auth")}
                className="bg-white text-black px-8 py-4 rounded-full font-headline font-bold text-sm hover:scale-105 transition-transform duration-300 shadow-[0_0_30px_rgba(255,255,255,0.15)] hover:shadow-[0_0_50px_rgba(255,255,255,0.4)]"
              >
                Start Free Trial
              </button>
              <button 
                onClick={() => navigate("/dashboard")}
                className="bg-white/5 border border-white/15 text-white px-8 py-4 rounded-full font-headline font-bold text-sm hover:bg-white/10 transition-colors duration-300 backdrop-blur-md"
              >
                Explore Platform
              </button>
            </div>
          </div>
        </div>
      </section>
    </>
  );
};

export default Features;
