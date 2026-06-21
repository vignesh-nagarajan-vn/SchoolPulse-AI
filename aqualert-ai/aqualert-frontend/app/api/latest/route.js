/**
 * GET /api/latest
 * Returns the most recent sensor reading and the last 60 readings for charting.
 * The frontend polls this every 2 seconds.
 *
 * Response: { latest: Reading | null, history: Reading[], ts: string }
 */

import { fetchLatest, fetchHistory } from '../../../lib/kv.js';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const [latest, history] = await Promise.all([fetchLatest(), fetchHistory()]);
    return Response.json(
      { latest, history, ts: new Date().toISOString() },
      { headers: { 'Cache-Control': 'no-store, no-cache' } },
    );
  } catch (err) {
    console.error('[latest] error:', err);
    return Response.json({ error: 'Storage error' }, { status: 500 });
  }
}
