import { useEffect, useState } from "react";

import AddTask from "./components/AddTask";
import TaskList from "./components/TaskList";
import { TaskProvider } from "./context/TaskProvider";
import type { ThemeMode } from "./types/theme";
import Auth from "./components/Auth";

const THEME_STORAGE_KEY = "theme-preference";

const App = () => {
  const [theme, setTheme] = useState<ThemeMode>(() => {
    if (typeof window === "undefined") {
      return "light";
    }

    const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
    if (stored === "light" || stored === "dark") {
      return stored;
    }

    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  });

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const handleChange = (event: MediaQueryListEvent) => {
      if (!window.localStorage.getItem(THEME_STORAGE_KEY)) {
        setTheme(event.matches ? "dark" : "light");
      }
    };

    mediaQuery.addEventListener("change", handleChange);

    return () => mediaQuery.removeEventListener("change", handleChange);
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle("dark", theme === "dark");
  }, [theme]);

  const toggleTheme = () => {
    setTheme((prev) => {
      const next = prev === "dark" ? "light" : "dark";
      if (typeof window !== "undefined") {
        window.localStorage.setItem(THEME_STORAGE_KEY, next);
      }
      return next;
    });
  };

  return (
    <TaskProvider>
      <div className="min-h-screen text-foreground transition-colors">
        <div className="container mx-auto px-4 py-10">
          <div className="grid gap-6 lg:grid-cols-[1fr_minmax(0,450px)]">
            <TaskList className="w-full mx-auto max-w-3xl rounded-3xl border bg-card p-6 shadow-lg transition-colors lg:mx-0 lg:max-w-none" />
            <div className="space-y-6 lg:sticky lg:top-10 lg:h-fit lg:max-h-[calc(100vh-5rem)]">
              <AddTask
                className="w-full max-w-md rounded-3xl border bg-card p-6 shadow-lg transition-colors mx-auto lg:mx-0 lg:max-w-none "
                toggleTheme={toggleTheme}
                theme={theme}
              />
              <Auth className="w-full max-w-md rounded-3xl border bg-card p-6 shadow-lg transition-colors mx-auto lg:mx-0 lg:max-w-none" />
            </div>
          </div>
        </div>
      </div>
    </TaskProvider>
  );
};

export default App;
