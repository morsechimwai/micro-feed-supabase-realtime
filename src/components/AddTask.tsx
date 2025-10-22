import { type ChangeEvent, useEffect, useState } from "react";
import { ListTodo, LogOut, MoonStar, Plus, Sun } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { ThemeMode } from "@/types/theme";
import type { Task } from "@/types/task";
import { Spinner } from "./ui/spinner";
import { supabase } from "@/supabase-client";
import { Form, FormControl, FormField, FormItem, FormMessage } from "./ui/form";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import z from "zod";
import {
  MAX_IMAGE_FILE_SIZE_BYTES,
  TASK_IMAGES_BUCKET,
  composeImageReference,
  createStoragePath,
  withCacheBuster,
} from "@/lib/storage";

interface AddTaskProps {
  className?: string;
  toggleTheme: () => void;
  theme: ThemeMode;
  adding: boolean;
  onAddTask: (task: Pick<Task, "title" | "description" | "image_url">) => Promise<void>;
  onSubmitted?: () => void;
}

const AddTask = ({ className, toggleTheme, theme, adding, onAddTask, onSubmitted }: AddTaskProps) => {
  const [logouting, setLogouting] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);

  useEffect(() => {
    return () => {
      if (preview) {
        URL.revokeObjectURL(preview);
      }
    };
  }, [preview]);

  const themeIcon = theme === "dark" ? <Sun className="size-5" /> : <MoonStar className="size-5" />;
  const themeLabel = theme === "dark" ? "Switch to light theme" : "Switch to dark theme";

  const taskSchema = z.object({
    title: z.string().min(1, "Title is required").max(100, "Title is too long"),
    description: z.string().max(500, "Description is too long").optional(),
    image_file: z.any().nullable().optional(),
  });

  const form = useForm<z.infer<typeof taskSchema>>({
    resolver: zodResolver(taskSchema),
    defaultValues: {
      title: "",
      description: "",
      image_file: null,
    },
    mode: "onSubmit",
    reValidateMode: "onChange",
  });

  const titleValue = form.watch("title");

  const clearPreview = () => {
    if (preview) {
      URL.revokeObjectURL(preview);
      setPreview(null);
    }
  };

  const handleChangeFile = (
    event: ChangeEvent<HTMLInputElement>,
    formOnChange: (value: File | null) => void
  ) => {
    const file = event.target.files?.[0];

    if (!file) {
      clearPreview();
      formOnChange(null);
      form.clearErrors("image_file");
      return;
    }

    if (!file.type.startsWith("image/")) {
      clearPreview();
      formOnChange(null);
      form.setError("image_file", { type: "manual", message: "Only image files are allowed" });
      event.target.value = "";
      return;
    }

    if (file.size > MAX_IMAGE_FILE_SIZE_BYTES) {
      clearPreview();
      formOnChange(null);
      form.setError("image_file", { type: "manual", message: "File size must be under 2MB" });
      event.target.value = "";
      return;
    }

    form.clearErrors("image_file");
    clearPreview();
    const objectUrl = URL.createObjectURL(file);
    setPreview(objectUrl);
    formOnChange(file);
  };

  const isFile = (value: unknown): value is File =>
    typeof File !== "undefined" && value instanceof File;

  const uploadFile = async (file: File) => {
    const path = createStoragePath(file.name);
    const { error } = await supabase.storage.from(TASK_IMAGES_BUCKET).upload(path, file, {
      cacheControl: "3600",
      upsert: false,
    });

    if (error) {
      throw new Error(error.message);
    }

    const { data } = supabase.storage.from(TASK_IMAGES_BUCKET).getPublicUrl(path);
    if (!data.publicUrl) {
      throw new Error("Unable to generate public URL for uploaded image");
    }

    const versionedUrl = withCacheBuster(data.publicUrl);
    return composeImageReference(path, versionedUrl);
  };

  const onSubmit = async (values: z.infer<typeof taskSchema>) => {
    try {
      let imageReference: string | null = null;
      const maybeFile = values.image_file;

      if (isFile(maybeFile)) {
        setUploadingImage(true);
        imageReference = await uploadFile(maybeFile);
      }

      await onAddTask({
        title: values.title,
        description: values.description ?? "",
        image_url: imageReference,
      });

      form.reset();
      clearPreview();
      form.clearErrors("image_file");
      onSubmitted?.();
    } catch (error) {
      console.error("Error uploading image:", error);
      const message = error instanceof Error ? error.message : "Unable to upload image";
      form.setError("image_file", { type: "manual", message });
    } finally {
      setUploadingImage(false);
    }
  };

  const handleLogout = async () => {
    setLogouting(true);
    try {
      await supabase.auth.signOut();
    } catch (error) {
      setLogouting(false);
      console.error("Error signing out:", error);
    } finally {
      setLogouting(false);
    }
  };

  return (
    <div className={`${className}`}>
      <header className="flex flex-wrap items-start justify-between gap-3 sm:items-center">
        <h2 className="flex items-center text-xl font-semibold text-card-foreground">
          <ListTodo />
          <span className="ml-2">Task Manager</span>
        </h2>
        <div className="flex flex-row gap-2">
          <Button aria-label={themeLabel} onClick={toggleTheme} size="icon" variant="outline">
            {themeIcon}
          </Button>
          <Button aria-label="Log Out" onClick={handleLogout} size="icon" variant="destructive">
            {logouting ? <Spinner /> : <LogOut />}
          </Button>
        </div>
      </header>

      <div className="mt-4 space-y-2">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="image_file"
              render={({ field: { onBlur, name, onChange: formOnChange, ref }, fieldState }) => (
                <FormItem>
                  <FormControl>
                    {preview ? (
                      <div className="relative">
                        <div className="absolute left-0 bottom-1 flex w-full items-center justify-between gap-2 px-4">
                          <span className="text-sm text-muted-foreground">Image Preview</span>
                          <Button
                            type="button"
                            variant="link"
                            className="p-0 text-sm text-red-500"
                            onClick={() => {
                              clearPreview();
                              formOnChange(null);
                              form.clearErrors("image_file");
                            }}
                          >
                            Remove
                          </Button>
                        </div>
                        <img
                          src={preview}
                          alt="Preview"
                          className="h-56 w-full rounded-md border object-cover"
                        />
                      </div>
                    ) : (
                      <div className="flex flex-col gap-2">
                        <Input
                          type="file"
                          accept="image/*"
                          name={name}
                          onBlur={onBlur}
                          ref={ref}
                          onChange={(event) => handleChangeFile(event, formOnChange)}
                        />
                      </div>
                    )}
                  </FormControl>
                  <FormMessage>{fieldState.error?.message}</FormMessage>
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
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
              control={form.control}
              name="description"
              render={({ field, fieldState }) => (
                <FormItem>
                  <FormControl>
                    <Textarea
                      className="max-h-60 resize-y"
                      placeholder="Task Description (optional)"
                      rows={4}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage>{fieldState.error?.message}</FormMessage>
                </FormItem>
              )}
            />

            <Button
              className="mt-4 w-full"
              type="submit"
              disabled={!titleValue?.trim() || adding || uploadingImage}
            >
              {adding || uploadingImage ? (
                <>
                  <Spinner />
                  {uploadingImage ? "Uploading..." : "Adding Task.."}
                </>
              ) : (
                <>
                  <Plus />
                  Add Task
                </>
              )}
            </Button>
          </form>
        </Form>
      </div>
    </div>
  );
};

export default AddTask;
