import { NextResponse, type NextRequest } from "next/server"
import { jwtVerify } from "jose"

// Allow unauthenticated access to the login page and logout API
const PUBLIC_PATHS = ["/login", "/api/logout"]

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl

  // 1. Allow public paths
  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
    return NextResponse.next()
  }

  // 2. Read cookie and verify signature
  const token = req.cookies.get("app_auth")?.value
  if (token) {
    try {
      const secret = new TextEncoder().encode(process.env.AUTH_SECRET!)
      await jwtVerify(token, secret) 
      return NextResponse.next()     
    } catch {
      // fallthrough to redirect
    }
  }

  // 3. Not logged in: redirect to login and preserve the target path
  const loginUrl = new URL("/login", req.url)
  loginUrl.searchParams.set("from", pathname)
  return NextResponse.redirect(loginUrl)
}

// Intercept all routes except Next.js internals and static assets
export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
}
