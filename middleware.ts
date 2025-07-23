import { updateSession } from "@/utils/supabase/middleware"; // wherever your `updateSession` is

export const middleware = updateSession;

export const config = {
  matcher: ["/((?!_next|favicon.ico|.*\\.\\w+).*)"], // protect all routes except static assets
};
