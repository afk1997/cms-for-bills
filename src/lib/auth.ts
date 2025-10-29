import { cookies } from "next/headers";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { prisma } from "@/lib/prisma";
import { Role } from "@prisma/client";

type SessionPayload = {
  userId: string;
  role: Role;
};

const SESSION_COOKIE = "session";
const SESSION_MAX_AGE = 60 * 60 * 8; // 8 hours

export async function hashPassword(password: string) {
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(password, salt);
}

export async function verifyPassword(password: string, hash: string) {
  return bcrypt.compare(password, hash);
}

export async function createSession(payload: SessionPayload) {
  const secret = process.env.SESSION_SECRET;
  if (!secret) {
    throw new Error("SESSION_SECRET is not configured");
  }
  const token = jwt.sign(payload, secret, { expiresIn: SESSION_MAX_AGE });
  cookies().set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: SESSION_MAX_AGE,
    path: "/"
  });
}

export function destroySession() {
  cookies().set(SESSION_COOKIE, "", { maxAge: 0, path: "/" });
}

export async function getSession(): Promise<(SessionPayload & { user: Awaited<ReturnType<typeof findUserById>> }) | null> {
  const cookie = cookies().get(SESSION_COOKIE);
  if (!cookie) return null;

  try {
    const secret = process.env.SESSION_SECRET;
    if (!secret) return null;
    const decoded = jwt.verify(cookie.value, secret) as SessionPayload;
    const user = await findUserById(decoded.userId);
    if (!user || !user.isActive) return null;
    return { ...decoded, user } as const;
  } catch (error) {
    return null;
  }
}

export function requireRole(session: SessionPayload | null, roles: Role[]) {
  if (!session) return false;
  return roles.includes(session.role);
}

export async function findUserById(id: string) {
  return prisma.user.findUnique({
    where: { id },
    include: {
      regions: {
        include: { region: true }
      }
    }
  });
}

export async function authenticate(email: string, password: string) {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !user.isActive) {
    return null;
  }
  const valid = await verifyPassword(password, user.passwordHash);
  if (!valid) return null;
  return user;
}
