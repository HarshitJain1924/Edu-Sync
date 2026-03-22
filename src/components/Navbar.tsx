import { useNavigate } from "react-router-dom";
import { ThemeToggle } from "./ThemeToggle";

const Navbar = () => {
  const navigate = useNavigate();

  return (
    <nav className="fixed inset-x-0 top-4 z-50 px-4 md:px-6">
      <div className="mx-auto flex w-full max-w-7xl items-center justify-between rounded-full border border-slate-200/50 dark:border-white/12 bg-white/80 dark:bg-[#070a17]/55 px-4 py-3 backdrop-blur-2xl md:px-6 shadow-sm dark:shadow-none">
        <button className="group inline-flex items-center gap-2" onClick={() => navigate("/")}>
          <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-fuchsia-500 to-indigo-500 text-[10px] font-bold text-white">E</span>
          <span className="font-headline text-xl font-bold tracking-tight text-slate-900 dark:text-white">EduSync</span>
          <span className="hidden rounded-full border border-slate-200 dark:border-white/15 px-2 py-1 font-label text-[10px] font-semibold uppercase tracking-[0.14em] text-indigo-500 dark:text-indigo-200 sm:inline-flex">2026</span>
        </button>

        <div className="hidden items-center gap-7 font-label text-[11px] font-semibold uppercase tracking-[0.15em] text-slate-500 dark:text-slate-400 md:flex">
          <a className="transition-colors hover:text-slate-900 dark:hover:text-white" href="#products">Platform</a>
          <a className="transition-colors hover:text-slate-900 dark:hover:text-white" href="#why-edusync">Approach</a>
          <a className="transition-colors hover:text-slate-900 dark:hover:text-white" href="#results">Outcomes</a>
          <a className="transition-colors hover:text-slate-900 dark:hover:text-white" href="#faq">FAQ</a>
        </div>

        <div className="flex items-center gap-2">
          <ThemeToggle />
          <button
            className="rounded-full border border-slate-200 dark:border-white/15 px-4 py-2 font-label text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-300 transition-colors hover:bg-slate-100 dark:hover:bg-white/10 hover:text-slate-900 dark:hover:text-white"
            onClick={() => navigate("/auth")}
          >
            Log In
          </button>
          <button
            onClick={() => navigate("/auth")}
            className="rounded-full bg-gradient-to-r from-fuchsia-500 to-indigo-500 px-4 py-2 font-label text-[10px] font-semibold uppercase tracking-[0.14em] text-white transition-transform duration-300 hover:scale-[1.02]"
          >
            Start Free
          </button>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
