import multer from 'multer';
import { env } from '../config/env';

/**
 * Files are held in memory (bounded by MAX_UPLOAD_MB) so they can be fully
 * validated (extension + magic bytes) before anything touches storage.
 */
export const singleFileUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: env.maxUploadBytes, files: 1, fields: 10 },
}).single('file');
