import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

/** Token do link de gerenciamento: 256 bits aleatórios, em base64url. */
export function generateManageToken() {
  return randomBytes(32).toString("base64url");
}

/** Só o hash vai para o banco; o token completo existe apenas no link da cliente. */
export function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export function isWellFormedToken(token: string) {
  return /^[A-Za-z0-9_-]{43}$/.test(token);
}

export function safeEqual(a: string, b: string) {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}
