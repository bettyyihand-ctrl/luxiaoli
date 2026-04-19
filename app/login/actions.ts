"use server"

import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import { SignJWT } from "jose"

export async function login(formData: FormData) {
  const password = formData.get("password")?.toString() ?? ""
  const from = formData.get("from")?.toString() || "/"

  if (password !== process.env.APP_PASSWORD) {
    redirect("/login?error=1&from=" + encodeURIComponent(from))
  }

  const secret = new TextEncoder().encode(process.env.AUTH_SECRET!)
  const token = await new SignJWT({ ok: true })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d") 
    .sign(secret)

  const cookieStore = await cookies();
  cookieStore.set("app_auth", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  })

  redirect(from)
}
