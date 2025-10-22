//backend\src\auth\auth.service.ts

import {
  Injectable,
  UnauthorizedException,
  InternalServerErrorException,
  Logger,
  Inject,
} from "@nestjs/common";
import { PrismaService } from "../database/prisma.service";
import { createHash, randomBytes } from "node:crypto";

function newOpaqueToken(): string {
  return randomBytes(18).toString("base64url");
}
function hashToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

type EnrollInput = {
  enrollmentSecret: string;
  deviceId: string;
  hostname: string;
  os: string;
  arch: string;
  version: string;
};

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) { }

  /**
   * Enroll (or re-enroll) an agent.
   * - Validates the shared enrollment secret
   * - If deviceId exists, rotates token & updates metadata
   * - Otherwise creates a new agent
   * - Returns { agentId, agentToken }
   */
  async enrollAgent(input: EnrollInput) {
    const expected = process.env.ENROLLMENT_SECRET || "";
    if (!expected || input.enrollmentSecret !== expected) {
      throw new UnauthorizedException("Invalid enrollment secret");
    }

    try {
      const token = newOpaqueToken();
      const tokenHash = hashToken(token);

      // Look up existing agent by deviceId to avoid duplicates
      const existing = await this.prisma.agent.findFirst({
        where: { deviceId: input.deviceId },
        select: { id: true },
      });

      let agentId: string;

      if (existing) {
        const updated = await this.prisma.agent.update({
          where: { id: existing.id },
          data: {
            hostname: input.hostname,
            os: input.os,
            arch: input.arch,
            version: input.version,
            tokenHash,              // rotate token on re-enroll
            // Optionally mark presence immediately:
            // lastHeartbeatAt: new Date(),
          },
          select: { id: true },
        });
        agentId = updated.id;
        this.logger.log(`Re-enrolled agent ${agentId} (deviceId=${input.deviceId}).`);
      } else {
        const created = await this.prisma.agent.create({
          data: {
            deviceId: input.deviceId,
            hostname: input.hostname,
            os: input.os,
            arch: input.arch,
            version: input.version,
            tokenHash,
            // Optionally mark presence immediately:
            // lastHeartbeatAt: new Date(),
          },
          select: { id: true },
        });
        agentId = created.id;
        this.logger.log(`Enrolled new agent ${agentId} (deviceId=${input.deviceId}).`);
      }

      return { agentId, agentToken: token };
    } catch (e: any) {
      const msg = e?.message ?? String(e);
      this.logger.error(`Enroll failed: ${msg}`, e?.stack ?? undefined);
      // Be verbose in dev, generic in prod
      const dev = (process.env.NODE_ENV || "").toLowerCase() === "development";
      throw new InternalServerErrorException(dev ? `Enroll failed: ${msg}` : "Enroll failed");
    }
  }

  /**
   * Validate an agent’s bearer token (opaque string).
   * Returns the agentId on success, or null on failure.
   */
  async validateAgentToken(rawToken: string): Promise<string | null> {
    const tokenHash = hashToken(rawToken);
    const found = await this.prisma.agent.findUnique({ where: { tokenHash } });
    return found?.id ?? null;
  }
}
