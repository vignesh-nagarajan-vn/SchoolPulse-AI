/* SchoolPulse dashboard — unified module console */

const state = {
  overview: null,
  modules: {},
  recognition: null,
  currentAudio: null,
  currentAudioUrl: null,
  voiceConfigured: false,
  listening: false,
  lastExchange: null,
  highlightZone: null
};

const moduleTone = {
  Energy: "tone-energy",
  Water: "tone-water",
  Waste: "tone-waste",
  Events: "tone-events"
};

const moduleColors = {
  Energy: "#ca8a04",
  Water: "#0284c7",
  Waste: "#c2410c",
  Events: "#16a34a"
};

const panelByModule = {
  Energy: "energyPanel",
  Water: "waterPanel",
  Waste: "wastePanel",
  Events: "eventsPanel"
};

const CAMPUS_ZONES = {
  "A-Wing": { x: 80, y: 90, w: 120, h: 100, label: "A-Wing" },
  "B-Wing": { x: 220, y: 90, w: 120, h: 100, label: "B-Wing" },
  Cafeteria: { x: 80, y: 210, w: 120, h: 80, label: "Cafeteria" },
  Gym: { x: 220, y: 210, w: 120, h: 80, label: "Gym" },
  Auditorium: { x: 360, y: 90, w: 100, h: 80, label: "Auditorium" },
  "Science Lab": { x: 360, y: 190, w: 100, h: 70, label: "Science Lab" },
  Library: { x: 360, y: 280, w: 100, h: 60, label: "Library" },
  Main: { x: 140, y: 310, w: 100, h: 50, label: "Main" }
};

const languageLabels = {
  "en-US": "English",
  "es-US": "Spanish",
  "hi-IN": "Hindi",
  "zh-CN": "Chinese",
  ar: "Arabic",
  "fr-FR": "French"
};

const answerSectionLabels = [
  "Highest priority",
  "Most important next action",
  "Why",
  "Details",
  "Next step",
  "Human check",
  "Human verification required",
  "Evidence",
  "Estimated impact",
  "Confidence",
  "Prioridad máxima",
  "Por qué",
  "Siguiente paso",
  "Verificación humana",
  "Evidencia",
  "Impacto estimado",
  "Confianza",
  "सबसे ज़रूरी काम",
  "क्यों",
  "अगला कदम",
  "मानवीय जांच",
  "最高优先级",
  "原因",
  "下一步",
  "人工确认",
  "الأولوية الأعلى",
  "السبب",
  "الخطوة التالية",
  "تحقق بشري",
  "Priorité principale",
  "Pourquoi",
  "Prochaine étape",
  "Vérification humaine"
];

function selectedLanguage() {
  return document.getElementById("language").value || "en-US";
}

async function getJson(url, options) {
  const response = await fetch(url, options);
  if (!response.ok) {
    throw new Error(`Request failed: ${response.status}`);
  }
  return response.json();
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatNumber(value, digits = 0) {
  return Number(value || 0).toLocaleString(undefined, {
    maximumFractionDigits: digits
  });
}

function animateCount(el, target, digits = 0) {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    el.textContent = formatNumber(target, digits);
    return;
  }
  const start = 0;
  const duration = 800;
  const startTime = performance.now();
  function tick(now) {
    const t = Math.min(1, (now - startTime) / duration);
    const eased = 1 - (1 - t) ** 3;
    const current = start + (target - start) * eased;
    el.textContent = formatNumber(current, digits);
    if (t < 1) requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
}

function setStatus(ok, text, modelText = "Backend") {
  document.getElementById("statusDot").classList.toggle("online", ok);
  document.getElementById("statusDot").classList.toggle("offline", !ok);
  document.getElementById("systemStatus").textContent = text;
  document.getElementById("modelStatus").textContent = modelText;
}

function setResponseTools(enabled) {
  document.getElementById("copyAnswer").disabled = !enabled;
  document.getElementById("copyBrief").disabled = !enabled;
  document.getElementById("speakAnswer").disabled =
    !enabled || (!state.voiceConfigured && !("speechSynthesis" in window));
}

function stripMarkdown(value) {
  return String(value ?? "")
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/`([^`]*)`/g, "$1")
    .replace(/^\s*[-*]\s+/gm, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function renderAnswer(value) {
  const rawLines = String(value ?? "").split(/\n+/).map((line) => line.trim()).filter(Boolean);
  if (!rawLines.length) return "<p>No response yet.</p>";
  const html = [];
  let listOpen = false;

  function closeList() {
    if (listOpen) {
      html.push("</ul>");
      listOpen = false;
    }
  }

  rawLines.forEach((rawLine) => {
    let line = rawLine
      .replace(/\*\*(.*?)\*\*/g, "$1")
      .replace(/`([^`]*)`/g, "$1")
      .replace(/^#+\s*/, "")
      .trim();
    const bullet = line.match(/^[-*]\s+(.*)$/);
    if (bullet) {
      if (!listOpen) {
        html.push("<ul>");
        listOpen = true;
      }
      html.push(`<li>${escapeHtml(bullet[1])}</li>`);
      return;
    }
    closeList();
    const labeled = parseLabeledLine(line);
    if (labeled) {
      html.push(`<h4>${escapeHtml(labeled.label)}</h4>`);
      if (labeled.rest) html.push(`<p>${escapeHtml(labeled.rest)}</p>`);
    } else {
      html.push(`<p>${escapeHtml(line)}</p>`);
    }
  });
  closeList();
  return html.join("");
}

function parseLabeledLine(line) {
  const normalized = line.replace(/\s+/g, " ").trim();
  const folded = normalized.toLocaleLowerCase();
  for (const label of answerSectionLabels) {
    const labelFolded = label.toLocaleLowerCase();
    if (folded === labelFolded) {
      return { label, rest: "" };
    }
    if (folded.startsWith(`${labelFolded}:`)) {
      return {
        label: normalized.slice(0, label.length),
        rest: normalized.slice(label.length + 1).trim()
      };
    }
  }
  return null;
}

function setTranscript(query, answerText, kickerText) {
  document.getElementById("inputTranscript").textContent = query || "No prompt yet.";
  document.getElementById("answer").innerHTML = renderAnswer(answerText);
  const kicker = document.getElementById("answerKicker");
  if (kicker) kicker.textContent = kickerText;
}

function stopOutputAudio() {
  if (state.currentAudio) {
    state.currentAudio.pause();
    state.currentAudio.currentTime = 0;
    state.currentAudio = null;
  }
  if (state.currentAudioUrl) {
    URL.revokeObjectURL(state.currentAudioUrl);
    state.currentAudioUrl = null;
  }
  if ("speechSynthesis" in window) {
    window.speechSynthesis.cancel();
  }
}

async function speakText(text) {
  const cleanText = stripMarkdown(text);
  if (!cleanText) return;
  stopOutputAudio();

  if (state.voiceConfigured) {
    try {
      const response = await fetch("/api/voice/speak", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: cleanText, language: selectedLanguage() })
      });
      if (response.ok) {
        const blob = await response.blob();
        const audioUrl = URL.createObjectURL(blob);
        const audio = new Audio(audioUrl);
        state.currentAudio = audio;
        state.currentAudioUrl = audioUrl;
        audio.addEventListener(
          "ended",
          () => {
            if (state.currentAudio === audio) state.currentAudio = null;
            if (state.currentAudioUrl === audioUrl) {
              URL.revokeObjectURL(audioUrl);
              state.currentAudioUrl = null;
            }
          },
          { once: true }
        );
        await audio.play();
        return;
      }
    } catch {
      // Browser speech fallback below.
    }
  }

  if (!("speechSynthesis" in window) || !("SpeechSynthesisUtterance" in window)) return;
  const utterance = new SpeechSynthesisUtterance(cleanText);
  utterance.lang = selectedLanguage();
  utterance.rate = 0.98;
  utterance.pitch = 1;
  window.speechSynthesis.speak(utterance);
}

async function copyText(text, label) {
  if (!text) return;
  const status = document.getElementById("copyStatus");
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
    } else {
      const textarea = document.createElement("textarea");
      textarea.value = text;
      textarea.setAttribute("readonly", "");
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
    }
    status.textContent = `${label} copied.`;
  } catch {
    status.textContent = "Copy failed.";
  }
}

function citationText(citation) {
  if (!citation || typeof citation !== "object") return String(citation ?? "");
  return [citation.title, citation.source, citation.score !== undefined ? `score ${citation.score}` : ""]
    .filter(Boolean)
    .join(" | ");
}

function buildBrief() {
  const exchange = state.lastExchange;
  if (!exchange) return "";
  const cards = exchange.actionCards.length
    ? exchange.actionCards
        .map((item, index) =>
          [
            `${index + 1}. ${item.module}: ${item.title}`,
            `   Evidence: ${item.evidence}`,
            `   Action: ${item.recommendation}`,
            `   Human check: ${item.human_check}`
          ].join("\n")
        )
        .join("\n\n")
    : "No action cards returned.";
  const citations = exchange.citations.length
    ? exchange.citations.map((citation) => `- ${citationText(citation)}`).join("\n")
    : "No citations returned.";
  return [
    "SchoolPulse Agent Brief",
    "",
    `Model mode: ${exchange.usedLlm ? "Gemma LLM response" : "deterministic fallback response"}`,
    `Language: ${languageLabels[exchange.language] || exchange.language || "English"}`,
    "",
    `Input: ${exchange.query}`,
    "",
    `Output: ${exchange.answer}`,
    "",
    "Top Action Cards:",
    cards,
    "",
    "Citations:",
    citations
  ].join("\n");
}

function metric(label, value, unit, tone, rawValue, digits = 0) {
  return `<article class="metric ${tone}">
    <span>${escapeHtml(label)}</span>
    <strong data-count="${rawValue}" data-digits="${digits}">${escapeHtml(value)}</strong>
    <small>${escapeHtml(unit)}</small>
  </article>`;
}

function confidenceBar(confidence) {
  const percent = Math.round(Number(confidence || 0) * 100);
  return `<div class="confidence" aria-label="Confidence ${percent}%">
    <span style="width: ${Math.max(5, Math.min(100, percent))}%"></span>
  </div>`;
}

function actionCard(item) {
  const tone = moduleTone[item.module] || "tone-default";
  return `<article class="action-card ${tone}">
    <div class="card-top">
      <span>${escapeHtml(item.module)}</span>
      <strong>${escapeHtml(item.priority)}</strong>
    </div>
    <h3>${escapeHtml(item.title)}</h3>
    <dl>
      <div>
        <dt>Location</dt>
        <dd>${escapeHtml(item.location)}</dd>
      </div>
      <div>
        <dt>Evidence</dt>
        <dd>${escapeHtml(item.evidence)}</dd>
      </div>
    </dl>
    <p>${escapeHtml(item.recommendation)}</p>
    <p class="impact">${escapeHtml(item.estimated_impact)}</p>
    ${confidenceBar(item.confidence)}
    <div class="human-check-badge" role="note">Verify: ${escapeHtml(item.human_check)}</div>
  </article>`;
}

function table(headers, rows, emptyText, highlightFn) {
  if (!rows.length) {
    return `<div class="empty-state">${escapeHtml(emptyText)}</div>`;
  }
  return `<table>
    <thead>
      <tr>${headers.map((header) => `<th>${escapeHtml(header.label)}</th>`).join("")}</tr>
    </thead>
    <tbody>
      ${rows
        .map((row) => {
          const hl = highlightFn && highlightFn(row) ? ' class="highlight-row"' : "";
          return `<tr${hl}>${headers.map((header) => `<td>${escapeHtml(header.value(row))}</td>`).join("")}</tr>`;
        })
        .join("")}
    </tbody>
  </table>`;
}

function normalizeZone(text) {
  const raw = String(text || "").trim();
  if (!raw) return null;
  const lower = raw.toLowerCase();
  if (lower.includes("a-wing") || lower.startsWith("a wing")) return "A-Wing";
  if (lower.includes("b-wing") || lower.startsWith("b wing") || lower.includes("b-wing bathroom")) return "B-Wing";
  if (lower.includes("cafeteria")) return "Cafeteria";
  if (lower.includes("gym")) return "Gym";
  if (lower.includes("auditorium")) return "Auditorium";
  if (lower.includes("science")) return "Science Lab";
  if (lower.includes("library")) return "Library";
  if (lower.includes("main")) return "Main";
  return null;
}

function severityScore(priority, confidence) {
  const pri = priority === "high" ? 3 : priority === "medium" ? 2 : 1;
  return pri * 10 + Number(confidence || 0) * 10;
}

function buildMapNodes(modules, overview) {
  const nodes = new Map();

  function upsert(zone, module, label, priority, confidence, panelId) {
    if (!zone || !CAMPUS_ZONES[zone]) return;
    const score = severityScore(priority, confidence);
    const existing = nodes.get(zone);
    if (!existing || score > existing.score) {
      nodes.set(zone, { zone, module, label, priority, confidence, panelId, score });
    }
  }

  (overview?.top_action_cards || []).forEach((card) => {
    const zone = normalizeZone(card.location);
    upsert(zone, card.module, card.title, card.priority, card.confidence, panelByModule[card.module]);
  });

  (modules.energy?.rows || []).forEach((row) => {
    const zone = normalizeZone(row.zone);
    upsert(zone, "Energy", "Energy spike", "high", 0.85, "energyPanel");
  });

  (modules.water?.rows || []).forEach((row) => {
    const zone = normalizeZone(row.location);
    upsert(zone, "Water", "Water alert", "high", row.confidence, "waterPanel");
  });

  (modules.waste?.rows || []).forEach((row) => {
    const zone = normalizeZone(row.source || row.location);
    upsert(zone, "Waste", "Low-confidence sort", "medium", row.confidence, "wastePanel");
  });

  (modules.events?.rows || []).forEach((row) => {
    const zone = normalizeZone(row.rooms);
    upsert(zone, "Events", row.name || "Event", "medium", 0.7, "eventsPanel");
  });

  return Array.from(nodes.values());
}

function renderFootprintMap() {
  const container = document.getElementById("footprintMap");
  const nodes = buildMapNodes(state.modules, state.overview);
  document.getElementById("mapNodeCount").textContent =
    nodes.length ? `${nodes.length} alert${nodes.length === 1 ? "" : "s"}` : "All clear";

  const zoneRects = Object.entries(CAMPUS_ZONES)
    .map(
      ([id, z]) =>
        `<rect class="map-zone" data-zone="${id}" x="${z.x}" y="${z.y}" width="${z.w}" height="${z.h}" rx="6" />
         <text class="map-zone-label" x="${z.x + z.w / 2}" y="${z.y + z.h / 2}" text-anchor="middle" dominant-baseline="middle">${escapeHtml(z.label)}</text>`
    )
    .join("");

  const nodeMarkers = nodes
    .map((node) => {
      const z = CAMPUS_ZONES[node.zone];
      const cx = z.x + z.w / 2;
      const cy = z.y + 18;
      const color = moduleColors[node.module] || "#16a34a";
      return `<g class="map-node" tabindex="0" role="button" aria-label="${escapeHtml(node.module)} alert in ${escapeHtml(node.zone)}: ${escapeHtml(node.label)}"
        data-zone="${escapeHtml(node.zone)}" data-panel="${escapeHtml(node.panelId)}">
        <circle cx="${cx}" cy="${cy}" r="8" fill="${color}" />
        <text class="map-node-label" x="${cx}" y="${cy + 20}" text-anchor="middle">${escapeHtml(node.module)}</text>
      </g>`;
    })
    .join("");

  const emptyOverlay = nodes.length ? "" : '<div class="map-empty">No active alerts</div>';

  container.innerHTML = `${emptyOverlay}<svg viewBox="0 0 480 380" xmlns="http://www.w3.org/2000/svg" aria-hidden="${nodes.length ? "true" : "false"}">
    <rect width="480" height="380" fill="#fafafa" />
    ${zoneRects}
    ${nodeMarkers}
  </svg>`;

  container.querySelectorAll(".map-node").forEach((el) => {
    const activate = () => {
      const panelId = el.dataset.panel;
      const zone = el.dataset.zone;
      state.highlightZone = zone;
      switchPanel(panelId);
      renderEnergy(state.modules.energy);
      renderWater(state.modules.water);
      renderWaste(state.modules.waste);
      renderEvents(state.modules.events);
      document.getElementById(panelId)?.scrollIntoView({ behavior: "smooth", block: "start" });
    };
    el.addEventListener("click", activate);
    el.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        activate();
      }
    });
  });
}

function rowMatchesZone(row, zone) {
  if (!state.highlightZone || !zone) return false;
  const fields = [row.zone, row.location, row.source, row.rooms].filter(Boolean);
  return fields.some((f) => normalizeZone(f) === state.highlightZone);
}

function switchPanel(panelId) {
  document.querySelectorAll(".nav-link").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.panel === panelId);
  });
  document.querySelectorAll(".panel").forEach((panel) => {
    if (panelId === "overviewPanel") {
      panel.classList.remove("active-panel");
    } else {
      panel.classList.toggle("active-panel", panel.id === panelId);
    }
  });
  if (panelId === "overviewPanel") {
    document.querySelector(".hero")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }
}

function renderOverview() {
  const totals = state.overview.impact_totals;
  document.getElementById("missionText").textContent = state.overview.mission || "";
  document.getElementById("metrics").innerHTML = [
    metric("Energy", formatNumber(totals.estimated_wasted_kwh, 1), "kWh wasted", "metric-energy", totals.estimated_wasted_kwh, 1),
    metric("Water", formatNumber(totals.open_water_gallons_at_risk, 1), "gal at risk", "metric-water", totals.open_water_gallons_at_risk, 1),
    metric("Waste", formatNumber(totals.food_waste_lbs_logged, 1), "lbs logged", "metric-waste", totals.food_waste_lbs_logged, 1),
    metric("Events", formatNumber(totals.events_analyzed), "tracked", "metric-events", totals.events_analyzed, 0)
  ].join("");

  document.querySelectorAll("[data-count]").forEach((el) => {
    animateCount(el, Number(el.dataset.count), Number(el.dataset.digits || 0));
  });

  const cards = state.overview.top_action_cards || [];
  document.getElementById("cardCount").textContent = `${cards.length} item${cards.length === 1 ? "" : "s"}`;
  document.getElementById("cards").innerHTML = cards.map(actionCard).join("");
  renderFootprintMap();
}

function renderEnergy(data) {
  document.getElementById("energyTotal").textContent = `${formatNumber(data.estimated_wasted_kwh, 1)} kWh`;
  document.getElementById("energyTable").innerHTML = table(
    [
      { label: "Zone", value: (row) => row.zone },
      { label: "Actual", value: (row) => `${Number(row.actual_kwh).toFixed(1)} kWh` },
      { label: "Expected", value: (row) => `${Number(row.expected_kwh).toFixed(1)} kWh` },
      { label: "Reason", value: (row) => row.waste_reason || "anomaly" },
      { label: "Time", value: (row) => new Date(row.timestamp).toLocaleString() }
    ],
    data.rows || [],
    "No energy anomalies.",
    (row) => rowMatchesZone(row)
  );
}

function renderWater(data) {
  const live = data.live_sensor;
  document.getElementById("waterTotal").textContent = live
    ? `${formatNumber(live.fill_percent, 1)}% full`
    : `${formatNumber(data.open_gallons_at_risk, 1)} gal`;
  document.getElementById("waterLiveCard").innerHTML = live
    ? `<article class="live-strip">
        <span class="output-label">Tank level</span>
        <strong>${formatNumber(live.fill_percent, 1)}%</strong>
        <p class="live-meta">${escapeHtml(live.location)} · ${live.is_live ? "Live" : "Waiting"}</p>
        <div class="live-stats">
          <div><span>Status</span><strong class="status-${escapeHtml(String(live.status).toLowerCase())}">${escapeHtml(live.status)}</strong></div>
          <div><span>Distance</span><strong>${formatNumber(live.distance_cm, 2)} cm</strong></div>
          <div><span>Depth</span><strong>${formatNumber(live.fill_depth_cm, 2)} cm</strong></div>
          <div><span>Confidence</span><strong>${Math.round(Number(live.confidence) * 100)}%</strong></div>
        </div>
      </article>`
    : `<div class="empty-state">No live sensor data yet.</div>`;
  document.getElementById("waterLiveTable").innerHTML = table(
    [
      { label: "Time", value: (row) => new Date(row.recorded_at).toLocaleTimeString() },
      { label: "Fill", value: (row) => `${formatNumber(row.fill_percent, 1)}%` },
      { label: "Distance", value: (row) => `${formatNumber(row.distance_cm, 2)} cm` },
      { label: "Spread", value: (row) => `${formatNumber(row.spread_cm || 0, 2)} cm` },
      { label: "Status", value: (row) => row.status }
    ],
    data.live_history || [],
    "No live ultrasonic readings yet."
  );
  document.getElementById("waterTable").innerHTML = table(
    [
      { label: "Location", value: (row) => row.location },
      { label: "Duration", value: (row) => `${row.duration_min} min` },
      { label: "Gallons", value: (row) => Number(row.estimated_gallons).toFixed(1) },
      { label: "Confidence", value: (row) => `${Math.round(Number(row.confidence) * 100)}%` },
      { label: "Status", value: (row) => row.status }
    ],
    data.rows || [],
    "No open water alerts.",
    (row) => rowMatchesZone(row)
  );
}

function renderWaste(data) {
  document.getElementById("wasteTotal").textContent = `${formatNumber(data.food_waste_lbs, 1)} lb`;
  document.getElementById("wasteTable").innerHTML = table(
    [
      { label: "Item", value: (row) => row.item },
      { label: "Category", value: (row) => row.category },
      { label: "Source", value: (row) => row.source },
      { label: "Weight", value: (row) => `${Number(row.weight_lbs).toFixed(2)} lb` },
      { label: "Confidence", value: (row) => `${Math.round(Number(row.confidence) * 100)}%` }
    ],
    data.rows || [],
    "No waste items need review.",
    (row) => rowMatchesZone(row)
  );
}

function renderEvents(data) {
  document.getElementById("eventsTotal").textContent = `${formatNumber(data.events_analyzed)} events`;
  document.getElementById("eventsTable").innerHTML = table(
    [
      { label: "Event", value: (row) => row.name },
      { label: "Type", value: (row) => row.category },
      { label: "Room", value: (row) => row.rooms },
      { label: "Attendance", value: (row) => `${row.actual_attendance}/${row.expected_attendance}` },
      { label: "Food waste", value: (row) => `${Number(row.food_waste_lbs).toFixed(1)} lb` }
    ],
    data.rows || [],
    "No event history loaded.",
    (row) => rowMatchesZone(row)
  );
}

function renderForecast(data) {
  document.getElementById("forecastCard").innerHTML = `<article class="forecast-box">
    <span>Servings</span>
    <strong>${formatNumber(data.recommended_servings)}</strong>
    <p>${escapeHtml(data.energy_note)}</p>
    <p>${escapeHtml(data.waste_note)}</p>
    <small>${escapeHtml(data.human_check)}</small>
  </article>`;
}

async function loadAll() {
  try {
    setStatus(false, "Loading", "Connecting");
    const [overview, energy, water, waste, events, voiceStatus] = await Promise.all([
      getJson("/api/overview"),
      getJson("/api/energy"),
      getJson("/api/water"),
      getJson("/api/waste"),
      getJson("/api/events"),
      getJson("/api/voice/status").catch(() => ({ configured: false }))
    ]);
    state.voiceConfigured = Boolean(voiceStatus.configured);
    state.overview = overview;
    state.modules = { energy, water, waste, events };
    renderOverview();
    renderEnergy(energy);
    renderWater(water);
    renderWaste(waste);
    renderEvents(events);
    await forecastEvent();
    setStatus(true, "Online", state.voiceConfigured ? "Voice on" : "Ready");
    setResponseTools(Boolean(state.lastExchange));
  } catch (error) {
    setStatus(false, "Offline", "Check API");
    setTranscript("System check", error.message, "Error");
  }
}

async function refreshWaterOnly() {
  try {
    const water = await getJson("/api/water");
    state.modules.water = water;
    renderWater(water);
    renderFootprintMap();
  } catch (error) {
    console.warn("Water refresh failed", error);
  }
}

async function askAgent() {
  const query = document.getElementById("query").value.trim();
  if (!query) return;
  stopOutputAudio();
  const askButton = document.getElementById("ask");
  askButton.disabled = true;
  document.getElementById("copyStatus").textContent = "";
  setResponseTools(false);
  setTranscript(query, "Reading logs and retrieved context...", "Thinking");
  const language = selectedLanguage();
  try {
    const data = await getJson("/api/agent/query", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query, language, voice_mode: true })
    });
    state.lastExchange = {
      query,
      language,
      answer: data.answer,
      usedLlm: data.used_llm,
      actionCards: data.action_cards || [],
      citations: data.citations || []
    };
    setTranscript(query, data.answer, data.used_llm ? "Gemma response" : "Fallback response");
    setResponseTools(true);
    if (document.getElementById("autoSpeak").checked) {
      speakText(data.answer);
    }
    if (data.action_cards && data.action_cards.length) {
      document.getElementById("cards").innerHTML = data.action_cards.map(actionCard).join("");
      document.getElementById("cardCount").textContent = `${data.action_cards.length} item${data.action_cards.length === 1 ? "" : "s"}`;
    }
  } catch (error) {
    state.lastExchange = null;
    setTranscript(query, error.message, "Error");
  } finally {
    askButton.disabled = false;
  }
}

async function forecastEvent() {
  const eventType = document.getElementById("eventType").value;
  const attendance = document.getElementById("attendance").value;
  const duration = document.getElementById("duration").value;
  const data = await getJson(
    `/api/event-plan?event_type=${encodeURIComponent(eventType)}&expected_attendance=${encodeURIComponent(attendance)}&duration_hr=${encodeURIComponent(duration)}`
  );
  renderForecast(data);
}

function setupTabs() {
  document.querySelectorAll(".nav-link").forEach((button) => {
    button.addEventListener("click", () => {
      state.highlightZone = null;
      const panelId = button.dataset.panel;
      switchPanel(panelId);
      if (panelId !== "overviewPanel") {
        renderEnergy(state.modules.energy);
        renderWater(state.modules.water);
        renderWaste(state.modules.waste);
        renderEvents(state.modules.events);
        document.getElementById(panelId)?.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    });
  });
}

function setupAutoRefresh() {
  window.setInterval(refreshWaterOnly, 4000);
}

function setupVoice() {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  const voiceButton = document.getElementById("voice");

  function setVoiceButton(label, hint, listening = false) {
    document.getElementById("voiceLabel").textContent = label;
    document.getElementById("voiceHint").textContent = hint;
    voiceButton.classList.toggle("listening", listening);
  }

  const recognition = SpeechRecognition ? new SpeechRecognition() : null;
  if (recognition) {
    recognition.lang = selectedLanguage();
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    recognition.addEventListener("start", () => {
      state.listening = true;
      setVoiceButton("Listening", "Listening…", true);
    });
    recognition.addEventListener("result", (event) => {
      const transcript = event.results[0][0].transcript;
      document.getElementById("query").value = transcript;
      setTranscript(transcript, "Voice captured. Sending prompt to Pulse Agent...", "Voice input");
      askAgent();
    });
    recognition.addEventListener("error", (event) => {
      state.listening = false;
      setVoiceButton("Speak", "Tap the mic or type a question");
      const message =
        event.error === "not-allowed"
          ? "Microphone access is blocked. Allow mic access and try again."
          : "Voice input did not come through. Try again or type your question.";
      setTranscript("Voice input", message, "Error");
    });
    recognition.addEventListener("end", () => {
      state.listening = false;
      setVoiceButton("Speak", "Tap the mic or type a question");
    });
    state.recognition = recognition;
  }

  function startBrowserSpeech() {
    if (!recognition) {
      setTranscript("Voice input", "Voice input is unavailable in this browser.", "Error");
      return;
    }
    stopOutputAudio();
    recognition.lang = selectedLanguage();
    setTranscript("Listening...", "Speak your prompt clearly. Pulse Agent will answer here.", "Voice input");
    recognition.start();
  }

  if (!SpeechRecognition) {
    voiceButton.disabled = true;
    setVoiceButton("No voice", "Type your question");
    return;
  }

  voiceButton.addEventListener("click", () => {
    if (state.listening) {
      recognition.stop();
      return;
    }
    startBrowserSpeech();
  });
}

function setupEvents() {
  document.getElementById("refresh").addEventListener("click", loadAll);
  document.getElementById("ask").addEventListener("click", askAgent);
  document.getElementById("query").addEventListener("input", stopOutputAudio);
  document.getElementById("query").addEventListener("keydown", (event) => {
    if (event.key === "Enter") askAgent();
  });
  document.querySelectorAll(".chip").forEach((button) => {
    button.addEventListener("click", () => {
      document.getElementById("query").value = button.textContent;
      askAgent();
    });
  });
  document.getElementById("eventPlanner").addEventListener("submit", (event) => {
    event.preventDefault();
    forecastEvent();
  });
  document.getElementById("copyAnswer").addEventListener("click", () => {
    copyText(state.lastExchange?.answer || "", "Answer");
  });
  document.getElementById("copyBrief").addEventListener("click", () => {
    copyText(buildBrief(), "Brief");
  });
  document.getElementById("speakAnswer").addEventListener("click", () => {
    speakText(state.lastExchange?.answer || "");
  });
}

document.addEventListener("DOMContentLoaded", () => {
  setupTabs();
  setupAutoRefresh();
  setupVoice();
  setupEvents();
  loadAll();
});
