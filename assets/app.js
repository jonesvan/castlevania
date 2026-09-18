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
  atlasBuilt: false,
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
  statSummary: document.getElementById("statSummary"),
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
  if (state.tab === "atlas") renderAtlas();
  if (state.tab === "stats") renderStats();
  if (updateUrl) syncUrl();
}

function renderSummary() {
  const n = state.filtered.length;
  els.statCount.textContent = n.toLocaleString();
  const parts = [];
  if (n !== state.entries.length) parts.push("filtered");
  if (state.name !== null) parts.push(displayName(state.name));
  if (state.partner !== "") parts.push(PARTNER_ABBR[+state.partner]);
  if (state.savePoint !== "") parts.push(BLOCKS[+state.savePoint]);
  if (state.mode !== "") parts.push(MODE_NAME[+state.mode]);
  els.statSummary.textContent = parts.length ? `passwords · ${parts.join(" · ")}` : "passwords";
  els.search.parentElement.classList.toggle("has-query", !!state.query);
}

function renderResults() {
  const total = state.filtered.length;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  state.page = Math.min(state.page, pages - 1);
  const start = state.page * PAGE_SIZE;
  const slice = state.filtered.slice(start, start + PAGE_SIZE);

  if (!total) {
    els.results.innerHTML = `<div class="empty"><b>No passwords found</b>Try a different name, block, partner or password fragment.</div>`;
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
        <div class="nm">${esc(displayName(e.name))} <span class="pt" style="color:${PARTNER_COLOR[e.partner]}">&middot; ${esc(PARTNER_ABBR[e.partner])}</span></div>
        <div class="row2">${esc(e.block)} &middot; ${esc(e.modeName)}</div>
        <code class="pw">${esc(e.password)}</code>
      </div>
    </button>`
    )
    .join("");

  els.pageInfo.textContent = `${state.page + 1} / ${pages}`;
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

function hexToRgba(hex, a) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
}

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

function findEntry(row, savePoint) {
  return state.lookup.get(`${row.name}|${row.mode}|${row.toggle}|${row.partner}|${savePoint}`) || null;
}

function buildAtlas() {
  const cols = SAVE_POINTS.length;

  let head = '<thead><tr><th class="corner">Name &middot; partner</th>';
  for (let c = 0; c < cols; c++) head += `<th>${BLOCKS[c]}</th>`;
  head += "</tr></thead>";

  state.atlasCells = [];
  let body = "<tbody>";
  atlasRows.forEach((row, ri) => {
    body += `<tr${row.newGroup ? ' class="group-start"' : ""} data-row="${ri}">`;
    body += `<th class="${row.mode === 1 ? "hard" : ""}"><span class="nm">${esc(displayName(row.name))}</span> <span class="pt">&middot; ${esc(PARTNER_ABBR[row.partner])}</span></th>`;
    for (let c = 0; c < cols; c++) {
      const entry = findEntry(row, c);
      state.atlasCells.push(entry);
      if (!entry) {
        body += `<td class="cell invalid" data-col="${c}"></td>`;
      } else {
        const alpha = (0.5 + 0.45 * (markCount(entry.password) / 9)).toFixed(2);
        body += `<td class="cell" data-id="${entry.id}" data-col="${c}" style="background:${hexToRgba(PARTNER_COLOR[row.partner], alpha)}"></td>`;
      }
    }
    body += "</tr>";
  });
  body += "</tbody>";

  els.atlas.innerHTML = `<table class="atlas">${head}${body}</table>`;
  state.atlasBuilt = true;
  applyAtlasFilter();
}

function applyAtlasFilter() {
  if (!state.atlasBuilt) return;
  const set = state.filtered.length === state.entries.length ? null : new Set(state.filtered.map((e) => e.id));
  for (const td of els.atlas.querySelectorAll("td.cell[data-id]")) {
    td.classList.toggle("dim", set !== null && !set.has(+td.dataset.id));
  }
}

function renderAtlas() {
  if (!state.atlasBuilt) buildAtlas();
  else applyAtlasFilter();
}

function cellContext(td) {
  const tr = td.closest("tr");
  return { row: atlasRows[+tr.dataset.row], col: +td.dataset.col };
}

function onAtlasMove(ev) {
  const td = ev.target.closest("td.cell");
  if (!td) {
    els.tooltip.hidden = true;
    return;
  }
  const { row, col } = cellContext(td);
  const entry = td.dataset.id ? state.entries[+td.dataset.id] : null;
  const base = `<b>${esc(displayName(row.name))}</b> &middot; <span style="color:${PARTNER_COLOR[row.partner]}">${esc(PARTNER_ABBR[row.partner])}</span><br>${esc(BLOCKS[col])} &middot; ${esc(MODE_NAME[row.mode])} &middot; toggle ${row.toggle ? "B" : "A"}`;
  els.tooltip.innerHTML = entry
    ? `${base}<br><code>${esc(entry.password)}</code><br><span class="muted">${markCount(entry.password)} marks &middot; click to inspect</span>`
    : `${base}<br><span class="muted">No valid password at this save point.</span>`;
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
  const td = ev.target.closest("td.cell");
  if (td && td.dataset.id) openDetail(state.entries[+td.dataset.id], false);
}

function openDetail(entry, pushUrl = true) {
  const portrait = `${entry.partner === 0 ? "trevor" : PARTNER_CLASS[entry.partner]}-${entry.toggleMaskIndex}`;
  els.modalBody.innerHTML = `
    <div class="hero-id">
      ${matrixHTML(entry.matrix, "big")}
      <div class="modal-pw">${esc(entry.password)}</div>
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
  t.style.cssText = "position:fixed;bottom:24px;left:50%;transform:translateX(-50%);background:var(--surface-2);border:1px solid var(--line-2);color:var(--text);padding:10px 16px;border-radius:10px;z-index:99;font-size:13px;box-shadow:0 10px 30px rgba(0,0,0,.5)";
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
  if (tab === "atlas") renderAtlas();
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
