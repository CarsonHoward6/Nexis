import { createHash, timingSafeEqual } from "node:crypto";

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function tokensMatch(plainFromClient: string, hashFromDb: string): boolean {
  if (!plainFromClient || !hashFromDb) return false;
  const a = Buffer.from(hashToken(plainFromClient), "utf8");
  const b = Buffer.from(hashFromDb, "utf8");
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
