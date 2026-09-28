import { NextResponse } from 'next/server';
import { buildBackup } from '@/lib/backup';

export const dynamic = 'force-dynamic';

export async function GET() {
  const payload = await buildBackup();
  const stamp = new Date().toISOString().slice(0, 10);
  return new NextResponse(JSON.stringify(payload, null, 2), {
    headers: {
      'Content-Type': 'application/json',
      'Content-Disposition': `attachment; filename="trade-journal-backup-${stamp}.json"`,
    },
  });
}
