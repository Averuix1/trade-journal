import { eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { screenshots } from '@/lib/db/schema';

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [row] = await db
    .select()
    .from(screenshots)
    .where(eq(screenshots.id, Number(id)));
  if (!row) return new NextResponse('Not found', { status: 404 });
  if (row.url) return NextResponse.redirect(row.url);
  if (!row.data) return new NextResponse('Not found', { status: 404 });
  return new NextResponse(new Uint8Array(row.data), {
    headers: {
      'Content-Type': row.contentType,
      'Cache-Control': 'private, max-age=31536000, immutable',
    },
  });
}
