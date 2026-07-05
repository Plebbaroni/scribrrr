import { type NextRequest } from "next/server";
import { createClient } from "./supabase/middleware";

export async function middleware(request: NextRequest) {
  // Refreshes the Supabase auth session cookie on every matched request.
  // Without this running, tokens expire silently and users get logged out
  // unpredictably even though nothing looks wrong client-side.
  return await createClient(request);
}

export const config = {
  matcher: [
    // Run on every route except static assets and image optimization files.
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
