// Admin password hashing/verification using Node's built-in crypto.scrypt (no new dependency).
// Only used server-side (login server action, and the one-off hash-admin-password.ts script) —
// never imported from middleware.ts, so it's fine that it relies on node:crypto.

import { randomBytes, scrypt, timingSafeEqual } from "crypto";
import { promisify } from "util";

const scryptAsync = promisify(scrypt);
const KEY_LENGTH = 64;

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString("hex");
  const derivedKey = (await scryptAsync(password, salt, KEY_LENGTH)) as Buffer;
  return `${salt}:${derivedKey.toString("hex")}`;
}

async function verifyPassword(password: string, storedHash: string): Promise<boolean> {
  const [salt, hashHex] = storedHash.split(":");
  if (!salt || !hashHex) return false;

  const derivedKey = (await scryptAsync(password, salt, KEY_LENGTH)) as Buffer;
  const storedBuf = Buffer.from(hashHex, "hex");
  if (storedBuf.length !== derivedKey.length) return false;

  return timingSafeEqual(storedBuf, derivedKey);
}

// Verifies a plaintext password against ADMIN_PASSWORD_HASH from the environment.
export async function verifyAdminPassword(password: string): Promise<boolean> {
  const storedHash = process.env.ADMIN_PASSWORD_HASH;
  if (!storedHash) return false;
  return verifyPassword(password, storedHash);
}
