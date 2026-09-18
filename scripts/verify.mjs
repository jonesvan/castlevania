import { readFile } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { TOGGLE_MASKS, hashName, isValidSavePoint } from "./cv3.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));

const SCRAMBLES = [
  [0x00, 0x33, 0x20, 0x13, 0x22, 0x01, 0x11, 0x03, 0x32],
  [0x12, 0x10, 0x02, 0x32, 0x23, 0x13, 0x30, 0x21, 0x01],
  [0x31, 0x13, 0x01, 0x22, 0x10, 0x30, 0x33, 0x03, 0x21],
];
const SELECTORS = [0x01, 0x1b, 0x02, 0x35, 0x19, 0x03, 0x37, 0x1a, 0x36];
const MARK = { ".": 0, W: 1, R: 2, H: 3 };

function parse(password) {
  const rows = [[], [], [], []];
  for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) rows[r][c] = MARK[password[r * 4 + c]];
  return rows;
}

function findScrambles(p) {
  let found = null;
  for (let i = SCRAMBLES.length - 1; i >= 0; i--) {
    const rc = SCRAMBLES[i][0];
    if (p[rc >> 4][rc & 3] !== 0) {
      if (found) throw new Error("multiple leaders");
      found = SCRAMBLES[i];
    }
  }
  if (!found) throw new Error("no leader");
  return found;
}

function findSelectorIndex(p, scrambles) {
  const rc = scrambles[0];
  const selector = (rc & 0x30) | ((rc & 3) << 2) | p[rc >> 4][rc & 3];
  let i = SELECTORS.length - 1;
  while (SELECTORS[i] !== selector && i > 0) i--;
  return i;
}

function verifyNonblanksInScrambles(p, scrambles) {
  for (let r = 0; r < 4; r++) {
    for (let c = 0; c < 4; c++) {
      if (p[r][c] !== 0) {
        const inside = scrambles.some((rc) => r === rc >> 4 && c === (rc & 3));
        if (!inside) throw new Error("stray mark");
      }
    }
  }
}

function decodeData(p, scrambles, shift) {
  let data = 0;
  for (let i = scrambles.length - 1; i > 0; i--) {
    const rc = scrambles[i];
    data = (data << 1) | ((p[rc >> 4][rc & 3] >> shift) & 1);
  }
  return data;
}

function hashPayload(payload, savePoint, toggleMaskIndex) {
  const nibbleSum = 0x0f & ((payload >> 4) + payload);
  const toggled = TOGGLE_MASKS[toggleMaskIndex] ^ payload;
  const toggledNibbleSum = 0x0f & ((toggled >> 4) + toggled);
  return 0xff & (savePoint + ((nibbleSum << 4) | toggledNibbleSum));
}

function decode(name, password) {
  const p = parse(password);
  const scrambles = findScrambles(p);
  const selectorIndex = findSelectorIndex(p, scrambles);
  verifyNonblanksInScrambles(p, scrambles);

  const state = decodeData(p, scrambles, 1);
  const nameHash = state >> 5;
  const savePoint = (selectorIndex << 1) | ((state >> 4) & 1);
  const toggleMaskIndex = (state >> 3) & 1;
  const partner = (state >> 1) & 3;
  const mode = state & 1;

  if (
    !isValidSavePoint(name, savePoint, partner, mode) ||
    hashName(name) !== nameHash ||
    hashPayload(state, savePoint, toggleMaskIndex) !== decodeData(p, scrambles, 0)
  ) {
    throw new Error("rejected");
  }

  return { name, savePoint, partner, mode, toggleMaskIndex };
}

const { entries } = JSON.parse(await readFile(resolve(__dirname, "..", "data", "passwords.json")));

let failures = 0;
for (const e of entries) {
  try {
    const d = decode(e.name, e.password);
    if (
      d.savePoint !== e.savePoint ||
      d.partner !== e.partner ||
      d.mode !== e.mode ||
      d.toggleMaskIndex !== e.toggleMaskIndex
    ) {
      throw new Error(`mismatch ${JSON.stringify(d)}`);
    }
  } catch (err) {
    failures++;
    if (failures <= 5) console.error("FAIL", e.id, e.name, e.password, err.message);
  }
}

console.log(`Round-trip decoded ${entries.length - failures}/${entries.length} passwords.`);
if (failures) process.exit(1);
