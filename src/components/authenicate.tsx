// React
import { useState } from "react";

// UI Components
import { Input } from "./ui/input";
import { Button } from "./ui/button";
import { Form, FormControl, FormField, FormItem, FormMessage } from "@/components/ui/form";

// Icons
import { Eye, EyeOff, Loader2, MessageCircleMore, MoonStar, Sun } from "lucide-react";

// Libraries for form validation
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";

// Supabase Client
import { supabase } from "@/supabase-client";

// Types
import type { ThemeMode } from "@/types/theme";
import { toast } from "sonner";

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
  confirm_password: z
    .string()
    .max(50, {
      message: "Password must be at most 50 characters long",
    })
    .optional(),
});

interface AuthenicateProps {
  className?: string;
  toggleTheme: () => void;
  theme: ThemeMode;
}

export default function Authenicate({ className, toggleTheme, theme }: AuthenicateProps) {
  // React Hook
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      email: "",
      password: "",
      confirm_password: "",
    },
    mode: "onSubmit",
    reValidateMode: "onChange",
  });

  // Component State
  const [action, setAction] = useState<"signIn" | "signUp">("signIn");
  const [submitting, setSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const handleSwitchAction = (next: "signIn" | "signUp") => {
    setAction(next);
    form.clearErrors();
    setShowPassword(false);
    setShowConfirmPassword(false);
    form.setValue("confirm_password", "");
  };

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    setSubmitting(true);

    // Simulate async operation
    form.clearErrors(["password", "confirm_password"]);

    if (action === "signIn") {
      const toastId = toast.loading("Signing in...");
      setTimeout(async () => {
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
            toast.dismiss(toastId);
            return;
          }
        } catch (error) {
          console.error("Error signing in:", error);
          form.setError("password", {
            type: "manual",
            message: "Unexpected error during sign in. Please try again.",
          });
          toast.dismiss(toastId);
        } finally {
          setSubmitting(false);
          toast.info(`Welcome back! ${values.email}`, { id: toastId });
        }
      }, 2000);
    } else {
      const toastId = toast.loading("Signing up...");

      setTimeout(async () => {
        try {
          const confirm =
            form.getValues("confirm_password")?.trim() ?? "";
          if (values.password !== confirm) {
            form.setError("confirm_password", {
              type: "manual",
              message: "Passwords do not match.",
            });
            toast.dismiss(toastId);
            setSubmitting(false);
            return;
          }

          const { error, data } = await supabase.auth.signUp({
            email: values.email,
            password: values.password,
          });

          if (error?.message?.includes("already registered")) {
            form.setError("email", {
              type: "manual",
              message: "Email is already in use. Please use a different email.",
            });
            toast.dismiss(toastId);
            setSubmitting(false);
            return;
          }

          if (!error && data?.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
            form.setError("email", {
              type: "manual",
              message: "Email is already in use. Please sign in instead.",
            });
            toast.dismiss(toastId);
            setSubmitting(false);
            return;
          }

          // Sign up successful
          if (data) {
            console.log("Sign up successful:", data);
            toast.success(
              `Sign up successful! Please check your email: ${values.email}, to confirm your account.`,
              {
                id: toastId,
                duration: 12000,
              }
            );
            handleSwitchAction("signIn");
            form.reset({
              email: "",
              password: "",
              confirm_password: "",
            });
          }
        } catch (error) {
          console.error("Error signing up:", error);
          form.setError("password", {
            type: "manual",
            message: "Unexpected error during sign up. Please try again.",
          });
          toast.dismiss(toastId);
        } finally {
          setSubmitting(false);
        }
      }, 2500);
    }
  };

  // Theme icon and label
  const themeIcon = theme === "dark" ? <Sun className="size-5" /> : <MoonStar className="size-5" />;
  const themeLabel = theme === "dark" ? "Switch to light theme" : "Switch to dark theme";

  return (
    <div className={`${className}`}>
      <header className="flex flex-wrap items-start justify-between gap-3 sm:items-center">
        <Button aria-label={themeLabel} onClick={toggleTheme} size="icon" variant="outline">
          {themeIcon}
        </Button>
        <h2 className="flex items-center text-xl font-semibold text-card-foreground">
          <MessageCircleMore />
          <span className="ml-2">MicroFeed</span>
        </h2>
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
                    <Input placeholder="Email" autoComplete="off" maxLength={100} {...field} />
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
                    <div className="relative">
                      <Input
                        type={showPassword ? "text" : "password"}
                        placeholder="Password"
                        autoComplete="off"
                        maxLength={50}
                        {...field}
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="absolute right-2 top-1/2 h-7 w-7 -translate-y-1/2 text-muted-foreground"
                        onClick={() => setShowPassword((prev) => !prev)}
                        aria-label={showPassword ? "Hide password" : "Show password"}
                      >
                        {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                      </Button>
                    </div>
                  </FormControl>
                  <FormMessage>{fieldState.error?.message}</FormMessage>
                </FormItem>
              )}
            />
            {action === "signUp" ? (
              <FormField
                control={form.control}
                name="confirm_password"
                render={({ field, fieldState }) => (
                  <FormItem>
                    <FormControl>
                      <div className="relative">
                        <Input
                          type={showConfirmPassword ? "text" : "password"}
                          placeholder="Confirm Password"
                          autoComplete="off"
                          maxLength={50}
                          {...field}
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="absolute right-2 top-1/2 h-7 w-7 -translate-y-1/2 text-muted-foreground"
                          onClick={() => setShowConfirmPassword((prev) => !prev)}
                          aria-label={showConfirmPassword ? "Hide confirm password" : "Show confirm password"}
                        >
                          {showConfirmPassword ? (
                            <EyeOff className="size-4" />
                          ) : (
                            <Eye className="size-4" />
                          )}
                        </Button>
                      </div>
                    </FormControl>
                    <FormMessage>{fieldState.error?.message}</FormMessage>
                  </FormItem>
                )}
              />
            ) : null}
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
            <Button variant="link" className="p-0" onClick={() => handleSwitchAction("signUp")}>
              Sign Up
            </Button>
          </p>
        ) : (
          <p className="mt-4 text-center text-sm text-muted-foreground">
            Already have an account?{" "}
            <Button variant="link" className="p-0" onClick={() => handleSwitchAction("signIn")}>
              Sign In
            </Button>
          </p>
        )}
      </div>
    </div>
  );
}
