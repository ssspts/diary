// src/components/FeedbackDialog.jsx
import { useState } from "react";
import { layout } from "../styles/tokens";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../firebase";

const CATEGORIES = [
  { id: "bug",        label: "🐛 Bug / Something broken" },
  { id: "ui",         label: "🎨 Design / UI issue" },
  { id: "feature",    label: "💡 Feature request" },
  { id: "performance",label: "⚡ Performance issue" },
  { id: "other",      label: "💬 Other" },
];

const RATINGS = [
  { value: 1, emoji: "😞", label: "Poor" },
  { value: 2, emoji: "😕", label: "Fair" },
  { value: 3, emoji: "😐", label: "Okay" },
  { value: 4, emoji: "😊", label: "Good" },
  { value: 5, emoji: "🤩", label: "Excellent" },
];

export default function FeedbackDialog({ user, onClose }) {
  const [category,    setCategory]    = useState("");
  const [rating,      setRating]      = useState(0);
  const [message,     setMessage]     = useState("");
  const [email,       setEmail]       = useState(user?.email || "");
  const [submitting,  setSubmitting]  = useState(false);
  const [submitted,   setSubmitted]   = useState(false);
  const [error,       setError]       = useState("");

  const canSubmit = category && message.trim().length >= 10 && !submitting;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    setError("");
    try {
      await addDoc(collection(db, "feedback"), {
        category,
        rating:      rating || null,
        message:     message.trim(),
        email:       email.trim() || null,
        userId:      user?.uid || null,
        displayName: user?.displayName || null,
        userAgent:   navigator.userAgent,
        url:         window.location.href,
        createdAt:   serverTimestamp(),
        status:      "new",   // for internal triage: new / reviewed / resolved
      });
      setSubmitted(true);
    } catch (e) {
      console.error("Feedback submit failed:", e);
      setError("Failed to send feedback. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={layout.overlay} onClick={onClose}>
      <div style={st.modal} onClick={(e) => e.stopPropagation()}>

        {/* Header */}
        <div style={st.header}>
          <div style={st.headerLeft}>
            <span style={{ fontSize:20 }}>💬</span>
            <span style={st.headerTitle}>Send Feedback</span>
          </div>
          <button style={st.closeBtn} onClick={onClose}>✕</button>
        </div>

        {/* ── Success state ── */}
        {submitted ? (
          <div style={st.successBox}>
            <div style={{ fontSize:48, marginBottom:12 }}>🎉</div>
            <div style={st.successTitle}>Thank you for your feedback!</div>
            <div style={st.successSub}>
              We read every submission and use it to improve the app.
            </div>
            <button style={st.submitBtn} onClick={onClose}>Close</button>
          </div>
        ) : (
          <div style={st.body}>

            {/* Category */}
            <div style={st.field}>
              <label style={st.label}>What's this about? <span style={st.required}>*</span></label>
              <div style={st.categoryGrid}>
                {CATEGORIES.map((c) => (
                  <button
                    key={c.id}
                    style={{ ...st.categoryBtn, ...(category === c.id ? st.categoryBtnActive : {}) }}
                    onClick={() => setCategory(c.id)}
                  >
                    {c.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Rating */}
            <div style={st.field}>
              <label style={st.label}>Overall experience</label>
              <div style={st.ratingRow}>
                {RATINGS.map((r) => (
                  <button
                    key={r.value}
                    title={r.label}
                    style={{ ...st.ratingBtn, ...(rating === r.value ? st.ratingBtnActive : {}) }}
                    onClick={() => setRating(r.value)}
                  >
                    <span style={{ fontSize:24 }}>{r.emoji}</span>
                    <span style={{ fontSize:10, marginTop:2, color: rating === r.value ? "#1a73e8" : "#9aa0a6" }}>{r.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Message */}
            <div style={st.field}>
              <label style={st.label}>
                Describe the issue or idea <span style={st.required}>*</span>
                <span style={st.charCount}>{message.length} / 1000</span>
              </label>
              <textarea
                style={st.textarea}
                placeholder="Tell us what happened, what you expected, or what you'd like to see..."
                value={message}
                onChange={(e) => setMessage(e.target.value.slice(0, 1000))}
                rows={5}
              />
              {message.trim().length > 0 && message.trim().length < 10 && (
                <div style={st.hint}>Please add a bit more detail (at least 10 characters)</div>
              )}
            </div>

            {/* Email */}
            <div style={st.field}>
              <label style={st.label}>Your email (optional — for follow-up)</label>
              <input
                type="email"
                style={st.input}
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>

            {/* Error */}
            {error && <div style={st.error}>{error}</div>}

            {/* Footer */}
            <div style={st.footer}>
              <div style={st.footerNote}>
                Feedback is shared with our team only and never made public.
              </div>
              <div style={st.footerBtns}>
                <button style={st.cancelBtn} onClick={onClose}>Cancel</button>
                <button
                  style={{ ...st.submitBtn, opacity: canSubmit ? 1 : 0.45, cursor: canSubmit ? "pointer" : "default" }}
                  onClick={handleSubmit}
                  disabled={!canSubmit}
                >
                  {submitting ? "Sending…" : "Send Feedback"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

const st = {
  modal:            { background:"#fff", borderRadius:16, width:500, maxWidth:"95vw", maxHeight:"90vh", boxShadow:"0 16px 48px rgba(0,0,0,0.18)", overflow:"hidden", display:"flex", flexDirection:"column" },
  header:           { display:"flex", alignItems:"center", justifyContent:"space-between", padding:"16px 20px", borderBottom:"1px solid #f1f3f4", flexShrink:0 },
  headerLeft:       { display:"flex", alignItems:"center", gap:10 },
  headerTitle:      { fontSize:16, fontWeight:700, color:"#202124" },
  closeBtn:         { border:"none", background:"#f1f3f4", borderRadius:"50%", width:28, height:28, cursor:"pointer", fontSize:14, color:"#5f6368", display:"flex", alignItems:"center", justifyContent:"center" },
  body:             { overflowY:"auto", padding:"16px 20px", display:"flex", flexDirection:"column", gap:16, flex:1 },
  field:            { display:"flex", flexDirection:"column", gap:6 },
  label:            { fontSize:12, fontWeight:600, color:"#5f6368", display:"flex", justifyContent:"space-between", alignItems:"center" },
  required:         { color:"#d93025" },
  charCount:        { fontSize:11, color:"#9aa0a6", fontWeight:400 },
  categoryGrid:     { display:"grid", gridTemplateColumns:"1fr 1fr", gap:6 },
  categoryBtn:      { padding:"8px 12px", border:"1px solid #e0e0e0", borderRadius:8, background:"#fff", cursor:"pointer", fontSize:12, color:"#3c4043", textAlign:"left", transition:"all 0.12s" },
  categoryBtnActive:{ background:"#e8f0fe", borderColor:"#1a73e8", color:"#1a73e8", fontWeight:600 },
  ratingRow:        { display:"flex", gap:6 },
  ratingBtn:        { flex:1, display:"flex", flexDirection:"column", alignItems:"center", padding:"8px 4px", border:"1px solid #e0e0e0", borderRadius:8, background:"#fff", cursor:"pointer", transition:"all 0.12s" },
  ratingBtnActive:  { background:"#e8f0fe", borderColor:"#1a73e8" },
  textarea:         { border:"1px solid #e0e0e0", borderRadius:8, padding:"10px 12px", fontSize:13, color:"#202124", resize:"vertical", fontFamily:"inherit", outline:"none", lineHeight:1.6, minHeight:100 },
  input:            { border:"1px solid #e0e0e0", borderRadius:8, padding:"9px 12px", fontSize:13, color:"#202124", outline:"none", fontFamily:"inherit" },
  hint:             { fontSize:11, color:"#f57c00" },
  error:            { fontSize:12, color:"#d93025", padding:"8px 12px", background:"#fce8e6", borderRadius:6 },
  footer:           { borderTop:"1px solid #f1f3f4", paddingTop:14, display:"flex", flexDirection:"column", gap:10, flexShrink:0 },
  footerNote:       { fontSize:11, color:"#9aa0a6" },
  footerBtns:       { display:"flex", gap:8, justifyContent:"flex-end" },
  cancelBtn:        { padding:"8px 16px", border:"1px solid #dadce0", borderRadius:8, background:"#fff", cursor:"pointer", fontSize:13, color:"#3c4043" },
  submitBtn:        { padding:"8px 20px", border:"none", borderRadius:8, background:"#1a73e8", color:"#fff", cursor:"pointer", fontSize:13, fontWeight:600 },
  successBox:       { display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", padding:"40px 24px", gap:8, textAlign:"center", flex:1 },
  successTitle:     { fontSize:18, fontWeight:700, color:"#202124" },
  successSub:       { fontSize:13, color:"#5f6368", lineHeight:1.6, marginBottom:16 },
};
