// React
import { useCallback, useEffect, useState } from "react";

// UI Components
import Auth from "./components/Auth";
import AddTask from "./components/AddTask";
import TaskList from "./components/TaskList";

// Types
import type { ThemeMode } from "./types/theme";
import type { Task } from "./types/task";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "./supabase-client";
import { Button } from "./components/ui/button";

// Theme Management
const THEME_STORAGE_KEY = "theme-preference";

const App = () => {
  const [session, setSession] = useState<Session | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [fetching, setFetching] = useState(false);
  const [adding, setAdding] = useState(false);
  const [updatingId, setUpdatingId] = useState<number | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const fetchSession = async () => {
    const currentSession = await supabase.auth.getSession();
    if (currentSession.data.session) {
      console.log("Current session:", currentSession.data.session);
      setSession(currentSession.data.session);
    }
  };

  useEffect(() => {
    fetchSession();

    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
      console.log("Auth state changed:", event, session);
      setSession(session);
      if (!session) {
        setTasks([]);
      }
    });

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, []);

  const fetchTasks = useCallback(async () => {
    if (!session) {
      setTasks([]);
      return;
    }

    setFetching(true);
    try {
      const { data, error } = await supabase
        .from("tasks")
        .select("*")
        .order("created_at", { ascending: true });

      if (error) {
        console.error("Error fetching tasks:", error.message);
        return;
      }

      setTasks(data || []);
    } catch (error) {
      console.error("Unexpected error fetching tasks:", error);
    } finally {
      setFetching(false);
    }
  }, [session]);

  useEffect(() => {
    void fetchTasks();
  }, [fetchTasks]);

  const handleAddTask = useCallback(
    async (task: { title: string; description?: string }) => {
      if (!session) {
        return false;
      }

      setAdding(true);
      try {
        const { data, error } = await supabase
          .from("tasks")
          .insert({
            title: task.title,
            description: task.description ?? "",
          })
          .select()
          .single<Task>();

        if (error || !data) {
          console.error("Error adding task:", error?.message ?? "No data returned");
          return false;
        }

        setTasks((prev) => [...prev, data]);
        return true;
      } catch (error) {
        console.error("Unexpected error adding task:", error);
        return false;
      } finally {
        setAdding(false);
      }
    },
    [session]
  );

  const handleDeleteTask = useCallback(
    async (id: number) => {
      if (!session) {
        return false;
      }

      setDeletingId(id);
      try {
        const { data, error } = await supabase
          .from("tasks")
          .delete()
          .eq("id", id)
          .select()
          .single<Task>();

        if (error || !data) {
          console.error("Error deleting task:", error?.message ?? "Task not found");
          return false;
        }

        setTasks((prev) => prev.filter((task) => task.id !== id));
        return true;
      } catch (error) {
        console.error("Unexpected error deleting task:", error);
        return false;
      } finally {
        setDeletingId(null);
      }
    },
    [session]
  );

  const handleUpdateTask = useCallback(
    async (id: number, updates: Pick<Task, "title" | "description">) => {
      if (!session) {
        return false;
      }

      setUpdatingId(id);
      try {
        const { data, error } = await supabase
          .from("tasks")
          .update(updates)
          .eq("id", id)
          .select()
          .single<Task>();

        if (error || !data) {
          console.error("Error updating task:", error?.message ?? "Task not found");
          return false;
        }

        setTasks((prev) => prev.map((task) => (task.id === id ? data : task)));
        return true;
      } catch (error) {
        console.error("Unexpected error updating task:", error);
        return false;
      } finally {
        setUpdatingId(null);
      }
    },
    [session]
  );

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

  // Listen to system theme changes
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

  // Apply theme to document root
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
    <div className="min-h-screen text-foreground transition-colors">
      <div className="container mx-auto px-4 py-10">
        <div className="grid gap-6 lg:grid-cols-[1fr_minmax(0,450px)]">
          <TaskList
            className="w-full mx-auto max-w-3xl rounded-3xl border bg-card p-6 shadow-lg transition-colors lg:mx-0 lg:max-w-none"
            tasks={tasks}
            fetching={fetching}
            updatingId={updatingId}
            deletingId={deletingId}
            onDeleteTask={handleDeleteTask}
            onUpdateTask={handleUpdateTask}
          />
          <div className="space-y-6 lg:sticky lg:top-10 lg:h-fit lg:max-h-[calc(100vh-5rem)]">
            {session ? (
              <AddTask
                className="w-full max-w-md rounded-3xl border bg-card p-6 shadow-lg transition-colors mx-auto lg:mx-0 lg:max-w-none "
                toggleTheme={toggleTheme}
                theme={theme}
                adding={adding}
                onAddTask={handleAddTask}
              />
            ) : (
              <Auth className="w-full max-w-md rounded-3xl border bg-card p-6 shadow-lg transition-colors mx-auto lg:mx-0 lg:max-w-none" />
            )}
            <p className="mt-2 text-sm text-muted-foreground">
              Simple{" "}
              <a
                className="font-semibold text-green-500"
                href="https://supabase.com"
                rel="noreferrer"
                target="_blank"
              >
                Supabase
              </a>{" "}
              based{" "}
              <a
                className="font-semibold text-sky-500"
                href="https://react.dev"
                rel="noreferrer"
                target="_blank"
              >
                React
              </a>{" "}
              CRUD application with Authentication.
              <Button asChild className="ml-1 inline-flex p-0 align-baseline" variant="link">
                <a
                  href="https://github.com/morsechimwai/react-supabase-crud"
                  rel="noreferrer"
                  target="_blank"
                >
                  View on GitHub
                </a>
              </Button>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default App;
