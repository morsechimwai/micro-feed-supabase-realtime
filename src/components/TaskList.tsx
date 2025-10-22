// UI Components
import { Skeleton } from "@/components/ui/skeleton";
import TaskItem from "./TaskItem";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";

// Icons
import { MessageCircleOff } from "lucide-react";

// Types
import type { Task } from "@/types/task";

// Supabase
import type { Session } from "@supabase/supabase-js";

interface TaskListProps {
  className?: string;
  tasks: Task[];
  session: Session | null;
  fetching: boolean;
  updatingId: number | null;
  deletingId: number | null;
  onDeleteTask: (task: Task) => void;
  onEditTask: (task: Task) => void;
}

const TaskList = ({
  className,
  tasks,
  session,
  fetching,
  updatingId,
  deletingId,
  onDeleteTask,
  onEditTask,
}: TaskListProps) => {
  return (
    <>
      <div className={`${className}`}>
        {fetching ? (
          <div className="space-y-4">
            <Skeleton className="h-96 w-full rounded-3xl border" />
            <Skeleton className="h-96 w-full rounded-3xl border" />
            <Skeleton className="h-96 w-full rounded-3xl border" />
            <Skeleton className="h-96 w-full rounded-3xl border" />
          </div>
        ) : tasks.length === 0 ? (
          <Empty>
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <MessageCircleOff className="h-12 w-12 text-muted-foreground" />
              </EmptyMedia>
              <EmptyTitle>No Tasks Yet</EmptyTitle>
              <EmptyDescription>
                You haven&apos;t created any tasks yet. Get started by creating your first task.
              </EmptyDescription>
            </EmptyHeader>
            <EmptyContent>Create a new task using the (+ Add Task) button.</EmptyContent>
          </Empty>
        ) : (
          <ul className="space-y-4">
            {tasks
              .map((task) => (
                <TaskItem
                  key={task.id}
                  task={task}
                  session={session}
                  onDelete={() => onDeleteTask(task)}
                  onEdit={onEditTask}
                  isUpdating={updatingId === task.id}
                  isDeleting={deletingId === task.id}
                />
              ))
              .reverse()}
          </ul>
        )}
      </div>
    </>
  );
};

export default TaskList;
