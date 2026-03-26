// src/utils/templates.js

// ── Handwriting font catalogue ────────────────────────────────────────────────
// TTF URLs must point to static (non-variable) font files with a proper unicode
// cmap table. Google Fonts /s/ static URLs are reliable for this.
export const HANDWRITING_FONTS = {
  default: {
    label: "Default",
    googleFamily: null,
    pdfFont: "helvetica",
    editorFamily: "inherit",
    emoji: "Aa",
    ttfUrl: null,
  },
  dancingScript: {
    label: "Dancing Script",
    googleFamily: "Dancing+Script:wght@400",
    pdfFont: "DancingScript",
    ttfUrl: "https://fonts.gstatic.com/s/dancingscript/v25/If2cXTr6YS-zF4S-kcSWSVi_sxjsohD9F50Ruu7BMSo3ROp6.ttf",
    editorFamily: "'Dancing Script', cursive",
    emoji: "𝒟",
  },
  pacifico: {
    label: "Pacifico",
    googleFamily: "Pacifico",
    pdfFont: "Pacifico",
    ttfUrl: "https://fonts.gstatic.com/s/pacifico/v22/FwZY7-Qmy14u9lezJ-6H6MmBp0u-.ttf",
    editorFamily: "'Pacifico', cursive",
    emoji: "𝒫",
  },
  caveat: {
    label: "Caveat",
    googleFamily: "Caveat:wght@400",
    pdfFont: "Caveat",
    ttfUrl: "https://fonts.gstatic.com/s/caveat/v18/WnznHAc5bAfYB2QRah7pcpNvOx-pjfB9SIWpZA.ttf",
    editorFamily: "'Caveat', cursive",
    emoji: "✍",
  },
  kalam: {
    label: "Kalam",
    googleFamily: "Kalam:wght@400",
    pdfFont: "Kalam",
    ttfUrl: "https://fonts.gstatic.com/s/kalam/v16/YA9dr0Wd4kDdMuhROCXXsA.ttf",
    editorFamily: "'Kalam', cursive",
    emoji: "✒",
  },
  patrickHand: {
    label: "Patrick Hand",
    googleFamily: "Patrick+Hand",
    pdfFont: "PatrickHand",
    ttfUrl: "https://fonts.gstatic.com/s/patrickhand/v20/LDI1apSQOAYtSuYWp8ZhfYe8XsLL.ttf",
    editorFamily: "'Patrick Hand', cursive",
    emoji: "🖊",
  },
  indieFlower: {
    label: "Indie Flower",
    googleFamily: "Indie+Flower",
    pdfFont: "IndieFlower",
    ttfUrl: "https://fonts.gstatic.com/s/indieflower/v21/m8JVjfNVeKWVnh3QMuKkFcZlbkGG1dKEDw.ttf",
    editorFamily: "'Indie Flower', cursive",
    emoji: "🌸",
  },
  satisfy: {
    label: "Satisfy",
    googleFamily: "Satisfy",
    pdfFont: "Satisfy",
    ttfUrl: "https://fonts.gstatic.com/s/satisfy/v21/rP2Hp2yn6lkG50LoOZSCHBeHFl0.ttf",
    editorFamily: "'Satisfy', cursive",
    emoji: "✨",
  },
};

export const FONT_KEYS = Object.keys(HANDWRITING_FONTS);

// Per-doc cache: Map<jsPDF instance, Set<fontKey>>
// We can't share a single cache across instances because each new jsPDF() is fresh.
// Instead we cache the raw ArrayBuffer globally and re-register per doc.
const _bufferCache = {};

export async function loadFontIntoDoc(doc, fontKey) {
  const def = HANDWRITING_FONTS[fontKey];
  if (!def || !def.ttfUrl) return false; // built-in helvetica, nothing to do

  // Fetch and cache the binary buffer once
  if (!_bufferCache[fontKey]) {
    const res = await fetch(def.ttfUrl);
    if (!res.ok) throw new Error(`Failed to fetch font: ${def.ttfUrl}`);
    _bufferCache[fontKey] = await res.arrayBuffer();
  }

  // Convert to base64
  const uint8  = new Uint8Array(_bufferCache[fontKey]);
  let binary   = "";
  for (let i = 0; i < uint8.length; i++) binary += String.fromCharCode(uint8[i]);
  const base64 = btoa(binary);

  const fileName = `${def.pdfFont}.ttf`;
  doc.addFileToVFS(fileName, base64);
  doc.addFont(fileName, def.pdfFont, "normal");
  return true;
}

// ── Layout contract ───────────────────────────────────────────────────────────
// firstLineY  = mm from top where the FIRST text baseline sits
// lineSpacing = mm between consecutive baselines  (= ruled-line gap)
// leftMargin / rightMargin = mm from respective edges
// fontSize    = pt for body text
const DEFAULT_LAYOUT = {
  firstLineY:  42,
  lineSpacing:  8,
  leftMargin:  18,
  rightMargin: 14,
  fontSize:    11,
};

// ── Templates ─────────────────────────────────────────────────────────────────
export const TEMPLATES = {

  plain: {
    label: "Plain", emoji: "🤍",
    editorStyle: { background: "#fff", color: "#202124" },
    layout: { ...DEFAULT_LAYOUT, leftMargin: 14 },
    pdfDrawBackground: () => {},
    pdfTextColor: "#202124", pdfTitleColor: "#202124",
  },

  rosegarden: {
    label: "Rose Garden", emoji: "🌸",
    editorStyle: {
      background: "linear-gradient(160deg, #fff0f5 0%, #ffe4ec 100%)",
      color: "#5a2233",
    },
    layout: { ...DEFAULT_LAYOUT },
    pdfDrawBackground: (d, pw, ph, layout) => {
      d.setFillColor(255, 240, 245); d.rect(0, 0, pw, ph, "F");
      d.setFillColor(255, 182, 203); d.rect(0, 0, pw, 8, "F");
      d.setFillColor(255, 105, 145); d.rect(0, 0, pw, 3, "F");
      d.setFillColor(255, 182, 203); d.rect(0, ph - 8, pw, 8, "F");
      d.setFillColor(255, 105, 145); d.rect(0, ph - 3, pw, 3, "F");
      const rose = (x, y) => {
        d.setFillColor(255, 105, 145); d.circle(x, y, 5, "F");
        d.setFillColor(255, 182, 203); d.circle(x - 4, y + 2, 3, "F");
        d.setFillColor(255, 182, 203); d.circle(x + 4, y + 2, 3, "F");
        d.setFillColor(255, 182, 203); d.circle(x, y - 4, 3, "F");
        d.setFillColor(220, 80, 120);  d.circle(x, y, 2, "F");
      };
      rose(14, 14); rose(pw - 14, 14); rose(14, ph - 14); rose(pw - 14, ph - 14);
      d.setDrawColor(255, 180, 210); d.setLineWidth(0.35);
      for (let y = layout.firstLineY; y < ph - 10; y += layout.lineSpacing)
        d.line(layout.leftMargin, y, pw - layout.rightMargin, y);
    },
    pdfTextColor: "#5a2233", pdfTitleColor: "#c0185a",
  },

  sunflower: {
    label: "Sunflower", emoji: "🌻",
    editorStyle: {
      background: "linear-gradient(160deg, #fffde7 0%, #fff8c5 100%)",
      color: "#4a3500",
    },
    layout: { ...DEFAULT_LAYOUT, leftMargin: 20 },
    pdfDrawBackground: (d, pw, ph, layout) => {
      d.setFillColor(255, 253, 231); d.rect(0, 0, pw, ph, "F");
      d.setFillColor(255, 214, 0);   d.rect(0, 0, pw, 6, "F");
      d.setFillColor(255, 165, 0);   d.rect(0, 0, pw, 2.5, "F");
      d.setFillColor(255, 214, 0);   d.rect(0, ph - 6, pw, 6, "F");
      d.setFillColor(255, 165, 0);   d.rect(0, ph - 2.5, pw, 2.5, "F");
      d.setFillColor(255, 236, 153); d.rect(0, 0, 14, ph, "F");
      d.setDrawColor(255, 180, 0);   d.setLineWidth(0.5); d.line(14, 0, 14, ph);
      const sun = (cx, cy, r) => {
        d.setFillColor(255, 165, 0);
        for (let a = 0; a < 360; a += 45) {
          const rad = (a * Math.PI) / 180;
          d.circle(cx + Math.cos(rad) * r * 1.6, cy + Math.sin(rad) * r * 1.6, r * 0.55, "F");
        }
        d.setFillColor(139, 90, 0);  d.circle(cx, cy, r, "F");
        d.setFillColor(101, 60, 0);  d.circle(cx, cy, r * 0.55, "F");
      };
      sun(7, 14, 4); sun(pw - 12, 14, 4); sun(7, ph - 14, 4); sun(pw - 12, ph - 14, 4);
      d.setDrawColor(255, 210, 80); d.setLineWidth(0.35);
      for (let y = layout.firstLineY; y < ph - 10; y += layout.lineSpacing)
        d.line(layout.leftMargin, y, pw - layout.rightMargin, y);
    },
    pdfTextColor: "#4a3500", pdfTitleColor: "#b06000",
  },

  ocean: {
    label: "Ocean", emoji: "🌊",
    editorStyle: {
      background: "linear-gradient(160deg, #e3f2fd 0%, #e0f7fa 100%)",
      color: "#0d3349",
    },
    layout: { ...DEFAULT_LAYOUT },
    pdfDrawBackground: (d, pw, ph, layout) => {
      d.setFillColor(227, 242, 253); d.rect(0, 0, pw, ph, "F");
      d.setFillColor(3, 169, 244);   d.rect(0, 0, pw, 10, "F");
      d.setFillColor(0, 188, 212);   d.rect(0, 3, pw, 4, "F");
      d.setFillColor(2, 136, 209);   d.rect(0, 0, pw, 2, "F");
      d.setFillColor(3, 169, 244);   d.rect(0, ph - 10, pw, 10, "F");
      d.setFillColor(0, 188, 212);   d.rect(0, ph - 7, pw, 4, "F");
      [[12, 12], [pw - 12, 12], [12, ph - 12], [pw - 12, ph - 12]].forEach(([x, y]) => {
        d.setFillColor(179, 229, 252); d.circle(x, y, 5, "F");
        d.setFillColor(3, 169, 244);   d.circle(x, y, 3, "F");
        d.setFillColor(179, 229, 252); d.circle(x - 1, y - 1, 1, "F");
      });
      d.setDrawColor(144, 202, 249); d.setLineWidth(0.35);
      for (let y = layout.firstLineY; y < ph - 14; y += layout.lineSpacing)
        d.line(layout.leftMargin, y, pw - layout.rightMargin, y);
    },
    pdfTextColor: "#0d3349", pdfTitleColor: "#0277bd",
  },

  forest: {
    label: "Forest", emoji: "🌿",
    editorStyle: {
      background: "linear-gradient(160deg, #e8f5e9 0%, #f1f8e9 100%)",
      color: "#1b3a1f",
    },
    layout: { ...DEFAULT_LAYOUT },
    pdfDrawBackground: (d, pw, ph, layout) => {
      d.setFillColor(232, 245, 233); d.rect(0, 0, pw, ph, "F");
      d.setFillColor(56, 142, 60);   d.rect(0, 0, pw, 7, "F");
      d.setFillColor(27, 94, 32);    d.rect(0, 0, pw, 2.5, "F");
      d.setFillColor(56, 142, 60);   d.rect(0, ph - 7, pw, 7, "F");
      d.setFillColor(27, 94, 32);    d.rect(0, ph - 2.5, pw, 2.5, "F");
      // Leaf corners — using only circle/rect (no ellipse to avoid API issues)
      const leaf = (x, y) => {
        d.setFillColor(56, 142, 60);   d.circle(x, y, 4, "F");
        d.setFillColor(27, 94, 32);    d.circle(x + 3, y - 3, 2.5, "F");
        d.setFillColor(129, 199, 132); d.circle(x - 2, y - 2, 1.8, "F");
      };
      leaf(14, 14); leaf(pw - 14, 14); leaf(14, ph - 14); leaf(pw - 14, ph - 14);
      d.setDrawColor(165, 214, 167); d.setLineWidth(0.35);
      for (let y = layout.firstLineY; y < ph - 10; y += layout.lineSpacing)
        d.line(layout.leftMargin, y, pw - layout.rightMargin, y);
    },
    pdfTextColor: "#1b3a1f", pdfTitleColor: "#2e7d32",
  },

  galaxy: {
    label: "Galaxy", emoji: "🌌",
    editorStyle: {
      background: "linear-gradient(160deg, #1a1a2e 0%, #16213e 60%, #0f3460 100%)",
      color: "#e8eaf6",
    },
    layout: { ...DEFAULT_LAYOUT },
    pdfDrawBackground: (d, pw, ph, layout) => {
      d.setFillColor(22, 33, 62);   d.rect(0, 0, pw, ph, "F");
      d.setFillColor(63, 0, 125);   d.rect(0, 0, pw, 7, "F");
      d.setFillColor(123, 31, 162); d.rect(0, 0, pw, 3, "F");
      d.setFillColor(63, 0, 125);   d.rect(0, ph - 7, pw, 7, "F");
      d.setFillColor(123, 31, 162); d.rect(0, ph - 3, pw, 3, "F");
      d.setFillColor(255, 255, 255);
      [
        [20,20],[50,35],[90,18],[130,40],[170,22],[pw-20,20],[pw-50,35],[pw-90,18],
        [20,ph-20],[50,ph-35],[pw-20,ph-20],[pw-50,ph-35],
        [30,80],[70,65],[110,90],[150,70],[pw-30,80],[pw-70,65],
        [40,130],[80,115],[120,135],[pw-40,130],[pw-80,115],
      ].forEach(([x, y]) => d.circle(x, y, 0.6, "F"));
      [[pw / 2, 25], [pw / 4, ph / 2], [(pw * 3) / 4, ph / 2]].forEach(([x, y]) => {
        d.setFillColor(200, 180, 255); d.circle(x, y, 1.2, "F");
      });
      d.setDrawColor(80, 100, 180); d.setLineWidth(0.3);
      for (let y = layout.firstLineY; y < ph - 10; y += layout.lineSpacing)
        d.line(layout.leftMargin, y, pw - layout.rightMargin, y);
    },
    pdfTextColor: "#e8eaf6", pdfTitleColor: "#ce93d8",
  },

  scrapbook: {
    label: "Scrapbook", emoji: "✂️",
    editorStyle: {
      background: "#fdf6ec",
      color: "#3e2723",
      backgroundImage:
          "repeating-linear-gradient(0deg,transparent,transparent 27px,#f0e0c8 28px)," +
          "repeating-linear-gradient(90deg,transparent,transparent 27px,#f0e0c8 28px)",
    },
    layout: { ...DEFAULT_LAYOUT, leftMargin: 16 },
    pdfDrawBackground: (d, pw, ph, layout) => {
      d.setFillColor(253, 246, 236); d.rect(0, 0, pw, ph, "F");
      d.setDrawColor(240, 224, 200); d.setLineWidth(0.2);
      for (let x = 0; x < pw; x += 10) d.line(x, 0, x, ph);
      for (let y = 0; y < ph; y += 10) d.line(0, y, pw, y);
      const tape = (x, y, w, h, r, g, b) => { d.setFillColor(r, g, b); d.rect(x, y, w, h, "F"); };
      tape(8, 8, 20, 8, 255, 230, 100);
      tape(pw - 28, 8, 20, 8, 180, 230, 255);
      tape(8, ph - 16, 20, 8, 255, 180, 180);
      tape(pw - 28, ph - 16, 20, 8, 200, 255, 200);
      d.setDrawColor(180, 140, 100); d.setLineWidth(1);
      d.rect(12, 12, pw - 24, ph - 24);
      d.setDrawColor(210, 170, 130); d.setLineWidth(0.5);
      for (let y = layout.firstLineY; y < ph - 18; y += layout.lineSpacing)
        d.line(layout.leftMargin, y, pw - layout.rightMargin, y);
    },
    pdfTextColor: "#3e2723", pdfTitleColor: "#5d4037",
  },

  pastel: {
    label: "Pastel", emoji: "🎀",
    editorStyle: {
      background: "linear-gradient(135deg, #fce4ec 0%, #f3e5f5 33%, #e8eaf6 66%, #e3f2fd 100%)",
      color: "#37474f",
    },
    layout: { ...DEFAULT_LAYOUT },
    pdfDrawBackground: (d, pw, ph, layout) => {
      const bands = [
        [252,228,236],[248,225,241],[243,229,245],
        [235,234,245],[232,234,246],[227,242,253],
      ];
      const bh = ph / bands.length;
      bands.forEach(([r,g,b], i) => { d.setFillColor(r,g,b); d.rect(0, i * bh, pw, bh + 1, "F"); });
      d.setFillColor(255, 255, 255);
      for (let x = 10; x < pw; x += 15)
        for (let y = 10; y < ph; y += 15)
          d.circle(x, y, 1.2, "F");
      const rainbow = [[255,138,128],[255,190,100],[255,238,88],[149,221,128],[100,200,255],[200,150,255]];
      const sw = pw / rainbow.length;
      rainbow.forEach(([r,g,b], i) => { d.setFillColor(r,g,b); d.rect(i * sw, 0, sw, 5, "F"); });
      [...rainbow].reverse().forEach(([r,g,b], i) => { d.setFillColor(r,g,b); d.rect(i * sw, ph - 5, sw, 5, "F"); });
      d.setDrawColor(200, 160, 210); d.setLineWidth(0.35);
      for (let y = layout.firstLineY; y < ph - 10; y += layout.lineSpacing)
        d.line(layout.leftMargin, y, pw - layout.rightMargin, y);
    },
    pdfTextColor: "#37474f", pdfTitleColor: "#7b1fa2",
  },
};

export const TEMPLATE_KEYS = Object.keys(TEMPLATES);

export const ensureMeta = (page) => {
  if (typeof page === "string")
    return { data: page, meta: { template: "plain", font: "default" } };
  return {
    data: page?.data ?? "",
    meta: { template: page?.meta?.template ?? "plain", font: page?.meta?.font ?? "default" },
  };
};