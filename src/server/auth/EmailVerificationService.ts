import { createHash, randomBytes } from "crypto";
import { prisma } from "@/lib/db";

const TOKEN_TTL_HOURS = 24;

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export async function createEmailVerificationToken(
  userId: string
): Promise<{ token: string; expiresAt: Date }> {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + TOKEN_TTL_HOURS * 60 * 60 * 1000);

  await prisma.emailVerificationToken.deleteMany({
    where: { userId, usedAt: null },
  });
  await prisma.emailVerificationToken.create({
    data: { userId, tokenHash: hashToken(token), expiresAt },
  });

  return { token, expiresAt };
}

export async function verifyEmailToken(token: string): Promise<{
  ok: boolean;
  reason?: "BAD_TOKEN" | "EXPIRED" | "USED";
}> {
  const row = await prisma.emailVerificationToken.findUnique({
    where: { tokenHash: hashToken(token) },
    select: { id: true, userId: true, expiresAt: true, usedAt: true },
  });
  if (!row) return { ok: false, reason: "BAD_TOKEN" };
  if (row.usedAt) return { ok: false, reason: "USED" };
  if (row.expiresAt.getTime() < Date.now()) return { ok: false, reason: "EXPIRED" };

  await prisma.$transaction([
    prisma.emailVerificationToken.update({
      where: { id: row.id },
      data: { usedAt: new Date() },
    }),
    prisma.user.update({
      where: { id: row.userId },
      data: { emailVerifiedAt: new Date() },
    }),
  ]);
  return { ok: true };
}

export function buildVerificationUrl(token: string): string {
  const base = process.env.APP_URL || "http://localhost:3000";
  return `${base.replace(/\/$/, "")}/verify-email?token=${encodeURIComponent(token)}`;
}
