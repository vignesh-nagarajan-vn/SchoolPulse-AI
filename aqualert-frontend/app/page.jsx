'use client';

import { useState, useEffect, useCallback } from 'react';

const POLL_MS          = 2000;   // poll interval in ms
const CHART_POINTS     = 40;     // how many readings to chart
const STALE_SECONDS    = 10;     // treat reading as stale if older than this

const ALERT_THRESHOLD  = Number(process.env.NEXT_PUBLIC_ALERT_THRESHOLD ?? 10);
const WARN_THRESHOLD   = Number(process.env.NEXT_PUBLIC_WARN_THRESHOLD  ?? 20);
const SENSOR_STATUS_LABELS = {
  normal: 'NORMAL',
  low: 'LOW WATER',
  critical: 'CRITICAL',
  watch: 'UNSTABLE',
  sensor_fault: 'SENSOR FAULT',
};

// ── Status logic ────────────────────────────────────────────────────────────
function getStatus(reading) {
  const sensorStatus = String(reading?.status ?? '').toLowerCase();
  if (sensorStatus === 'sensor_fault') return 'fault';
  if (sensorStatus === 'critical') return 'alert';
  if (sensorStatus === 'low' || sensorStatus === 'watch') return 'warning';
  if (sensorStatus === 'normal') return 'normal';

  const value = reading?.value;
  if (value === null || value === undefined) return 'offline';
  if (value <= ALERT_THRESHOLD) return 'alert';
  if (value <= WARN_THRESHOLD)  return 'warning';
  return 'normal';
}

function getStatusLabel(reading, statusKey) {
  const sensorStatus = String(reading?.status ?? '').toLowerCase();
  return SENSOR_STATUS_LABELS[sensorStatus] ?? STATUS_CONFIG[statusKey].label;
}

const STATUS_CONFIG = {
  normal:  { label: 'NORMAL',        color: 'var(--green)',  bg: 'rgba(74,222,128,0.08)'  },
  warning: { label: 'WARNING',       color: 'var(--yellow)', bg: 'rgba(251,191,36,0.08)'  },
  alert:   { label: 'LEAK DETECTED', color: 'var(--red)',    bg: 'rgba(248,113,113,0.08)' },
  fault:   { label: 'SENSOR FAULT',  color: 'var(--red)',    bg: 'rgba(248,113,113,0.08)' },
  offline: { label: 'NO DATA',       color: 'var(--muted)',  bg: 'rgba(74,100,128,0.06)'  },
};

// ── SVG Sparkline ────────────────────────────────────────────────────────────
function Sparkline({ data }) {
  if (!data || data.length < 2) {
    return <div className="empty-chart">Waiting for sensor data…</div>;
  }

  const vals = data.map(d => d.value);
  const min  = Math.min(...vals);
  const max  = Math.max(...vals);
  const span = max - min || 1;

  const W = 900, H = 110, PX = 6, PY = 10;

  const point = (v, i) => {
    const x = PX + (i / (vals.length - 1)) * (W - PX * 2);
    const y = PY + (1 - (v - min) / span) * (H - PY * 2);
    return [x.toFixed(2), y.toFixed(2)];
  };

  const pts      = vals.map((v, i) => point(v, i).join(','));
  const linePts  = pts.join(' ');
  const [lx, ly] = point(vals[vals.length - 1], vals.length - 1);

  // Closed polygon for gradient fill (line + bottom baseline)
  const [fx0] = point(vals[0], 0);
  const fillPts = [
    `${fx0},${H - PY}`,
    ...vals.map((v, i) => point(v, i).join(',')),
    `${lx},${H - PY}`,
  ].join(' ');

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="none"
      width="100%"
      height="100%"
      aria-hidden
    >
      <defs>
        <linearGradient id="sg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stopColor="var(--accent)" stopOpacity="0.25" />
          <stop offset="100%" stopColor="var(--accent)" stopOpacity="0.01" />
        </linearGradient>
      </defs>
      <polygon points={fillPts} fill="url(#sg)" />
      <polyline
        points={linePts}
        fill="none"
        stroke="var(--accent)"
        strokeWidth="2.5"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      {/* Live dot at the latest reading */}
      <circle cx={lx} cy={ly} r="5" fill="var(--accent)" />
      <circle cx={lx} cy={ly} r="5" fill="var(--accent)" opacity="0.3">
        <animate attributeName="r" from="5" to="12" dur="1.5s" repeatCount="indefinite" />
        <animate attributeName="opacity" from="0.3" to="0" dur="1.5s" repeatCount="indefinite" />
      </circle>
    </svg>
  );
}

// ── Dashboard ────────────────────────────────────────────────────────────────
export default function Dashboard() {
  const [latest,    setLatest]    = useState(null);
  const [history,   setHistory]   = useState([]);
  const [online,    setOnline]    = useState(false);
  const [lastPoll,  setLastPoll]  = useState(null);

  const poll = useCallback(async () => {
    try {
      const res = await fetch('/api/latest', { cache: 'no-store' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setLatest(data.latest ?? null);
      // History comes newest-first from server; reverse so chart is oldest→newest
      setHistory((data.history ?? []).slice(0, CHART_POINTS).reverse());
      setOnline(true);
      setLastPoll(new Date());
    } catch {
      setOnline(false);
    }
  }, []);

  useEffect(() => {
    poll();
    const id = setInterval(poll, POLL_MS);
    return () => clearInterval(id);
  }, [poll]);

  const value  = latest?.distance_cm ?? latest?.value ?? null;
  const status = getStatus(latest);
  const sc     = STATUS_CONFIG[status];
  const statusLabel = getStatusLabel(latest, status);

  const isStale = latest?.ts
    ? (Date.now() - new Date(latest.ts).getTime()) > STALE_SECONDS * 1000
    : true;

  const liveState = !online ? 'offline' : isStale ? 'stale' : 'live';

  const histMin = history.length ? Math.min(...history.map(d => d.value)) : null;
  const histMax = history.length ? Math.max(...history.map(d => d.value)) : null;

  return (
    <div className="root">
      {/* ── Header ── */}
      <header>
        <div className="logo">
          <span className="logo-tag">SchoolPulse</span>
          <span className="logo-sep">/</span>
          <span className="logo-name">AquaLert</span>
        </div>
        <div className={`live-pill ${liveState}`}>
          <span className="dot" />
          {liveState === 'live' ? 'LIVE' : liveState === 'stale' ? 'STALE' : 'OFFLINE'}
        </div>
      </header>

      {/* ── Top row ── */}
      <div className="top-row">

        {/* Sensor value */}
        <div className="card value-card">
          <div className="card-label">Sensor Distance</div>
          <div className="big-value" style={{ color: sc.color }}>
            {value !== null ? value.toFixed(1) : '—'}
            {value !== null && <span className="unit"> cm</span>}
          </div>
          <div
            className="status-pill"
            style={{ color: sc.color, background: sc.bg, borderColor: sc.color }}
          >
            {statusLabel}
          </div>
        </div>

        {/* Device meta */}
        <div className="card device-card">
          <div className="card-label">Device</div>
          <div className="device-name">{latest?.device_id ?? '—'}</div>

          <div className="card-label" style={{ marginTop: '1rem' }}>Device Status</div>
          <div className="meta-text">{latest?.status ?? sc.label}</div>

          <div className="card-label" style={{ marginTop: '1rem' }}>Last Reading</div>
          <div className="meta-text">
            {latest?.ts ? new Date(latest.ts).toLocaleTimeString() : '—'}
          </div>

          <div className="card-label" style={{ marginTop: '1rem' }}>Fill Level</div>
          <div className="meta-text">
            {latest?.fill_percent !== null && latest?.fill_percent !== undefined
              ? `${latest.fill_percent.toFixed(1)}%`
              : '—'}
          </div>

          <div className="card-label" style={{ marginTop: '1rem' }}>Confidence</div>
          <div className="meta-text">
            {latest?.confidence !== null && latest?.confidence !== undefined
              ? `${(latest.confidence * 100).toFixed(0)}%`
              : '—'}
          </div>

          <div className="card-label" style={{ marginTop: '1rem' }}>Raw Serial Output</div>
          <div className="raw-text">{latest?.raw ?? '—'}</div>

          <div className="card-label" style={{ marginTop: '1rem' }}>Dashboard Poll</div>
          <div className="meta-text">
            {lastPoll ? lastPoll.toLocaleTimeString() : '—'}
          </div>

          <div className="card-label" style={{ marginTop: '1rem' }}>Sample Count / Sequence</div>
          <div className="meta-text">
            {latest?.sample_count ?? '—'} / {latest?.arduino_sequence ?? '—'}
          </div>
        </div>

        {/* Thresholds */}
        <div className="card thresholds-card">
          <div className="card-label">Alert Thresholds</div>
          <div className="threshold-row">
            <span className="dot" style={{ background: 'var(--red)' }} />
            <span>Leak Alert</span>
            <span className="threshold-val">≤ {ALERT_THRESHOLD} cm</span>
          </div>
          <div className="threshold-row">
            <span className="dot" style={{ background: 'var(--yellow)' }} />
            <span>Warning</span>
            <span className="threshold-val">≤ {WARN_THRESHOLD} cm</span>
          </div>
          <div className="threshold-row">
            <span className="dot" style={{ background: 'var(--green)' }} />
            <span>Normal</span>
            <span className="threshold-val">&gt; {WARN_THRESHOLD} cm</span>
          </div>

          <div className="card-label" style={{ marginTop: '1.5rem' }}>Readings Buffered</div>
          <div className="meta-text">{history.length} / {CHART_POINTS}</div>

          {histMin !== null && (
            <>
              <div className="card-label" style={{ marginTop: '1rem' }}>Session Range</div>
              <div className="meta-text">{histMin.toFixed(1)} – {histMax.toFixed(1)} cm</div>
            </>
          )}
        </div>
      </div>

      {/* ── Chart ── */}
      <div className="card chart-card">
        <div className="chart-header">
          <div className="card-label">Live Distance — Last {CHART_POINTS} Readings</div>
          {history.length > 1 && (
            <div className="chart-meta">
              min {histMin?.toFixed(1)} cm &nbsp;·&nbsp; max {histMax?.toFixed(1)} cm
            </div>
          )}
        </div>
        <div className="chart-area">
          <Sparkline data={history} />
        </div>
      </div>
    </div>
  );
}
