/**
 * POST /api/ingest
 * Receives a sensor reading from serial_reader.py and stores it.
 *
 * Accepted body:
 *   Plain reading:
 *     { msg_id, device_id, ts, value, raw }
 *   Arduino JSON bridge:
 *     { distance_cm, fill_percent, status, confidence, ... }
 *
 * Optional auth: x-ingest-secret header must match INGEST_SECRET env var.
 */

import { saveReading } from '../../../lib/kv.js';

export const dynamic = 'force-dynamic';

const SECRET = process.env.INGEST_SECRET ?? '';

function toFiniteNumber(value) {
  if (value === undefined || value === null || value === '') return null;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

export async function POST(req) {
  // Auth
  if (SECRET) {
    const provided = req.headers.get('x-ingest-secret') ?? '';
    if (provided !== SECRET) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  // Parse body
  let body;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const readingValue = toFiniteNumber(body?.value ?? body?.distance_cm);
  if (readingValue === null) {
    return Response.json(
      { error: 'Missing numeric sensor value. Send "value" or "distance_cm".' },
      { status: 400 },
    );
  }

  const reading = {
    msg_id:    body.msg_id    ?? crypto.randomUUID(),
    device_id: body.device_id ?? 'unknown',
    ts:        body.ts        ?? new Date().toISOString(),
    value:     readingValue,
    raw:       body.raw       ?? JSON.stringify(body),
    distance_cm: toFiniteNumber(body.distance_cm),
    fill_depth_cm: toFiniteNumber(body.fill_depth_cm),
    tank_depth_cm: toFiniteNumber(body.tank_depth_cm),
    fill_percent: toFiniteNumber(body.fill_percent),
    confidence: toFiniteNumber(body.confidence),
    sample_count: toFiniteNumber(body.sample_count),
    spread_cm: toFiniteNumber(body.spread_cm),
    arduino_sequence: toFiniteNumber(body.arduino_sequence),
    uptime_ms: toFiniteNumber(body.uptime_ms),
    status: typeof body.status === 'string' ? body.status : null,
  };

  try {
    await saveReading(reading);
  } catch (err) {
    console.error('[ingest] saveReading error:', err);
    return Response.json({ error: 'Storage error' }, { status: 500 });
  }

  return Response.json({ ok: true, reading });
}
