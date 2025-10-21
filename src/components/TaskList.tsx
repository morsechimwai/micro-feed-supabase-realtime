import TaskItem from "./TaskItem";
import { Skeleton } from "@/components/ui/skeleton";
import { useTasks } from "@/hooks/useTasks";
import type { Task } from "@/types/task";

interface TaskListProps {
  className?: string;
}

const TaskList = ({ className }: TaskListProps) => {
  const { tasks, fetching, updatingId, deletingId, deleteTask, updateTask } = useTasks();

  const handleEdit = (task: Task) => {
    const title = window.prompt("Update task title", task.title);
    if (title === null) return;

    const description = window.prompt("Update task description", task.description);
    if (description === null) return;

    void updateTask(task.id, { title, description });
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
            {tasks.map((task) => (
              <TaskItem
                key={task.id}
                task={task}
                onDelete={(id) => void deleteTask(id)}
                onEdit={handleEdit}
                isUpdating={updatingId === task.id}
                isDeleting={deletingId === task.id}
              />
            ))}
          </ul>
        )}
      </div>
    </>
  );
};

export default TaskList;
