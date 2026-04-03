// src/components/TemplatePicker.jsx
import { layout, templatePicker as s } from "../styles/tokens";
import { TEMPLATES, TEMPLATE_KEYS } from "../utils/templates";

/**
 * Props:
 *   currentTplKey – template key of the current page
 *   onSelect      – (key, applyToAll: boolean) => void
 *   onClose       – () => void
 */
export default function TemplatePicker({ currentTplKey, onSelect, onClose }) {
  return (
      <div style={layout.overlay} onClick={onClose}>
        <div style={s.modal} onClick={(e) => e.stopPropagation()}>

          <div style={s.header}>
            <span style={s.title}>Choose a page theme</span>
            <button style={s.closeBtn} onClick={onClose}>✕</button>
          </div>

          <p style={s.sub}>
            Click a theme to apply it to <strong>all pages</strong>, or use
            <strong> This page</strong> to apply to the current page only.
          </p>

          <div style={s.grid}>
            {TEMPLATE_KEYS.map((key) => {
              const tpl    = TEMPLATES[key];
              const active = currentTplKey === key;
              return (
                  // position:relative on card so the ✓ badge can sit top-right
                  // NO pointer-events override — everything inside is naturally clickable
                  <div
                      key={key}
                      style={{
                        ...s.card,
                        ...(active ? s.cardActive : {}),
                        position: "relative",
                        display: "flex",
                        flexDirection: "column",
                        overflow: "hidden",
                      }}
                  >
                    {/* Active badge — pointer-events:none so it never blocks clicks */}
                    {active && (
                        <div style={{
                          position: "absolute", top: 6, right: 8,
                          fontSize: 13, color: "#1a73e8", fontWeight: 700,
                          pointerEvents: "none",   // ← never blocks button clicks
                          zIndex: 1,
                        }}>✓</div>
                    )}

                    {/* Mini preview — click = this page only */}
                    <div
                        style={{
                          ...s.preview,
                          ...tpl.editorStyle,
                          cursor: "pointer",
                          flex: 1,
                        }}
                        onClick={(e) => { e.stopPropagation(); onSelect(key, true); }}  // default = all pages
                    >
                      <span style={{ fontSize: 26 }}>{tpl.emoji}</span>
                      <div style={{ marginTop: 5, display:"flex", flexDirection:"column", gap:3, width:"100%", padding:"0 8px" }}>
                        {[70, 90, 60, 80].map((w, i) => (
                            <div key={i} style={{ height:3, width:`${w}%`, borderRadius:2, background: active ? tpl.pdfTitleColor : "rgba(0,0,0,0.18)", opacity:0.65 }} />
                        ))}
                      </div>
                    </div>

                    {/* Label */}
                    <div style={s.label}>{tpl.label}</div>

                    {/* Two apply buttons — All pages is default/primary */}
                    <div style={st.applyRow}>
                      <button
                          style={{ ...st.applyBtn, ...st.applyBtnAll }}
                          onClick={(e) => { e.stopPropagation(); onSelect(key, true); }}
                          title="Apply to all pages in this entry"
                      >
                        All pages
                      </button>
                      <button
                          style={st.applyBtn}
                          onClick={(e) => { e.stopPropagation(); onSelect(key, false); }}
                          title="Apply to current page only"
                      >
                        This page
                      </button>
                    </div>
                  </div>
              );
            })}
          </div>
        </div>
      </div>
  );
}

const st = {
  applyRow: {
    display:     "flex",
    gap:         4,
    padding:     "6px 6px 7px",
    borderTop:   "1px solid #f1f3f4",
    background:  "#fafafa",
    flexShrink:  0,
  },
  applyBtn: {
    flex:        1,
    padding:     "5px 0",
    fontSize:    11,
    fontWeight:  500,
    border:      "1px solid #dadce0",
    borderRadius:4,
    background:  "#fff",
    color:       "#3c4043",
    cursor:      "pointer",
  },
  applyBtnAll: {
    background:  "#e8f0fe",
    color:       "#1a73e8",
    border:      "1px solid #c5d8fb",
  },
};