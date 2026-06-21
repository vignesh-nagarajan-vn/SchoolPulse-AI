/**
 * In-memory fallback store used when Vercel KV is not configured.
 * Attached to globalThis so it survives Next.js HMR in development.
 */

const MAX_HISTORY = 60;

if (!globalThis.__aqualertStore) {
  globalThis.__aqualertStore = { latest: null, history: [] };
}

const store = globalThis.__aqualertStore;

export function getLatest() {
  return store.latest;
}

export function getHistory() {
  return store.history;
}

export function setReading(reading) {
  store.latest = reading;
  store.history.unshift(reading);
  if (store.history.length > MAX_HISTORY) {
    store.history.length = MAX_HISTORY;
  }
}
