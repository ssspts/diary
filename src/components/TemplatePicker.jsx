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

        {/* FIX 3 — scope hint shown before the grid */}
        <p style={s.sub}>
          Click a theme to apply it to <strong>this page only</strong>, or use
          the buttons below a theme to apply it to <strong>all pages</strong>.
        </p>

        <div style={s.grid}>
          {TEMPLATE_KEYS.map((key) => {
            const tpl    = TEMPLATES[key];
            const active = currentTplKey === key;
            return (
              <div key={key} style={{ ...s.card, ...(active ? s.cardActive : {}) }}>
                {/* Mini preview — click = current page only */}
                <div
                  style={{ ...s.preview, ...tpl.editorStyle, cursor: "pointer" }}
                  onClick={() => onSelect(key, false)}
                >
                  <span style={{ fontSize: 26 }}>{tpl.emoji}</span>
                  <div style={{ marginTop: 5, display: "flex", flexDirection: "column", gap: 3, width: "100%", padding: "0 8px" }}>
                    {[70, 90, 60, 80].map((w, i) => (
                      <div
                        key={i}
                        style={{
                          height: 3, width: `${w}%`, borderRadius: 2,
                          background: active ? tpl.pdfTitleColor : "rgba(0,0,0,0.18)",
                          opacity: 0.65,
                        }}
                      />
                    ))}
                  </div>
                </div>

                <div style={s.label}>{tpl.label}</div>
                {active && <div style={s.check}>✓</div>}

                {/* FIX 3 — two explicit apply buttons */}
                <div style={st.applyRow}>
                  <button
                    style={st.applyBtn}
                    onClick={() => onSelect(key, false)}
                    title="Apply to current page only"
                  >
                    This page
                  </button>
                  <button
                    style={{ ...st.applyBtn, ...st.applyBtnAll }}
                    onClick={() => onSelect(key, true)}
                    title="Apply to all pages in this entry"
                  >
                    All pages
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
    display: "flex",
    gap: 4,
    padding: "6px 6px 7px",
    borderTop: "1px solid #f1f3f4",
    background: "#fafafa",
  },
  applyBtn: {
    flex: 1,
    padding: "4px 0",
    fontSize: 10,
    fontWeight: 500,
    border: "1px solid #dadce0",
    borderRadius: 4,
    background: "#fff",
    color: "#3c4043",
    cursor: "pointer",
  },
  applyBtnAll: {
    background: "#e8f0fe",
    color: "#1a73e8",
    border: "1px solid #c5d8fb",
  },
};
