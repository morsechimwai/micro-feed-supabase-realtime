import { createContext, type Dispatch, type SetStateAction } from "react";

import type { Task } from "@/types/task";

export interface TaskFormState {
  title: string;
  description: string;
}

export interface TaskContextValue {
  tasks: Task[];
  newTask: TaskFormState;
  setNewTask: Dispatch<SetStateAction<TaskFormState>>;
  fetchTasks: () => Promise<void>;
  addTask: () => Promise<void>;
  deleteTask: (id: number) => Promise<void>;
  updateTask: (id: number, updates: Pick<Task, "title" | "description">) => Promise<void>;
  fetching: boolean;
  adding: boolean;
  updatingId: number | null;
  deletingId: number | null;
}

export const TaskContext = createContext<TaskContextValue | null>(null);
