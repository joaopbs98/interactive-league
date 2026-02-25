import { NextResponse } from "next/server";
// The client you created from the Server-Side Auth instructions
import { createClient } from "@/utils/supabase/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const error = searchParams.get("error");
  const errorDescription = searchParams.get("error_description");
  
  // if "next" is in param, use it as the redirect URL
  let next = searchParams.get("next") ?? "/";
  if (!next.startsWith("/")) {
    // if "next" is not a relative URL, use the default
    next = "/";
  }

  // If there's an OAuth error, redirect to error page with details
  if (error) {
    console.error("OAuth error in callback:", { error, errorDescription });
    const errorParams = new URLSearchParams({
      message: errorDescription || error || "OAuth error occurred",
      code: error,
      status: "400",
    }).toString();
    return NextResponse.redirect(`${origin}/auth/auth-code-error?${errorParams}`);
  }

  if (code) {
    const supabase = await createClient();
    
    try {
      const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
      
      if (!exchangeError) {
        const forwardedHost = request.headers.get("x-forwarded-host"); // original origin before load balancer
        const isLocalEnv = process.env.NODE_ENV === "development";
        if (isLocalEnv) {
          // we can be sure that there is no load balancer in between, so no need to watch for X-Forwarded-Host
          return NextResponse.redirect(`${origin}${next}`);
        } else if (forwardedHost) {
          return NextResponse.redirect(`https://${forwardedHost}${next}`);
        } else {
          return NextResponse.redirect(`${origin}${next}`);
        }
      } else {
        // Pass exchange error details to error page
        console.error("Code exchange error:", exchangeError);
        const errorParams = new URLSearchParams({
          message: exchangeError.message || "Failed to exchange code for session",
          code: exchangeError.name || "EXCHANGE_ERROR",
          status: exchangeError.status?.toString() || "400",
        }).toString();
        return NextResponse.redirect(`${origin}/auth/auth-code-error?${errorParams}`);
      }
    } catch (err) {
      console.error("Unexpected error during code exchange:", err);
      const errorParams = new URLSearchParams({
        message: "An unexpected error occurred during authentication",
        code: "UNEXPECTED_ERROR",
        status: "500",
      }).toString();
      return NextResponse.redirect(`${origin}/auth/auth-code-error?${errorParams}`);
    }
  }

  // return the user to an error page with instructions
  return NextResponse.redirect(`${origin}/auth/auth-code-error`);
}
