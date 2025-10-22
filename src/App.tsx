// React
import { type ChangeEvent, useEffect, useState } from "react";

// UI Components
import Auth from "./components/Auth";
import AddTask from "./components/AddPost";
import TaskList from "./components/PostList";
import { Form, FormControl, FormField, FormItem, FormMessage } from "./components/ui/form";

// Types
import type { ThemeMode } from "./types/theme";
import type { Task } from "./types/post";
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
import {
  MAX_IMAGE_FILE_SIZE_BYTES,
  TASK_IMAGES_BUCKET,
  composeImageReference,
  createStoragePath,
  parseImageReference,
  withCacheBuster,
} from "./lib/storage";
import { Plus } from "lucide-react";

// Theme Management
const THEME_STORAGE_KEY = "theme-preference";

const taskSchema = z.object({
  title: z.string().min(1, "Title is required").max(100, "Title is too long"),
  description: z.string().max(500, "Description is too long").optional(),
  image_url: z.string().nullable().optional(),
  image_file: z.any().nullable().optional(),
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
  const [editPreview, setEditPreview] = useState<string | null>(null);
  const [editUploading, setEditUploading] = useState(false);
  const [mobileAddOpen, setMobileAddOpen] = useState(false);

  const editForm = useForm<z.infer<typeof taskSchema>>({
    resolver: zodResolver(taskSchema),
    defaultValues: {
      title: "",
      description: "",
      image_url: null,
      image_file: null,
    },
    mode: "onSubmit",
    reValidateMode: "onChange",
  });

  const editImageValue = editForm.watch("image_url");

  const isFile = (value: unknown): value is File =>
    typeof File !== "undefined" && value instanceof File;

  useEffect(() => {
    return () => {
      if (editPreview?.startsWith("blob:")) {
        URL.revokeObjectURL(editPreview);
      }
    };
  }, [editPreview]);

  useEffect(() => {
    if (!session) {
      setMobileAddOpen(false);
    }
  }, [session]);

  const resetEditPreview = () => {
    if (editPreview?.startsWith("blob:")) {
      URL.revokeObjectURL(editPreview);
    }
    setEditPreview(null);
  };

  const clearEditFileInput = () => {
    const input = document.querySelector('input[name="image_file"]') as HTMLInputElement | null;
    if (input) {
      input.value = "";
    }
  };

  const handleEditFileChange = (
    event: ChangeEvent<HTMLInputElement>,
    formOnChange: (value: File | null) => void
  ) => {
    const file = event.target.files?.[0];

    if (!file) {
      resetEditPreview();
      formOnChange(null);
      editForm.setValue("image_file", null);
      editForm.clearErrors("image_file");
      return;
    }

    if (!file.type.startsWith("image/")) {
      resetEditPreview();
      formOnChange(null);
      editForm.setError("image_file", { type: "manual", message: "Only image files are allowed" });
      event.target.value = "";
      clearEditFileInput();
      return;
    }

    if (file.size > MAX_IMAGE_FILE_SIZE_BYTES) {
      resetEditPreview();
      formOnChange(null);
      editForm.setError("image_file", { type: "manual", message: "File size must be under 2MB" });
      event.target.value = "";
      clearEditFileInput();
      return;
    }

    editForm.clearErrors("image_file");
    resetEditPreview();
    const objectUrl = URL.createObjectURL(file);
    setEditPreview(objectUrl);
    editForm.setValue("image_url", editingTask?.image_url ?? null, { shouldDirty: true });
    formOnChange(file);
  };

  const handleRemoveEditImage = (formOnChange: (value: File | null) => void) => {
    resetEditPreview();
    formOnChange(null);
    editForm.setValue("image_file", null);
    editForm.setValue("image_url", null, { shouldDirty: true });
    editForm.clearErrors("image_file");
    clearEditFileInput();
  };

  const resolvePublicUrlFromPath = (path: string | null) => {
    if (!path) {
      return null;
    }
    const { data } = supabase.storage.from(TASK_IMAGES_BUCKET).getPublicUrl(path);
    if (!data.publicUrl) {
      return null;
    }
    return withCacheBuster(data.publicUrl);
  };

  useEffect(() => {
    const loadSession = async () => {
      const currentSession = await supabase.auth.getSession();
      const activeSession = currentSession.data.session ?? null;

      if (activeSession) {
        console.log("Current session:", activeSession);
      }

      setSession(activeSession);

      if (!activeSession) {
        setEditingTask(null);
        setOpenEdit(false);
      }
    };

    void loadSession();

    const { data: authListener } = supabase.auth.onAuthStateChange((event, authSession) => {
      console.log("Auth state changed:", event, authSession);
      setSession(authSession);
      if (!authSession) {
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

  const handleAddTask = async (task: Pick<Task, "title" | "description" | "image_url">) => {
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
          image_url: task.image_url ?? null,
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

  const handleDeleteTask = async (task: Task) => {
    setDeletingId(task.id);
    try {
      const reference = parseImageReference(task.image_url);
      if (reference.path) {
        console.log("Deleting image from storage:", reference);
        console.log("Deleting image from storage at path:", reference.path);
        const { error: storageError, data } = await supabase.storage
          .from(TASK_IMAGES_BUCKET)
          .remove([reference.path]);

        if (storageError) {
          console.error("Error deleting image from storage:", storageError.message);
          return;
        }

        if (data) {
          console.log("Deleted image from storage:", data);
        }
      }

      const { error } = await supabase.from("tasks").delete().eq("id", task.id).select().single();

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

  const handleUpdateTask = async (
    id: number,
    updates: Pick<Task, "title" | "description" | "image_url">
  ) => {
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
    resetEditPreview();
    clearEditFileInput();
    setEditingTask(task);

    const reference = parseImageReference(task.image_url);
    const currentUrl = reference.publicUrl ?? resolvePublicUrlFromPath(reference.path);
    setEditPreview(currentUrl);

    editForm.reset({
      title: task.title,
      description: task.description ?? "",
      image_url: reference.raw,
      image_file: null,
    });
    setOpenEdit(true);
  };

  const handleEditDialogChange = (open: boolean) => {
    setOpenEdit(open);
    if (!open) {
      resetEditPreview();
      clearEditFileInput();
      setEditingTask(null);
      editForm.reset({
        title: "",
        description: "",
        image_url: null,
        image_file: null,
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

    await handleDeleteTask(taskToDelete);
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

    try {
      setEditUploading(true);
      let nextImageReference = editingTask.image_url ?? null;
      const maybeFile = values.image_file;
      const existingReference = parseImageReference(editingTask.image_url);

      if (isFile(maybeFile)) {
        const targetPath = existingReference.path ?? createStoragePath(maybeFile.name);
        const { error } = await supabase.storage
          .from(TASK_IMAGES_BUCKET)
          .upload(targetPath, maybeFile, {
            cacheControl: "3600",
            upsert: true,
          });

        if (error) {
          throw new Error(error.message);
        }

        const { data } = supabase.storage.from(TASK_IMAGES_BUCKET).getPublicUrl(targetPath);
        if (!data.publicUrl) {
          throw new Error("Unable to generate public URL for updated image");
        }

        const versionedUrl = withCacheBuster(data.publicUrl);
        nextImageReference = composeImageReference(targetPath, versionedUrl);
      } else if (!values.image_url && existingReference.path) {
        const { error: storageError } = await supabase.storage
          .from(TASK_IMAGES_BUCKET)
          .remove([existingReference.path]);

        if (storageError) {
          throw new Error(storageError.message);
        }

        nextImageReference = null;
      }

      await handleUpdateTask(editingTask.id, {
        title: values.title,
        description: values.description ?? "",
        image_url: nextImageReference,
      });

      handleEditDialogChange(false);
    } catch (error) {
      console.error("Error updating task:", error);
      const message = error instanceof Error ? error.message : "Unable to update task";
      editForm.setError("image_file", { type: "manual", message });
    } finally {
      setEditUploading(false);
    }
  };

  return (
    <>
      <div className="min-h-screen text-foreground transition-colors">
        <div className="container mx-auto px-4 py-10">
          <div className="grid gap-6 lg:grid-cols-[1fr_minmax(0,450px)]">
            <div className="space-y-6 relative">
              {!session ? (
                <Auth
                  className="w-full sticky -top-5 rounded-3xl border bg-card p-6 shadow-lg transition-colors mx-auto lg:hidden"
                  toggleTheme={toggleTheme}
                  theme={theme}
                />
              ) : null}

              <TaskList
                className="w-full mx-auto max-w-4xl transition-colors"
                tasks={tasks}
                session={session}
                fetching={fetching}
                updatingId={updatingId}
                deletingId={deletingId}
                onDeleteTask={handleDeleteRequest}
                onEditTask={handleEditTask}
              />
            </div>

            <div className="hidden space-y-6 lg:sticky lg:top-10 lg:block lg:h-fit lg:min-h-[calc(100vh-5rem)]">
              {session ? (
                <AddTask
                  className="mx-auto w-full max-w-md rounded-3xl border bg-card p-6 shadow-lg transition-colors"
                  toggleTheme={toggleTheme}
                  theme={theme}
                  adding={adding}
                  onAddTask={handleAddTask}
                />
              ) : (
                <Auth
                  className="mx-auto w-full max-w-md rounded-3xl border bg-card p-6 shadow-lg transition-colors"
                  toggleTheme={toggleTheme}
                  theme={theme}
                />
              )}

              <p className="text-sm text-muted-foreground">
                Simple{" "}
                <a
                  className="font-semibold text-green-500"
                  href="https://supabase.com"
                  rel="noreferrer"
                  target="_blank"
                >
                  Supabase
                </a>{" "}
                powered microfeed built with{" "}
                <a
                  className="font-semibold text-sky-500"
                  href="https://react.dev"
                  rel="noreferrer"
                  target="_blank"
                >
                  React
                </a>{" "}
                and secure authentication.
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
      {session ? (
        <>
          <Button
            aria-label="New Post"
            size="icon"
            className="fixed bottom-6 right-6 h-14 w-14 rounded-full bg-primary text-primary-foreground shadow-xl transition hover:scale-105 focus-visible:ring-2 focus-visible:ring-offset-2 lg:hidden"
            onClick={() => setMobileAddOpen(true)}
          >
            <Plus className="size-6" />
          </Button>
          <Dialog open={mobileAddOpen} onOpenChange={setMobileAddOpen}>
            <DialogContent className="px-4 border-0 sm:max-w-[420px] bg-transparent sm:shadow-none">
              <AddTask
                className="w-full space-y-4 rounded-3xl border bg-card p-6 shadow-lg"
                toggleTheme={toggleTheme}
                theme={theme}
                adding={adding}
                onAddTask={handleAddTask}
                onSubmitted={() => setMobileAddOpen(false)}
              />
            </DialogContent>
          </Dialog>
        </>
      ) : null}

      <Dialog open={deleteDialogOpen} onOpenChange={handleDeleteDialogChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Post</DialogTitle>
            <DialogDescription>
              This action cannot be undone. Are you sure you want to delete{" "}
              <span className="font-semibold">
                {taskToDelete ? `"${taskToDelete.title}"` : "this post"}
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
            <DialogTitle>Edit Post</DialogTitle>
            <DialogDescription>Update the details of your post.</DialogDescription>
          </DialogHeader>
          <Form {...editForm}>
            <form onSubmit={editForm.handleSubmit(onUpdate)} className="space-y-4">
              <FormField
                control={editForm.control}
                name="image_file"
                render={({ field: { onBlur, name, onChange, ref }, fieldState }) => {
                  const reference = parseImageReference(
                    typeof editImageValue === "string"
                      ? editImageValue
                      : (editingTask?.image_url ?? null)
                  );
                  const displayImage =
                    editPreview ?? reference.publicUrl ?? resolvePublicUrlFromPath(reference.path);

                  return (
                    <FormItem>
                      <FormControl>
                        <div className="flex flex-col gap-2">
                          {displayImage ? (
                            <div className="relative">
                              <div className="absolute left-0 bottom-1 flex w-full items-center justify-between gap-2 px-4">
                                <span className="text-sm text-muted-foreground">
                                  {editPreview ? "Image Preview" : "Current Image"}
                                </span>
                                <Button
                                  type="button"
                                  variant="link"
                                  className="p-0 text-sm text-red-500"
                                  onClick={() => handleRemoveEditImage(onChange)}
                                >
                                  Remove
                                </Button>
                              </div>
                              <img
                                src={displayImage}
                                alt="Post"
                                className="h-56 w-full rounded-md border object-cover"
                              />
                            </div>
                          ) : (
                            <div className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
                              No image selected for this task.
                            </div>
                          )}
                          <Input
                            type="file"
                            accept="image/*"
                            name={name}
                            onBlur={onBlur}
                            ref={ref}
                            onChange={(event) => handleEditFileChange(event, onChange)}
                          />
                        </div>
                      </FormControl>
                      <FormMessage>{fieldState.error?.message}</FormMessage>
                    </FormItem>
                  );
                }}
              />

              <FormField
                control={editForm.control}
                name="title"
                render={({ field, fieldState }) => (
                  <FormItem>
                    <FormControl>
                      <Input
                        className="overflow-x-auto text-ellipsis"
                        placeholder="Post Title"
                        autoComplete="off"
                        {...field}
                      />
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
                      <Textarea
                        className="resize-none overflow-y-auto break-all"
                        placeholder="Post Content (optional)"
                        rows={4}
                        {...field}
                      />
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
                <Button
                  type="submit"
                  disabled={!editingTask || updatingId === editingTask?.id || editUploading}
                >
                  {editUploading || updatingId === editingTask?.id ? (
                    <>
                      <Spinner className="mr-2" />
                      {editUploading ? "Updating image..." : "Saving..."}
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
