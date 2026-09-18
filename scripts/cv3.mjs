export const SAVE_POINTS = [
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

export const BLOCKS = [
  "1-1", "2-1", "2-4", "3-0", "3-1", "4-A", "5-A", "6-A",
  "4-1", "5-1", "5-6", "6-1", "6-1", "7-1", "7-A", "8-1", "9-1", "A-1",
];

export const PARTNERS = ["none", "Sypha Belnades", "Grant Danasty", "Alucard"];
export const TOGGLE_MASKS = [0x55, 0xaa];
export const MODE_NAMES = ["Normal", "Hard"];

const VALID_SAVE_POINT_BITS = [0xffffff, 0x0703ff, 0x2fffff, 0x003dff];
const SCRAMBLES = [
  [0x00, 0x33, 0x20, 0x13, 0x22, 0x01, 0x11, 0x03, 0x32],
  [0x12, 0x10, 0x02, 0x32, 0x23, 0x13, 0x30, 0x21, 0x01],
  [0x31, 0x13, 0x01, 0x22, 0x10, 0x30, 0x33, 0x03, 0x21],
];
const SELECTORS = [0x01, 0x1b, 0x02, 0x35, 0x19, 0x03, 0x37, 0x1a, 0x36];
const NAME_HASH_SEED = 28;
const MARK_NAMES = [".", "W", "R", "H"];

const VALID_SAVE_POINTS = PARTNERS.map((_, partner) =>
  SAVE_POINTS.map((__, savePoint) => (VALID_SAVE_POINT_BITS[partner] & (0x800000 >> savePoint)) !== 0)
);

const SPECIAL_NAMES = new Set(["AKAMA", "FUJIMOTO", "URATA", "OKUDA"]);

export function isSpecialName(name) {
  return SPECIAL_NAMES.has(name.replace(/\s+$/, ""));
}

export function isValidSavePoint(name, savePoint, partner, mode) {
  return mode === 1 || VALID_SAVE_POINTS[partner][savePoint] || isSpecialName(name);
}

function toTile(c) {
  if (c === " ") return 0x00;
  if (c === ".") return 0x4b;
  if (c === "!") return 0x6a;
  if (c === "?") return 0x6b;
  if (c >= "A" && c <= "Z") return c.charCodeAt(0) - 65 + 0x50;
  throw new Error(`Invalid character: ${JSON.stringify(c)}`);
}

export function hashName(name) {
  let hash = NAME_HASH_SEED;
  for (let i = 0; i < name.length; i++) hash += toTile(name[i]);
  return hash & 7;
}

export function encode(name, savePoint, partner, mode, toggleMaskIndex) {
  const password = [
    [0, 0, 0, 0],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
  ];

  const selector = SELECTORS[savePoint >> 1];
  const selectorRowCol = (0x30 & selector) | (0x03 & (selector >> 2));
  let scrambles = SCRAMBLES[0];
  for (let i = SCRAMBLES.length - 1; i >= 0; i--) {
    scrambles = SCRAMBLES[i];
    if (scrambles[0] === selectorRowCol) break;
  }

  const payload =
    (hashName(name) << 5) |
    ((savePoint & 1) << 4) |
    (toggleMaskIndex << 3) |
    (partner << 1) |
    mode;

  const nibbleSum = 0x0f & ((payload >> 4) + payload);
  const toggled = TOGGLE_MASKS[toggleMaskIndex] ^ payload;
  const toggledNibbleSum = 0x0f & ((toggled >> 4) + toggled);
  const payloadHash = 0xff & (savePoint + ((nibbleSum << 4) | toggledNibbleSum));

  for (let i = scrambles.length - 1; i >= 0; i--) {
    const row = scrambles[i] >> 4;
    const col = scrambles[i] & 0x03;
    password[row][col] =
      i === 0 ? selector & 3 : (((payload >> (i - 1)) & 1) << 1) | ((payloadHash >> (i - 1)) & 1);
  }

  return password;
}

const NAMES = [
  ["", "B", "C", "D", "E", "F", "G", "H", "HELP ME", "OKUDA", "URATA", "FUJIMOTO"],
  ["", "B", "C", "D", "E", "F", "G", "H", "HELP ME", "AKAMA", "AKAMA", "OKUDA", "URATA", "FUJIMOTO"],
];

const MODES = [
  [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  [1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 1, 1, 1, 1],
];

function passwordToString(matrix) {
  return matrix.map((row) => row.map((mark) => MARK_NAMES[mark]).join("")).join("");
}

export function buildDataset() {
  const entries = [];
  let id = 0;

  for (let i = 0; i < MODES.length; i++) {
    for (let j = 0; j < NAMES[i].length; j++) {
      const name = NAMES[i][j];
      const mode = MODES[i][j];
      for (let toggleMaskIndex = 0; toggleMaskIndex < TOGGLE_MASKS.length; toggleMaskIndex++) {
        for (let partner = 0; partner < PARTNERS.length; partner++) {
          for (let savePoint = 0; savePoint < SAVE_POINTS.length; savePoint++) {
            if (!isValidSavePoint(name, savePoint, partner, mode)) continue;
            const matrix = encode(name, savePoint, partner, mode, toggleMaskIndex);
            entries.push({
              id: id++,
              name,
              nameHash: hashName(name),
              savePoint,
              block: BLOCKS[savePoint],
              savePointLabel: SAVE_POINTS[savePoint],
              partner,
              partnerName: PARTNERS[partner],
              mode,
              modeName: MODE_NAMES[mode],
              toggleMaskIndex,
              password: passwordToString(matrix),
              matrix,
            });
          }
        }
      }
    }
  }

  return entries;
}

export function buildStats(entries) {
  return {
    total: entries.length,
    byMode: MODE_NAMES.map((label, mode) => ({ label, count: entries.filter((e) => e.mode === mode).length })),
    byPartner: PARTNERS.map((label, partner) => ({ label, count: entries.filter((e) => e.partner === partner).length })),
    bySavePoint: SAVE_POINTS.map((label, savePoint) => ({
      savePoint,
      block: BLOCKS[savePoint],
      label,
      count: entries.filter((e) => e.savePoint === savePoint).length,
    })),
  };
}
