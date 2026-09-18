const MARK_CLASS = ["", "whip", "rosary", "heart"];
const MARK_CHAR = [".", "W", "R", "H"];
const PARTNER_CLASS = ["none", "sypha", "grant", "alucard"];
const PARTNER_ABBR = ["none", "Sypha", "Grant", "Alucard"];
const PARTNER_COLOR = ["#8b93a1", "#4fa8e0", "#e0a13c", "#b06bd6"];
const MODE_NAME = ["Normal", "Hard"];

const SAVE_POINTS = [
  "1-1 Warakiya Village - Skull Knight",
  "2-1 Clock Tower of Untimely Death (climb up) - Nasty Grant",
  "2-4 Clock Tower of Untimely Death (climb down to the Forest of Darkness)",
  "3-0 Forest of Darkness (from the Warakiya Village) - Cyclops plus Sypha or Murky Marsh",
  "3-1 Forest of Darkness (from the Clock Tower) - Cyclops plus Sypha or Murky Marsh",
  "4-A Haunted Ship of Fools - Snake Man Sentinel and Death Fire (Mummies and Cyclops)",
  "5-A Tower of Terror - Frankenstein's Monster",
  "6-A Causeway of Chaos - Water Dragons",
  "4-1 Murky Marsh of Morbid Morons - Giant Bat",
  "5-1 Caves (entering) - Alucard",
  "5-6 Caves (escaping) - Skull Knight King or Sunken City",
  "6-1 Sunken City of Poltergeists - Bone Dragon King",
  "6-1 Castle Basement - Frankenstein's Monster",
  "7-1 Morbid Mountains - Giant Bat and Death Fire King (Mummies, Cyclops, and Leviathan)",
  "7-A Rampart and Lookout Tower - Death Fire King (Mummies, Cyclops, and Leviathan)",
  "8-1 Castle Entrance - Grim Reaper",
  "9-1 Villa and Waterfalls - Doppelganger",
  "A-1 Clock Tower and Castle Keep - Dracula",
];
const BLOCKS = ["1-1","2-1","2-4","3-0","3-1","4-A","5-A","6-A","4-1","5-1","5-6","6-1","6-1","7-1","7-A","8-1","9-1","A-1"];

const ATLAS_GROUPS = [
  { mode: 0, names: ["", "B", "C", "D", "E", "F", "G", "H", "HELP ME", "OKUDA", "URATA", "FUJIMOTO"] },
  { mode: 1, names: ["", "B", "C", "D", "E", "F", "G", "H", "HELP ME", "AKAMA", "AKAMA", "OKUDA", "URATA", "FUJIMOTO"] },
];

const PAGE_SIZE = 48;

const state = {
  entries: [],
  lookup: new Map(),
  filtered: [],
  page: 0,
  query: "",
  mode: "",
  partner: "",
  savePoint: "",
  name: null,
  tab: "passwords",
  atlasCells: [],
};

const els = {
  search: document.getElementById("search"),
  clearSearch: document.getElementById("clearSearch"),
  fMode: document.getElementById("fMode"),
  fPartner: document.getElementById("fPartner"),
  fSavePoint: document.getElementById("fSavePoint"),
  fName: document.getElementById("fName"),
  resetBtn: document.getElementById("resetBtn"),
  randomBtn: document.getElementById("randomBtn"),
  results: document.getElementById("results"),
  pageInfo: document.getElementById("pageInfo"),
  prevPage: document.getElementById("prevPage"),
  nextPage: document.getElementById("nextPage"),
  atlas: document.getElementById("atlas"),
  tooltip: document.getElementById("tooltip"),
  modal: document.getElementById("modal"),
  modalBody: document.getElementById("modalBody"),
  statCount: document.getElementById("statCount"),
  statName: document.getElementById("statName"),
  statPartner: document.getElementById("statPartner"),
  statSave: document.getElementById("statSave"),
  heroCount: document.getElementById("heroCount"),
};

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const displayName = (n) => (n === "" ? "(blank)" : n);
const keyOf = (e) => `${e.name}|${e.mode}|${e.toggleMaskIndex}|${e.partner}|${e.savePoint}`;

function matrixHTML(matrix, cls) {
  let html = `<div class="matrix ${cls}">`;
  for (let r = 0; r < 4; r++) {
    for (let c = 0; c < 4; c++) {
      const mark = matrix[r][c];
      html += `<div class="cell${mark ? " " + MARK_CLASS[mark] : ""}"></div>`;
    }
  }
  return html + "</div>";
}

function markCount(password) {
  let n = 0;
  for (const ch of password) if (ch !== ".") n++;
  return n;
}

function matches(e) {
  if (state.mode !== "" && e.mode !== +state.mode) return false;
  if (state.partner !== "" && e.partner !== +state.partner) return false;
  if (state.savePoint !== "" && e.savePoint !== +state.savePoint) return false;
  if (state.name !== null && e.name !== state.name) return false;
  if (state.query) {
    const q = state.query.toLowerCase();
    const hay = `${displayName(e.name)} ${e.name} ${e.block} ${e.savePointLabel} ${e.partnerName} ${e.modeName} ${e.password} ${e.nameHash}`.toLowerCase();
    if (!q.split(/\s+/).every((tok) => hay.includes(tok))) return false;
  }
  return true;
}

function applyFilters(updateUrl = true) {
  state.filtered = state.entries.filter(matches);
  state.page = 0;
  renderSummary();
  renderResults();
  if (state.tab === "atlas") drawAtlas();
  if (state.tab === "stats") renderStats();
  if (updateUrl) syncUrl();
}

function renderSummary() {
  const n = state.filtered.length;
  els.statCount.textContent = n.toLocaleString();
  els.statName.textContent = state.name === null ? "all" : displayName(state.name);
  els.statPartner.textContent = state.partner === "" ? "all" : PARTNER_ABBR[+state.partner];
  els.statSave.textContent = state.savePoint === "" ? "all" : BLOCKS[+state.savePoint];
  els.search.parentElement.classList.toggle("has-query", !!state.query);
}

function renderResults() {
  const total = state.filtered.length;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  state.page = Math.min(state.page, pages - 1);
  const start = state.page * PAGE_SIZE;
  const slice = state.filtered.slice(start, start + PAGE_SIZE);

  if (!total) {
    els.results.innerHTML = `<div class="empty" style="grid-column:1/-1"><b>No passwords found</b>Try a different name, block, partner, mode or password fragment.</div>`;
    els.pageInfo.textContent = "";
    els.prevPage.disabled = els.nextPage.disabled = true;
    return;
  }

  els.results.innerHTML = slice
    .map(
      (e) => `
    <button class="result" data-id="${e.id}">
      ${matrixHTML(e.matrix, "mini")}
      <div class="meta">
        <b>${esc(displayName(e.name))} &middot; <span style="color:${PARTNER_COLOR[e.partner]}">${esc(PARTNER_ABBR[e.partner])}</span></b>
        <i>${esc(e.block)} &middot; ${esc(e.modeName)} mode &middot; ${e.toggleMaskIndex ? "toggle B" : "toggle A"}</i>
        <div class="pw">${esc(e.password)}</div>
      </div>
    </button>`
    )
    .join("");

  els.pageInfo.textContent = `Page ${state.page + 1} of ${pages} · ${total.toLocaleString()} results`;
  els.prevPage.disabled = state.page === 0;
  els.nextPage.disabled = state.page >= pages - 1;
}

function renderStats() {
  const data = state.filtered;
  renderBars("chartSavePoint", BLOCKS.map((b, i) => ({ label: b, value: data.filter((e) => e.savePoint === i).length })));
  renderBars("chartPartner", PARTNER_ABBR.map((p, i) => ({ label: p, value: data.filter((e) => e.partner === i).length, color: PARTNER_COLOR[i] })));
  renderBars("chartMode", MODE_NAME.map((m, i) => ({ label: m, value: data.filter((e) => e.mode === i).length })));

  const hist = new Map();
  for (const e of data) {
    const n = markCount(e.password);
    hist.set(n, (hist.get(n) || 0) + 1);
  }
  const marks = [...hist.keys()].sort((a, b) => a - b).map((n) => ({ label: `${n} mark${n === 1 ? "" : "s"}`, value: hist.get(n) }));
  renderBars("chartMarks", marks);
}

function renderBars(id, rows) {
  const el = document.getElementById(id);
  const max = Math.max(1, ...rows.map((r) => r.value));
  el.innerHTML = rows
    .map(
      (r) => `
    <div class="bar-row">
      <span class="label" title="${esc(r.label)}">${esc(r.label)}</span>
      <span class="track"><span class="fill" style="width:${(r.value / max) * 100}%${r.color ? `;background:${r.color}` : ""}"></span></span>
      <span class="value">${r.value.toLocaleString()}</span>
    </div>`
    )
    .join("");
}

let atlasGeo = { labelW: 210, cellW: 50, cellH: 20, headerH: 34, pad: 10 };

function buildAtlasRows() {
  const rows = [];
  for (const group of ATLAS_GROUPS) {
    for (const name of group.names) {
      for (let toggle = 0; toggle < 2; toggle++) {
        for (let partner = 0; partner < 4; partner++) {
          rows.push({ name, mode: group.mode, toggle, partner, newGroup: toggle === 0 && partner === 0 });
        }
      }
    }
  }
  return rows;
}

const atlasRows = buildAtlasRows();

function drawAtlas() {
  const canvas = els.atlas;
  const ctx = canvas.getContext("2d");
  const dpr = window.devicePixelRatio || 1;
  const { labelW, cellW, cellH, headerH, pad } = atlasGeo;
  const cols = SAVE_POINTS.length;
  const cssW = labelW + cols * cellW + pad;
  const cssH = headerH + atlasRows.length * cellH + pad;
  canvas.width = Math.ceil(cssW * dpr);
  canvas.height = Math.ceil(cssH * dpr);
  canvas.style.width = cssW + "px";
  canvas.style.height = cssH + "px";
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  ctx.fillStyle = "#0b0712";
  ctx.fillRect(0, 0, cssW, cssH);

  ctx.font = "600 11px Inter, sans-serif";
  ctx.textBaseline = "middle";
  ctx.textAlign = "center";
  ctx.fillStyle = "#9c90ad";
  for (let c = 0; c < cols; c++) {
    ctx.fillText(BLOCKS[c], labelW + c * cellW + cellW / 2, headerH / 2);
  }

  const matchSet = state.filtered.length === state.entries.length ? null : new Set(state.filtered.map((e) => e.id));
  state.atlasCells = new Array(atlasRows.length * cols).fill(null);
  const geo = { x0: labelW, y0: headerH, cellW, cellH, cols };

  atlasRows.forEach((row, ri) => {
    const y = headerH + ri * cellH;

    if (row.newGroup) {
      ctx.fillStyle = "#170f24";
      ctx.fillRect(0, y, cssW, cellH * 2);
      ctx.strokeStyle = "#3a2c57";
      ctx.beginPath();
      ctx.moveTo(0, y + 0.5);
      ctx.lineTo(cssW, y + 0.5);
      ctx.stroke();
    }

    const label = `${displayName(row.name)}  ·  ${PARTNER_ABBR[row.partner]}  ·  ${MODE_NAME[row.mode]}`;
    ctx.textAlign = "left";
    ctx.font = "600 11px Inter, sans-serif";
    ctx.fillStyle = row.mode === 1 ? "#e08a8a" : "#cfc6dd";
    ctx.fillText(label, 12, y + cellH / 2, labelW - 44);
    ctx.fillStyle = "#6b5f7d";
    ctx.font = "600 10px 'JetBrains Mono', monospace";
    ctx.fillText(row.toggle ? "T1" : "T0", labelW - 26, y + cellH / 2);

    for (let c = 0; c < cols; c++) {
      const entry = findEntry(row, c);
      state.atlasCells[ri * cols + c] = entry;
      const x = labelW + c * cellW;
      const pw = cellW - 3;
      const ph = cellH - 3;

      if (!entry) {
        ctx.fillStyle = "#120c1b";
        ctx.fillRect(x + 1.5, y + 1.5, pw, ph);
        continue;
      }

      const marks = markCount(entry.password);
      const alpha = 0.5 + 0.5 * (marks / 9);
      const dim = matchSet && !matchSet.has(entry.id);
      ctx.globalAlpha = dim ? 0.12 : alpha;
      ctx.fillStyle = PARTNER_COLOR[row.partner];
      roundRect(ctx, x + 1.5, y + 1.5, pw, ph, 3);
      ctx.fill();

      if (!dim) {
        ctx.globalAlpha = matchSet ? 0.85 : 0.12;
        ctx.strokeStyle = matchSet ? "#ffe6a8" : "#ffffff";
        ctx.lineWidth = 1;
        roundRect(ctx, x + 1.5, y + 1.5, pw, ph, 3);
        ctx.stroke();
      }

      if (row.toggle) {
        ctx.globalAlpha = dim ? 0.08 : 0.28;
        ctx.strokeStyle = "#0a0710";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(x + 4, y + ph);
        ctx.lineTo(x + pw, y + 4);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
    }
  });

  canvas._geo = geo;
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function findEntry(row, savePoint) {
  return state.lookup.get(`${row.name}|${row.mode}|${row.toggle}|${row.partner}|${savePoint}`) || null;
}

function atlasHit(ev) {
  const geo = els.atlas._geo;
  if (!geo) return null;
  const rect = els.atlas.getBoundingClientRect();
  const x = ev.clientX - rect.left;
  const y = ev.clientY - rect.top;
  const col = Math.floor((x - geo.x0) / geo.cellW);
  const r = Math.floor((y - geo.y0) / geo.cellH);
  if (col < 0 || col >= geo.cols || r < 0 || r >= atlasRows.length) return null;
  return { row: r, col, entry: state.atlasCells[r * geo.cols + col] };
}

function onAtlasMove(ev) {
  const hit = atlasHit(ev);
  if (!hit) {
    els.tooltip.hidden = true;
    return;
  }
  const row = atlasRows[hit.row];
  const base = `<b>${esc(displayName(row.name))}</b> &middot; <span style="color:${PARTNER_COLOR[row.partner]}">${esc(PARTNER_ABBR[row.partner])}</span><br>${esc(BLOCKS[hit.col])} &mdash; ${esc(row.mode === 1 ? "Hard" : "Normal")} mode &middot; toggle ${row.toggle ? "B" : "A"}`;
  const body = hit.entry
    ? `${base}<br><code>${esc(hit.entry.password)}</code><br><span style="color:#9c90ad">${markCount(hit.entry.password)} marks &middot; click to inspect</span>`
    : `${base}<br><span style="color:#9c90ad">No valid password at this save point.</span>`;
  els.tooltip.innerHTML = body;
  els.tooltip.hidden = false;
  const pad = 14;
  let left = ev.clientX + pad;
  let top = ev.clientY + pad;
  const tw = els.tooltip.offsetWidth;
  const th = els.tooltip.offsetHeight;
  if (left + tw > window.innerWidth - 8) left = ev.clientX - tw - pad;
  if (top + th > window.innerHeight - 8) top = ev.clientY - th - pad;
  els.tooltip.style.left = left + "px";
  els.tooltip.style.top = top + "px";
}

function onAtlasClick(ev) {
  const hit = atlasHit(ev);
  if (hit && hit.entry) openDetail(hit.entry, false);
}

function openDetail(entry, pushUrl = true) {
  const portrait = `${entry.partner === 0 ? "trevor" : PARTNER_CLASS[entry.partner]}-${entry.toggleMaskIndex}`;
  els.modalBody.innerHTML = `
    <div style="display:flex;flex-direction:column;gap:12px;align-items:center">
      ${matrixHTML(entry.matrix, "big")}
      <div class="pw" style="font-family:'JetBrains Mono',monospace;color:var(--gold-2);letter-spacing:.14em;font-size:14px">${esc(entry.password)}</div>
    </div>
    <div class="detail">
      <div style="display:flex;gap:12px;align-items:center">
        <img class="portrait" src="assets/sprites/${portrait}.png" alt="" />
        <div>
          <h2 id="modalTitle">${esc(displayName(entry.name))}</h2>
          <div class="sub">${esc(entry.block)} &middot; ${esc(entry.savePointLabel.replace(new RegExp("^" + entry.block + "\\s*"), ""))}</div>
        </div>
      </div>
      <dl class="kv">
        <dt>Partner</dt><dd style="color:${PARTNER_COLOR[entry.partner]}">${esc(entry.partnerName)}</dd>
        <dt>Mode</dt><dd>${esc(entry.modeName)}</dd>
        <dt>Save point</dt><dd>0x${entry.savePoint.toString(16).toUpperCase().padStart(2, "0")}</dd>
        <dt>Name hash</dt><dd>${entry.nameHash}</dd>
        <dt>Toggle mask</dt><dd>${entry.toggleMaskIndex ? "B (0xAA)" : "A (0x55)"}</dd>
        <dt>Marks</dt><dd>${markCount(entry.password)} / 16</dd>
      </dl>
      <div class="modal-actions">
        <button class="btn small" id="copyPw">Copy password</button>
        <button class="btn ghost small" id="copyLink">Copy link</button>
        <button class="btn ghost small" id="randomInModal">Random</button>
      </div>
    </div>`;

  els.modal.hidden = false;
  document.body.style.overflow = "hidden";

  document.getElementById("copyPw").onclick = () => copy(entry.password, "Copied password");
  document.getElementById("copyLink").onclick = () => copy(shareUrl(entry.id), "Copied link");
  document.getElementById("randomInModal").onclick = () => {
    const pool = state.filtered.length ? state.filtered : state.entries;
    const pick = pool[Math.floor(Math.random() * pool.length)];
    openDetail(pick, true);
  };

  if (pushUrl) {
    const url = new URL(location.href);
    url.searchParams.set("id", entry.id);
    history.replaceState(null, "", url);
  }
}

function closeModal() {
  els.modal.hidden = true;
  document.body.style.overflow = "";
  const url = new URL(location.href);
  url.searchParams.delete("id");
  history.replaceState(null, "", url);
}

function shareUrl(id) {
  const url = new URL(location.href);
  url.search = "";
  url.searchParams.set("id", id);
  return url.toString();
}

function copy(text, toast) {
  navigator.clipboard?.writeText(text).then(() => flash(toast));
}

function flash(msg) {
  const t = document.createElement("div");
  t.textContent = msg;
  t.style.cssText = "position:fixed;bottom:26px;left:50%;transform:translateX(-50%);background:#050308;border:1px solid var(--gold);color:var(--gold-2);padding:10px 18px;border-radius:10px;z-index:99;font-size:13px";
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 1600);
}

function syncUrl() {
  const url = new URL(location.href);
  const set = (k, v) => (v === "" || v == null ? url.searchParams.delete(k) : url.searchParams.set(k, v));
  set("q", state.query);
  set("mode", state.mode);
  set("partner", state.partner);
  set("sp", state.savePoint);
  if (state.name === null) url.searchParams.delete("name");
  else url.searchParams.set("name", state.name);
  set("tab", state.tab === "passwords" ? "" : state.tab);
  history.replaceState(null, "", url);
}

function readUrl() {
  const p = new URLSearchParams(location.search);
  state.query = p.get("q") || "";
  state.mode = p.get("mode") || "";
  state.partner = p.get("partner") || "";
  state.savePoint = p.get("sp") || "";
  state.name = p.has("name") ? p.get("name") : null;
  state.tab = p.get("tab") || "passwords";
  els.search.value = state.query;
}

function populateSelects() {
  const opt = (value, label) => `<option value="${value}">${esc(label)}</option>`;
  els.fMode.innerHTML = opt("", "All modes") + MODE_NAME.map((m, i) => opt(i, m)).join("");
  els.fPartner.innerHTML = opt("", "All partners") + PARTNER_ABBR.map((p, i) => opt(i, p)).join("");
  els.fSavePoint.innerHTML = opt("", "All save points") + SAVE_POINTS.map((s, i) => opt(i, `${BLOCKS[i]} · ${s.split(" - ")[0]}`)).join("");
  const names = [...new Set(state.entries.map((e) => e.name))].sort((a, b) => (a === "" ? -1 : b === "" ? 1 : a.localeCompare(b)));
  els.fName.innerHTML = opt("", "All names") + names.map((n) => opt(n === "" ? "__blank__" : n, displayName(n))).join("");
  els.fMode.value = state.mode;
  els.fPartner.value = state.partner;
  els.fSavePoint.value = state.savePoint;
  els.fName.value = state.name === null ? "" : state.name === "" ? "__blank__" : state.name;
}

function setTab(tab) {
  state.tab = tab;
  document.querySelectorAll(".tab").forEach((b) => b.classList.toggle("active", b.dataset.tab === tab));
  document.querySelectorAll(".panel").forEach((p) => p.classList.toggle("active", p.id === "panel-" + tab));
  if (tab === "atlas") drawAtlas();
  if (tab === "stats") renderStats();
  syncUrl();
}

function wireEvents() {
  els.search.addEventListener("input", () => {
    state.query = els.search.value.trim();
    applyFilters();
  });
  els.clearSearch.addEventListener("click", () => {
    els.search.value = "";
    state.query = "";
    applyFilters();
    els.search.focus();
  });
  els.fMode.addEventListener("change", () => { state.mode = els.fMode.value; applyFilters(); });
  els.fPartner.addEventListener("change", () => { state.partner = els.fPartner.value; applyFilters(); });
  els.fSavePoint.addEventListener("change", () => { state.savePoint = els.fSavePoint.value; applyFilters(); });
  els.fName.addEventListener("change", () => {
    const v = els.fName.value;
    state.name = v === "" ? null : v === "__blank__" ? "" : v;
    applyFilters();
  });
  els.resetBtn.addEventListener("click", () => {
    els.search.value = "";
    Object.assign(state, { query: "", mode: "", partner: "", savePoint: "", name: null });
    populateSelects();
    applyFilters();
  });
  els.randomBtn.addEventListener("click", (e) => {
    e.preventDefault();
    const pool = state.filtered.length ? state.filtered : state.entries;
    openDetail(pool[Math.floor(Math.random() * pool.length)], true);
  });
  els.prevPage.addEventListener("click", () => { state.page--; renderResults(); scrollResults(); });
  els.nextPage.addEventListener("click", () => { state.page++; renderResults(); scrollResults(); });
  els.results.addEventListener("click", (e) => {
    const btn = e.target.closest(".result");
    if (btn) openDetail(state.entries[+btn.dataset.id], true);
  });
  document.querySelectorAll(".tab").forEach((b) => b.addEventListener("click", () => setTab(b.dataset.tab)));
  els.atlas.addEventListener("mousemove", onAtlasMove);
  els.atlas.addEventListener("mouseleave", () => (els.tooltip.hidden = true));
  els.atlas.addEventListener("click", onAtlasClick);
  els.modal.addEventListener("click", (e) => { if (e.target.closest("[data-close]")) closeModal(); });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !els.modal.hidden) closeModal(); });
  window.addEventListener("resize", () => { if (state.tab === "atlas") drawAtlas(); });
}

function scrollResults() {
  document.getElementById("panel-passwords").scrollIntoView({ behavior: "smooth", block: "start" });
}

async function init() {
  try {
    const res = await fetch("data/passwords.json");
    if (!res.ok) throw new Error(res.statusText);
    const data = await res.json();
    state.entries = data.entries;
    state.lookup = new Map(state.entries.map((e) => [keyOf(e), e]));
    els.heroCount.textContent = state.entries.length.toLocaleString();

    readUrl();
    populateSelects();
    wireEvents();
    setTab(state.tab);
    applyFilters(false);

    const id = new URLSearchParams(location.search).get("id");
    if (id != null && state.entries[+id]) openDetail(state.entries[+id], false);
  } catch (err) {
    els.results.innerHTML = `<div class="empty" style="grid-column:1/-1"><b>Could not load passwords.json</b>Serve this folder over HTTP (e.g. <code>python3 -m http.server</code>) rather than opening the file directly.<br><br>${esc(err.message)}</div>`;
  }
}

init();
