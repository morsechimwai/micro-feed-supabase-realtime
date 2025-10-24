// React
import { type ChangeEvent, useEffect, useState } from "react";

// UI Components
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Spinner } from "./ui/spinner";
import { Form, FormControl, FormField, FormItem, FormMessage } from "./ui/form";
import { toast } from "sonner";

// Types
import type { Post } from "@/types/post";

// Form and Validation
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import z from "zod";

// Supabase Client
import { supabase } from "@/supabase-client";

// Storage Utilities
import {
  MAX_IMAGE_FILE_SIZE_BYTES,
  POSTS_STORAGE_BUCKET,
  composeImageReference,
  createStoragePath,
  isFile,
  withCacheBuster,
} from "@/lib/storage";

// Form Validation Schema
const postSchema = z
  .object({
    title: z.string().min(1, "Title is required").max(100, "Title is too long"),
    description: z.string().max(500, "Description is too long").optional(),
    image_url: z.string().nullable().optional(),
    image_file: z.any().nullable().optional(),
  })
  .superRefine((values, ctx) => {
    if (!isFile(values.image_file)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Please select an image for your post, post must have an image",
        path: ["image_url"],
      });
    }
  });

interface AddPostProps {
  className?: string;
  adding: boolean;
  onAddPost: (post: Pick<Post, "title" | "description" | "image_url">) => Promise<boolean>;
  onSubmitted?: () => void;
}

export default function AddPost({ className, adding, onAddPost, onSubmitted }: AddPostProps) {
  // React Hook
  const form = useForm<z.infer<typeof postSchema>>({
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

  // Component State

  const [preview, setPreview] = useState<string | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);

  const onSubmit = async (values: z.infer<typeof postSchema>) => {
    try {
      let imageReference: string | null = null;
      const maybeFile = values.image_file;

      if (isFile(maybeFile)) {
        setUploadingImage(true);
        imageReference = await uploadFile(maybeFile);
      }

      form.setValue("image_url", imageReference ?? null);
      const added = await onAddPost({
        title: values.title,
        description: values.description ?? "",
        image_url: imageReference,
      });

      if (!added) {
        return;
      }

      form.reset();
      clearPreview();
      form.clearErrors(["image_file", "image_url"]);
      onSubmitted?.();
    } catch (error) {
      console.error("Error uploading image:", error);
      const message = error instanceof Error ? error.message : "Unable to upload image";
      form.setError("image_file", { type: "manual", message });
      toast.error(message);
    } finally {
      setUploadingImage(false);
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
      form.setValue("image_url", null);
      form.clearErrors(["image_file", "image_url"]);
      return;
    }

    if (!file.type.startsWith("image/")) {
      clearPreview();
      formOnChange(null);
      form.setError("image_file", { type: "manual", message: "Only image files are allowed" });
      form.setError("image_url", { type: "manual", message: "Only image files are allowed" });
      event.target.value = "";
      return;
    }

    if (file.size > MAX_IMAGE_FILE_SIZE_BYTES) {
      clearPreview();
      formOnChange(null);
      form.setError("image_file", { type: "manual", message: "File size must be under 2MB" });
      form.setError("image_url", { type: "manual", message: "File size must be under 2MB" });
      event.target.value = "";
      return;
    }

    form.clearErrors(["image_file", "image_url"]);
    clearPreview();
    const objectUrl = URL.createObjectURL(file);
    setPreview(objectUrl);
    formOnChange(file);
  };

  const uploadFile = async (file: File) => {
    console.log("Uploading file:", file);
    const path = createStoragePath(file.name);
    const { error } = await supabase.storage.from(POSTS_STORAGE_BUCKET).upload(path, file, {
      cacheControl: "3600",
      upsert: false,
    });

    if (error) {
      throw new Error(error.message);
    }

    const { data } = supabase.storage.from(POSTS_STORAGE_BUCKET).getPublicUrl(path);
    if (!data.publicUrl) {
      throw new Error("Unable to generate public URL for uploaded image");
    }

    const versionedUrl = withCacheBuster(data.publicUrl);
    return composeImageReference(path, versionedUrl);
  };

  const clearPreview = () => {
    if (preview) {
      URL.revokeObjectURL(preview);
      setPreview(null);
    }
  };

  useEffect(() => {
    return () => {
      if (preview) {
        URL.revokeObjectURL(preview);
      }
    };
  }, [preview]);

  // Watch title value for enabling/disabling submit button
  const titleValue = form.watch("title");

  return (
    <div className={`${className}`}>
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
                              form.setValue("image_url", null);
                              form.clearErrors(["image_file", "image_url"]);
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
                  <FormMessage>
                    {fieldState.error?.message ?? form.formState.errors.image_url?.message}
                  </FormMessage>
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="title"
              render={({ field, fieldState }) => (
                <FormItem>
                  <FormControl>
                    <Input placeholder="Post Title" autoComplete="off" maxLength={100} {...field} />
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
                      placeholder="Post Content (optional)"
                      rows={4}
                      maxLength={500}
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
                  {uploadingImage ? "Uploading..." : "Publishing..."}
                </>
              ) : (
                "Publish Post"
              )}
            </Button>
          </form>
        </Form>
      </div>
    </div>
  );
}
