import { useEffect, useRef } from "react";

// UI Components
import PostItem from "./post-item";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Spinner } from "@/components/ui/spinner";

// Icons
import { MessageCircleOff } from "lucide-react";

// Types
import type { Post } from "@/types/post";
import type { User } from "@/types/user";
import type { Session } from "@supabase/supabase-js";

interface PostListProps {
  className?: string;
  posts: Post[];
  session: Session | null;
  profiles: Record<string, User>;
  postStatsByEmail: Record<string, { count: number; lastPostAt: string | null }>;
  fetching: boolean;
  loadingMore: boolean;
  hasMore: boolean;
  onLoadMore: () => void;
  updatingId: number | null;
  deletingId: number | null;
  onDeletePost: (post: Post) => void;
  onEditPost: (post: Post) => void;
}

export default function PostList({
  className,
  posts,
  session,
  profiles,
  postStatsByEmail,
  fetching,
  loadingMore,
  hasMore,
  onLoadMore,
  updatingId,
  deletingId,
  onDeletePost,
  onEditPost,
}: PostListProps) {
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!hasMore || loadingMore || fetching) {
      return;
    }

    const node = sentinelRef.current;
    if (!node) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const [entry] = entries;
        if (entry?.isIntersecting) {
          onLoadMore();
        }
      },
      {
        rootMargin: "200px",
      }
    );

    observer.observe(node);

    return () => {
      observer.disconnect();
    };
  }, [hasMore, loadingMore, onLoadMore, fetching, posts.length]);

  return (
    <>
      <div className={`${className}`}>
        {fetching ? (
          <div className="space-y-4">
            <Skeleton className="h-96 w-full rounded-none md:rounded-3xl border" />
            <Skeleton className="h-96 w-full rounded-none md:rounded-3xl border" />
            <Skeleton className="h-96 w-full rounded-none md:rounded-3xl border" />
            <Skeleton className="h-96 w-full rounded-none md:rounded-3xl border" />
          </div>
        ) : posts.length === 0 ? (
          <Empty>
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <MessageCircleOff className="h-12 w-12 text-muted-foreground" />
              </EmptyMedia>
              <EmptyTitle>No Posts Yet</EmptyTitle>
              <EmptyDescription>
                You haven&apos;t shared any posts yet. Get started by publishing your first post.
              </EmptyDescription>
            </EmptyHeader>
            <EmptyContent>Create a new post using the (+) button.</EmptyContent>
          </Empty>
        ) : (
          <>
            <ul className="space-y-2 md:space-y-4">
              {posts.map((post) => {
                const normalizedEmail = post.email.trim().toLowerCase();
                const stats = postStatsByEmail[normalizedEmail] ?? null;
                return (
                  <PostItem
                    key={post.id}
                    post={post}
                    session={session}
                    profile={profiles[normalizedEmail] ?? null}
                    postCount={stats?.count ?? 0}
                    lastPostAt={stats?.lastPostAt ?? null}
                    onDelete={() => onDeletePost(post)}
                    onEdit={onEditPost}
                    isUpdating={updatingId === post.id}
                    isDeleting={deletingId === post.id}
                  />
                );
              })}
            </ul>
            {posts.length > 0 ? <div ref={sentinelRef} className="h-1" /> : null}
            {loadingMore ? (
              <div className="py-4 text-center">
                <Spinner className="mx-auto" />
              </div>
            ) : null}
            {session && !hasMore && posts.length > 0 ? (
              <p className="py-4 text-center text-sm text-muted-foreground">
                No more posts to load.
              </p>
            ) : null}
          </>
        )}
      </div>
    </>
  );
}
