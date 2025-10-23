// React
import { useState } from "react";

// UI Components
import { Input } from "./ui/input";
import { Button } from "./ui/button";
import { Form, FormControl, FormField, FormItem, FormMessage } from "@/components/ui/form";

// Icons
import { KeySquare, Loader2, MoonStar, Sun, User } from "lucide-react";

// Libraries for form validation
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";

// Supabase Client
import { supabase } from "@/supabase-client";

// Types
import type { ThemeMode } from "@/types/theme";

// Form Validation Schema
const formSchema = z.object({
  email: z.string().email({
    message: "Invalid email address",
  }),
  password: z
    .string()
    .min(8, {
      message: "Password must be at least 8 characters long",
    })
    .max(50, {
      message: "Password must be at most 50 characters long",
    }),
});

interface AuthProps {
  className?: string;
  toggleTheme: () => void;
  theme: ThemeMode;
}

export default function Auth({ className, toggleTheme, theme }: AuthProps) {
  // React Hook
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      email: "",
      password: "",
    },
    mode: "onSubmit",
    reValidateMode: "onChange",
  });

  // Component State
  const [action, setAction] = useState<"signIn" | "signUp">("signIn");
  const [submitting, setSubmitting] = useState(false);

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    console.log(values);
    setSubmitting(true);

    // Simulate async operation
    form.clearErrors("password");

    if (action === "signIn") {
      try {
        const { error } = await supabase.auth.signInWithPassword({
          email: values.email,
          password: values.password,
        });

        if (error) {
          console.error("Error signing in:", error.message);
          form.setError("password", {
            type: "manual",
            message: error.message ?? "Invalid email or password. Please try again.",
          });
          return;
        }
      } catch (error) {
        console.error("Error signing in:", error);
        form.setError("password", {
          type: "manual",
          message: "Unexpected error during sign in. Please try again.",
        });
      } finally {
        setSubmitting(false);
      }
    } else {
      try {
        const { error, data } = await supabase.auth.signUp({
          email: values.email,
          password: values.password,
        });

        if (error?.message?.includes("already registered")) {
          form.setError("email", {
            type: "manual",
            message: "Email is already in use. Please use a different email.",
          });
          return;
        }

        // Sign up successful
        if (data) {
          console.log("Sign up successful:", data);
          setAction("signIn");
          form.reset();
        }
      } catch (error) {
        console.error("Error signing up:", error);
        form.setError("password", {
          type: "manual",
          message: "Unexpected error during sign up. Please try again.",
        });
      } finally {
        setSubmitting(false);
      }
    }
  };

  // Theme icon and label
  const themeIcon = theme === "dark" ? <Sun className="size-5" /> : <MoonStar className="size-5" />;
  const themeLabel = theme === "dark" ? "Switch to light theme" : "Switch to dark theme";

  return (
    <div className={`${className}`}>
      <header className="flex flex-wrap items-start justify-between gap-3 sm:items-center">
        <h2 className="flex items-center text-xl font-semibold text-card-foreground">
          {action === "signIn" ? <KeySquare /> : <User />}
          <span className="ml-2">{action === "signIn" ? "Sign In" : "Sign Up"}</span>
        </h2>
        <div className="flex flex-row gap-2">
          <Button aria-label={themeLabel} onClick={toggleTheme} size="icon" variant="outline">
            {themeIcon}
          </Button>
        </div>
      </header>
      <div className="mt-4 space-y-2">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="email"
              render={({ field, fieldState }) => (
                <FormItem>
                  <FormControl>
                    <Input placeholder="Email" autoComplete="off" {...field} />
                  </FormControl>
                  <FormMessage>{fieldState.error?.message}</FormMessage>
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="password"
              render={({ field, fieldState }) => (
                <FormItem>
                  <FormControl>
                    <Input type="password" placeholder="Password" autoComplete="off" {...field} />
                  </FormControl>
                  <FormMessage>{fieldState.error?.message}</FormMessage>
                </FormItem>
              )}
            />
            <Button className="mt-4 w-full" type="submit" disabled={submitting}>
              {submitting ? (
                <>
                  <Loader2 className="animate-spin" />
                  {action === "signIn" ? "Signing In..." : "Signing Up..."}
                </>
              ) : action === "signIn" ? (
                "Sign In"
              ) : (
                "Sign Up"
              )}
            </Button>
          </form>
        </Form>
      </div>
      <div>
        {action === "signIn" ? (
          <p className="mt-4 text-center text-sm text-muted-foreground">
            Don't have an account?{" "}
            <Button variant="link" className="p-0" onClick={() => setAction("signUp")}>
              Sign Up
            </Button>
          </p>
        ) : (
          <p className="mt-4 text-center text-sm text-muted-foreground">
            Already have an account?{" "}
            <Button variant="link" className="p-0" onClick={() => setAction("signIn")}>
              Sign In
            </Button>
          </p>
        )}
      </div>
    </div>
  );
}
