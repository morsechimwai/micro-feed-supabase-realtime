// UI Components
import { Button } from "./ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

// Icons
import { EllipsisVertical, Laugh, MessageCircleMore, Pencil, Trash2 } from "lucide-react";

// Types
import type { Post } from "@/types/post";
import type { Session } from "@supabase/supabase-js";

// Supabase Client
import { supabase } from "@/supabase-client";

// Storage Utilities
import { STORAGE_BUCKET, parseImageReference, withCacheBuster } from "@/lib/storage";

// Utilities
import { formatCreatedAt } from "@/lib/utils";

interface PostItemProps {
  post: Post;
  session: Session | null;
  onDelete?: (post: Post) => void;
  onEdit?: (post: Post) => void;
  isUpdating?: boolean;
  isDeleting?: boolean;
}

export default function PostItem({
  post,
  session,
  onDelete,
  onEdit,
  isUpdating,
  isDeleting,
}: PostItemProps) {
  // Determine the image URL to display
  const imageReference = parseImageReference(post.image_url);

  // Compute the display image URL
  const displayImage = (() => {
    if (imageReference.publicUrl) {
      return imageReference.publicUrl;
    }

    if (!imageReference.path) {
      return null;
    }

    const { data } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(imageReference.path);
    if (!data.publicUrl) {
      return null;
    }

    return withCacheBuster(data.publicUrl, post.created_at ?? undefined);
  })();

  return (
    <>
      <li className="bg-card flex flex-col gap-4 border shadow-sm transition-colors hover:bg-accent hover:shadow-md rounded-3xl overflow-hidden">
        <div className="space-y-2">
          <div className="flex flex-row items-center justify-between pt-2">
            <div className="px-4 mt-2 gap-2">
              <div className="flex flex-row items-center gap-2">
                <Laugh className="inline size-8 mr-2 mb-1 text-secondary-foreground" />
                <div>
                  <div className="text-sm font-bold">
                    {post.email === session?.user.email ? (
                      <span className="dark:text-green-500 text-green-700">My Post</span>
                    ) : (
                      post.email
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {formatCreatedAt(post.created_at)}
                  </div>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 sm:justify-end">
              {session && session.user.email === post.email && (
                <DropdownMenu modal={false}>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" className="h-8 w-8 p-0">
                      <EllipsisVertical />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => onEdit?.(post)} disabled={isUpdating}>
                      <Pencil />
                      <span>Edit</span>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => onDelete?.(post)} disabled={isDeleting}>
                      <Trash2 />
                      <span>Delete</span>
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>
          </div>

          <div>
            {displayImage ? (
              <img src={displayImage} alt={post.title} className="h-84 w-full object-cover" />
            ) : null}
          </div>

          <div className="mb-2 px-4">
            <h3 className="text-based text-secondary-foreground break-words">{post.title}</h3>
            <div className="flex flex-row items-center gap-1.5 mt-2">
              <MessageCircleMore className="size-3.5" />
              <p className="flex-1 text-sm text-muted-foreground whitespace-pre-wrap break-all">
                {post.description}
              </p>
            </div>
          </div>
        </div>
      </li>
    </>
  );
}
