import 'server-only';

export type SavedScreenshot = {
  url: string | null;
  blobPath: string | null;
  data: Buffer | null;
  contentType: string;
};

const MAX_DB_BYTES = 4 * 1024 * 1024;

/** Uploads to Vercel Blob when a token is configured, otherwise stores the bytes in Postgres. */
export async function saveScreenshot(file: File): Promise<SavedScreenshot> {
  const contentType = file.type || 'image/png';
  const token = process.env.BLOB_READ_WRITE_TOKEN;

  if (token) {
    const { put } = await import('@vercel/blob');
    const path = `screenshots/${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${file.name || 'chart.png'}`;
    const blob = await put(path, file, { access: 'public', token, contentType });
    return { url: blob.url, blobPath: blob.pathname, data: null, contentType };
  }

  const bytes = Buffer.from(await file.arrayBuffer());
  if (bytes.byteLength > MAX_DB_BYTES) {
    throw new Error('Image is larger than 4 MB. Add a Vercel Blob store, or upload a smaller screenshot.');
  }
  return { url: null, blobPath: null, data: bytes, contentType };
}

export function screenshotSrc(row: { id: number; url: string | null }): string {
  return row.url ?? `/api/screenshots/${row.id}`;
}
