// src/utils/stickers.js
// Curated sticker catalogue — all from open CDNs (Twemoji / OpenMoji / Noto Emoji).
// Each sticker is a CDN image URL. We group them by mood/category.

export const STICKER_CATEGORIES = [
  {
    label: "Hearts & Love",
    stickers: [
      { id: "heart-red",     url: "https://cdn.jsdelivr.net/npm/twemoji@14.0.2/assets/72x72/2764.png",    alt: "❤️" },
      { id: "heart-pink",    url: "https://cdn.jsdelivr.net/npm/twemoji@14.0.2/assets/72x72/1f497.png",   alt: "💗" },
      { id: "heart-sparkle", url: "https://cdn.jsdelivr.net/npm/twemoji@14.0.2/assets/72x72/1f496.png",   alt: "💖" },
      { id: "heart-eyes",    url: "https://cdn.jsdelivr.net/npm/twemoji@14.0.2/assets/72x72/1f60d.png",   alt: "😍" },
      { id: "kiss",          url: "https://cdn.jsdelivr.net/npm/twemoji@14.0.2/assets/72x72/1f618.png",   alt: "😘" },
      { id: "cupid",         url: "https://cdn.jsdelivr.net/npm/twemoji@14.0.2/assets/72x72/1f498.png",   alt: "💘" },
    ],
  },
  {
    label: "Flowers & Nature",
    stickers: [
      { id: "rose",          url: "https://cdn.jsdelivr.net/npm/twemoji@14.0.2/assets/72x72/1f339.png",   alt: "🌹" },
      { id: "cherry",        url: "https://cdn.jsdelivr.net/npm/twemoji@14.0.2/assets/72x72/1f338.png",   alt: "🌸" },
      { id: "sunflower",     url: "https://cdn.jsdelivr.net/npm/twemoji@14.0.2/assets/72x72/1f33b.png",   alt: "🌻" },
      { id: "tulip",         url: "https://cdn.jsdelivr.net/npm/twemoji@14.0.2/assets/72x72/1f337.png",   alt: "🌷" },
      { id: "butterfly",     url: "https://cdn.jsdelivr.net/npm/twemoji@14.0.2/assets/72x72/1f98b.png",   alt: "🦋" },
      { id: "leaf",          url: "https://cdn.jsdelivr.net/npm/twemoji@14.0.2/assets/72x72/1f343.png",   alt: "🍃" },
      { id: "mushroom",      url: "https://cdn.jsdelivr.net/npm/twemoji@14.0.2/assets/72x72/1f344.png",   alt: "🍄" },
      { id: "rainbow",       url: "https://cdn.jsdelivr.net/npm/twemoji@14.0.2/assets/72x72/1f308.png",   alt: "🌈" },
    ],
  },
  {
    label: "Stars & Magic",
    stickers: [
      { id: "star",          url: "https://cdn.jsdelivr.net/npm/twemoji@14.0.2/assets/72x72/2b50.png",    alt: "⭐" },
      { id: "sparkles",      url: "https://cdn.jsdelivr.net/npm/twemoji@14.0.2/assets/72x72/2728.png",    alt: "✨" },
      { id: "shooting-star", url: "https://cdn.jsdelivr.net/npm/twemoji@14.0.2/assets/72x72/1f320.png",   alt: "🌠" },
      { id: "dizzy",         url: "https://cdn.jsdelivr.net/npm/twemoji@14.0.2/assets/72x72/1f4ab.png",   alt: "💫" },
      { id: "crystal-ball",  url: "https://cdn.jsdelivr.net/npm/twemoji@14.0.2/assets/72x72/1f52e.png",   alt: "🔮" },
      { id: "unicorn",       url: "https://cdn.jsdelivr.net/npm/twemoji@14.0.2/assets/72x72/1f984.png",   alt: "🦄" },
    ],
  },
  {
    label: "Food & Treats",
    stickers: [
      { id: "cake",          url: "https://cdn.jsdelivr.net/npm/twemoji@14.0.2/assets/72x72/1f370.png",   alt: "🎂" },
      { id: "cupcake",       url: "https://cdn.jsdelivr.net/npm/twemoji@14.0.2/assets/72x72/1f9c1.png",   alt: "🧁" },
      { id: "cookie",        url: "https://cdn.jsdelivr.net/npm/twemoji@14.0.2/assets/72x72/1f36a.png",   alt: "🍪" },
      { id: "lollipop",      url: "https://cdn.jsdelivr.net/npm/twemoji@14.0.2/assets/72x72/1f36d.png",   alt: "🍭" },
      { id: "strawberry",    url: "https://cdn.jsdelivr.net/npm/twemoji@14.0.2/assets/72x72/1f353.png",   alt: "🍓" },
      { id: "bubble-tea",    url: "https://cdn.jsdelivr.net/npm/twemoji@14.0.2/assets/72x72/1f9cb.png",   alt: "🧋" },
    ],
  },
  {
    label: "Moods & Vibes",
    stickers: [
      { id: "smile",         url: "https://cdn.jsdelivr.net/npm/twemoji@14.0.2/assets/72x72/1f600.png",   alt: "😀" },
      { id: "cool",          url: "https://cdn.jsdelivr.net/npm/twemoji@14.0.2/assets/72x72/1f60e.png",   alt: "😎" },
      { id: "party",         url: "https://cdn.jsdelivr.net/npm/twemoji@14.0.2/assets/72x72/1f973.png",   alt: "🥳" },
      { id: "sleepy",        url: "https://cdn.jsdelivr.net/npm/twemoji@14.0.2/assets/72x72/1f634.png",   alt: "😴" },
      { id: "cry",           url: "https://cdn.jsdelivr.net/npm/twemoji@14.0.2/assets/72x72/1f622.png",   alt: "😢" },
      { id: "fire",          url: "https://cdn.jsdelivr.net/npm/twemoji@14.0.2/assets/72x72/1f525.png",   alt: "🔥" },
      { id: "tada",          url: "https://cdn.jsdelivr.net/npm/twemoji@14.0.2/assets/72x72/1f389.png",   alt: "🎉" },
      { id: "clap",          url: "https://cdn.jsdelivr.net/npm/twemoji@14.0.2/assets/72x72/1f44f.png",   alt: "👏" },
    ],
  },
  {
    label: "Travel & Places",
    stickers: [
      { id: "airplane",      url: "https://cdn.jsdelivr.net/npm/twemoji@14.0.2/assets/72x72/2708.png",    alt: "✈️" },
      { id: "mountains",     url: "https://cdn.jsdelivr.net/npm/twemoji@14.0.2/assets/72x72/26f0.png",    alt: "⛰️" },
      { id: "beach",         url: "https://cdn.jsdelivr.net/npm/twemoji@14.0.2/assets/72x72/1f3d6.png",   alt: "🏖️" },
      { id: "camera",        url: "https://cdn.jsdelivr.net/npm/twemoji@14.0.2/assets/72x72/1f4f7.png",   alt: "📷" },
      { id: "map",           url: "https://cdn.jsdelivr.net/npm/twemoji@14.0.2/assets/72x72/1f5fa.png",   alt: "🗺️" },
      { id: "compass",       url: "https://cdn.jsdelivr.net/npm/twemoji@14.0.2/assets/72x72/1f9ed.png",   alt: "🧭" },
    ],
  },
];

// Flat list keyed by id for quick lookup
export const STICKER_MAP = Object.fromEntries(
  STICKER_CATEGORIES.flatMap((c) => c.stickers.map((s) => [s.id, s]))
);
