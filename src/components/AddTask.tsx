import { ListTodo, MoonStar, Plus, Sun } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useTasks } from "@/hooks/useTasks";
import type { ThemeMode } from "@/types/theme";
import { Spinner } from "./ui/spinner";

interface AddTaskProps {
  className?: string;
  toggleTheme: () => void;
  theme: ThemeMode;
}

const AddTask = ({ className, toggleTheme, theme }: AddTaskProps) => {
  const { newTask, setNewTask, addTask, adding } = useTasks();

  const themeIcon = theme === "dark" ? <Sun className="size-5" /> : <MoonStar className="size-5" />;
  const themeLabel = theme === "dark" ? "Switch to light theme" : "Switch to dark theme";

  return (
    <div className={`${className}`}>
      <header>
        <div className="flex flex-wrap items-start justify-between gap-3 sm:items-center">
          <h2 className="flex items-center text-xl font-semibold text-card-foreground">
            <ListTodo />
            <span className="ml-2">Task Manager</span>
          </h2>
          <Button aria-label={themeLabel} onClick={toggleTheme} size="icon" variant="outline">
            {themeIcon}
          </Button>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          Simple{" "}
          <a
            className="font-semibold text-green-500"
            href="https://supabase.com"
            rel="noreferrer"
            target="_blank"
          >
            Supabase
          </a>{" "}
          based{" "}
          <a
            className="font-semibold text-sky-500"
            href="https://react.dev"
            rel="noreferrer"
            target="_blank"
          >
            React
          </a>{" "}
          CRUD application.
          <Button asChild className="ml-1 inline-flex p-0 align-baseline" variant="link">
            <a
              href="https://github.com/morsechimwai/react-supabase-crud"
              rel="noreferrer"
              target="_blank"
            >
              View on GitHub
            </a>
          </Button>
        </p>
      </header>

      <div className="mt-4 space-y-2">
        <Input
          placeholder="Task Title"
          value={newTask.title}
          onChange={(e) => setNewTask((prev) => ({ ...prev, title: e.target.value }))}
        />
        <Textarea
          className="max-h-32 h-32"
          placeholder="Task Description"
          value={newTask.description}
          onChange={(e) => setNewTask((prev) => ({ ...prev, description: e.target.value }))}
        />
      </div>

      <Button
        className="mt-4 w-full"
        onClick={() => void addTask()}
        disabled={!newTask.title.trim() || adding}
      >
        {adding ? (
          <>
            <Spinner />
            Adding Task..
          </>
        ) : (
          <>
            <Plus />
            Add Task
          </>
        )}
      </Button>
    </div>
  );
};

export default AddTask;
