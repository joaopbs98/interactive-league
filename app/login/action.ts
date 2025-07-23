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
  const supabase = await createClient();

  const email = formData.get("email") as string;
  const password = formData.get("password") as string;

  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    return { error: error.message, success: null };
  }

  revalidatePath("/", "layout");
  redirect("/");
}

export async function signup(
  _prevState: AuthState,
  formData: FormData
): Promise<AuthState> {
  const supabase = await createClient();

  const email = formData.get("email") as string;
  const password = formData.get("password") as string;
  const username = formData.get("username") as string;

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
  });

  if (error) {
    return { error: error.message, success: null };
  }

  const userId = data.user?.id;
  if (!userId) {
    return {
      error: "User ID not found after signup.",
      success: null,
    };
  }

  const { error: profileError } = await supabase.from("profile").insert([
    {
      id: userId,
      username: username.toLowerCase(),
    },
  ]);

  if (profileError) {
    return {
      error: "Signup succeeded, but that username is already taken.",
      success: null,
    };
  }

  if (!data.session) {
    return {
      success: "Account created! Please check your email to confirm.",
      error: null,
    };
  }

  revalidatePath("/", "layout");
  redirect("/");
}
