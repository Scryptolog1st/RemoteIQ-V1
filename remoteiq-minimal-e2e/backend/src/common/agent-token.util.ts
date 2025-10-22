import crypto from "node:crypto";
import jwt from "jsonwebtoken";

const algo = "sha256";

export function hashToken(token: string): string {
  return crypto.createHash(algo).update(token, "utf8").digest("hex");
}

export function newOpaqueToken(): string {
  return crypto.randomBytes(24).toString("base64url");
}

export function signAgentJwt(agentId: string): string {
  const secret = process.env.JWT_SECRET || "dev";
  return jwt.sign({ sub: agentId, typ: "agent" }, secret, { algorithm: "HS256" });
}

export function verifyAgentJwt(token: string): string | null {
  try {
    const secret = process.env.JWT_SECRET || "dev";
    const payload = jwt.verify(token, secret) as any;
    return payload?.sub as string;
  } catch {
    return null;
  }
}