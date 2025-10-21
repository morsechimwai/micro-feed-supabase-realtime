// UI Components
import { Button } from "./ui/button";
import type { Session } from "@supabase/supabase-js";
import { Badge } from "./ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

// Icons
import { EllipsisVertical, Pencil, Trash2, User2 } from "lucide-react";

// Types
import type { Task } from "@/types/task";

interface TaskItemProps {
  task: Task;
  session: Session | null;
  onDelete?: (id: number) => void;
  onEdit?: (task: Task) => void;
  isUpdating?: boolean;
  isDeleting?: boolean;
}

const TaskItem = ({ task, session, onDelete, onEdit }: TaskItemProps) => {
  return (
    <>
      <li className="mb-4 flex flex-col gap-4 rounded-2xl border p-4 shadow-sm transition-colors hover:bg-accent hover:shadow-md sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-2">
          <h3 className="text-lg font-semibold text-secondary-foreground break-words">
            {task.title}
          </h3>
          <p className="text-sm text-muted-foreground whitespace-pre-line break-words">
            {task.description}
          </p>
          <div className="flex flex-row items-center gap-2 pt-2">
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
            <span className="ml-2 text-xs text-muted-foreground">
              {new Date(task.created_at).toLocaleString()}
            </span>
          </div>
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
                <DropdownMenuItem onClick={() => onEdit?.(task)}>
                  <Pencil />
                  <span>Edit</span>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => onDelete?.(task.id)}>
                  <Trash2 />
                  <span>Delete</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </li>
    </>
  );
};

export default TaskItem;
