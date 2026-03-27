import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

function redirectToError(origin: string, message: string, code = "AUTH_ERROR", status = "400") {
  const errorParams = new URLSearchParams({ message, code, status }).toString();
  return NextResponse.redirect(`${origin}/auth/auth-code-error?${errorParams}`);
}

export async function GET(request: Request) {
  try {
    const { searchParams, origin } = new URL(request.url);
    const code = searchParams.get("code");
    const error = searchParams.get("error");
    const errorDescription = searchParams.get("error_description");

    // Validate Supabase env vars before attempting auth
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
      console.error("Auth callback: Missing Supabase env vars");
      return redirectToError(
        origin,
        "Server configuration error: Supabase credentials not configured. Check Vercel environment variables.",
        "CONFIG_ERROR",
        "500"
      );
    }

    let next = searchParams.get("next") ?? "/";
    if (!next.startsWith("/")) next = "/";

    if (error) {
      console.error("OAuth error in callback:", { error, errorDescription });
      return redirectToError(origin, errorDescription || error || "OAuth error occurred", error, "400");
    }

    if (!code) {
      return redirectToError(origin, "No authorization code received. Please try signing in again.", "NO_CODE", "400");
    }

    const supabase = await createClient();
    const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);

    if (exchangeError) {
      console.error("Code exchange error:", exchangeError);
      return redirectToError(
        origin,
        exchangeError.message || "Failed to complete sign in",
        exchangeError.name || "EXCHANGE_ERROR",
        String(exchangeError.status ?? 400)
      );
    }

    const forwardedHost = request.headers.get("x-forwarded-host");
    const isLocalEnv = process.env.NODE_ENV === "development";
    const redirectBase = isLocalEnv ? origin : forwardedHost ? `https://${forwardedHost}` : origin;
    return NextResponse.redirect(`${redirectBase}${next}`);
  } catch (err) {
    console.error("Auth callback unexpected error:", err);
    const origin = new URL(request.url).origin;
    return redirectToError(
      origin,
      err instanceof Error ? err.message : "An unexpected error occurred during sign in",
      "UNEXPECTED_ERROR",
      "500"
    );
  }
}
