// src/components/ProfileModal.jsx
import { layout, profileModal as s, shared } from "../styles/tokens";

/**
 * Props:
 *   user     – Firebase user object
 *   onClose  – () => void
 *   onLogout – () => void
 */
export default function ProfileModal({ user, onClose, onLogout }) {
  return (
    <div style={layout.overlay} onClick={onClose}>
      <div style={s.modal} onClick={(e) => e.stopPropagation()}>
        <img src={user.photoURL} alt="profile" style={s.img} />
        <div style={s.name}>{user.displayName}</div>
        <div style={s.email}>{user.email}</div>
        <div style={{ display: "flex", gap: 8, marginTop: 20 }}>
          <button style={shared.btnOutline} onClick={onClose}>Close</button>
          <button
            style={{ ...shared.btnPrimary, background: "#d93025" }}
            onClick={() => { onClose(); onLogout(); }}
          >
            Sign out
          </button>
        </div>
      </div>
    </div>
  );
}
