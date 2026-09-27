import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";
import {
  allowedCorsOrigin,
  antiAutomation,
  apiMethodGuard,
  csrfProtection,
  rateLimit,
  requireJsonContentType,
  requestTimeout,
  rejectPromptInjectionContent,
  securityHeaders,
  validateRequestInput,
} from "./middlewares/security";

const app: Express = express();

app.disable("x-powered-by");
app.set("trust proxy", process.env.TRUST_PROXY === "true" ? 1 : false);
app.use(securityHeaders);
app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
app.use(
  cors({
    origin(origin, callback) {
      callback(null, allowedCorsOrigin(origin));
    },
    methods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "Accept", "X-Payment-Signature", "X-Kiwify-Signature"],
    credentials: false,
    maxAge: 600,
  }),
);
app.use("/api", apiMethodGuard);
app.use("/api", csrfProtection);
app.use("/api", requestTimeout(15_000));
app.use(express.json({
  limit: "512kb",
  verify: (req, _res, buffer) => {
    if (buffer.length > 512 * 1024) {
      const error = new Error("Payload too large") as Error & { status: number; type: string };
      error.status = 413;
      error.type = "entity.too.large";
      throw error;
    }
    (req as typeof req & { rawBody?: Buffer }).rawBody = Buffer.from(buffer);
  },
}));
app.use(express.urlencoded({ extended: false, limit: "32kb" }));
app.use("/api", requireJsonContentType);
app.use("/api", validateRequestInput);
app.use("/api", rejectPromptInjectionContent);
app.use("/api", rateLimit({
  windowMs: 60 * 1000,
  max: 180,
  message: "Muitas requisições. Tente novamente em instantes.",
}));

app.use("/api", router);

app.use((_req, res) => {
  res.status(404).json({ error: "Recurso não encontrado." });
});

app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  const parserError = err as { type?: string; status?: number };
  if (parserError.type === "entity.too.large" || parserError.status === 413) {
    res.status(413).json({ error: "Payload excede o tamanho máximo permitido." });
    return;
  }
  if (parserError.type === "entity.parse.failed") {
    res.status(400).json({ error: "JSON inválido." });
    return;
  }
  logger.error({ err }, "Unhandled request error");
  res.status(500).json({ error: "Não foi possível concluir a operação." });
});

export default app;
