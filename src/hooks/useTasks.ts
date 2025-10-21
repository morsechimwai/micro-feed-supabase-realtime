import { useContext } from "react";

import { TaskContext, type TaskContextValue } from "@/context/task-context";

export const useTasks = (): TaskContextValue => {
  const context = useContext(TaskContext);

  if (!context) {
    throw new Error("useTasks must be used within a TaskProvider");
  }

  return context;
};
