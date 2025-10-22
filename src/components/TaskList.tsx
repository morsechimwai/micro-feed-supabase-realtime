// UI Components
import { Skeleton } from "@/components/ui/skeleton";
import TaskItem from "./TaskItem";

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
          <p className="mt-2 text-sm text-muted-foreground">No tasks available.</p>
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
