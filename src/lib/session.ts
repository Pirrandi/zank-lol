// Admin session token: a signed, expiring token stored in an httpOnly cookie.
//
// Uses the Web Crypto API (crypto.subtle) instead of node:crypto so this module can be
// imported both from Node.js request handlers/server actions AND from middleware.ts, which
// Next.js runs on the Edge runtime (no node:crypto/Buffer there). Web Crypto is available in
// both environments without adding a dependency.

export const SESSION_COOKIE_NAME = "zank_admin_session";
export const SESSION_DURATION_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

function getSessionSecret(): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret) {
    throw new Error("SESSION_SECRET env var is not set");
  }
  return secret;
}

function bufToHex(buf: ArrayBuffer): string {
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function timingSafeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

async function hmacHex(data: string, secret: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(data));
  return bufToHex(sig);
}

// Token shape: "admin.<expiresAtMs>.<hmacHex>"
export async function createSessionToken(): Promise<string> {
  const secret = getSessionSecret();
  const expiresAt = Date.now() + SESSION_DURATION_MS;
  const payload = `admin.${expiresAt}`;
  const sig = await hmacHex(payload, secret);
  return `${payload}.${sig}`;
}

export async function verifySessionToken(token: string | undefined | null): Promise<boolean> {
  if (!token) return false;
  const parts = token.split(".");
  if (parts.length !== 3) return false;
  const [role, expiresAtStr, sig] = parts;
  if (role !== "admin") return false;

  const expiresAt = Number(expiresAtStr);
  if (!Number.isFinite(expiresAt) || Date.now() > expiresAt) return false;

  const secret = getSessionSecret();
  const expectedSig = await hmacHex(`${role}.${expiresAtStr}`, secret);
  return timingSafeEqualHex(sig, expectedSig);
}
