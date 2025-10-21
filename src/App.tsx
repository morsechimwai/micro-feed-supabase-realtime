// React
import { useEffect, useState } from "react";

// UI Components
import Auth from "./components/Auth";
import AddTask from "./components/AddTask";
import TaskList from "./components/TaskList";
import { Form, FormControl, FormField, FormItem, FormMessage } from "./components/ui/form";

// Types
import type { ThemeMode } from "./types/theme";
import type { Task } from "./types/task";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "./supabase-client";

import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogFooter,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "./components/ui/button";
import { Textarea } from "./components/ui/textarea";
import { Input } from "./components/ui/input";
import z from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Spinner } from "./components/ui/spinner";

// Theme Management
const THEME_STORAGE_KEY = "theme-preference";

const taskSchema = z.object({
  title: z.string().min(1, "Title is required").max(100, "Title is too long"),
  description: z.string().max(500, "Description is too long").optional(),
});

const App = () => {
  const [session, setSession] = useState<Session | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [fetching, setFetching] = useState(false);
  const [adding, setAdding] = useState(false);
  const [updatingId, setUpdatingId] = useState<number | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [openEdit, setOpenEdit] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [taskToDelete, setTaskToDelete] = useState<Task | null>(null);

  const editForm = useForm<z.infer<typeof taskSchema>>({
    resolver: zodResolver(taskSchema),
    defaultValues: {
      title: "",
      description: "",
    },
    mode: "onSubmit",
    reValidateMode: "onChange",
  });

  useEffect(() => {
    const loadSession = async () => {
      const currentSession = await supabase.auth.getSession();
      const activeSession = currentSession.data.session ?? null;

      if (activeSession) {
        console.log("Current session:", activeSession);
      }

      setSession(activeSession);

      if (!activeSession) {
        setTasks([]);
        setEditingTask(null);
        setOpenEdit(false);
      }
    };

    void loadSession();

    const { data: authListener } = supabase.auth.onAuthStateChange((event, authSession) => {
      console.log("Auth state changed:", event, authSession);
      setSession(authSession);
      if (!authSession) {
        setTasks([]);
        setEditingTask(null);
        setOpenEdit(false);
      }
    });

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    const loadTasks = async () => {
      setFetching(true);
      try {
        const { error, data } = await supabase
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
    };

    void loadTasks();
  }, []);

  useEffect(() => {
    const channel = supabase
      .channel("tasks-channel")
      // เมื่อมีการเพิ่ม task
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "tasks" }, (payload) => {
        const newTask = payload.new as Task;
        setTasks((prev) => [...prev, newTask]);
      })
      // เมื่อมีการอัปเดต task
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "tasks" }, (payload) => {
        const updatedTask = payload.new as Task;
        setTasks((prev) => prev.map((task) => (task.id === updatedTask.id ? updatedTask : task)));
      })
      // เมื่อมีการลบ task
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "tasks" }, (payload) => {
        const deletedTask = payload.old as Task;
        setTasks((prev) => prev.filter((task) => task.id !== deletedTask.id));
      })
      .subscribe((status) => {
        console.log("Subscription status:", status);
      });

    // cleanup เพื่อยกเลิก channel เมื่อ component ถูก unmount
    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const handleAddTask = async (task: Pick<Task, "title" | "description">) => {
    if (!session) {
      return;
    }

    setAdding(true);
    try {
      const { error } = await supabase
        .from("tasks")
        .insert({
          title: task.title,
          description: task.description ?? "",
          email: session.user.email,
        })
        .select()
        .single();

      if (error) {
        console.error("Error adding task:", error.message);
        return;
      }
    } catch (error) {
      console.error("Unexpected error adding task:", error);
    } finally {
      setAdding(false);
    }
  };

  const handleDeleteTask = async (id: number) => {
    setDeletingId(id);
    try {
      const { error } = await supabase.from("tasks").delete().eq("id", id).select().single();

      if (error) {
        console.error("Error deleting task:", error.message);
        return;
      }
    } catch (error) {
      console.error("Unexpected error deleting task:", error);
    } finally {
      setDeletingId(null);
    }
  };

  const handleUpdateTask = async (id: number, updates: Pick<Task, "title" | "description">) => {
    setUpdatingId(id);
    try {
      const { error } = await supabase.from("tasks").update(updates).eq("id", id).select().single();

      if (error) {
        console.error("Error updating task:", error.message);
        return;
      }
    } catch (error) {
      console.error("Unexpected error updating task:", error);
    } finally {
      setUpdatingId(null);
    }
  };

  const handleEditTask = (task: Task) => {
    setEditingTask(task);
    editForm.reset({
      title: task.title,
      description: task.description ?? "",
    });
    setOpenEdit(true);
  };

  const handleEditDialogChange = (open: boolean) => {
    setOpenEdit(open);
    if (!open) {
      setEditingTask(null);
      editForm.reset({
        title: "",
        description: "",
      });
    }
  };

  const handleDeleteRequest = (task: Task) => {
    setTaskToDelete(task);
    setDeleteDialogOpen(true);
  };

  const handleDeleteDialogChange = (open: boolean) => {
    setDeleteDialogOpen(open);
    if (!open) {
      setTaskToDelete(null);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!taskToDelete) {
      return;
    }

    await handleDeleteTask(taskToDelete.id);
    handleDeleteDialogChange(false);
  };

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

  const onUpdate = async (values: z.infer<typeof taskSchema>) => {
    if (!editingTask) {
      return;
    }

    await handleUpdateTask(editingTask.id, {
      title: values.title,
      description: values.description ?? "",
    });

    handleEditDialogChange(false);
  };

  return (
    <>
      <div className="min-h-screen text-foreground transition-colors">
        <div className="container mx-auto px-4 py-10">
          <div className="grid gap-6 lg:grid-cols-[1fr_minmax(0,450px)]">
            <TaskList
              className="w-full mx-auto max-w-3xl rounded-3xl border bg-card p-6 shadow-lg transition-colors lg:mx-0 lg:max-w-none"
              tasks={tasks}
              session={session}
              fetching={fetching}
              updatingId={updatingId}
              deletingId={deletingId}
              onDeleteTask={handleDeleteRequest}
              onEditTask={handleEditTask}
            />
            <div className="space-y-6 lg:sticky lg:top-10 lg:h-fit lg:max-h-[calc(100vh-5rem)]">
              {session ? (
                <AddTask
                  className="w-full max-w-md rounded-3xl border bg-card p-6 shadow-lg transition-colors mx-auto lg:mx-0 lg:max-w-none"
                  toggleTheme={toggleTheme}
                  theme={theme}
                  adding={adding}
                  onAddTask={handleAddTask}
                />
              ) : (
                <Auth
                  className="w-full max-w-md rounded-3xl border bg-card p-6 shadow-lg transition-colors mx-auto lg:mx-0 lg:max-w-none"
                  toggleTheme={toggleTheme}
                  theme={theme}
                />
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

      <Dialog open={deleteDialogOpen} onOpenChange={handleDeleteDialogChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Task</DialogTitle>
            <DialogDescription>
              This action cannot be undone. Are you sure you want to delete
              {" "}
              <span className="font-semibold">
                {taskToDelete ? `"${taskToDelete.title}"` : "this task"}
              </span>
              ?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:justify-between">
            <DialogClose asChild>
              <Button type="button" variant="outline">
                Cancel
              </Button>
            </DialogClose>
            <Button
              type="button"
              variant="destructive"
              onClick={handleDeleteConfirm}
              disabled={!taskToDelete || deletingId === taskToDelete.id}
            >
              {deletingId === taskToDelete?.id ? (
                <>
                  <Spinner className="mr-2" />
                  Deleting...
                </>
              ) : (
                "Delete"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={openEdit} onOpenChange={handleEditDialogChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Task</DialogTitle>
            <DialogDescription>Update the details of your task.</DialogDescription>
          </DialogHeader>
          <Form {...editForm}>
            <form onSubmit={editForm.handleSubmit(onUpdate)} className="space-y-4">
              <FormField
                control={editForm.control}
                name="title"
                render={({ field, fieldState }) => (
                  <FormItem>
                    <FormControl>
                      <Input placeholder="Task Title" autoComplete="off" {...field} />
                    </FormControl>
                    <FormMessage>{fieldState.error?.message}</FormMessage>
                  </FormItem>
                )}
              />

              <FormField
                control={editForm.control}
                name="description"
                render={({ field, fieldState }) => (
                  <FormItem>
                    <FormControl>
                      <Textarea placeholder="Task Description (optional)" rows={4} {...field} />
                    </FormControl>
                    <FormMessage>{fieldState.error?.message}</FormMessage>
                  </FormItem>
                )}
              />

              <DialogFooter className="gap-2 sm:justify-between">
                <DialogClose asChild>
                  <Button type="button" variant="outline">
                    Cancel
                  </Button>
                </DialogClose>
                <Button type="submit" disabled={!editingTask || updatingId === editingTask.id}>
                  {updatingId === editingTask?.id ? (
                    <>
                      <Spinner className="mr-2" />
                      Saving...
                    </>
                  ) : (
                    "Save Changes"
                  )}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default App;
