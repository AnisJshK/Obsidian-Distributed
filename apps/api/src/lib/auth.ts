import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET!;
const JWT_EXPIRY = "7d";

export async function hashPassword(password: string): Promise<string> {
  return Bun.password.hash(password, { algorithm: "argon2id" });
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return Bun.password.verify(password, hash);
}

export function signSession(userId: string): string {
  return jwt.sign({ sub: userId }, JWT_SECRET, { expiresIn: JWT_EXPIRY });
}

export function verifySession(token: string): { sub: string } | null {
  try {
    return jwt.verify(token, JWT_SECRET) as { sub: string };
  } catch {
    return null;
  }
}