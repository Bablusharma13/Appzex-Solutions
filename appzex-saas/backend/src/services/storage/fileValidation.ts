import path from 'node:path';
import { validationFailed } from '../../utils/errors';

interface AllowedType {
  mimeType: string;
  /** Returns true when the file content matches the claimed type. */
  matches: (buffer: Buffer) => boolean;
}

const startsWith = (signature: number[]) => (buffer: Buffer) =>
  buffer.length >= signature.length && signature.every((byte, index) => buffer[index] === byte);

const PDF = startsWith([0x25, 0x50, 0x44, 0x46]); // %PDF
const PNG = startsWith([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const JPEG = startsWith([0xff, 0xd8, 0xff]);
const ZIP = startsWith([0x50, 0x4b, 0x03, 0x04]); // docx / xlsx are zip containers
const OLE2 = startsWith([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]); // legacy doc / xls

/** Plain text must not contain NUL bytes (a strong sign of a binary file). */
const TEXT = (buffer: Buffer) => !buffer.subarray(0, 8192).includes(0);

export const ALLOWED_TYPES: Record<string, AllowedType> = {
  '.pdf': { mimeType: 'application/pdf', matches: PDF },
  '.png': { mimeType: 'image/png', matches: PNG },
  '.jpg': { mimeType: 'image/jpeg', matches: JPEG },
  '.jpeg': { mimeType: 'image/jpeg', matches: JPEG },
  '.doc': { mimeType: 'application/msword', matches: OLE2 },
  '.docx': { mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', matches: ZIP },
  '.xls': { mimeType: 'application/vnd.ms-excel', matches: OLE2 },
  '.xlsx': { mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', matches: ZIP },
  '.csv': { mimeType: 'text/csv', matches: TEXT },
  '.txt': { mimeType: 'text/plain', matches: TEXT },
};

export const ALLOWED_EXTENSIONS = Object.keys(ALLOWED_TYPES);

/** Strips directories and control characters from a user-supplied filename. */
export function sanitizeFilename(name: string): string {
  const base = path.basename(name.replace(/\\/g, '/'));
  // eslint-disable-next-line no-control-regex
  const cleaned = base.replace(/[\u0000-\u001f\u007f<>:"/\\|?*]/g, '_').trim();
  return (cleaned || 'file').slice(0, 200);
}

/**
 * Validates an upload by extension allow-list AND file signature. The
 * browser-supplied MIME type is ignored; the stored MIME type is derived from
 * the validated extension.
 */
export function validateUpload(file: { originalname: string; buffer: Buffer; size: number }) {
  const originalName = sanitizeFilename(file.originalname);
  const extension = path.extname(originalName).toLowerCase();
  const allowed = ALLOWED_TYPES[extension];

  if (!allowed) {
    throw validationFailed([
      { path: 'file', message: `Unsupported file type. Allowed: ${ALLOWED_EXTENSIONS.join(', ')}` },
    ]);
  }
  if (file.size === 0) {
    throw validationFailed([{ path: 'file', message: 'The file is empty' }]);
  }
  if (!allowed.matches(file.buffer)) {
    throw validationFailed([{ path: 'file', message: 'File content does not match its extension' }]);
  }

  return { originalName, extension, mimeType: allowed.mimeType };
}
