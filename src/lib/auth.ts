import { SignJWT, jwtVerify } from "jose";
import { cookies, headers } from "next/headers";

const SESSION_COOKIE = "bk_admin_session";
const SESSION_DURATION_SECONDS = 60 * 60 * 24 * 7; // 7 days

function getSecretKey() {
  const secret = process.env.SESSION_SECRET;
  if (!secret) throw new Error("SESSION_SECRET is not set");
  return new TextEncoder().encode(secret);
}

/**
 * `next start` always sets NODE_ENV=production regardless of whether the
 * connection is actually HTTPS, so that alone can't decide the cookie's
 * Secure flag. In this app's deployment, TLS is terminated by nginx
 * (docker-compose.yml), which forwards `X-Forwarded-Proto: https` — that's
 * the only reliable signal. With no such header (e.g. hitting the Next.js
 * server directly, as when testing over plain HTTP on a LAN), the
 * connection itself isn't HTTPS, so Secure must stay off or the browser
 * silently drops the cookie and every login looks like it failed.
 */
async function isRequestSecure() {
  const headerStore = await headers();
  return headerStore.get("x-forwarded-proto") === "https";
}

export async function createAdminSession(adminId: string) {
  const token = await new SignJWT({ adminId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_DURATION_SECONDS}s`)
    .sign(getSecretKey());

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: await isRequestSecure(),
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_DURATION_SECONDS,
  });
}

export async function clearAdminSession() {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE);
}

export async function getAdminSession() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, getSecretKey());
    return payload as { adminId: string };
  } catch {
    return null;
  }
}

export async function verifyAdminToken(token: string) {
  try {
    const { payload } = await jwtVerify(token, getSecretKey());
    return payload as { adminId: string };
  } catch {
    return null;
  }
}

export { SESSION_COOKIE };
