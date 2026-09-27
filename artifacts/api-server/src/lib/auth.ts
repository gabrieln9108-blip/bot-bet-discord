import { randomBytes } from "node:crypto";
import type { NextFunction, Request, Response } from "express";
import { logger } from "./logger";

const SESSION_TTL_MS = 8 * 60 * 60 * 1000;
const SUPABASE_CACHE_TTL_MS = 60 * 1000;

export type AuthPrincipal = {
  userId: string;
  email: string;
  name: string;
};

type Session = {
  principal: AuthPrincipal;
  expiresAt: number;
};

type SupabaseCacheEntry = {
  principal: AuthPrincipal;
  expiresAt: number;
};

const sessions = new Map<string, Session>();
const supabaseCache = new Map<string, SupabaseCacheEntry>();

declare global {
  namespace Express {
    interface Request {
      auth?: AuthPrincipal;
      rawBody?: Buffer;
    }
  }
}

function readBearerToken(req: Request): string | null {
  const header = req.get("authorization");
  if (!header) return null;
  const match = /^Bearer[ \t]+([A-Za-z0-9._~-]{20,})$/i.exec(header.trim());
  return match?.[1] ?? null;
}

function removeExpiredSessions(): void {
  const now = Date.now();
  for (const [token, session] of sessions) {
    if (session.expiresAt <= now) sessions.delete(token);
  }
  for (const [token, entry] of supabaseCache) {
    if (entry.expiresAt <= now) supabaseCache.delete(token);
  }
}

export function createSession(principal: AuthPrincipal): {
  access_token: string;
  expires_in: number;
  user: { id: string; email: string; name: string };
} {
  removeExpiredSessions();
  const token = randomBytes(32).toString("base64url");
  const expiresAt = Date.now() + SESSION_TTL_MS;
  sessions.set(token, { principal, expiresAt });
  return {
    access_token: token,
    expires_in: Math.floor(SESSION_TTL_MS / 1000),
    user: { id: principal.userId, email: principal.email, name: principal.name },
  };
}

export function revokeSession(req: Request): void {
  const token = readBearerToken(req);
  if (token) {
    sessions.delete(token);
    supabaseCache.delete(token);
  }
}

function localSession(token: string): AuthPrincipal | null {
  const session = sessions.get(token);
  if (!session) return null;
  if (session.expiresAt <= Date.now()) {
    sessions.delete(token);
    return null;
  }
  return session.principal;
}

async function supabaseSession(token: string): Promise<AuthPrincipal | null> {
  const url = process.env.SUPABASE_URL?.trim().replace(/\/+$/, "");
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !serviceKey) return null;

  const cached = supabaseCache.get(token);
  if (cached && cached.expiresAt > Date.now()) return cached.principal;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 4000);
  try {
    const response = await fetch(`${url}/auth/v1/user`, {
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${token}`,
      },
      signal: controller.signal,
    });
    if (!response.ok) return null;
    const payload = (await response.json()) as {
      id?: unknown;
      email?: unknown;
      user_metadata?: { name?: unknown; full_name?: unknown };
    };
    if (typeof payload.id !== "string" || typeof payload.email !== "string") return null;
    const principal: AuthPrincipal = {
      userId: `supabase:${payload.id}`,
      email: payload.email.trim().toLowerCase(),
      name:
        typeof payload.user_metadata?.name === "string"
          ? payload.user_metadata.name
          : typeof payload.user_metadata?.full_name === "string"
            ? payload.user_metadata.full_name
            : payload.email.split("@")[0],
    };
    supabaseCache.set(token, {
      principal,
      expiresAt: Date.now() + SUPABASE_CACHE_TTL_MS,
    });
    return principal;
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

async function resolvePrincipal(req: Request): Promise<AuthPrincipal | null> {
  const token = readBearerToken(req);
  if (!token) return null;
  return localSession(token) ?? (await supabaseSession(token));
}

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  void resolvePrincipal(req).then((principal) => {
    if (!principal) {
      logger.warn({
        event: "authorization_failed",
        method: req.method,
        path: req.path,
        ip: req.ip,
      }, "Authorization failed");
      res.status(401).json({ error: "Sessão inválida ou expirada." });
      return;
    }
    req.auth = principal;
    next();
  }).catch(next);
}
