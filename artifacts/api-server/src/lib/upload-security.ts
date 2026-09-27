import { randomBytes } from "node:crypto";
import { isSafePublicHttpUrl } from "../middlewares/security";

export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

const ALLOWED_UPLOADS = new Map([
  ["application/pdf", { extensions: [".pdf"], magic: Buffer.from("%PDF-") }],
  ["image/png", { extensions: [".png"], magic: Buffer.from("\x89PNG\r\n\x1a\n") }],
  ["image/jpeg", { extensions: [".jpg", ".jpeg"], magic: Buffer.from([0xff, 0xd8, 0xff]) }],
]);

export type UploadMetadata = {
  originalName: string;
  mimeType: string;
  size: number;
  bytes?: Buffer;
};

/**
 * Uploads are not currently exposed by a route. Any future upload route must
 * call this validator before accepting a file and store it outside executable
 * directories using the returned random storage name.
 */
export function validateUpload(metadata: UploadMetadata): string | null {
  const extension = metadata.originalName.toLowerCase().slice(metadata.originalName.lastIndexOf("."));
  const rule = ALLOWED_UPLOADS.get(metadata.mimeType.toLowerCase());
  if (!rule || !rule.extensions.includes(extension)) return "Tipo de arquivo não permitido.";
  if (!Number.isInteger(metadata.size) || metadata.size <= 0 || metadata.size > MAX_UPLOAD_BYTES) {
    return "O arquivo excede o tamanho máximo permitido.";
  }
  if (metadata.originalName.length > 180 ||
      /(?:^|[\\/])\.\.?(?:[\\/]|$)/.test(metadata.originalName) ||
      /[\u0000-\u001f\u007f]/.test(metadata.originalName)) {
    return "Nome de arquivo inválido.";
  }
  if (metadata.bytes && !metadata.bytes.subarray(0, rule.magic.length).equals(rule.magic)) {
    return "O conteúdo real do arquivo não corresponde ao tipo informado.";
  }
  return null;
}

export function randomStorageName(extension: string): string {
  const normalizedExtension = extension.toLowerCase();
  if (![".pdf", ".png", ".jpg", ".jpeg"].includes(normalizedExtension)) {
    throw new Error("Unsupported storage extension");
  }
  return `${randomBytes(24).toString("hex")}${normalizedExtension}`;
}

export function isSafeStoragePath(value: string): boolean {
  return value.length <= 255 &&
    !value.includes("\0") &&
    !/(?:^|[\\/])\.\.?(?:[\\/]|$)/.test(value) &&
    !value.startsWith("/") &&
    !/^[A-Za-z]:/.test(value);
}

export { isSafePublicHttpUrl };