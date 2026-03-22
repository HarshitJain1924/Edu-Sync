import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";

interface ThemeToggleProps {
  compact?: boolean;
}

export function ThemeToggle({ compact = false }: ThemeToggleProps) {
  const [isDark, setIsDark] = useState(true); // Default to our neon dark theme

  const applyTheme = (theme: "light" | "dark") => {
    const root = document.documentElement;
    if (theme === "dark") {
      root.classList.add("dark");
      setIsDark(true);
    } else {
      root.classList.remove("dark");
      setIsDark(false);
    }
  };

  useEffect(() => {
    // Initialize from saved preference (dark by default)
    const savedTheme = localStorage.getItem("theme") === "light" ? "light" : "dark";
    applyTheme(savedTheme);

    // Keep multiple toggle instances in sync across route changes/components
    const handleThemeSync = () => {
      const nextTheme = localStorage.getItem("theme") === "light" ? "light" : "dark";
      applyTheme(nextTheme);
    };

    window.addEventListener("storage", handleThemeSync);
    window.addEventListener("edusync:theme-changed", handleThemeSync);

    return () => {
      window.removeEventListener("storage", handleThemeSync);
      window.removeEventListener("edusync:theme-changed", handleThemeSync);
    };
  }, []);

  const toggleTheme = () => {
    const nextTheme: "light" | "dark" = isDark ? "light" : "dark";
    localStorage.setItem("theme", nextTheme);
    applyTheme(nextTheme);
    window.dispatchEvent(new Event("edusync:theme-changed"));
  };

  return (
    <button
      onClick={toggleTheme}
      className={
        compact
          ? "flex items-center justify-center rounded-lg p-2 text-slate-600 dark:text-zinc-300 transition-colors duration-200 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/5"
          : "flex items-center justify-center rounded-full border border-slate-300 dark:border-white/15 bg-white/80 dark:bg-white/5 p-2 text-slate-800 dark:text-white transition-transform duration-300 hover:scale-105 hover:bg-slate-100 dark:hover:bg-white/10"
      }
      aria-label="Toggle theme"
    >
      {isDark ? (
        <Sun className={compact ? "h-4 w-4 text-amber-500 dark:text-zinc-300" : "h-4 w-4 text-amber-500 dark:text-secondary-dim dark:hover:text-secondary dark:drop-shadow-[0_0_8px_#699cff]"} />
      ) : (
        <Moon className={compact ? "h-4 w-4 text-indigo-600 dark:text-zinc-300" : "h-4 w-4 text-indigo-600 dark:text-slate-200"} />
      )}
    </button>
  );
}
