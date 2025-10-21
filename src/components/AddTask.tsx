import { ListTodo, LogOut, MoonStar, Plus, Sun } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { ThemeMode } from "@/types/theme";
import { Spinner } from "./ui/spinner";
import { supabase } from "@/supabase-client";
import { useState } from "react";
import { Form, FormControl, FormField, FormItem, FormMessage } from "./ui/form";
import z from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { Task } from "@/types/task";

interface AddTaskProps {
  className?: string;
  toggleTheme: () => void;
  theme: ThemeMode;
  adding: boolean;
  onAddTask: (task: Pick<Task, "title" | "description">) => Promise<void>;
}

const AddTask = ({ className, toggleTheme, theme, adding, onAddTask }: AddTaskProps) => {
  const [logouting, setLogouting] = useState(false);

  const themeIcon = theme === "dark" ? <Sun className="size-5" /> : <MoonStar className="size-5" />;
  const themeLabel = theme === "dark" ? "Switch to light theme" : "Switch to dark theme";

  const taskSchema = z.object({
    title: z.string().min(1, "Title is required").max(100, "Title is too long"),
    description: z.string().max(500, "Description is too long").optional(),
  });

  const form = useForm<z.infer<typeof taskSchema>>({
    resolver: zodResolver(taskSchema),
    defaultValues: {
      title: "",
      description: "",
    },
    mode: "onSubmit",
    reValidateMode: "onChange",
  });

  const titleValue = form.watch("title");

  const onSubmit = async (values: z.infer<typeof taskSchema>) => {
    await onAddTask({
      title: values.title,
      description: values.description ?? "",
    });

    form.reset();
  };

  const handleLogout = async () => {
    setLogouting(true);
    try {
      await supabase.auth.signOut();
      // Optionally, you can also clear any user-related state here
    } catch (error) {
      setLogouting(false);
      console.error("Error signing out:", error);
    } finally {
      setLogouting(false);
    }
  };

  return (
    <div className={`${className}`}>
      <header className="flex flex-wrap items-start justify-between gap-3 sm:items-center">
        <h2 className="flex items-center text-xl font-semibold text-card-foreground">
          <ListTodo />
          <span className="ml-2">Task Manager</span>
        </h2>
        <div className="flex flex-row gap-2">
          <Button aria-label={themeLabel} onClick={toggleTheme} size="icon" variant="outline">
            {themeIcon}
          </Button>
          <Button aria-label="Log Out" onClick={handleLogout} size="icon" variant="destructive">
            {logouting ? <Spinner /> : <LogOut />}
          </Button>
        </div>
      </header>

      <div className="mt-4 space-y-2">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="title"
              render={({ field, fieldState }) => (
                <FormItem>
                  <FormControl>
                    <Input placeholder="Task Title" autoComplete="off" {...field} />
                  </FormControl>
                  <FormMessage>{fieldState.error?.message}</FormMessage>
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="description"
              render={({ field, fieldState }) => (
                <FormItem>
                  <FormControl>
                    <Textarea
                      className="resize-y max-h-60"
                      placeholder="Task Description (optional)"
                      rows={4}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage>{fieldState.error?.message}</FormMessage>
                </FormItem>
              )}
            />

            <Button className="mt-4 w-full" type="submit" disabled={!titleValue?.trim() || adding}>
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
          </form>
        </Form>
      </div>
    </div>
  );
};

export default AddTask;
