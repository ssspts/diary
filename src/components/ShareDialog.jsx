// src/components/ShareDialog.jsx
// Share dialog that uses Web Share API when available, otherwise shows
// manual sharing links for WhatsApp, Facebook, Instagram, Twitter/X, Telegram.
import { useState } from "react";
import { layout } from "../styles/tokens";

const PLATFORMS = [
  {
    id: "whatsapp",
    label: "WhatsApp",
    color: "#25D366",
    icon: "💬",
    getUrl: (text, url) =>
      `https://wa.me/?text=${encodeURIComponent(text + (url ? "\n" + url : ""))}`,
  },
  {
    id: "telegram",
    label: "Telegram",
    color: "#2CA5E0",
    icon: "✈️",
    getUrl: (text, url) =>
      `https://t.me/share/url?url=${encodeURIComponent(url || window.location.href)}&text=${encodeURIComponent(text)}`,
  },
  {
    id: "twitter",
    label: "Twitter / X",
    color: "#000",
    icon: "𝕏",
    getUrl: (text, url) =>
      `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}${url ? "&url=" + encodeURIComponent(url) : ""}`,
  },
  {
    id: "facebook",
    label: "Facebook",
    color: "#1877F2",
    icon: "f",
    getUrl: (_, url) =>
      `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url || window.location.href)}`,
  },
  {
    id: "instagram",
    label: "Instagram",
    color: "#E1306C",
    icon: "📸",
    // Instagram has no direct web share URL — guide user to copy & share
    getUrl: null,
    note: "Copy text below and paste into Instagram",
  },
  {
    id: "copy",
    label: "Copy text",
    color: "#5f6368",
    icon: "📋",
    getUrl: null,
    isCopy: true,
  },
];

/**
 * Props:
 *   title       – entry title (string)
 *   text        – content to share (string, first page text)
 *   imageUrl    – optional dataURL of the rendered page image for image download
 *   onClose     – () => void
 */
export default function ShareDialog({ title, text, imageUrl, onClose }) {
  const [copied, setCopied]   = useState(false);
  const [imgCopied, setImgCopied] = useState(false);

  const shareText = `📖 ${title}\n\n${text.slice(0, 280)}${text.length > 280 ? "…" : ""}`;
  const pageUrl   = window.location.href;

  // Web Share API — native sheet on mobile
  const canNativeShare = typeof navigator.share === "function";

  const handleNativeShare = async () => {
    try {
      await navigator.share({ title, text: shareText, url: pageUrl });
    } catch (e) {
      if (e.name !== "AbortError") console.warn("Share failed:", e);
    }
  };

  const handleCopyText = () => {
    navigator.clipboard.writeText(shareText).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const handleDownloadImage = () => {
    if (!imageUrl) return;
    const a = document.createElement("a");
    a.href     = imageUrl;
    a.download = `${title || "diary"}.png`;
    a.click();
  };

  return (
    <div style={layout.overlay} onClick={onClose}>
      <div style={st.modal} onClick={(e) => e.stopPropagation()}>

        {/* Header */}
        <div style={st.header}>
          <span style={st.headerTitle}>Share Entry</span>
          <button style={st.closeBtn} onClick={onClose}>✕</button>
        </div>

        {/* Entry preview card */}
        <div style={st.previewCard}>
          <div style={st.previewTitle}>{title}</div>
          <div style={st.previewText}>{text.slice(0, 120)}{text.length > 120 ? "…" : ""}</div>
        </div>

        {/* Native share (mobile/supported browsers) */}
        {canNativeShare && (
          <button style={st.nativeBtn} onClick={handleNativeShare}>
            <span style={{ fontSize: 18 }}>↗</span> Share via device…
          </button>
        )}

        {/* Platform buttons */}
        <div style={st.platformGrid}>
          {PLATFORMS.filter((p) => !p.isCopy).map((p) => (
            <button
              key={p.id}
              style={{ ...st.platformBtn, borderColor: p.color + "55" }}
              title={p.note || p.label}
              onClick={() => {
                if (p.getUrl) {
                  window.open(p.getUrl(shareText, pageUrl), "_blank", "noopener");
                }
                // Instagram / no URL platforms: just show note (handled by tooltip)
              }}
            >
              <span style={{ ...st.platformIcon, background: p.color }}>{p.icon}</span>
              <span style={st.platformLabel}>{p.label}</span>
              {p.note && <span style={st.platformNote}>{p.note}</span>}
            </button>
          ))}
        </div>

        {/* Copy + image row */}
        <div style={st.actionRow}>
          <button style={{ ...st.actionBtn, flex: 1 }} onClick={handleCopyText}>
            {copied ? "✓ Copied!" : "📋 Copy text"}
          </button>
          {imageUrl && (
            <button style={{ ...st.actionBtn, flex: 1 }} onClick={handleDownloadImage}>
              🖼 Save as image
            </button>
          )}
        </div>

        <p style={st.footerNote}>
          For Instagram: copy the text above and share as a caption or story.
        </p>
      </div>
    </div>
  );
}

const st = {
  modal:        { background: "#fff", borderRadius: 14, padding: "0 0 16px", width: 420, maxWidth: "95vw", boxShadow: "0 12px 40px rgba(0,0,0,0.18)", overflow: "hidden" },
  header:       { display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 20px 12px", borderBottom: "1px solid #f1f3f4" },
  headerTitle:  { fontSize: 16, fontWeight: 700, color: "#202124" },
  closeBtn:     { border: "none", background: "#f1f3f4", borderRadius: "50%", width: 28, height: 28, cursor: "pointer", fontSize: 14, color: "#5f6368" },
  previewCard:  { margin: "12px 16px", background: "#f8f9fa", borderRadius: 10, padding: "12px 14px", borderLeft: "3px solid #1a73e8" },
  previewTitle: { fontSize: 13, fontWeight: 600, color: "#202124", marginBottom: 4 },
  previewText:  { fontSize: 12, color: "#5f6368", lineHeight: 1.5 },
  nativeBtn:    { display: "flex", alignItems: "center", gap: 8, margin: "8px 16px", padding: "10px 14px", border: "1px solid #dadce0", borderRadius: 8, background: "#fff", cursor: "pointer", fontSize: 13, color: "#1a73e8", fontWeight: 500, width: "calc(100% - 32px)" },
  platformGrid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, padding: "8px 16px" },
  platformBtn:  { display: "flex", flexDirection: "column", alignItems: "center", gap: 5, padding: "10px 8px", border: "1px solid #e8eaed", borderRadius: 10, background: "#fff", cursor: "pointer", transition: "background 0.12s" },
  platformIcon: { width: 36, height: 36, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, color: "#fff", fontWeight: 700, flexShrink: 0 },
  platformLabel:{ fontSize: 12, fontWeight: 500, color: "#202124" },
  platformNote: { fontSize: 10, color: "#9aa0a6", textAlign: "center" },
  actionRow:    { display: "flex", gap: 8, padding: "4px 16px 0" },
  actionBtn:    { padding: "9px 12px", border: "1px solid #dadce0", borderRadius: 8, background: "#fff", cursor: "pointer", fontSize: 13, color: "#3c4043", fontWeight: 500 },
  footerNote:   { fontSize: 11, color: "#9aa0a6", margin: "10px 16px 0", lineHeight: 1.5 },
};
