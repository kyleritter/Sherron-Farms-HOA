import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Refreshes the Supabase session on every request and gates access to
 * protected routes based on profiles.status / profiles.role.
 *
 * Route rules:
 *  - "/chat/*"  requires status === "approved"
 *  - "/admin/*" requires role === "admin" AND status === "approved"
 *  - unauthenticated users hitting a protected route are sent to /login
 *  - authenticated-but-not-approved users are sent to /pending or /access-denied
 */
export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;
  const isProtected =
    path.startsWith("/chat") ||
    path.startsWith("/admin") ||
    path.startsWith("/hoa-docs") ||
    path.startsWith("/documents") ||
    path.startsWith("/financials") ||
    path.startsWith("/ideas");

  if (!isProtected) {
    return supabaseResponse;
  }

  if (!user) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("status, role")
    .eq("id", user.id)
    .single();

  if (!profile || profile.status === "pending") {
    const url = request.nextUrl.clone();
    url.pathname = "/verify";
    return NextResponse.redirect(url);
  }

  if (profile.status === "rejected") {
    const url = request.nextUrl.clone();
    url.pathname = "/access-denied";
    return NextResponse.redirect(url);
  }

  if (path.startsWith("/admin") && profile.role !== "admin") {
    const url = request.nextUrl.clone();
    url.pathname = "/chat";
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}
