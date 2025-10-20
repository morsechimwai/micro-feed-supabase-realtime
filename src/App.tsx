import { useEffect, useState } from "react";
import { ListTodo, MoonStar, Plus, Sun } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

const App = () => {
  const [theme, setTheme] = useState<"light" | "dark">(() => {
    if (typeof window === "undefined") {
      return "light";
    }

    return window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light";
  });

  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle("dark", theme === "dark");
  }, [theme]);

  const toggleTheme = () => {
    setTheme((prev) => (prev === "dark" ? "light" : "dark"));
  };

  return (
    <div className="min-h-screen bg-background text-foreground transition-colors">
      <div className="container mx-auto px-6 py-10">
        <div className="flex justify-end">
          <Button
            aria-label="Toggle theme"
            onClick={toggleTheme}
            size="icon"
            variant="outline"
          >
            {theme === "dark" ? <Sun className="size-5" /> : <MoonStar className="size-5" />}
          </Button>
        </div>
        <div className="mx-auto mt-12 max-w-md rounded-3xl border border-border bg-card p-6 shadow-lg transition-colors">
          <header>
            <h2 className="flex items-center text-xl font-semibold text-card-foreground">
              <ListTodo />
              <span className="ml-2">Task Manager</span>
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Simple <span className="font-semibold text-green-500">Supabase</span> CRUD application.
              <Button asChild className="ml-1 inline-flex p-0 align-baseline" variant="link">
                <a href="https://github.com/morsechimwai/react-supabase-crud" rel="noreferrer" target="_blank">
                  View on GitHub
                </a>
              </Button>
            </p>
          </header>

          <div className="mt-4 space-y-2">
            <Input placeholder="Task Title" />
            <Textarea className="min-h-32" placeholder="Task Description" />
          </div>

          <Button className="mt-4 w-full">
            <Plus />
            <span className="font-semibold">Add Task</span>
          </Button>
        </div>
      </div>
    </div>
  );
};

export default App;
