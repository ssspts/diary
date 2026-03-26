// src/components/TemplatePicker.jsx
import { layout, templatePicker as s } from "../styles/tokens";
import { TEMPLATES, TEMPLATE_KEYS, ensureMeta } from "../utils/templates";

/**
 * Props:
 *   currentTplKey   – the template key of the current page
 *   onSelect        – (key) => void  – called with the chosen template key
 *   onClose         – () => void
 */
export default function TemplatePicker({ currentTplKey, onSelect, onClose }) {
  return (
    <div style={layout.overlay} onClick={onClose}>
      <div style={s.modal} onClick={(e) => e.stopPropagation()}>
        <div style={s.header}>
          <span style={s.title}>Choose a page theme</span>
          <button style={s.closeBtn} onClick={onClose}>✕</button>
        </div>
        <p style={s.sub}>Each page in your diary can have its own theme.</p>

        <div style={s.grid}>
          {TEMPLATE_KEYS.map((key) => {
            const tpl    = TEMPLATES[key];
            const active = currentTplKey === key;
            return (
              <div
                key={key}
                style={{ ...s.card, ...(active ? s.cardActive : {}) }}
                onClick={() => onSelect(key)}
              >
                {/* Mini preview */}
                <div style={{ ...s.preview, ...tpl.editorStyle }}>
                  <span style={{ fontSize: 28 }}>{tpl.emoji}</span>
                  <div style={{ marginTop: 6, display: "flex", flexDirection: "column", gap: 3, width: "100%", padding: "0 8px" }}>
                    {[70, 90, 60, 80].map((w, i) => (
                      <div
                        key={i}
                        style={{
                          height: 3, width: `${w}%`, borderRadius: 2,
                          background: active ? tpl.pdfTitleColor : "rgba(0,0,0,0.15)",
                          opacity: 0.6,
                        }}
                      />
                    ))}
                  </div>
                </div>

                <div style={s.label}>{tpl.label}</div>
                {active && <div style={s.check}>✓</div>}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
