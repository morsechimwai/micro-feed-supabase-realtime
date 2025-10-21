import type { PropsWithChildren } from "react";
import { useCallback, useEffect, useMemo, useReducer, useState } from "react";

import { taskReducer } from "@/reducers/taskReducer";
import { supabase } from "@/supabase-client";
import type { Task } from "@/types/task";

import { TaskContext, type TaskContextValue, type TaskFormState } from "./task-context";

const useTaskManager = (): TaskContextValue => {
  const [tasks, dispatch] = useReducer(taskReducer, [] as Task[]);
  const [newTask, setNewTask] = useState<TaskFormState>({ title: "", description: "" });
  const [fetching, setFetching] = useState(false);
  const [adding, setAdding] = useState(false);
  const [updatingId, setUpdatingId] = useState<number | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const fetchTasks = useCallback(async () => {
    setFetching(true);
    try {
      const { data, error: fetchError } = await supabase
        .from("tasks")
        .select("*")
        .order("created_at", { ascending: true });

      if (fetchError) {
        console.error("Error reading tasks:", fetchError.message);
        return;
      }

      dispatch({ type: "SET_TASKS", payload: data || [] });
    } catch (error) {
      console.error("Error fetching tasks:", error);
    } finally {
      setFetching(false);
    }
  }, []);

  const addTask = useCallback(async () => {
    if (!newTask.title.trim()) {
      return;
    }

    setAdding(true);
    try {
      const { data, error: addError } = await supabase
        .from("tasks")
        .insert(newTask)
        .select()
        .single<Task>();

      if (addError) {
        console.error("Error adding task:", addError.message);
        return;
      }

      if (data) {
        dispatch({ type: "ADD_TASK", payload: data });
        setNewTask({ title: "", description: "" });
      }
    } catch (error) {
      console.error("Error adding task:", error);
    } finally {
      setAdding(false);
    }
  }, [newTask]);

  const deleteTask = useCallback(async (id: number) => {
    setDeletingId(id);
    try {
      const { error: deleteError } = await supabase.from("tasks").delete().eq("id", id);

      if (deleteError) {
        console.error("Error deleting task:", deleteError.message);
        return;
      }

      dispatch({ type: "DELETE_TASK", payload: id });
    } catch (error) {
      console.error("Error deleting task:", error);
    } finally {
      setDeletingId(null);
    }
  }, []);

  const updateTask = useCallback(
    async (id: number, updates: Pick<Task, "title" | "description">) => {
      setUpdatingId(id);
      try {
        const { data, error: updateError } = await supabase
          .from("tasks")
          .update(updates)
          .eq("id", id)
          .select()
          .single<Task>();

        if (updateError) {
          console.error("Error updating task:", updateError.message);
          return;
        }

        if (data) {
          dispatch({ type: "UPDATE_TASK", payload: data });
        }
      } catch (error) {
        console.error("Error updating task:", error);
      } finally {
        setUpdatingId(null);
      }
    },
    []
  );

  useEffect(() => {
    void fetchTasks();
  }, [fetchTasks]);

  return useMemo(
    () => ({
      tasks,
      newTask,
      setNewTask,
      fetchTasks,
      addTask,
      deleteTask,
      updateTask,
      fetching,
      adding,
      updatingId,
      deletingId,
    }),
    [
      tasks,
      newTask,
      fetchTasks,
      addTask,
      deleteTask,
      updateTask,
      fetching,
      adding,
      updatingId,
      deletingId,
    ]
  );
};

export const TaskProvider = ({ children }: PropsWithChildren) => {
  const value = useTaskManager();
  return <TaskContext.Provider value={value}>{children}</TaskContext.Provider>;
};
