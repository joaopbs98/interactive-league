"use server";

import { createClient } from "@/utils/supabase/server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

type AuthState = {
  error: string | null;
  success: string | null;
};

export async function login(
  _prevState: AuthState,
  formData: FormData
): Promise<AuthState> {
  console.log("=== LOGIN PROCESS STARTED ===");
  
  const supabase = await createClient();
  console.log("Supabase client created");

  const email = formData.get("email") as string;
  const password = formData.get("password") as string;

  console.log("Login attempt for email:", email);

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  console.log("Login result:", { user: data.user?.id, error });

  if (error) {
    console.error("❌ Login error:", error);
    return { error: error.message, success: null };
  }

  console.log("✅ Login successful, redirecting...");
  console.log("=== LOGIN PROCESS ENDED ===");
  revalidatePath("/", "layout");
  redirect("/saves");
}

export async function signup(
  _prevState: AuthState,
  formData: FormData
): Promise<AuthState> {
  console.log("=== SIGNUP PROCESS STARTED ===");
  
  const supabase = await createClient();
  console.log("Supabase client created");

  const email = formData.get("email") as string;
  const password = formData.get("password") as string;
  const username = formData.get("username") as string;

  console.log("Form data extracted:", { email, username, passwordLength: password?.length });

  // Use Supabase Auth native signup with user metadata
  console.log("=== AUTH SIGNUP ===");
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        name: username,
        role: 'manager',
      }
    }
  });

  console.log("Auth signup result:", { data, error });

  if (error) {
    console.error("❌ Auth signup error:", error);
    return { error: error.message, success: null };
  }

  const userId = data.user?.id;
  console.log("User ID from auth:", userId);
  
  if (!userId) {
    console.error("❌ No user ID returned from auth signup");
    return {
      error: "User ID not found after signup.",
      success: null,
    };
  }

  console.log("✅ Auth user created with ID:", userId);

  console.log("=== SESSION CHECK ===");
  console.log("Session data:", data?.session);
  
  if (!data?.session) {
    console.log("No session created, email confirmation required");
    return {
      success: "Account created! Please check your email to confirm.",
      error: null,
    };
  }

  console.log("✅ Signup completed successfully");
  console.log("=== SIGNUP PROCESS ENDED ===");
  revalidatePath("/", "layout");
  redirect("/saves");
}
