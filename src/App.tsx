// React
import { type ChangeEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";

// UI Components
import Auth from "./components/authenicate";
import Profile from "./components/profile";
import AddPost from "./components/add-post";
import PostList from "./components/post-list";
import { Form, FormControl, FormField, FormItem, FormMessage } from "./components/ui/form";
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
import { Spinner } from "./components/ui/spinner";

// Icons
import { User2 } from "lucide-react";

// Types
import type { ThemeMode } from "./types/theme";
import type { Post } from "./types/post";
import type { User } from "./types/user";

// Supabase Client
import type { Session } from "@supabase/supabase-js";
import { supabase } from "./supabase-client";

// Libraries for form validation
import z from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

// Storage Utilities
import {
  MAX_IMAGE_FILE_SIZE_BYTES,
  POSTS_STORAGE_BUCKET,
  composeImageReference,
  createStoragePath,
  isFile,
  parseImageReference,
  withCacheBuster,
} from "./lib/storage";
import { toast } from "sonner";

// Theme Management
const THEME_STORAGE_KEY = "theme-preference";

type PostStats = {
  count: number;
  lastPostAt: string | null;
};

const POSTS_PAGE_SIZE = 5;

// Form Validation Schema
const postSchema = z.object({
  title: z.string().min(1, "Title is required").max(100, "Title is too long"),
  description: z.string().max(500, "Description is too long").optional(),
  image_url: z.string().nullable().optional(),
  image_file: z.any().nullable().optional(),
});

export default function App() {
  // Hook Form
  const editForm = useForm<z.infer<typeof postSchema>>({
    resolver: zodResolver(postSchema),
    defaultValues: {
      title: "",
      description: "",
      image_url: null,
      image_file: null,
    },
    mode: "onSubmit",
    reValidateMode: "onChange",
  });

  // State Management
  const [session, setSession] = useState<Session | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [postStatsByEmail, setPostStatsByEmail] = useState<Record<string, PostStats>>({});
  const [profilesByEmail, setProfilesByEmail] = useState<Record<string, User>>({});
  const profilesRef = useRef<Record<string, User>>({});
  const [initialFetching, setInitialFetching] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMorePosts, setHasMorePosts] = useState(true);
  const [authOverlayVisible, setAuthOverlayVisible] = useState(false);
  const [adding, setAdding] = useState(false);
  const [updatingId, setUpdatingId] = useState<number | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [openEdit, setOpenEdit] = useState(false);
  const [editingPost, setEditingPost] = useState<Post | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [postToDelete, setPostToDelete] = useState<Post | null>(null);
  const [editPreview, setEditPreview] = useState<string | null>(null);
  const [editUploading, setEditUploading] = useState(false);
  const [addPostOpen, setAddPostOpen] = useState(false);
  const [profileDialogOpen, setProfileDialogOpen] = useState(false);
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

  const currentUserPostCount = useMemo(() => {
    const normalizedEmail =
      typeof session?.user?.email === "string" ? session.user.email.trim().toLowerCase() : null;

    if (!normalizedEmail) {
      return 0;
    }

    return postStatsByEmail[normalizedEmail]?.count ?? 0;
  }, [postStatsByEmail, session?.user?.email]);

  const currentUserLastPostAt = useMemo(() => {
    const normalizedEmail =
      typeof session?.user?.email === "string" ? session.user.email.trim().toLowerCase() : null;

    if (!normalizedEmail) {
      return null;
    }

    return postStatsByEmail[normalizedEmail]?.lastPostAt ?? null;
  }, [postStatsByEmail, session?.user?.email]);

  const mergeProfiles = useCallback((users: User[] | null | undefined) => {
    if (!users?.length) {
      return;
    }

    setProfilesByEmail((previous) => {
      const next = { ...previous };
      for (const user of users) {
        const normalizedEmail =
          typeof user?.email === "string" ? user.email.trim().toLowerCase() : null;
        if (normalizedEmail) {
          next[normalizedEmail] = user;
        }
      }
      profilesRef.current = next;
      return next;
    });
  }, []);

  const ensureProfiles = useCallback(
    async (emails: string[]) => {
      const uniqueEmails = Array.from(
        new Set(
          emails
            .filter(
              (email): email is string => typeof email === "string" && email.trim().length > 0
            )
            .map((email) => email.trim().toLowerCase())
        )
      );

      if (uniqueEmails.length === 0) {
        return;
      }

      const missing = uniqueEmails.filter((email) => !profilesRef.current[email]);
      if (missing.length === 0) {
        return;
      }

      const { data, error } = await supabase.from("users").select("*").in("email", missing);

      if (error) {
        console.error("Error fetching user profiles:", error.message);
        return;
      }

      mergeProfiles(data);
    },
    [mergeProfiles]
  );

  const removeProfile = useCallback((email: string | null | undefined) => {
    if (!email) {
      return;
    }
    const normalized = email.trim().toLowerCase();
    setProfilesByEmail((previous) => {
      if (!previous[normalized]) {
        return previous;
      }
      const next = { ...previous };
      delete next[normalized];
      profilesRef.current = next;
      return next;
    });
  }, []);

  const refreshPostStats = useCallback(async () => {
    try {
      const { data, error } = await supabase.from("posts").select("email, created_at");

      if (error) {
        console.error("Error refreshing post stats:", error.message);
        return;
      }

      const stats: Record<string, PostStats> = {};
      for (const row of data ?? []) {
        const email = typeof row.email === "string" ? row.email.trim().toLowerCase() : null;
        if (!email) {
          continue;
        }

        const createdAt = typeof row.created_at === "string" ? row.created_at : null;
        const existing = stats[email] ?? { count: 0, lastPostAt: null as string | null };

        existing.count += 1;
        if (createdAt) {
          const newTimestamp = Date.parse(createdAt);
          if (!Number.isNaN(newTimestamp)) {
            const previousTimestamp = existing.lastPostAt ? Date.parse(existing.lastPostAt) : null;
            if (previousTimestamp === null || newTimestamp > previousTimestamp) {
              existing.lastPostAt = createdAt;
            }
          }
        }

        stats[email] = existing;
      }

      setPostStatsByEmail(stats);
    } catch (error) {
      console.error("Unexpected error refreshing post stats:", error);
    }
  }, []);

  useEffect(() => {
    if (session) {
      setAuthOverlayVisible(false);
      setHasMorePosts(true);
    } else {
      setAuthOverlayVisible(false);
      setPosts((previous) => previous.slice(0, POSTS_PAGE_SIZE));
    }
  }, [session]);

  const loadInitialPosts = useCallback(async () => {
    setInitialFetching(true);
    setHasMorePosts(true);
    try {
      const { data, error } = await supabase
        .from("posts")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(POSTS_PAGE_SIZE + 1);

      if (error) {
        console.error("Error fetching posts:", error.message);
        return;
      }

      const fetchedPosts = data ?? [];
      const hasExtra = fetchedPosts.length > POSTS_PAGE_SIZE;
      const visiblePosts = fetchedPosts.slice(0, POSTS_PAGE_SIZE);

      setPosts(visiblePosts);
      setHasMorePosts(hasExtra);
      if (visiblePosts.length > 0) {
        void ensureProfiles(visiblePosts.map((post) => post.email));
      }
      await refreshPostStats();
    } catch (error) {
      console.error("Unexpected error fetching posts:", error);
    } finally {
      setInitialFetching(false);
    }
  }, [ensureProfiles, refreshPostStats]);

  const loadMorePosts = useCallback(async () => {
    if (!session) {
      setAuthOverlayVisible(true);
      setHasMorePosts(false);
      return;
    }

    if (loadingMore || !hasMorePosts) {
      return;
    }

    const oldestPost = posts[posts.length - 1] ?? null;
    if (!oldestPost?.created_at) {
      setHasMorePosts(false);
      return;
    }

    setLoadingMore(true);
    try {
      const { data, error } = await supabase
        .from("posts")
        .select("*")
        .lt("created_at", oldestPost.created_at)
        .order("created_at", { ascending: false })
        .limit(POSTS_PAGE_SIZE);

      if (error) {
        console.error("Error loading more posts:", error.message);
        return;
      }

      const fetchedPosts = data ?? [];
      if (fetchedPosts.length > 0) {
        setPosts((previous) => {
          const existingIds = new Set(previous.map((post) => post.id));
          const merged = [...previous, ...fetchedPosts.filter((post) => !existingIds.has(post.id))];
          return merged;
        });
        void ensureProfiles(fetchedPosts.map((post) => post.email));
      }

      if (fetchedPosts.length < POSTS_PAGE_SIZE) {
        setHasMorePosts(false);
      }
      await refreshPostStats();
    } catch (error) {
      console.error("Unexpected error loading more posts:", error);
    } finally {
      setLoadingMore(false);
    }
  }, [session, loadingMore, hasMorePosts, posts, ensureProfiles, refreshPostStats]);

  const handleLoadMorePosts = useCallback(() => {
    void loadMorePosts();
  }, [loadMorePosts]);

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

  useEffect(() => {
    return () => {
      if (editPreview?.startsWith("blob:")) {
        URL.revokeObjectURL(editPreview);
      }
    };
  }, [editPreview]);

  useEffect(() => {
    if (!session) {
      setAddPostOpen(false);
      setProfileDialogOpen(false);
    }
  }, [session]);

  useEffect(() => {
    const loadSession = async () => {
      const currentSession = await supabase.auth.getSession();
      const activeSession = currentSession.data.session ?? null;

      if (activeSession) {
        console.log("Current session:", activeSession);
      }

      setSession(activeSession);

      if (!activeSession) {
        setEditingPost(null);
        setOpenEdit(false);
      }
    };

    void loadSession();

    const { data: authListener } = supabase.auth.onAuthStateChange((event, authSession) => {
      console.log("Auth state changed:", event, authSession);
      setSession(authSession);
      if (!authSession) {
        setEditingPost(null);
        setOpenEdit(false);
      }
    });

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    void loadInitialPosts();
  }, [loadInitialPosts]);

  useEffect(() => {
    const channel = supabase
      .channel("posts-channel")
      // เมื่อมีการเพิ่ม post
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "posts" }, (payload) => {
        const newPost = payload.new as Post;
        setPosts((previous) => {
          if (previous.some((post) => post.id === newPost.id)) {
            return previous;
          }
          return [newPost, ...previous].sort((a, b) =>
            a.created_at < b.created_at ? 1 : a.created_at > b.created_at ? -1 : 0
          );
        });
        void ensureProfiles([newPost.email]);
        void refreshPostStats();
      })
      // เมื่อมีการอัปเดต post
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "posts" }, (payload) => {
        const updatedPost = payload.new as Post;
        setPosts((prev) => prev.map((post) => (post.id === updatedPost.id ? updatedPost : post)));
        void ensureProfiles([updatedPost.email]);
        void refreshPostStats();
      })
      // เมื่อมีการลบ post
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "posts" }, (payload) => {
        const deletedPost = payload.old as Post;
        setPosts((prev) => prev.filter((post) => post.id !== deletedPost.id));
        void refreshPostStats();
      })
      .subscribe((status) => {
        console.log("Subscription status:", status);
      });

    // cleanup เพื่อยกเลิก channel เมื่อ component ถูก unmount
    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  useEffect(() => {
    const channel = supabase
      .channel("users-profiles-channel")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "users" }, (payload) => {
        const user = payload.new as User;
        mergeProfiles([user]);
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "users" }, (payload) => {
        const user = payload.new as User;
        mergeProfiles([user]);
      })
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "users" }, (payload) => {
        const user = payload.old as User;
        removeProfile(user?.email);
      })
      .subscribe((status) => {
        console.log("Users channel status:", status);
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [mergeProfiles, removeProfile]);

  const toggleTheme = () => {
    setTheme((prev) => {
      const next = prev === "dark" ? "light" : "dark";
      if (typeof window !== "undefined") {
        window.localStorage.setItem(THEME_STORAGE_KEY, next);
      }
      return next;
    });
  };

  const resolvePublicUrlFromPath = (path: string | null) => {
    if (!path) {
      return null;
    }
    const { data } = supabase.storage.from(POSTS_STORAGE_BUCKET).getPublicUrl(path);
    if (!data.publicUrl) {
      return null;
    }
    return withCacheBuster(data.publicUrl);
  };

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
    editForm.setValue("image_url", editingPost?.image_url ?? null, { shouldDirty: true });
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

  const handleAddPost = async (
    post: Pick<Post, "title" | "description" | "image_url">
  ): Promise<boolean> => {
    if (!session) {
      return false;
    }

    setAdding(true);
    const toastId = toast.loading("Adding post...");
    let isSuccessful = false;
    try {
      const { error } = await supabase
        .from("posts")
        .insert({
          title: post.title,
          description: post.description ?? "",
          email: session.user.email,
          image_url: post.image_url ?? null,
        })
        .select()
        .single();

      if (error) {
        console.error("Error adding post:", error.message);
        toast.error("Error adding post. Please try again.", { id: toastId });
        return false;
      }

      toast.success("Post added successfully!", { id: toastId });
      isSuccessful = true;
      void refreshPostStats();
    } catch (error) {
      console.error("Unexpected error adding post:", error);
      toast.error("Unexpected error adding post. Please try again.", { id: toastId });
    } finally {
      setAdding(false);
    }

    return isSuccessful;
  };

  const onUpdate = async (values: z.infer<typeof postSchema>) => {
    if (!editingPost) {
      return;
    }

    try {
      setEditUploading(true);

      let nextImageReference = editingPost.image_url ?? null;
      const maybeFile = values.image_file;
      const existingReference = parseImageReference(editingPost.image_url);

      if (isFile(maybeFile)) {
        const targetPath = existingReference.path ?? createStoragePath(maybeFile.name);
        const { error } = await supabase.storage
          .from(POSTS_STORAGE_BUCKET)
          .upload(targetPath, maybeFile, {
            cacheControl: "3600",
            upsert: true,
          });

        if (error) {
          throw new Error(error.message);
        }

        const { data } = supabase.storage.from(POSTS_STORAGE_BUCKET).getPublicUrl(targetPath);
        if (!data.publicUrl) {
          throw new Error("Unable to generate public URL for updated image");
        }

        const versionedUrl = withCacheBuster(data.publicUrl);
        nextImageReference = composeImageReference(targetPath, versionedUrl);
      } else if (!values.image_url && existingReference.path) {
        const { error: storageError } = await supabase.storage
          .from(POSTS_STORAGE_BUCKET)
          .remove([existingReference.path]);

        if (storageError) {
          throw new Error(storageError.message);
        }

        nextImageReference = null;
      }

      await handleUpdatePost(editingPost.id, {
        title: values.title,
        description: values.description ?? "",
        image_url: nextImageReference,
      });

      handleEditDialogChange(false);
    } catch (error) {
      console.error("Error updating post:", error);

      const message = error instanceof Error ? error.message : "Unable to update post";
      editForm.setError("image_file", { type: "manual", message });
    } finally {
      setEditUploading(false);
    }
  };

  const handleUpdatePost = async (
    id: number,
    updates: Pick<Post, "title" | "description" | "image_url">
  ) => {
    setUpdatingId(id);
    const toastId = toast.loading("Updating post...");
    try {
      const { error } = await supabase.from("posts").update(updates).eq("id", id).select().single();

      if (error) {
        console.error("Error updating post:", error.message);
        toast.error("Error updating post. Please try again.", { id: toastId });
        return;
      }

      toast.success("Post updated successfully!", { id: toastId });
    } catch (error) {
      console.error("Unexpected error updating post:", error);
      toast.error("Unexpected error updating post. Please try again.", { id: toastId });
    } finally {
      setUpdatingId(null);
    }
  };

  const handleEditPost = (post: Post) => {
    resetEditPreview();
    clearEditFileInput();
    setEditingPost(post);

    const reference = parseImageReference(post.image_url);
    const currentUrl = reference.publicUrl ?? resolvePublicUrlFromPath(reference.path);
    setEditPreview(currentUrl);

    editForm.reset({
      title: post.title,
      description: post.description ?? "",
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
      setEditingPost(null);
      editForm.reset({
        title: "",
        description: "",
        image_url: null,
        image_file: null,
      });
    }
  };

  const handleDeletePost = async (post: Post) => {
    setDeletingId(post.id);
    const toastId = toast.loading("Deleting post...");
    try {
      const reference = parseImageReference(post.image_url);
      if (reference.path) {
        console.log("Deleting image from storage:", reference);
        console.log("Deleting image from storage at path:", reference.path);
        const { error: storageError, data } = await supabase.storage
          .from(POSTS_STORAGE_BUCKET)
          .remove([reference.path]);

        if (storageError) {
          console.error("Error deleting image from storage:", storageError.message);
          toast.error("Error deleting image from storage", { id: toastId });
          return;
        }

        if (data) {
          console.log("Deleted image from storage:", data);
        }
      }

      const { error } = await supabase.from("posts").delete().eq("id", post.id).select().single();

      if (error) {
        toast.error("Error deleting post. Please try again.", { id: toastId });
        console.error("Error deleting post:", error.message);
        return;
      }

      toast.success("Post deleted successfully!", { id: toastId });
      void refreshPostStats();
    } catch (error) {
      toast.error("Unexpected error deleting post. Please try again.", { id: toastId });
      console.error("Unexpected error deleting post:", error);
    } finally {
      setDeletingId(null);
    }
  };

  const handleDeleteRequest = (post: Post) => {
    setPostToDelete(post);
    setDeleteDialogOpen(true);
  };

  const handleDeleteDialogChange = (open: boolean) => {
    setDeleteDialogOpen(open);
    if (!open) {
      setPostToDelete(null);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!postToDelete) {
      return;
    }

    await handleDeletePost(postToDelete);
    handleDeleteDialogChange(false);
  };

  const editImageValue = editForm.watch("image_url");

  return (
    <>
      <div className="min-h-screen text-foreground transition-colors">
        <div className="container mx-auto px-0 lg:px-4 py-10">
          <div className="grid gap-6 lg:grid-cols-[1fr_minmax(0,450px)]">
            <div className="space-y-4 relative">
              {/* No session */}
              {!session ? (
                <Auth
                  className="w-full sticky z-10 top-5 border bg-card p-6 shadow-lg transition-colors mx-auto lg:hidden"
                  toggleTheme={toggleTheme}
                  theme={theme}
                />
              ) : null}

              <PostList
                className="w-full mx-auto  transition-colors p-0"
                posts={posts}
                session={session}
                profiles={profilesByEmail}
                postStatsByEmail={postStatsByEmail}
                fetching={initialFetching}
                loadingMore={loadingMore}
                hasMore={hasMorePosts}
                onLoadMore={handleLoadMorePosts}
                updatingId={updatingId}
                deletingId={deletingId}
                onDeletePost={handleDeleteRequest}
                onEditPost={handleEditPost}
              />
            </div>

            <div className="hidden space-y-4 lg:sticky lg:top-10 lg:block lg:h-fit lg:min-h-[calc(100vh-5rem)]">
              {session ? (
                <Profile
                  className="mx-auto w-full max-w-md rounded-3xl border bg-card shadow-lg transition-colors"
                  toggleTheme={toggleTheme}
                  theme={theme}
                  session={session}
                  currentUserPostCount={currentUserPostCount}
                  currentUserLastPostAt={currentUserLastPostAt}
                  onAddPostClick={() => setAddPostOpen(true)}
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
                    href="https://github.com/morsechimwai/micro-feed-supabase-realtime"
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
            aria-label="Open Profile"
            size="icon"
            className="fixed bottom-6 right-6 h-14 w-14 rounded-full bg-primary text-primary-foreground shadow-xl transition hover:scale-105 focus-visible:ring-2 focus-visible:ring-offset-2 lg:hidden"
            onClick={() => setProfileDialogOpen(true)}
          >
            <User2 className="size-6" />
          </Button>
          <Dialog open={profileDialogOpen} onOpenChange={setProfileDialogOpen}>
            <DialogContent className="border-0 bg-transparent p-0 px-4 sm:max-w-[520px] sm:px-0 sm:shadow-none">
              <DialogTitle className="sr-only">Your profile</DialogTitle>
              <Profile
                className="mx-auto w-full max-w-md rounded-3xl border bg-card shadow-lg transition-colors"
                toggleTheme={toggleTheme}
                theme={theme}
                session={session}
                currentUserPostCount={currentUserPostCount}
                currentUserLastPostAt={currentUserLastPostAt}
                onAddPostClick={() => setAddPostOpen(true)}
              />
            </DialogContent>
          </Dialog>
          <Dialog open={addPostOpen} onOpenChange={setAddPostOpen}>
            <DialogContent className="border-0 bg-transparent p-0 px-4 sm:max-w-[520px] sm:px-0 sm:shadow-none">
              <DialogTitle className="sr-only">Create a new post</DialogTitle>
              <AddPost
                className="mx-auto w-full max-w-md space-y-4 rounded-3xl border bg-card p-6 shadow-lg"
                adding={adding}
                onAddPost={handleAddPost}
                onSubmitted={() => {
                  setAddPostOpen(false);
                  setProfileDialogOpen(false);
                }}
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
                {postToDelete ? `"${postToDelete.title}"` : "this post"}
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
              disabled={!postToDelete || deletingId === postToDelete.id}
            >
              {deletingId === postToDelete?.id ? (
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
                      : (editingPost?.image_url ?? null)
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
                              No image selected for this post.
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
                  disabled={!editingPost || updatingId === editingPost?.id || editUploading}
                >
                  {editUploading || updatingId === editingPost?.id ? (
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
      {!session && authOverlayVisible ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/40 backdrop-blur-sm">
          <Auth
            className="mx-auto w-full max-w-md rounded-3xl border bg-card p-6 shadow-lg transition-colors"
            toggleTheme={toggleTheme}
            theme={theme}
          />
        </div>
      ) : null}
    </>
  );
}
