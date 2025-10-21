import type { Task } from "@/types/task";
import { Pencil, Trash2, User2 } from "lucide-react";

import { Button } from "./ui/button";
import { Spinner } from "./ui/spinner";
import type { Session } from "@supabase/supabase-js";
import { Badge } from "./ui/badge";

interface TaskItemProps {
  task: Task;
  session: Session | null;
  onDelete?: (id: number) => void;
  onEdit?: (task: Task) => void;
  isUpdating?: boolean;
  isDeleting?: boolean;
}

const TaskItem = ({ task, session, onDelete, onEdit, isUpdating, isDeleting }: TaskItemProps) => {
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
              <User2 className="mr-1 inline-block h-3 w-3" />
              <span>{task.email}</span>
            </Badge>
            <span className="ml-2 text-xs text-muted-foreground">
              {new Date(task.created_at).toLocaleString()}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2 sm:justify-end">
          {session && session.user.email === task.email && (
            <>
              <Button
                variant="outline"
                size="icon"
                aria-label="Edit task"
                onClick={() => onEdit?.(task)}
                disabled={isUpdating}
              >
                {isUpdating ? <Spinner /> : <Pencil />}
              </Button>
              <Button
                variant="destructive"
                size="icon"
                aria-label="Delete task"
                onClick={() => onDelete?.(task.id)}
                disabled={isDeleting}
              >
                {isDeleting ? <Spinner /> : <Trash2 />}
              </Button>
            </>
          )}
        </div>
      </li>
    </>
  );
};

export default TaskItem;
