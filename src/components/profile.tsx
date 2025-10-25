import { type ChangeEvent, useEffect, useState } from "react";

import { LogOut, Mail, MessageCircleMore, MoonStar, Sun, Plus } from "lucide-react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { toast } from "sonner";

import type { Session } from "@supabase/supabase-js";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import type { ThemeMode } from "@/types/theme";
import type { User } from "@/types/user";
import {
  MAX_IMAGE_FILE_SIZE_BYTES,
  USERS_STORAGE_BUCKET,
  composeImageReference,
  createUserStoragePath,
  isFile,
  parseImageReference,
  withCacheBuster,
} from "@/lib/storage";
import { supabase } from "@/supabase-client";

interface ProfileProps {
  className?: string;
  toggleTheme: () => void;
  theme: ThemeMode;
  session: Session | null;
  currentUserPostCount: number;
  currentUserLastPostAt: string | null;
  onAddPostClick?: () => void;
}

const profileSchema = z.object({
  name: z.string().min(1, "Name is required").max(50, "Name is too long"),
  bio: z.string().max(100, "Bio is too long").optional(),
  image_file: z.any().nullable().optional(),
  image_url: z.string().nullable().optional(),
});

export default function Profile({
  className,
  toggleTheme,
  theme,
  session,
  currentUserPostCount,
  onAddPostClick,
}: ProfileProps) {
  const [logouting, setLogouting] = useState(false);
  const [profile, setProfile] = useState<User | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);

  const form = useForm<z.infer<typeof profileSchema>>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      name: "",
      bio: "",
      image_file: null,
      image_url: null,
    },
  });

  const imageUrlValue = form.watch("image_url");

  useEffect(() => {
    if (!session?.user?.email) {
      setProfile(null);
      setEditOpen(false);
      form.reset({
        name: "",
        bio: "",
        image_file: null,
        image_url: null,
      });
      return;
    }

    const loadProfile = async () => {
      setLoadingProfile(true);

      try {
        const { data, error } = await supabase
          .from("users")
          .select("*")
          .eq("email", session.user.email)
          .maybeSingle<User>();

        if (error) {
          console.error("Error loading profile:", error.message);
          toast.error("Unable to load profile. Please try again.");
          return;
        }

        if (!data) {
          const defaultName =
            session.user.user_metadata?.full_name ??
            session.user.email?.split("@")[0] ??
            session.user.email;

          const { data: upserted, error: upsertError } = await supabase
            .from("users")
            .upsert(
              {
                email: session.user.email,
                name: defaultName,
                bio: null,
                image_url: null,
              },
              {
                onConflict: "email",
              }
            )
            .select()
            .single<User>();

          if (upsertError) {
            console.error("Error ensuring profile:", upsertError.message);
            toast.error("Unable to prepare your profile. Please try again later.");
            return;
          }

          if (upserted) {
            setProfile(upserted);
            form.reset({
              name: upserted.name ?? defaultName ?? "",
              bio: upserted.bio ?? "",
              image_file: null,
              image_url: upserted.image_url ?? null,
            });
            return;
          }

          toast.error("Profile information is unavailable right now.");
          return;
        }

        setProfile(data);
        form.reset({
          name:
            data.name ??
            session.user.user_metadata?.full_name ??
            session.user.email?.split("@")[0] ??
            session.user.email,
          bio: data.bio ?? "",
          image_file: null,
          image_url: data.image_url ?? null,
        });
      } finally {
        setLoadingProfile(false);
      }
    };

    void loadProfile();
  }, [form, session?.user?.email, session?.user?.user_metadata?.full_name]);

  useEffect(() => {
    return () => {
      if (preview?.startsWith("blob:")) {
        URL.revokeObjectURL(preview);
      }
    };
  }, [preview]);

  useEffect(() => {
    const channel = supabase
      .channel("profile-updates")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "users" }, (payload) => {
        const newUser = payload.new as User;
        if (newUser.email === session?.user?.email) {
          setProfile(newUser);
        }
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "users" }, (payload) => {
        const updatedUser = payload.new as User;
        if (updatedUser.email === session?.user?.email) {
          setProfile(updatedUser);
        }
      })
      .subscribe((status) => {
        console.log("Subscription status:", status);
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [session]);

  const resolvePublicUrlFromPath = (path: string | null) => {
    if (!path) {
      return null;
    }

    const { data } = supabase.storage.from(USERS_STORAGE_BUCKET).getPublicUrl(path);
    return data.publicUrl ?? null;
  };

  const updatePreview = (value: string | null) => {
    setPreview((previous) => {
      if (previous?.startsWith("blob:")) {
        URL.revokeObjectURL(previous);
      }
      return value;
    });
  };

  const resetPreview = () => {
    updatePreview(null);
  };

  const handleLogout = async () => {
    setLogouting(true);
    toast.loading("Signing out...");
    setTimeout(async () => {
      toast.dismiss();

      try {
        await supabase.auth.signOut();
        setProfile(null);
      } catch (error) {
        setLogouting(false);
        console.error("Error signing out:", error);
        toast.error("Error signing out. Please try again.");
        return;
      } finally {
        setLogouting(false);
      }
    }, 2000);
  };

  const handleEditDialogChange = (open: boolean) => {
    setEditOpen(open);

    if (open) {
      form.clearErrors();
      form.reset({
        name:
          profile?.name ??
          session?.user.user_metadata?.full_name ??
          session?.user.email?.split("@")[0] ??
          session?.user.email ??
          "",
        bio: profile?.bio ?? "",
        image_file: null,
        image_url: profile?.image_url ?? null,
      });
    } else {
      resetPreview();
      form.clearErrors();
      form.reset({
        name:
          profile?.name ??
          session?.user.user_metadata?.full_name ??
          session?.user.email?.split("@")[0] ??
          session?.user.email ??
          "",
        bio: profile?.bio ?? "",
        image_file: null,
        image_url: profile?.image_url ?? null,
      });
    }
  };

  const handleFileChange = (
    event: ChangeEvent<HTMLInputElement>,
    formOnChange: (value: File | null) => void,
    clearInput: () => void
  ) => {
    const file = event.target.files?.[0];

    if (!file) {
      resetPreview();
      formOnChange(null);
      form.setValue("image_file", null);
      form.clearErrors("image_file");
      return;
    }

    if (!file.type.startsWith("image/")) {
      resetPreview();
      formOnChange(null);
      form.setValue("image_file", null);
      form.setError("image_file", { type: "manual", message: "Only image files are allowed" });
      clearInput();
      return;
    }

    if (file.size > MAX_IMAGE_FILE_SIZE_BYTES) {
      resetPreview();
      formOnChange(null);
      form.setValue("image_file", null);
      form.setError("image_file", { type: "manual", message: "File size must be under 2MB" });
      clearInput();
      return;
    }

    form.clearErrors("image_file");
    const objectUrl = URL.createObjectURL(file);
    updatePreview(objectUrl);
    formOnChange(file);
    form.setValue("image_file", file, { shouldDirty: true });
    form.setValue("image_url", profile?.image_url ?? null, { shouldDirty: true });
  };

  const handleRemoveImage = (
    formOnChange: (value: File | null) => void,
    clearInput: () => void
  ) => {
    resetPreview();
    formOnChange(null);
    form.setValue("image_file", null);
    form.setValue("image_url", null, { shouldDirty: true });
    form.clearErrors("image_file");
    clearInput();
  };

  const onSubmit = async (values: z.infer<typeof profileSchema>) => {
    if (!profile || !session?.user?.email) {
      return;
    }

    const toastId = toast.loading("Updating profile...");
    setSavingProfile(true);

    try {
      const maybeFile = values.image_file;
      const normalizedName = values.name.trim();
      const normalizedBio = values.bio?.trim() ?? "";
      const sanitizedBio = normalizedBio.length > 0 ? normalizedBio : null;

      const existingReference = parseImageReference(profile.image_url, USERS_STORAGE_BUCKET);
      let nextImageReference = profile.image_url ?? null;

      if (isFile(maybeFile)) {
        const targetPath = existingReference.path ?? createUserStoragePath(maybeFile.name);
        const { error: uploadError } = await supabase.storage
          .from(USERS_STORAGE_BUCKET)
          .upload(targetPath, maybeFile, {
            cacheControl: "3600",
            upsert: true,
          });

        if (uploadError) {
          throw new Error(uploadError.message);
        }

        const { data } = supabase.storage.from(USERS_STORAGE_BUCKET).getPublicUrl(targetPath);
        if (!data.publicUrl) {
          throw new Error("Unable to generate public URL for uploaded image");
        }

        const versionedUrl = withCacheBuster(data.publicUrl);
        nextImageReference = composeImageReference(targetPath, versionedUrl);
      } else if (!values.image_url && existingReference.path) {
        const { error: removeError } = await supabase.storage
          .from(USERS_STORAGE_BUCKET)
          .remove([existingReference.path]);

        if (removeError) {
          throw new Error(removeError.message);
        }

        nextImageReference = null;
      }

      const { data: updatedProfile, error: updateError } = await supabase
        .from("users")
        .update({
          name: normalizedName,
          bio: sanitizedBio,
          image_url: nextImageReference,
        })
        .eq("email", session.user.email)
        .select()
        .single<User>();

      if (updateError) {
        throw new Error(updateError.message);
      }

      setProfile(updatedProfile);
      updatePreview(null);
      setEditOpen(false);
      form.clearErrors();
      form.reset({
        name:
          updatedProfile.name ??
          session.user.user_metadata?.full_name ??
          session.user.email?.split("@")[0] ??
          session.user.email,
        bio: updatedProfile.bio ?? "",
        image_file: null,
        image_url: updatedProfile.image_url ?? null,
      });
      toast.success("Profile updated successfully!", { id: toastId });
    } catch (error) {
      console.error("Error updating profile:", error);
      const message = error instanceof Error ? error.message : "Unable to update profile";
      form.setError("image_file", { type: "manual", message });
      toast.error(message, { id: toastId });
    } finally {
      setSavingProfile(false);
    }
  };

  const profileReference = parseImageReference(profile?.image_url ?? null, USERS_STORAGE_BUCKET);
  const profileImageUrl =
    profileReference.publicUrl ?? resolvePublicUrlFromPath(profileReference.path);
  const displayName =
    (loadingProfile
      ? "Loading..."
      : (profile?.name ??
        session?.user.user_metadata?.full_name ??
        session?.user.email?.split("@")[0] ??
        session?.user.email)) ?? "Profile";
  const displayBio = loadingProfile ? "Loading..." : (profile?.bio ?? "");
  const displayFallback = session?.user.email?.charAt(0).toUpperCase() ?? "?";

  const themeIcon = theme === "dark" ? <Sun className="size-5" /> : <MoonStar className="size-5" />;
  const themeLabel = theme === "dark" ? "Switch to light theme" : "Switch to dark theme";

  return (
    <div className={`${className}`}>
      <header className="flex px-6 py-4 flex-wrap items-start justify-between gap-3 sm:items-center">
        <div className="flex flex-row gap-2">
          <Button aria-label="Log Out" onClick={handleLogout} size="icon" variant="destructive">
            {logouting ? <Spinner /> : <LogOut />}
          </Button>
          <Button aria-label={themeLabel} onClick={toggleTheme} size="icon" variant="outline">
            {themeIcon}
          </Button>
        </div>
        <h2 className="flex items-center text-xl font-semibold text-card-foreground">
          <MessageCircleMore />
          <span className="ml-2">microFeed</span>
        </h2>
      </header>
      <Separator />
      <div className="p-4 flex flex-row items-center">
        <Avatar className="h-18 w-18">
          <AvatarImage src={profileImageUrl ?? undefined} />
          <AvatarFallback className="font-bold text-3xl">{displayFallback}</AvatarFallback>
        </Avatar>
        <div className="ml-4 space-y-1">
          <div className="flex flex-row items-center">
            <h3 className="text-lg font-medium text-card-foreground">{displayName}</h3>
            <Button
              variant="link"
              size="sm"
              className="text-xs text-sky-500"
              onClick={() => handleEditDialogChange(true)}
              disabled={loadingProfile}
            >
              Edit Profile
            </Button>
          </div>
          <div className="flex flex-row items-center">
            <Mail className="inline-block size-4 text-card-foreground/70" />
            <p className="ml-1 text-sm text-card-foreground/70">{session?.user.email}</p>
          </div>
          <div className="flex flex-row items-center">
            <p className="text-sm text-card-foreground/70">{displayBio}</p>
          </div>
        </div>
      </div>

      <Separator />
      <div className="px-6 py-4 text-center">
        <div className="space-y-1 bg-muted/50 px-4 py-3 rounded-md inline-block w-full">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Your Posts
          </p>
          <p className="mt-1 text-2xl font-semibold text-card-foreground">{currentUserPostCount}</p>
        </div>
      </div>
      {onAddPostClick ? (
        <div className="px-6 pb-6">
          <div className="mx-auto w-full shadow-lg transition-colors">
            <Button className="w-full" onClick={onAddPostClick}>
              <Plus className="mr-2 size-5" />
              Add Post
            </Button>
          </div>
        </div>
      ) : null}

      <Dialog open={editOpen} onOpenChange={handleEditDialogChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Profile</DialogTitle>
            <DialogDescription>Update your personal details.</DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="image_file"
                render={({ field: { onBlur, name, onChange, ref }, fieldState }) => {
                  const reference = parseImageReference(
                    typeof imageUrlValue === "string"
                      ? imageUrlValue
                      : (profile?.image_url ?? null),
                    USERS_STORAGE_BUCKET
                  );
                  const displayImage =
                    preview ?? reference.publicUrl ?? resolvePublicUrlFromPath(reference.path);
                  let fileInputRef: HTMLInputElement | null = null;

                  const clearInput = () => {
                    if (fileInputRef) {
                      fileInputRef.value = "";
                    }
                  };

                  return (
                    <FormItem>
                      <FormControl>
                        <div className="flex flex-col gap-2">
                          {displayImage ? (
                            <div className="relative">
                              <div className="absolute left-0 bottom-1 flex w-full items-center justify-between gap-2 px-4">
                                <span className="text-sm text-muted-foreground">
                                  {preview ? "Image Preview" : "Current Image"}
                                </span>
                                <Button
                                  type="button"
                                  variant="link"
                                  className="p-0 text-sm text-red-500"
                                  onClick={() => handleRemoveImage(onChange, clearInput)}
                                >
                                  Remove
                                </Button>
                              </div>
                              <img
                                src={displayImage}
                                alt="Profile"
                                className="h-56 w-full rounded-md border object-cover"
                              />
                            </div>
                          ) : (
                            <div className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
                              No profile image selected.
                            </div>
                          )}
                          <Input
                            type="file"
                            accept="image/*"
                            name={name}
                            onBlur={onBlur}
                            ref={(node) => {
                              ref(node);
                              fileInputRef = node;
                            }}
                            onChange={(event) => handleFileChange(event, onChange, clearInput)}
                          />
                        </div>
                      </FormControl>
                      <FormMessage>{fieldState.error?.message}</FormMessage>
                    </FormItem>
                  );
                }}
              />

              <FormField
                control={form.control}
                name="name"
                render={({ field, fieldState }) => (
                  <FormItem>
                    <FormControl>
                      <Input placeholder="Full name" autoComplete="off" maxLength={50} {...field} />
                    </FormControl>
                    <FormMessage>{fieldState.error?.message}</FormMessage>
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="bio"
                render={({ field, fieldState }) => (
                  <FormItem>
                    <FormControl>
                      <Textarea
                        className="max-h-60 resize-y"
                        placeholder="Short bio (optional)"
                        rows={4}
                        maxLength={100}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage>{fieldState.error?.message}</FormMessage>
                  </FormItem>
                )}
              />

              <DialogFooter className="gap-2 sm:justify-between">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => handleEditDialogChange(false)}
                  disabled={savingProfile}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={savingProfile}>
                  {savingProfile ? (
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
    </div>
  );
}
