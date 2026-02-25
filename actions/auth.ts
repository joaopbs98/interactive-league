"use server";

import { createClient } from "@/utils/supabase/server";

export async function signInWithGoogle(redirectTo: string) {
  const supabase = await createClient();
  
  // Use the current port from environment or default to 3000
  // The user is currently running on port 3001, so let's use that
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3001";
  const redirectURL = `${baseUrl}/auth/callback?next=${redirectTo}`;
  
  console.log("Google OAuth redirect URL:", redirectURL);

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: redirectURL,
      queryParams: {
        access_type: 'offline',
        prompt: 'consent',
      }
    },
  });
  
  if (error) {
    console.error("Google OAuth error:", error);
    throw error;
  }
  
  return data;
}

export async function signOut() {
  const supabase = await createClient();
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}
