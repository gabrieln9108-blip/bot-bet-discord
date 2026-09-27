import { createHash, createHmac, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { Router, type IRouter, type Request, type Response } from "express";
import { createSession, requireAuth, revokeSession } from "../lib/auth";
import { logger } from "../lib/logger";
import { antiAutomation, rateLimit, rejectUnexpectedKeys } from "../middlewares/security";

const router: IRouter = Router();
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PRICE_CENTS = 1690;
const DEMO_EMAIL = process.env.DEMO_ACCESS_EMAIL?.trim().toLowerCase();
const GENERIC_AUTH_ERROR = "E-mail ou senha inválidos.";
const EXPECTED_PRODUCT_ID =
  process.env.PAYMENT_PRODUCT_ID?.trim() || process.env.KIWIFY_PRODUCT_ID?.trim() || "";
const EXPECTED_PRODUCT_NAME =
  process.env.PAYMENT_PRODUCT_NAME?.trim().toLocaleLowerCase() ||
  process.env.KIWIFY_PRODUCT_NAME?.trim().toLocaleLowerCase() ||
  "";
const MAX_PASSWORD_LENGTH = 128;
const WEBHOOK_MAX_AGE_MS = 5 * 60 * 1000;

type AccessRecord = {
  id: string;
  email: string;
  name: string;
  passwordHash: string | null;
  purchased: boolean;
  createdAt: string;
};

type PendingCheckout = {
  name: string;
  email: string;
  createdAt: string;
};

const accessRecords = new Map<string, AccessRecord>();
if (DEMO_EMAIL && process.env.NODE_ENV !== "production") {
  accessRecords.set(DEMO_EMAIL, {
    id: `local-${randomBytes(16).toString("hex")}`,
    email: DEMO_EMAIL,
    name: "Cliente de demonstração",
    passwordHash: null,
    purchased: true,
    createdAt: new Date().toISOString(),
  });
}
const pendingCheckouts = new Map<string, PendingCheckout>();
const processedWebhookEvents = new Map<string, number>();
const loginFailures = new Map<string, { count: number; lastFailureAt: number }>();

function normalizeEmail(value: unknown): string {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

function normalizeName(value: unknown): string {
  return typeof value === "string" ? value.trim().replace(/\s+/g, " ") : "";
}

function error(res: Response, message: string, status = 400): void {
  res.status(status).json({ error: message });
}

function bodyKeys(req: Request, res: Response, allowed: readonly string[]): boolean {
  return rejectUnexpectedKeys(req, res, allowed);
}

function passwordHash(password: string, salt = randomBytes(16).toString("hex")): string {
  return `${salt}:${scryptSync(password, salt, 64).toString("hex")}`;
}

function passwordMatches(password: string, stored: string): boolean {
  const [salt, digest] = stored.split(":");
  if (!salt || !digest) return false;
  const actual = scryptSync(password, salt, 64);
  const expected = Buffer.from(digest, "hex");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

function checkoutUrl(req: Request): string {
  const configured = process.env.CHECKOUT_URL?.trim() || process.env.KIWIFY_CHECKOUT_URL?.trim();
  if (configured && /^(https:\/\/|\/(?!\/))/i.test(configured)) return configured;
  return "/checkout/pagamento-pendente";
}

function paymentSignatureIsValid(req: Request, rawBody: string): boolean {
  const secret = process.env.PAYMENT_WEBHOOK_SECRET?.trim() || process.env.KIWIFY_WEBHOOK_SECRET?.trim();
  if (!secret) return false;
  const suppliedHeader = req.headers["x-payment-signature"] ?? req.headers["x-kiwify-signature"];
  const supplied = (Array.isArray(suppliedHeader) ? suppliedHeader[0] : suppliedHeader ?? "")
    .trim()
    .replace(/^sha256=/i, "");
  const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
  try {
    return Boolean(supplied) &&
      supplied.length === expected.length &&
      timingSafeEqual(Buffer.from(supplied), Buffer.from(expected));
  } catch {
    return false;
  }
}

function recordValue(record: Record<string, unknown> | null, ...keys: string[]): unknown {
  if (!record) return undefined;
  for (const key of keys) {
    if (record[key] !== undefined && record[key] !== null) return record[key];
  }
  return undefined;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function textValue(value: unknown, maxLength = 256): string {
  return typeof value === "string" && value.length <= maxLength ? value.trim() : "";
}

function normalizedStatus(value: unknown): string {
  return textValue(value, 100).toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
}

function amountInCents(value: unknown): number | null {
  if (typeof value !== "number" && typeof value !== "string") return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) return null;
  return parsed <= 100 ? Math.round(parsed * 100) : Math.round(parsed);
}

function productIsValid(productId: string, productName: string): boolean {
  if (!EXPECTED_PRODUCT_ID && !EXPECTED_PRODUCT_NAME) return false;
  const idMatches = Boolean(EXPECTED_PRODUCT_ID && productId && productId === EXPECTED_PRODUCT_ID);
  const nameMatches = Boolean(EXPECTED_PRODUCT_NAME && productName &&
    productName.toLocaleLowerCase() === EXPECTED_PRODUCT_NAME);
  return idMatches || nameMatches;
}

function webhookTimestampIsValid(req: Request, payload: Record<string, unknown>): boolean {
  const rawTimestamp = req.headers["x-webhook-timestamp"] ??
    req.headers["x-timestamp"] ??
    recordValue(payload, "webhook_timestamp", "timestamp");
  if (rawTimestamp === undefined || rawTimestamp === null || rawTimestamp === "") return true;
  const timestamp = Number(rawTimestamp);
  if (!Number.isFinite(timestamp)) return false;
  const timestampMs = timestamp < 10_000_000_000 ? timestamp * 1000 : timestamp;
  return Math.abs(Date.now() - timestampMs) <= WEBHOOK_MAX_AGE_MS;
}

function cleanupProcessedWebhookEvents(): void {
  const cutoff = Date.now() - 24 * 60 * 60 * 1000;
  for (const [eventId, processedAt] of processedWebhookEvents) {
    if (processedAt < cutoff) processedWebhookEvents.delete(eventId);
  }
  if (processedWebhookEvents.size <= 10_000) return;
  const oldest = [...processedWebhookEvents.entries()]
    .sort(([, first], [, second]) => first - second)
    .slice(0, processedWebhookEvents.size - 10_000);
  oldest.forEach(([eventId]) => processedWebhookEvents.delete(eventId));
}

function throttleKey(req: Request, email: string): string {
  return `${req.ip}:${email}`;
}

function emailFingerprint(email: string): string {
  return createHash("sha256").update(email).digest("hex").slice(0, 16);
}

function loginDelay(req: Request, email: string): number {
  const failure = loginFailures.get(throttleKey(req, email));
  if (!failure) return 0;
  const elapsed = Date.now() - failure.lastFailureAt;
  const delay = Math.min(4000, Math.max(0, 250 * 2 ** Math.min(failure.count - 1, 4)));
  return Math.max(0, delay - elapsed);
}

function noteLoginFailure(req: Request, email: string): void {
  const key = throttleKey(req, email);
  const current = loginFailures.get(key);
  const failure = {
    count: (current?.count ?? 0) + 1,
    lastFailureAt: Date.now(),
  };
  loginFailures.set(key, failure);
  logger.warn({
    event: "login_failure",
    emailFingerprint: emailFingerprint(email),
    ip: req.ip,
    failureCount: failure.count,
  }, "Login failed");
}

function clearLoginFailures(req: Request, email: string): void {
  loginFailures.delete(throttleKey(req, email));
}

router.post("/auth/first-access/check", rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 12,
  key: (req) => `${req.ip}:first-access:${normalizeEmail(req.body?.email)}`,
}), antiAutomation({
  windowMs: 10 * 1000,
  burst: 5,
  key: (req) => `${req.ip}:first-access`,
}), (req, res): void => {
  if (!bodyKeys(req, res, ["email"])) return;
  const email = normalizeEmail(req.body?.email);
  if (email.length > 254 || !EMAIL_RE.test(email)) {
    error(res, "Confira os dados informados.");
    return;
  }
  const record = accessRecords.get(email);
  res.json({
    eligible: Boolean(record?.purchased),
    firstAccess: Boolean(record?.purchased && !record.passwordHash),
    needsPassword: Boolean(record?.purchased && record.passwordHash),
    demo: Boolean(DEMO_EMAIL && email === DEMO_EMAIL),
  });
});

router.post("/auth/first-access/complete", rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 8,
  key: (req) => `${req.ip}:first-access-complete:${normalizeEmail(req.body?.email)}`,
}), antiAutomation({
  windowMs: 10 * 1000,
  burst: 3,
  key: (req) => `${req.ip}:first-access-complete`,
}), async (req, res): Promise<void> => {
  if (!bodyKeys(req, res, ["email", "name", "password"])) return;
  const email = normalizeEmail(req.body?.email);
  const name = normalizeName(req.body?.name);
  const password = typeof req.body?.password === "string" ? req.body.password : "";
  const record = accessRecords.get(email);
  if (!EMAIL_RE.test(email) || name.length < 2) {
    error(res, "Confira seu nome e e-mail.");
    return;
  }
  if (password.length < 8 || password.length > MAX_PASSWORD_LENGTH) {
    error(res, "A senha precisa ter pelo menos 8 caracteres.");
    return;
  }
  if (!record?.purchased) {
    error(res, GENERIC_AUTH_ERROR, 403);
    return;
  }
  if (record.passwordHash) {
    error(res, "Este acesso já foi configurado. Entre com sua senha.", 409);
    return;
  }
  const updated: AccessRecord = { ...record, name, passwordHash: passwordHash(password) };
  accessRecords.set(email, updated);
  logger.info({
    event: "password_created",
    userId: updated.id,
    emailFingerprint: emailFingerprint(email),
    ip: req.ip,
  }, "First access password created");
  res.status(201).json({
    session: createSession({ userId: updated.id, email: updated.email, name: updated.name }),
  });
});

router.post("/auth/login", rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  key: (req) => `${req.ip}:login`,
}), antiAutomation({
  windowMs: 10 * 1000,
  burst: 5,
  key: (req) => `${req.ip}:login`,
}), async (req, res): Promise<void> => {
  if (!bodyKeys(req, res, ["email", "password"])) return;
  const email = normalizeEmail(req.body?.email);
  const password = typeof req.body?.password === "string" ? req.body.password : "";
  const delay = loginDelay(req, email);
  if (delay > 0) await new Promise((resolve) => setTimeout(resolve, delay));
  const record = accessRecords.get(email);
  if (!EMAIL_RE.test(email)) {
    noteLoginFailure(req, email);
    error(res, GENERIC_AUTH_ERROR, 401);
    return;
  }
  if (!record?.purchased) {
    noteLoginFailure(req, email);
    error(res, GENERIC_AUTH_ERROR, 401);
    return;
  }
  if (!record.passwordHash) {
    noteLoginFailure(req, email);
    error(res, GENERIC_AUTH_ERROR, 401);
    return;
  }
  if (!passwordMatches(password, record.passwordHash)) {
    noteLoginFailure(req, email);
    error(res, GENERIC_AUTH_ERROR, 401);
    return;
  }
  clearLoginFailures(req, email);
  logger.info({
    event: "login_success",
    userId: record.id,
    emailFingerprint: emailFingerprint(email),
    ip: req.ip,
  }, "Login succeeded");
  res.json({
    session: createSession({ userId: record.id, email: record.email, name: record.name }),
  });
});

router.post("/auth/logout", requireAuth, (req, res): void => {
  revokeSession(req);
  logger.info({
    event: "logout",
    userId: req.auth?.userId,
  }, "User logged out");
  res.status(204).send();
});

router.post("/checkout/start", rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 10,
  key: (req) => `${req.ip}:checkout:${normalizeEmail(req.body?.email)}`,
}), antiAutomation({
  windowMs: 10 * 1000,
  burst: 5,
  key: (req) => `${req.ip}:checkout`,
}), (req, res): void => {
  if (!bodyKeys(req, res, ["name", "email"])) return;
  const name = normalizeName(req.body?.name);
  const email = normalizeEmail(req.body?.email);
  if (name.length < 2 || name.length > 120 || !EMAIL_RE.test(email)) {
    error(res, "Informe seu nome e um e-mail válido.");
    return;
  }
  pendingCheckouts.set(email, { name, email, createdAt: new Date().toISOString() });
  res.json({ checkout_url: checkoutUrl(req), price_cents: PRICE_CENTS });
});

router.post("/webhooks/kiwify", rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  key: (req) => `${req.ip}:payment-webhook`,
  message: "Muitos eventos de pagamento em sequência. Tente novamente mais tarde.",
}), (req, res): void => {
  const rawBody = req.rawBody?.toString("utf8") ?? JSON.stringify(req.body ?? {});
  if (!paymentSignatureIsValid(req, rawBody)) {
    logger.warn({
      event: "payment_webhook_signature_failed",
      ip: req.ip,
    }, "Payment webhook signature failed");
    error(res, "Assinatura inválida.", 401);
    return;
  }
  const payload = asRecord(req.body);
  if (!payload) {
    error(res, "Payload de webhook inválido.");
    return;
  }
  if (!webhookTimestampIsValid(req, payload)) {
    error(res, "Webhook expirado ou com timestamp inválido.", 400);
    return;
  }

  const data = asRecord(recordValue(payload, "data", "order", "purchase")) ?? payload;
  const customer = asRecord(recordValue(data, "customer", "Customer", "buyer")) ?? {};
  const product = asRecord(recordValue(data, "product", "Product")) ?? {};
  const transactionId = textValue(recordValue(
    data,
    "transaction_id",
    "transactionId",
    "order_id",
    "orderId",
    "sale_id",
    "saleId",
  ) ?? recordValue(payload, "transaction_id", "transactionId", "order_id", "orderId"), 200);
  const eventId = textValue(
    recordValue(payload, "event_id", "eventId", "id") ??
      recordValue(data, "event_id", "eventId", "id") ??
      req.headers["x-event-id"],
    200,
  ) || transactionId;
  const buyerId = textValue(recordValue(
    data,
    "buyer_id",
    "buyerId",
    "customer_id",
    "customerId",
  ) ?? recordValue(customer, "id", "customer_id", "customerId") ??
    recordValue(payload, "buyer_id", "buyerId", "customer_id", "customerId"), 200);
  const email = normalizeEmail(
    recordValue(data, "customer_email", "customerEmail", "email") ??
      recordValue(customer, "email") ??
      recordValue(payload, "customer_email", "customerEmail", "email"),
  );
  const status = normalizedStatus(
    recordValue(data, "status", "order_status", "orderStatus", "payment_status", "paymentStatus") ??
      recordValue(payload, "status", "order_status", "orderStatus"),
  );
  const productId = textValue(
    recordValue(data, "product_id", "productId") ??
      recordValue(product, "id", "product_id", "productId") ??
      recordValue(payload, "product_id", "productId"),
    200,
  );
  const productName = textValue(
    recordValue(data, "product_name", "productName", "name") ??
      recordValue(product, "name", "product_name", "productName") ??
      recordValue(payload, "product_name", "productName"),
    256,
  );
  const amount = amountInCents(
    recordValue(data, "amount_cents", "amountCents", "amount", "value", "total") ??
      recordValue(payload, "amount_cents", "amountCents", "amount", "value", "total"),
  );
  const currency = textValue(
    recordValue(data, "currency", "currency_code", "currencyCode") ??
      recordValue(payload, "currency", "currency_code", "currencyCode"),
    10,
  ).toUpperCase();

  if (!eventId || !transactionId || !buyerId || !EMAIL_RE.test(email) ||
      !productIsValid(productId, productName) || amount !== PRICE_CENTS ||
      (currency && currency !== "BRL")) {
    error(res, "Evento de pagamento não reconhecido.", 422);
    return;
  }
  if (processedWebhookEvents.has(eventId)) {
    res.json({ received: true, duplicate: true });
    return;
  }

  const approvedStatuses = new Set(["paid", "approved", "completed", "purchase_approved", "order_paid"]);
  const revokedStatuses = new Set(["refunded", "refund", "chargeback", "cancelled", "canceled", "cancel"]);
  const neutralStatuses = new Set(["pending", "waiting_payment", "waiting_for_payment", "processing"]);
  const approved = approvedStatuses.has(status);
  const revoked = revokedStatuses.has(status);
  if (!approved && !revoked && !neutralStatuses.has(status)) {
    error(res, "Status de pagamento não reconhecido.", 422);
    return;
  }

  if (approved) {
    const pending = pendingCheckouts.get(email);
    const current = accessRecords.get(email);
    accessRecords.set(email, {
      email,
      id: current?.id || `local-${randomBytes(16).toString("hex")}`,
      name: pending?.name || current?.name || "Cliente",
      passwordHash: current?.passwordHash ?? null,
      purchased: true,
      createdAt: current?.createdAt || new Date().toISOString(),
    });
    pendingCheckouts.delete(email);
  } else if (revoked && accessRecords.has(email)) {
    accessRecords.get(email)!.purchased = false;
  }
  cleanupProcessedWebhookEvents();
  processedWebhookEvents.set(eventId, Date.now());
  logger.info({
    event: "payment_webhook_processed",
    eventId,
    transactionId,
    status,
    approved,
  }, "Payment webhook processed");
  res.json({ received: true, approved });
});

export default router;