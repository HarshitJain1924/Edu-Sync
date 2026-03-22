import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";

export function ThemeToggle() {
  const [isDark, setIsDark] = useState(true); // Default to our neon dark theme

  useEffect(() => {
    // Check saved theme from localStorage, otherwise default to dark
    const savedTheme = localStorage.getItem("theme");
    const root = document.documentElement;
    
    // We force dark mode on mount if nothing is saved since the user wants dark as base
    if (savedTheme === "light") {
      root.classList.remove("dark");
      setIsDark(false);
    } else {
      root.classList.add("dark");
      setIsDark(true);
    }
  }, []);

  const toggleTheme = () => {
    const root = document.documentElement;
    if (isDark) {
      root.classList.remove("dark");
      localStorage.setItem("theme", "light");
      setIsDark(false);
    } else {
      root.classList.add("dark");
      localStorage.setItem("theme", "dark");
      setIsDark(true);
    }
  };

  return (
    <button
      onClick={toggleTheme}
      className="flex items-center justify-center rounded-full border border-white/15 bg-white/5 p-2 text-white transition-transform duration-300 hover:scale-110 hover:bg-white/10 shadow-[0_0_15px_rgba(204,151,255,0.15)]"
      aria-label="Toggle theme"
    >
      {isDark ? <Sun className="h-4 w-4 text-secondary-dim hover:text-secondary drop-shadow-[0_0_8px_#699cff]" /> : <Moon className="h-4 w-4 text-slate-800" />}
    </button>
  );
}
