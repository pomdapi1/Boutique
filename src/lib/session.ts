// Compatible runtime Edge (utilisé par le middleware) : aucune dépendance Node.
import { SignJWT, jwtVerify } from "jose";

export const SESSION_COOKIE = "boutique_session";
export const SESSION_MAX_AGE = 60 * 60 * 24 * 30; // 30 jours

export type SessionPayload = {
  uid: string;
  role: "ADMIN" | "CREATOR";
  cid: string | null;
};

function secret() {
  const s = process.env.AUTH_SECRET;
  if (!s || s.length < 32) throw new Error("AUTH_SECRET manquant ou trop court (32 caractères minimum)");
  return new TextEncoder().encode(s);
}

export async function signSession(payload: SessionPayload): Promise<string> {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_MAX_AGE}s`)
    .sign(secret());
}

export async function verifySession(token: string | undefined): Promise<SessionPayload | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret());
    if (typeof payload.uid !== "string" || (payload.role !== "ADMIN" && payload.role !== "CREATOR")) return null;
    return { uid: payload.uid, role: payload.role, cid: (payload.cid as string | null) ?? null };
  } catch {
    return null;
  }
}

export function homeFor(role: string) {
  return role === "ADMIN" ? "/admin" : "/creator/boutique";
}
