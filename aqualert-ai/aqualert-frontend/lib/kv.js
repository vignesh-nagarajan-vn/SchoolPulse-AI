/**
 * Storage abstraction:
 *   - Vercel KV (Upstash Redis) when KV_REST_API_URL is set  ← production
 *   - In-process memory store (lib/store.js) otherwise        ← local dev
 */

import { setReading, getLatest, getHistory } from './store.js';

const MAX_HISTORY = 60;
const KEY_LATEST  = 'aqualert:latest';
const KEY_HISTORY = 'aqualert:history';

let _kv = null;

async function getKv() {
  if (!process.env.KV_REST_API_URL) return null;
  if (_kv) return _kv;
  try {
    const mod = await import('@vercel/kv');
    _kv = mod.kv;
    return _kv;
  } catch {
    return null;
  }
}

export async function saveReading(reading) {
  const kv = await getKv();
  if (kv) {
    await kv.set(KEY_LATEST, reading);
    await kv.lpush(KEY_HISTORY, JSON.stringify(reading));
    await kv.ltrim(KEY_HISTORY, 0, MAX_HISTORY - 1);
  } else {
    setReading(reading);
  }
}

export async function fetchLatest() {
  const kv = await getKv();
  if (kv) {
    return await kv.get(KEY_LATEST);
  }
  return getLatest();
}

/** Returns readings newest-first. */
export async function fetchHistory() {
  const kv = await getKv();
  if (kv) {
    const items = await kv.lrange(KEY_HISTORY, 0, MAX_HISTORY - 1);
    return items.map(i => (typeof i === 'string' ? JSON.parse(i) : i));
  }
  return getHistory();
}
