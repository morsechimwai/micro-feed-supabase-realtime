// UI Components
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

// Icons
import { EllipsisVertical, MessageCircleMore, Pencil, Trash2, User2 } from "lucide-react";

// Types
import type { Task } from "@/types/task";

// Supabase
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/supabase-client";
import { formatCreatedAt } from "@/lib/utils";
import { TASK_IMAGES_BUCKET, parseImageReference } from "@/lib/storage";

interface TaskItemProps {
  task: Task;
  session: Session | null;
  onDelete?: (task: Task) => void;
  onEdit?: (task: Task) => void;
  isUpdating?: boolean;
  isDeleting?: boolean;
}

const TaskItem = ({ task, session, onDelete, onEdit, isUpdating, isDeleting }: TaskItemProps) => {
  const imageReference = parseImageReference(task.image_url);
  const displayImage =
    imageReference.publicUrl ??
    (imageReference.path
      ? supabase.storage.from(TASK_IMAGES_BUCKET).getPublicUrl(imageReference.path).data.publicUrl
      : null);

  return (
    <>
      <li className="bg-card flex flex-col gap-4 border shadow-sm transition-colors hover:bg-accent hover:shadow-md rounded-3xl overflow-hidden">
        <div className="space-y-2">
          <div className="flex flex-row items-center justify-between pt-2">
            <div className="flex flex-row items-center px-4 mt-2 gap-2">
              <Badge variant="secondary" className="text-xs inline-block w-fit p-1">
                {task.email !== session?.user.email ? (
                  <User2 className="inline-block size-4 mr-1" />
                ) : null}
                <span>
                  {task.email === session?.user.email ? (
                    <span className="text-green-500">My Task</span>
                  ) : (
                    task.email
                  )}
                </span>
              </Badge>
              <h3 className="text-lg font-semibold text-secondary-foreground break-words">
                {task.title}
              </h3>
            </div>
            <div className="flex items-center gap-2 sm:justify-end">
              {session && session.user.email === task.email && (
                <DropdownMenu modal={false}>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" className="h-8 w-8 p-0">
                      <EllipsisVertical />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => onEdit?.(task)} disabled={isUpdating}>
                      <Pencil />
                      <span>Edit</span>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => onDelete?.(task)} disabled={isDeleting}>
                      <Trash2 />
                      <span>Delete</span>
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>
          </div>

          {displayImage ? (
            <img src={displayImage} alt={task.title} className="h-84 w-full object-cover" />
          ) : (
            <div className="flex h-32 w-full items-center justify-center rounded-md border bg-muted text-sm text-muted-foreground">
              No image selected
            </div>
          )}

          <div className="px-4 pb-4 space-y-2 relative">
            <div className="flex items-start gap-4">
              <MessageCircleMore className="size-5 mt-2 shrink-0" />
              <p className="flex-1 text-base whitespace-pre-wrap break-all">{task.description}</p>
            </div>
            <div className="flex flex-row items-center gap-2">
              <span className="text-xs text-muted-foreground ml-9">
                {formatCreatedAt(task.created_at)}
              </span>
            </div>
          </div>
        </div>
      </li>
    </>
  );
};

export default TaskItem;
