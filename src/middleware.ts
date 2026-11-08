import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, homeFor, verifySession } from "@/lib/session";

// Premier filtre (rapide) ; chaque page revérifie aussi le rôle côté serveur.
export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const session = await verifySession(req.cookies.get(SESSION_COOKIE)?.value);

  if (pathname === "/login") {
    if (session) return NextResponse.redirect(new URL(homeFor(session.role), req.url));
    return NextResponse.next();
  }

  if (!session) return NextResponse.redirect(new URL("/login", req.url));

  if (pathname.startsWith("/admin") && session.role !== "ADMIN")
    return NextResponse.redirect(new URL(homeFor(session.role), req.url));
  if (pathname.startsWith("/creator") && session.role !== "CREATOR")
    return NextResponse.redirect(new URL(homeFor(session.role), req.url));
  if (pathname === "/") return NextResponse.redirect(new URL(homeFor(session.role), req.url));

  return NextResponse.next();
}

export const config = {
  matcher: ["/", "/login", "/admin/:path*", "/creator/:path*"],
};
