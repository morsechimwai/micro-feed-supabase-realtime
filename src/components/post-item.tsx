import { useState } from "react";

// UI Components
import { Button } from "./ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

// Icons
import { EllipsisVertical, MessageCircleMore, Pencil, Trash2 } from "lucide-react";

// Types
import type { Post } from "@/types/post";
import type { Session } from "@supabase/supabase-js";
import type { User } from "@/types/user";

// Supabase Client
import { supabase } from "@/supabase-client";

// Storage Utilities
import {
  POSTS_STORAGE_BUCKET,
  USERS_STORAGE_BUCKET,
  parseImageReference,
  withCacheBuster,
} from "@/lib/storage";

// Utilities
import { formatCreatedAt } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar";

interface PostItemProps {
  post: Post;
  session: Session | null;
  profile: User | null;
  onDelete?: (post: Post) => void;
  onEdit?: (post: Post) => void;
  isUpdating?: boolean;
  isDeleting?: boolean;
}

export default function PostItem({
  post,
  session,
  profile,
  onDelete,
  onEdit,
  isUpdating,
  isDeleting,
}: PostItemProps) {
  const [profileDialogOpen, setProfileDialogOpen] = useState(false);
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

    const { data } = supabase.storage.from(POSTS_STORAGE_BUCKET).getPublicUrl(imageReference.path);
    if (!data.publicUrl) {
      return null;
    }

    return withCacheBuster(data.publicUrl, post.created_at ?? undefined);
  })();

  const profileReference = parseImageReference(profile?.image_url ?? null, USERS_STORAGE_BUCKET);

  const profileImage = (() => {
    if (profileReference.publicUrl) {
      return profileReference.publicUrl;
    }

    if (!profileReference.path) {
      return null;
    }

    const { data } = supabase.storage
      .from(USERS_STORAGE_BUCKET)
      .getPublicUrl(profileReference.path);
    if (!data.publicUrl) {
      return null;
    }

    const bustToken = profile?.updated_at ?? profile?.created_at ?? undefined;
    return withCacheBuster(data.publicUrl, bustToken ?? undefined);
  })();

  const isAuthor = session?.user.email === post.email;
  const displayName = profile?.name?.trim() || post.email;
  const displayBio = profile?.bio?.trim() || null;
  const displayEmail = profile?.email ?? post.email;
  const avatarFallback =
    (profile?.name || post.email)?.trim().charAt(0)?.toUpperCase() ?? post.email.charAt(0);

  return (
    <>
      <li className="bg-card flex flex-col gap-4 border transition-colors hover:bg-accent shadow-lg rounded-3xl overflow-hidden scale-100 hover:scale-[1.01] duration-150">
        <div className="space-y-2">
          <div className="flex flex-row items-center justify-between pt-2">
            <Dialog open={profileDialogOpen} onOpenChange={setProfileDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="ghost" className="px-4 mt-2 gap-2">
                  <div className="flex flex-row items-center gap-2 text-left">
                    <Avatar>
                      {profileImage ? (
                        <AvatarImage src={profileImage} alt={`${displayName}'s avatar`} />
                      ) : (
                        <AvatarFallback>{avatarFallback}</AvatarFallback>
                      )}
                    </Avatar>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-card-foreground">
                          {displayName}
                        </span>
                        {isAuthor ? (
                          <span className="text-xs font-medium text-green-600 dark:text-green-400">
                            (me)
                          </span>
                        ) : null}
                      </div>

                      <p className="text-xs text-muted-foreground">
                        {formatCreatedAt(post.created_at)}
                      </p>
                    </div>
                  </div>
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Profile</DialogTitle>
                  <DialogDescription>Author profile details</DialogDescription>
                </DialogHeader>
                {profile ? (
                  <div className="space-y-4">
                    <div className="flex items-center gap-3 flex-row sm:items-start">
                      <Avatar className="h-20 w-20">
                        {profileImage ? (
                          <AvatarImage src={profileImage} alt={`${displayName}'s avatar`} />
                        ) : (
                          <AvatarFallback className="text-lg">{avatarFallback}</AvatarFallback>
                        )}
                      </Avatar>
                      <div className="space-y-2">
                        <div>
                          <p className="text-sm font-medium text-muted-foreground">Name</p>
                          <p className="text-base font-semibold text-card-foreground">
                            {displayName}
                          </p>
                        </div>
                        <div>
                          <p className="text-sm font-medium text-muted-foreground">Email</p>
                          <p className="text-sm text-card-foreground break-all">{displayEmail}</p>
                        </div>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <p className="text-sm font-medium text-muted-foreground">Bio</p>
                      <p className="text-sm text-card-foreground whitespace-pre-wrap break-words">
                        {displayBio ?? "No bio provided."}
                      </p>
                    </div>
                    <div className="grid gap-2 sm:grid-cols-2">
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">Joined</p>
                        <p className="text-sm text-card-foreground">
                          {profile.created_at ? formatCreatedAt(profile.created_at) : "—"}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">Last updated</p>
                        <p className="text-sm text-card-foreground">
                          {profile.updated_at ? formatCreatedAt(profile.updated_at) : "—"}
                        </p>
                      </div>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Profile details are unavailable for this author.
                  </p>
                )}
              </DialogContent>
            </Dialog>

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
            <div className="flex flex-row items-start gap-1.5 mt-2">
              <MessageCircleMore className="size-3.5 mt-1" />
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
