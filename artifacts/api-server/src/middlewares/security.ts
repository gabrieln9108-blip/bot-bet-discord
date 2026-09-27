import { isIP } from "node:net";
import type { NextFunction, Request, RequestHandler, Response } from "express";
import { logger } from "../lib/logger";

type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();
const MAX_INPUT_STRING_LENGTH = 20_000;
const MAX_INPUT_ARRAY_LENGTH = 200;
const MAX_INPUT_OBJECT_KEYS = 100;
const MAX_INPUT_DEPTH = 8;
const MAX_TRACKED_KEYS = 50_000;
const automationWindows = new Map<string, number[]>();

function clientIp(req: Request): string {
  return req.ip || req.socket.remoteAddress || "unknown";
}

function cleanupBuckets(now: number): void {
  if (buckets.size <= MAX_TRACKED_KEYS) return;
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key);
  }
  if (buckets.size <= MAX_TRACKED_KEYS) return;
  const oldest = [...buckets.entries()]
    .sort(([, first], [, second]) => first.resetAt - second.resetAt)
    .slice(0, buckets.size - MAX_TRACKED_KEYS);
  oldest.forEach(([key]) => buckets.delete(key));
}

export function rateLimit(options: {
  windowMs: number;
  max: number;
  key?: (req: Request) => string;
  message?: string;
}): RequestHandler {
  return (req, res, next) => {
    const key = options.key?.(req) ?? clientIp(req);
    const now = Date.now();
    cleanupBuckets(now);
    let bucket = buckets.get(key);
    if (!bucket || bucket.resetAt <= now) {
      bucket = { count: 0, resetAt: now + options.windowMs };
      buckets.set(key, bucket);
    }
    bucket.count += 1;
    res.setHeader("X-RateLimit-Limit", String(options.max));
    res.setHeader("X-RateLimit-Remaining", String(Math.max(0, options.max - bucket.count)));
    if (bucket.count > options.max) {
      res.setHeader("Retry-After", String(Math.ceil((bucket.resetAt - now) / 1000)));
      logger.warn({
        event: "rate_limit_exceeded",
        method: req.method,
        path: req.path,
        ip: clientIp(req),
      }, "Request rate limit exceeded");
      res.status(429).json({
        error: options.message ?? "Muitas tentativas. Tente novamente mais tarde.",
      });
      return;
    }
    next();
  };
}

export function antiAutomation(options: {
  windowMs: number;
  burst: number;
  key?: (req: Request) => string;
}): RequestHandler {
  return (req, res, next) => {
    const key = options.key?.(req) ?? `${clientIp(req)}:${req.path}`;
    const now = Date.now();
    const recent = (automationWindows.get(key) ?? [])
      .filter((timestamp) => timestamp > now - options.windowMs);
    recent.push(now);
    automationWindows.set(key, recent);
    if (automationWindows.size > MAX_TRACKED_KEYS) {
      for (const [trackedKey, timestamps] of automationWindows) {
        if (!timestamps.some((timestamp) => timestamp > now - options.windowMs)) {
          automationWindows.delete(trackedKey);
        }
      }
    }
    if (recent.length > options.burst) {
      res.setHeader("Retry-After", "10");
      logger.warn({
        event: "automation_burst_blocked",
        method: req.method,
        path: req.path,
        ip: clientIp(req),
      }, "Automation burst blocked");
      res.status(429).json({
        error: "Detectamos muitas tentativas em sequência. Aguarde alguns instantes.",
      });
      return;
    }
    next();
  };
}

export function requestTimeout(timeoutMs: number): RequestHandler {
  return (req, res, next) => {
    req.setTimeout(timeoutMs);
    res.setTimeout(timeoutMs, () => {
      if (!res.headersSent) {
        res.status(503).json({ error: "A operação demorou demais. Tente novamente." });
      }
    });
    next();
  };
}

export function securityHeaders(_req: Request, res: Response, next: NextFunction): void {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "no-referrer");
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Cross-Origin-Resource-Policy", "same-site");
  res.setHeader(
    "Content-Security-Policy",
    "default-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'; object-src 'none'; script-src 'none'; style-src 'none'; img-src 'none'; connect-src 'none'",
  );
  if (process.env.NODE_ENV === "production") {
    res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  }
  next();
}

export function apiMethodGuard(req: Request, res: Response, next: NextFunction): void {
  const allowedMethods = new Set(["GET", "POST", "PATCH", "DELETE", "OPTIONS"]);
  if (!allowedMethods.has(req.method)) {
    res.setHeader("Allow", [...allowedMethods].join(", "));
    res.status(405).json({ error: "Método não permitido." });
    return;
  }
  next();
}

function isJsonContentType(req: Request): boolean {
  const contentType = req.get("content-type")?.split(";", 1)[0].trim().toLowerCase();
  return contentType === "application/json" || contentType?.endsWith("+json") === true;
}

export function requireJsonContentType(req: Request, res: Response, next: NextFunction): void {
  const hasBody = req.get("content-length") !== undefined && req.get("content-length") !== "0";
  if (["POST", "PATCH", "PUT"].includes(req.method) ||
      (req.method === "DELETE" && hasBody)) {
    if (!isJsonContentType(req)) {
      res.status(415).json({ error: "Content-Type application/json é obrigatório." });
      return;
    }
  }
  next();
}

function isUnsafeMethod(method: string): boolean {
  return ["POST", "PUT", "PATCH", "DELETE"].includes(method);
}

export function csrfProtection(req: Request, res: Response, next: NextFunction): void {
  if (!isUnsafeMethod(req.method)) {
    next();
    return;
  }

  const origin = req.get("origin");
  if (origin && !allowedCorsOrigin(origin)) {
    logger.warn({
      event: "csrf_origin_blocked",
      method: req.method,
      path: req.path,
      ip: clientIp(req),
    }, "Request origin blocked");
    res.status(403).json({ error: "Origem da requisição não permitida." });
    return;
  }

  // Bearer authentication is not sent automatically by browsers. If a future
  // cookie-backed session is added, also require a trusted Referer when Origin
  // is absent instead of relying on CORS as CSRF protection.
  if (!origin && req.get("cookie")) {
    const referer = req.get("referer");
    if (referer) {
      try {
        const refererOrigin = new URL(referer).origin;
        if (!allowedCorsOrigin(refererOrigin)) {
          logger.warn({
            event: "csrf_referer_blocked",
            method: req.method,
            path: req.path,
            ip: clientIp(req),
          }, "Request referer blocked");
          res.status(403).json({ error: "Origem da requisição não permitida." });
          return;
        }
      } catch {
        logger.warn({
          event: "csrf_invalid_referer",
          method: req.method,
          path: req.path,
          ip: clientIp(req),
        }, "Invalid request referer");
        res.status(403).json({ error: "Referência da requisição inválida." });
        return;
      }
    }
  }
  next();
}

function inspectInput(value: unknown, depth = 0): string | null {
  if (depth > MAX_INPUT_DEPTH) return "A estrutura enviada é profunda demais.";
  if (typeof value === "string") {
    if (value.length > MAX_INPUT_STRING_LENGTH) return "Um campo excede o tamanho máximo permitido.";
    if (/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/.test(value)) {
      return "A requisição contém caracteres inválidos.";
    }
    return null;
  }
  if (Array.isArray(value)) {
    if (value.length > MAX_INPUT_ARRAY_LENGTH) return "A lista enviada excede o limite permitido.";
    for (const item of value) {
      const error = inspectInput(item, depth + 1);
      if (error) return error;
    }
    return null;
  }
  if (value && typeof value === "object") {
    const entries = Object.entries(value);
    if (entries.length > MAX_INPUT_OBJECT_KEYS) return "A requisição contém campos demais.";
    for (const [key, item] of entries) {
      if (key.length > 100 || /[\u0000-\u001F\u007F]/.test(key)) {
        return "A requisição contém um nome de campo inválido.";
      }
      const error = inspectInput(item, depth + 1);
      if (error) return error;
    }
  }
  return null;
}

const PROMPT_INJECTION_PATTERNS = [
  /\b(ignore|disregard|forget|desconsidere|ignore|esqueça)\b.{0,80}\b(previous|earlier|above|system|developer|instruções?|regras?)\b/i,
  /\b(system prompt|system message|developer message|mensagem do sistema|instruções internas?)\b/i,
  /\b(jailbreak|prompt injection|dan mode|modo dan)\b/i,
  /\b(reveal|show|expose|revele|mostre|exponha)\b.{0,80}\b(secret|token|password|api key|chave|senha|credencial)\b/i,
  /\b(execute|run|execute|rode)\b.{0,80}\b(command|code|shell|comando|código|script)\b/i,
  /\b(override|alter|substitua|mude)\b.{0,80}\b(instruction|rule|policy|instrução|regra|política)\b/i,
];

function findPromptInjection(value: unknown, depth = 0): boolean {
  if (depth > MAX_INPUT_DEPTH) return false;
  if (typeof value === "string") {
    return PROMPT_INJECTION_PATTERNS.some((pattern) => pattern.test(value));
  }
  if (Array.isArray(value)) {
    return value.some((item) => findPromptInjection(item, depth + 1));
  }
  if (value && typeof value === "object") {
    return Object.entries(value).some(([key, item]) =>
      findPromptInjection(key, depth + 1) || findPromptInjection(item, depth + 1),
    );
  }
  return false;
}

/**
 * User-provided job descriptions, interview answers, and curriculum text are
 * DATA, never instructions. This guard is deliberately conservative because
 * this backend must never let submitted text change application rules.
 */
export function rejectPromptInjectionContent(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  if (findPromptInjection(req.body)) {
    logger.warn({
      event: "prompt_injection_blocked",
      method: req.method,
      path: req.path,
      ip: clientIp(req),
    }, "Untrusted content matched prompt-injection patterns");
    res.status(422).json({
      error: "O texto enviado contém instruções não permitidas. Envie apenas os dados da oportunidade ou do seu perfil.",
    });
    return;
  }
  next();
}

function isPrivateIpv4(hostname: string): boolean {
  const octets = hostname.split(".").map(Number);
  if (octets.length !== 4 || octets.some((octet) => !Number.isInteger(octet) || octet < 0 || octet > 255)) {
    return false;
  }
  const [first, second] = octets;
  return first === 0 || first === 10 || first === 127 ||
    (first === 100 && second >= 64 && second <= 127) ||
    (first === 169 && second === 254) ||
    (first === 172 && second >= 16 && second <= 31) ||
    (first === 192 && second === 0) ||
    (first === 192 && second === 168) ||
    (first === 198 && (second === 18 || second === 19)) ||
    first >= 224;
}

/**
 * Syntactic SSRF guard for URLs that may later be fetched by the server.
 * The current application does not fetch user URLs, but every future fetch
 * must use this helper and resolve DNS before opening a connection.
 */
export function isSafePublicHttpUrl(value: string): boolean {
  if (!value || value.length > 2048) return false;
  try {
    const parsed = new URL(value);
    const hostname = parsed.hostname.replace(/^\[|\]$/g, "").toLowerCase();
    if (!["http:", "https:"].includes(parsed.protocol) ||
        parsed.username || parsed.password ||
        hostname === "localhost" ||
        hostname.endsWith(".localhost") ||
        hostname.endsWith(".local") ||
        hostname === "metadata.google.internal" ||
        hostname === "metadata.google" ||
        hostname === "instance-data.ec2.internal") {
      return false;
    }
    const addressType = isIP(hostname);
    if (addressType === 4 && isPrivateIpv4(hostname)) return false;
    if (addressType === 6) {
      const normalized = hostname.toLowerCase();
      if (normalized === "::1" || normalized.startsWith("fc") ||
          normalized.startsWith("fd") || normalized.startsWith("fe8") ||
          normalized.startsWith("fe9") || normalized.startsWith("fea") ||
          normalized.startsWith("feb")) {
        return false;
      }
    }
    return true;
  } catch {
    return false;
  }
}

export function validateRequestInput(req: Request, res: Response, next: NextFunction): void {
  if (req.body === undefined) {
    next();
    return;
  }
  const error = inspectInput(req.body);
  if (error) {
    res.status(413).json({ error });
    return;
  }
  next();
}

export function rejectUnexpectedKeys(
  req: Request,
  res: Response,
  allowedKeys: readonly string[],
): boolean {
  if (!req.body || typeof req.body !== "object" || Array.isArray(req.body)) {
    res.status(400).json({ error: "O corpo da requisição deve ser um objeto JSON." });
    return false;
  }
  const allowed = new Set(allowedKeys);
  const unexpected = Object.keys(req.body).filter((key) => !allowed.has(key));
  if (unexpected.length > 0) {
    res.status(400).json({ error: "A requisição contém campos não reconhecidos." });
    return false;
  }
  return true;
}

export function allowedCorsOrigin(origin: string | undefined): boolean {
  if (!origin) return true;
  const configured = (process.env.ALLOWED_ORIGINS ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  if (configured.includes(origin)) return true;
  return process.env.NODE_ENV !== "production" && /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(origin);
}
