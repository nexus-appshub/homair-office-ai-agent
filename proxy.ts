import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const PUBLIC_PATHS = ["/login", "/setup-required", "/no-access", "/api/health"];

function isPublicPath(pathname: string) {
  return PUBLIC_PATHS.some((path) => pathname === path || pathname.startsWith(path + "/"));
}

function redirectTo(request: NextRequest, pathname: string) {
  const url = request.nextUrl.clone();
  url.pathname = pathname;
  url.search = "";
  return NextResponse.redirect(url);
}

function denyRequest(request: NextRequest, status: number, message: string, redirectPath: string) {
  if (request.nextUrl.pathname.startsWith("/api/")) {
    return NextResponse.json({ error: message }, {
      status,
      headers: { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" },
    });
  }
  return redirectTo(request, redirectPath);
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (isPublicPath(pathname)) return NextResponse.next();

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    // Local setup preview is allowed only in development. Production is fail-closed.
    if (pathname.startsWith("/api/")) {
      return denyRequest(request, 503, "Authentication is not configured.", "/setup-required");
    }
    if (process.env.NODE_ENV === "production") return redirectTo(request, "/setup-required");
    return NextResponse.next();
  }

  let response = NextResponse.next({ request });

  const supabase = createServerClient(supabaseUrl, supabaseKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });

  const { data, error } = await supabase.auth.getClaims();

  if (error || !data?.claims?.sub) {
    return denyRequest(request, 401, "Authentication required.", "/login");
  }

  const { data: profile, error: profileError } = await supabase
    .from("user_profiles")
    .select("role,is_active")
    .eq("user_id", data.claims.sub)
    .maybeSingle();

  if (profileError) {
    // If migrations or the profile table are missing, do not allow access.
    return redirectTo(request, "/setup-required");
  }

  if (!profile || profile.is_active !== true) {
    return denyRequest(request, 403, "Access is not enabled for this account.", "/no-access");
  }

  const { data: canReadDashboard, error: permissionError } = await supabase.rpc(
    "has_office_permission",
    { requested_permission: "dashboard.read" },
  );

  if (permissionError) return redirectTo(request, "/setup-required");
  if (canReadDashboard !== true) return redirectTo(request, "/no-access");

  response.headers.set("Cache-Control", "private, no-store");
  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js|woff2?)$).*)",
  ],
};
