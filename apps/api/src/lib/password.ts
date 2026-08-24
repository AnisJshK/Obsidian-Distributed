export const hashPassword = (p: string) => Bun.password.hash(p, { algorithm: "argon2id" });
export const verifyPassword = (p: string, hash: string) => Bun.password.verify(p, hash);