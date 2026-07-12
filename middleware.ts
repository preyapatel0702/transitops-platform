import NextAuth from "next-auth";
import { NextResponse } from "next/server";
import { authConfig } from "@/auth/auth.config";

const { auth } = NextAuth(authConfig);

export default auth((req) => {
  const isApiAuthRoute = req.nextUrl.pathname.startsWith("/api/auth");
  if (isApiAuthRoute) return NextResponse.next();

  // The daily cron job (Vercel Cron / Render cron curl) authenticates with
  // its own `Authorization: Bearer $CRON_SECRET` header, not a session
  // cookie. It must bypass the login redirect below or the job can never
  // reach app/api/cron/license-reminders/route.ts.
  const isCronRoute = req.nextUrl.pathname.startsWith("/api/cron");
  if (isCronRoute) return NextResponse.next();

  const isLoggedIn = !!req.auth;
  const isAuthRoute = req.nextUrl.pathname.startsWith("/login");

  if (isAuthRoute) {
    if (isLoggedIn) return NextResponse.redirect(new URL("/dashboard", req.url));
    return NextResponse.next();
  }

  if (!isLoggedIn) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};