import { KeySquare, Loader2, User } from "lucide-react";
import { Input } from "./ui/input";
import { useState } from "react";
import { Button } from "./ui/button";

import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";

import { Form, FormControl, FormField, FormItem, FormMessage } from "@/components/ui/form";
import { supabase } from "@/supabase-client";

interface AuthProps {
  className?: string;
}

const Auth = ({ className }: AuthProps) => {
  // State to toggle between Sign In and Sign Up
  const [action, setAction] = useState<"signIn" | "signUp">("signIn");

  // State to manage submitting state
  const [submitting, setSubmitting] = useState(false);

  // Define the schema using zod
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

  // Initialize the form with react-hook-form and zod resolver
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      email: "",
      password: "",
    },
    mode: "onSubmit",
    reValidateMode: "onChange",
  });

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    console.log(values);
    setSubmitting(true);

    // Simulate async operation
    form.clearErrors("password");

    if (action === "signIn") {
      try {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email: values.email,
          password: values.password,
        });

        if (signInError) {
          console.error("Error signing in:", signInError.message);
          form.setError("password", {
            type: "manual",
            message: signInError.message ?? "Invalid email or password. Please try again.",
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
        const { data, error: signUpError } = await supabase.auth.signUp({
          email: values.email,
          password: values.password,
        });

        if (signUpError) {
          console.error("Error signing up:", signUpError.message);
          form.setError("password", {
            type: "manual",
            message: signUpError.message ?? "Unable to sign up. Please try again.",
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

  return (
    <div className={`${className}`}>
      <h2 className="flex items-center text-xl font-semibold text-card-foreground">
        {action === "signIn" ? <KeySquare /> : <User />}
        <span className="ml-2">{action === "signIn" ? "Sign In" : "Sign Up"}</span>
      </h2>
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
};

export default Auth;
