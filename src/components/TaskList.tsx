import TaskItem from "./TaskItem";
import { Skeleton } from "@/components/ui/skeleton";
import type { Task } from "@/types/task";

interface TaskListProps {
  className?: string;
  tasks: Task[];
  fetching: boolean;
  updatingId: number | null;
  deletingId: number | null;
  onDeleteTask: (id: number) => Promise<boolean>;
  onUpdateTask: (
    id: number,
    updates: Pick<Task, "title" | "description">
  ) => Promise<boolean>;
}

const TaskList = ({
  className,
  tasks,
  fetching,
  updatingId,
  deletingId,
  onDeleteTask,
  onUpdateTask,
}: TaskListProps) => {
  const handleEdit = (task: Task) => {
    const title = window.prompt("Update task title", task.title);
    if (title === null) return;

    const description = window.prompt("Update task description", task.description);
    if (description === null) return;

    void onUpdateTask(task.id, { title, description });
  };

  return (
    <>
      <div className={`${className}`}>
        {fetching ? (
          <div className="space-y-4">
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
          </div>
        ) : tasks.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">No tasks available.</p>
        ) : (
          <ul className="mt-2">
            {tasks
              .map((task) => (
                <TaskItem
                  key={task.id}
                  task={task}
                  onDelete={(id) => void onDeleteTask(id)}
                  onEdit={handleEdit}
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
