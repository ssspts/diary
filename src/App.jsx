import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  signOut,
  onAuthStateChanged,
  signInWithPopup
} from "firebase/auth";
import {
  collection,
  addDoc,
  deleteDoc,
  doc,
  updateDoc,
  getDocs
} from "firebase/firestore";
import jsPDF from "jspdf";
import { auth, db, provider } from "./firebase";

// ─── CSS injected once for spinner keyframes & global resets ─────────────────
const globalStyles = `
  @keyframes spin { to { transform: rotate(360deg); } }
  * { box-sizing: border-box; }
  body { margin: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
  ::-webkit-scrollbar { width: 6px; }
  ::-webkit-scrollbar-track { background: transparent; }
  ::-webkit-scrollbar-thumb { background: #dadce0; border-radius: 3px; }
  ::-webkit-scrollbar-thumb:hover { background: #bdc1c6; }
`;

export default function App() {
  const [user, setUser]                     = useState(null);
  const [files, setFiles]                   = useState([]);
  const [selectedFile, setSelectedFile]     = useState(null);
  const [selectedDate, setSelectedDate]     = useState(new Date());
  const [loading, setLoading]               = useState(false);
  const [editingTitle, setEditingTitle]     = useState(false);
  const [tempTitle, setTempTitle]           = useState("");
  const [showMenu, setShowMenu]             = useState(false);
  const [showProfile, setShowProfile]       = useState(false);
  const [saving, setSaving]                 = useState(false);
  const [deletingFileId, setDeletingFileId] = useState(null);
  const [editingFileId, setEditingFileId]   = useState(null);
  const [tempFileName, setTempFileName]     = useState("");
  const [searchQuery, setSearchQuery]       = useState("");
  const [searchResults, setSearchResults]   = useState([]);
  const [expandedMonths, setExpandedMonths] = useState({});
  const [pages, setPages]                   = useState([]);
  const [currentPage, setCurrentPage]       = useState(0);
  // BUG FIX: track unsaved changes to warn user and drive Save button state
  const [isDirty, setIsDirty]               = useState(false);
  // UX: search dropdown driven by focus so it closes on outside click
  const [searchFocused, setSearchFocused]   = useState(false);

  const menuRef       = useRef(null);
  const searchRef     = useRef(null);
  const titleInputRef = useRef(null);

  // ─── Inject global CSS once ───────────────────────────────────────────────
  useEffect(() => {
    const tag = document.createElement("style");
    tag.textContent = globalStyles;
    document.head.appendChild(tag);
    return () => document.head.removeChild(tag);
  }, []);

  // ─── Auth listener ────────────────────────────────────────────────────────
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      if (u) fetchFiles(u.uid);
    });
    return () => unsub();
  }, []);

  // ─── Close menus / search on outside click ────────────────────────────────
  useEffect(() => {
    const handler = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target))
        setShowMenu(false);
      // BUG FIX: search dropdown never closed on outside click in original code
      if (searchRef.current && !searchRef.current.contains(e.target))
        setSearchFocused(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // ─── Search filter ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!searchQuery.trim()) { setSearchResults([]); return; }
    const q = searchQuery.toLowerCase();
    setSearchResults(
        files.filter((f) => {
          const nameHit = (f.name || "").toLowerCase().includes(q);
          const bodyText = Array.isArray(f.content)
              ? f.content.map((p) => (typeof p === "string" ? p : p?.data ?? "")).join(" ")
              : (f.content ?? "");
          return nameHit || bodyText.toLowerCase().includes(q);
        })
    );
  }, [searchQuery, files]);

  // ─── Ctrl/Cmd+S to save ───────────────────────────────────────────────────
  // BUG FIX: keyboard save was missing entirely from the original
  useEffect(() => {
    const handler = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "s") {
        e.preventDefault();
        if (selectedFile) saveContent();
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedFile, pages]);

  // ─── Warn on tab close when there are unsaved changes ────────────────────
  // BUG FIX: without this, closing the tab silently discarded edits
  useEffect(() => {
    const handler = (e) => {
      if (isDirty) { e.preventDefault(); e.returnValue = ""; }
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [isDirty]);

  // ─── Helpers ─────────────────────────────────────────────────────────────
  const fetchFiles = async (uid) => {
    const snap = await getDocs(collection(db, "users", uid, "files"));
    setFiles(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
  };

  // BUG FIX: original ensureMeta crashed when passed a plain string (old-format pages)
  const ensureMeta = (page) => {
    if (typeof page === "string")
      return { data: page, meta: { template: "plain" } };
    return { data: page?.data ?? "", meta: { template: page?.meta?.template ?? "plain" } };
  };

  // BUG FIX: switching files without saving silently discarded unsaved changes
  const openFile = useCallback((file) => {
    if (isDirty) {
      const ok = window.confirm("You have unsaved changes. Discard and open this entry?");
      if (!ok) return;
    }
    const filePages = (!file.content || file.content.length === 0)
        ? [ensureMeta("")]
        : file.content.map(ensureMeta);
    setPages(filePages);
    setCurrentPage(0);
    setSelectedFile(file);
    setEditingTitle(false);
    setIsDirty(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isDirty]);

  const addFile = async () => {
    setLoading(true);
    try {
      const createdAt = new Date(selectedDate).toISOString();
      const docRef = await addDoc(collection(db, "users", user.uid, "files"), {
        name: "New Entry", content: [], createdAt
      });
      const newFile = { id: docRef.id, name: "New Entry", content: [], createdAt };
      setFiles((prev) => [...prev, newFile]);
      // Open directly (isDirty is false here so no confirm needed)
      const filePages = [ensureMeta("")];
      setPages(filePages);
      setCurrentPage(0);
      setSelectedFile(newFile);
      setEditingTitle(false);
      setIsDirty(false);
      // Auto-focus title for immediate rename
      setTimeout(() => {
        setTempTitle("New Entry");
        setEditingTitle(true);
        titleInputRef.current?.focus();
      }, 40);
    } finally {
      setLoading(false);
    }
  };

  const deleteFile = async (id) => {
    try {
      setDeletingFileId(id);
      await deleteDoc(doc(db, "users", user.uid, "files", id));
      setFiles((prev) => prev.filter((f) => f.id !== id));
      if (selectedFile?.id === id) {
        setSelectedFile(null);
        setPages([]);
        setIsDirty(false);
      }
    } catch (e) {
      alert("Delete failed: " + e.message);
    } finally {
      setDeletingFileId(null);
    }
  };

  const renameFile = async (id, newName) => {
    // BUG FIX: empty-name guard — original allowed saving a blank title
    const trimmed = (newName || "").trim();
    if (!trimmed) return;
    await updateDoc(doc(db, "users", user.uid, "files", id), { name: trimmed });
    setFiles((prev) => prev.map((f) => f.id === id ? { ...f, name: trimmed } : f));
    if (selectedFile?.id === id)
      setSelectedFile((prev) => ({ ...prev, name: trimmed }));
  };

  const saveContent = async () => {
    if (!selectedFile) return;
    try {
      setSaving(true);
      await updateDoc(doc(db, "users", user.uid, "files", selectedFile.id), { content: pages });
      setFiles((prev) =>
          prev.map((f) => f.id === selectedFile.id ? { ...f, content: pages } : f)
      );
      setIsDirty(false);
    } catch {
      alert("Save failed. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  // ─── PDF export ───────────────────────────────────────────────────────────
  // BUG FIX: original used `pageContent` directly (an object), printing "[object Object]"
  // Also added a header rule line and safe filename sanitisation
  const downloadPDF = () => {
    if (!selectedFile || !pages?.length) return;
    const pdfdoc = new jsPDF();
    pages.forEach((page, index) => {
      if (index !== 0) pdfdoc.addPage();
      const text = typeof page === "string" ? page : (page?.data ?? "");
      pdfdoc.setFontSize(16);
      pdfdoc.text(selectedFile.name || "Diary Entry", 14, 16);
      pdfdoc.setFontSize(9);
      pdfdoc.setTextColor(120);
      pdfdoc.text(new Date(selectedFile.createdAt).toDateString(), 14, 23);
      pdfdoc.text(`Page ${index + 1} of ${pages.length}`, 196, 23, { align: "right" });
      pdfdoc.setTextColor(0);
      pdfdoc.setDrawColor(220);
      pdfdoc.line(14, 26, 196, 26);
      pdfdoc.setFontSize(11);
      const lines = pdfdoc.splitTextToSize(text, 182);
      pdfdoc.text(lines, 14, 34);
    });
    const safeName = (selectedFile.name || "diary").replace(/[^a-z0-9_-]/gi, "_");
    pdfdoc.save(`${safeName}.pdf`);
  };

  // ─── Date helpers ─────────────────────────────────────────────────────────
  const isSameDay = (d1, d2) =>
      new Date(d1).toDateString() === new Date(d2).toDateString();

  // BUG FIX: original called dates.reverse() which mutates the cached array in
  // `map`, causing the sidebar to flip order on every re-render. Spread first.
  const groupDatesByMonth = () => {
    const map = {};
    const today = new Date();
    const start = new Date(2024, 0, 1);
    for (let d = new Date(start); d <= today; d.setDate(d.getDate() + 1)) {
      const date = new Date(d);
      const key = date.toLocaleString("default", { month: "long", year: "numeric" });
      if (!map[key]) map[key] = [];
      map[key].push(new Date(date));
    }
    return Object.entries(map).reverse(); // newest month first
  };

  const filteredFiles = files.filter((f) => {
    if (!searchQuery) return isSameDay(f.createdAt, selectedDate);
    const q = searchQuery.toLowerCase();
    const body = Array.isArray(f.content)
        ? f.content.map((p) => (typeof p === "string" ? p : p?.data ?? "")).join(" ")
        : (f.content ?? "");
    return (f.name ?? "").toLowerCase().includes(q) || body.toLowerCase().includes(q);
  });

  const googleLogin = () => signInWithPopup(auth, provider);
  const logout      = () => signOut(auth);

  // ─── Page templates ───────────────────────────────────────────────────────
  const PAGE_TEMPLATES = {
    plain: {},
    lined: {
      backgroundImage: "repeating-linear-gradient(to bottom, transparent, transparent 27px, #e0e0e0 28px)",
      backgroundSize: "100% 28px"
    },
    dots: {
      backgroundImage: "radial-gradient(#ccc 1px, transparent 1px)",
      backgroundSize: "22px 22px"
    },
    stars: {
      backgroundImage: "radial-gradient(#f9ab00 1.2px, transparent 1.2px)",
      backgroundSize: "24px 24px"
    },
    dark: { background: "#1e1e1e", color: "#e8eaed" }
  };
  const templateStyle = (t) => PAGE_TEMPLATES[t] || {};

  // ─── Reusable hover row ───────────────────────────────────────────────────
  const HoverRow = ({ children, onClick, style }) => {
    const [hov, setHov] = useState(false);
    return (
        <div
            style={{ ...style, background: hov ? "#f1f3f4" : (style?.background || "transparent"), transition: "background 0.12s" }}
            onMouseEnter={() => setHov(true)}
            onMouseLeave={() => setHov(false)}
            onClick={onClick}
        >{children}</div>
    );
  };

  // ─────────────────────────────── RENDER ──────────────────────────────────

  if (!user) {
    return (
        <div style={s.loginPage}>
          <div style={s.loginCard}>
            <div style={s.loginLogo}>📖</div>
            <h1 style={s.loginTitle}>Diary</h1>
            <p style={s.loginSub}>Your private space to write.</p>
            <button style={s.googleBtn} onClick={googleLogin}>
              <svg width="18" height="18" viewBox="0 0 48 48" style={{ marginRight: 10, flexShrink: 0 }}>
                <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
                <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
                <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
                <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
              </svg>
              Continue with Google
            </button>
          </div>
        </div>
    );
  }

  const currentTemplate = pages[currentPage]?.meta?.template || "plain";
  const showSearchDrop  = searchFocused && searchQuery.trim().length > 0;

  return (
      <div style={s.wrapper}>

        {/* ── NAVBAR ── */}
        <nav style={s.navbar}>
          <span style={s.brand}>📖 Diary</span>

          <div ref={searchRef} style={s.navCenter}>
            <div style={s.searchWrapper}>
              <span style={s.searchIcon}>🔍</span>
              <input
                  type="text"
                  placeholder="Search entries…"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onFocus={() => setSearchFocused(true)}
                  style={s.navSearch}
              />
              {searchQuery && (
                  <button
                      style={s.searchClear}
                      onClick={() => { setSearchQuery(""); setSearchFocused(false); }}
                  >✕</button>
              )}
              {showSearchDrop && (
                  <div style={s.searchDropdown}>
                    {searchResults.length > 0 ? searchResults.map((f) => (
                        <HoverRow
                            key={f.id}
                            style={s.searchItem}
                            onClick={() => {
                              setSelectedDate(new Date(f.createdAt));
                              openFile(f);
                              setSearchQuery("");
                              setSearchFocused(false);
                            }}
                        >
                          <div style={s.searchItemName}>{f.name}</div>
                          <div style={s.searchItemDate}>{new Date(f.createdAt).toDateString()}</div>
                        </HoverRow>
                    )) : (
                        <div style={s.noResult}>No results found</div>
                    )}
                  </div>
              )}
            </div>
          </div>

          <div ref={menuRef} style={s.userSection}>
            <img
                src={user.photoURL}
                alt="avatar"
                style={s.avatar}
                onClick={(e) => { e.stopPropagation(); setShowMenu((v) => !v); }}
            />
            {showMenu && (
                <div style={s.userDropdown}>
                  <HoverRow style={s.dropdownRow} onClick={() => { setShowProfile(true); setShowMenu(false); }}>
                    <img src={user.photoURL} alt="" style={s.dropdownAvatar} />
                    <div>
                      <div style={s.dropdownName}>{user.displayName || "User"}</div>
                      <div style={s.dropdownEmail}>{user.email}</div>
                    </div>
                  </HoverRow>
                  <div style={s.divider} />
                  <HoverRow style={s.dropdownRow} onClick={logout}>
                    <span style={{ fontSize: 14, color: "#3c4043" }}>Sign out</span>
                  </HoverRow>
                </div>
            )}
          </div>
        </nav>

        {/* ── BODY ── */}
        <div style={s.body}>

          {/* LEFT sidebar — dates */}
          <aside style={s.leftSidebar}>
            <div style={s.datePickerWrap}>
              <input
                  type="date"
                  style={s.datePicker}
                  max={new Date().toISOString().split("T")[0]}
                  value={selectedDate.toISOString().split("T")[0]}
                  onChange={(e) => {
                    // BUG FIX: new Date(dateString) parses as UTC, shifting day by timezone.
                    // Append T00:00:00 to force local-time parsing.
                    const picked = new Date(e.target.value + "T00:00:00");
                    setSelectedDate(picked);
                    setSelectedFile(null);
                    setIsDirty(false);
                  }}
              />
            </div>

            <div style={s.dateList}>
              {groupDatesByMonth().map(([month, dates]) => (
                  <div key={month}>
                    <div
                        style={s.monthHeader}
                        onClick={() => setExpandedMonths((p) => ({ ...p, [month]: !p[month] }))}
                    >
                      <span>{month}</span>
                      <span style={{ fontSize: 9, opacity: 0.55 }}>{expandedMonths[month] ? "▲" : "▼"}</span>
                    </div>

                    {expandedMonths[month] && [...dates].reverse().map((d) => {
                      const active     = isSameDay(d, selectedDate);
                      const hasEntries = files.some((f) => isSameDay(f.createdAt, d));
                      return (
                          <div
                              key={d.toDateString()}
                              onClick={() => { setSelectedDate(d); setSelectedFile(null); setIsDirty(false); }}
                              style={{
                                ...s.dateItem,
                                background:  active ? "#e8f0fe" : "transparent",
                                fontWeight:  active ? 600 : 400,
                                color:       active ? "#1a73e8" : "#3c4043",
                                borderRadius: 6,
                              }}
                          >
                            {d.toDateString().slice(4, 10)}
                            {hasEntries && <span style={s.entryDot} />}
                          </div>
                      );
                    })}
                  </div>
              ))}
            </div>
          </aside>

          {/* MIDDLE sidebar — file list */}
          <aside style={s.midSidebar}>
            <div style={s.midHeader}>
            <span style={s.midTitle}>
              {searchQuery
                  ? `Results (${filteredFiles.length})`
                  : selectedDate.toLocaleDateString("default", { month: "short", day: "numeric" })}
            </span>
              <button style={s.addBtn} onClick={addFile} disabled={loading} title="New entry">
                {loading ? "…" : "+"}
              </button>
            </div>

            <div style={s.fileScroll}>
              {filteredFiles.length === 0 && (
                  <div style={s.emptyState}>
                    {searchQuery ? "No matches." : "No entries yet."}
                    {!searchQuery && <div style={{ marginTop: 6, fontSize: 12, color: "#9aa0a6" }}>Hit + to add one.</div>}
                  </div>
              )}
              {filteredFiles.map((f) => {
                const active    = selectedFile?.id === f.id;
                const isEditing = editingFileId === f.id;
                const deleting  = deletingFileId === f.id;
                return (
                    <div
                        key={f.id}
                        style={{ ...s.fileRow, background: active ? "#e8f0fe" : "transparent" }}
                        onClick={() => !isEditing && openFile(f)}
                    >
                      {isEditing ? (
                          <input
                              autoFocus
                              value={tempFileName}
                              onChange={(e) => setTempFileName(e.target.value)}
                              onKeyDown={async (e) => {
                                if (e.key === "Enter") { await renameFile(f.id, tempFileName); setEditingFileId(null); }
                                if (e.key === "Escape") setEditingFileId(null);
                              }}
                              style={s.renameInput}
                              onClick={(e) => e.stopPropagation()}
                          />
                      ) : (
                          <span style={{ ...s.fileName, color: active ? "#1a73e8" : "#202124", fontWeight: active ? 500 : 400 }}>
                      {f.name}
                    </span>
                      )}

                      {!isEditing && (
                          <div style={s.fileActions} onClick={(e) => e.stopPropagation()}>
                            <button
                                style={s.iconBtn}
                                title="Rename"
                                onClick={() => { setEditingFileId(f.id); setTempFileName(f.name); }}
                            >✏️</button>
                            <button
                                style={{ ...s.iconBtn, opacity: deleting ? 0.4 : 1 }}
                                title="Delete"
                                disabled={deleting}
                                onClick={async () => {
                                  if (window.confirm(`Delete "${f.name}"?`)) await deleteFile(f.id);
                                }}
                            >🗑️</button>
                          </div>
                      )}
                      {isEditing && (
                          <div style={s.fileActions} onClick={(e) => e.stopPropagation()}>
                            <button style={s.iconBtn} title="Confirm" onClick={async () => { await renameFile(f.id, tempFileName); setEditingFileId(null); }}>✔️</button>
                            <button style={s.iconBtn} title="Cancel"  onClick={() => setEditingFileId(null)}>❌</button>
                          </div>
                      )}
                    </div>
                );
              })}
            </div>
          </aside>

          {/* RIGHT — editor */}
          <main style={s.editorPane}>
            {!selectedFile ? (
                <div style={s.emptyEditor}>
                  <div style={{ fontSize: 44, marginBottom: 12 }}>📝</div>
                  <div style={{ fontSize: 15, color: "#80868b" }}>Select an entry or create a new one</div>
                </div>
            ) : (
                <div style={{ ...s.editorInner, background: templateStyle(currentTemplate).background || "#fff" }}>

                  {/* Toolbar */}
                  <div style={s.toolbar}>
                    <div style={s.toolbarLeft}>
                      {editingTitle ? (
                          <input
                              ref={titleInputRef}
                              value={tempTitle}
                              onChange={(e) => setTempTitle(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") { renameFile(selectedFile.id, tempTitle); setEditingTitle(false); }
                                if (e.key === "Escape") setEditingTitle(false);
                              }}
                              onBlur={() => { renameFile(selectedFile.id, tempTitle); setEditingTitle(false); }}
                              style={s.titleInput}
                          />
                      ) : (
                          <div
                              style={s.entryTitle}
                              title="Click to rename"
                              onClick={() => { setTempTitle(selectedFile.name); setEditingTitle(true); }}
                          >
                            {selectedFile.name}
                            {isDirty && <span style={s.dirtyDot} title="Unsaved changes" />}
                          </div>
                      )}
                      <span style={s.entryMeta}>
                    {new Date(selectedFile.createdAt).toLocaleDateString("default", {
                      weekday: "short", year: "numeric", month: "short", day: "numeric"
                    })}
                  </span>
                    </div>

                    <div style={s.toolbarRight}>
                      <select
                          value={currentTemplate}
                          onChange={(e) => {
                            const updated = [...pages];
                            updated[currentPage] = { ...ensureMeta(updated[currentPage]), meta: { template: e.target.value } };
                            setPages(updated);
                            setIsDirty(true);
                          }}
                          style={s.select}
                      >
                        <option value="plain">Plain</option>
                        <option value="lined">Lined</option>
                        <option value="dots">Dots</option>
                        <option value="stars">Stars</option>
                        <option value="dark">Dark</option>
                      </select>

                      <button style={s.btnOutline} onClick={downloadPDF}>⬇ PDF</button>

                      <button
                          style={{ ...s.btnPrimary, opacity: saving ? 0.7 : 1, background: isDirty ? "#1a73e8" : "#34a853" }}
                          onClick={saveContent}
                          disabled={saving}
                          title="Save (Ctrl+S / Cmd+S)"
                      >
                        {saving
                            ? <><span style={s.spinner} /> Saving…</>
                            : isDirty ? "Save" : "✓ Saved"}
                      </button>
                    </div>
                  </div>

                  {/* Textarea */}
                  <textarea
                      style={{
                        ...s.textarea,
                        ...templateStyle(currentTemplate),
                        // keep text colour correct for dark template
                        color: currentTemplate === "dark" ? "#e8eaed" : "#202124",
                      }}
                      value={pages[currentPage]?.data ?? ""}
                      placeholder="Start writing…"
                      onChange={(e) => {
                        const updated = [...pages];
                        updated[currentPage] = { ...ensureMeta(updated[currentPage]), data: e.target.value };
                        setPages(updated);
                        setIsDirty(true);
                      }}
                  />

                  {/* Pagination bar */}
                  <div style={s.pagination}>
                    <button
                        style={s.pageBtn}
                        disabled={currentPage === 0}
                        onClick={() => setCurrentPage((p) => p - 1)}
                    >← Prev</button>

                    <span style={s.pageLabel}>
                  Page {currentPage + 1} / {pages.length || 1}
                </span>

                    <button
                        style={s.pageBtn}
                        disabled={currentPage >= pages.length - 1}
                        onClick={() => setCurrentPage((p) => p + 1)}
                    >Next →</button>

                    <button
                        style={{ ...s.pageBtn, marginLeft: 6 }}
                        onClick={() => {
                          setPages((prev) => [...prev, ensureMeta("")]);
                          setCurrentPage(pages.length);
                          setIsDirty(true);
                        }}
                    >+ Page</button>

                    {/* BUG FIX: there was no way to delete a page — users could only add */}
                    {pages.length > 1 && (
                        <button
                            style={{ ...s.pageBtn, color: "#d93025", borderColor: "#f5c6c6" }}
                            onClick={() => {
                              if (!window.confirm("Delete this page? This cannot be undone.")) return;
                              const updated = pages.filter((_, i) => i !== currentPage);
                              setPages(updated);
                              setCurrentPage(Math.min(currentPage, updated.length - 1));
                              setIsDirty(true);
                            }}
                        >✕ Page</button>
                    )}
                  </div>
                </div>
            )}
          </main>
        </div>

        {/* ── PROFILE MODAL ── */}
        {showProfile && (
            <div style={s.overlay} onClick={() => setShowProfile(false)}>
              <div style={s.modal} onClick={(e) => e.stopPropagation()}>
                <img src={user.photoURL} alt="profile" style={s.profileImg} />
                <div style={s.profileName}>{user.displayName}</div>
                <div style={s.profileEmail}>{user.email}</div>
                <div style={{ display: "flex", gap: 8, marginTop: 20 }}>
                  <button style={s.btnOutline} onClick={() => setShowProfile(false)}>Close</button>
                  <button
                      style={{ ...s.btnPrimary, background: "#d93025" }}
                      onClick={() => { setShowProfile(false); logout(); }}
                  >Sign out</button>
                </div>
              </div>
            </div>
        )}
      </div>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const s = {
  wrapper:     { height: "100vh", display: "flex", flexDirection: "column", overflow: "hidden", background: "#fff" },
  body:        { display: "flex", flex: 1, overflow: "hidden" },

  // Login
  loginPage:   { display: "flex", justifyContent: "center", alignItems: "center", height: "100vh", background: "#f8f9fa" },
  loginCard:   { background: "#fff", padding: "40px 48px", borderRadius: 16, border: "1px solid #e8eaed", textAlign: "center", maxWidth: 360, width: "90%" },
  loginLogo:   { fontSize: 40, marginBottom: 8 },
  loginTitle:  { margin: "0 0 4px", fontSize: 26, fontWeight: 700, color: "#202124" },
  loginSub:    { margin: "0 0 28px", color: "#5f6368", fontSize: 14 },
  googleBtn:   { display: "flex", alignItems: "center", justifyContent: "center", width: "100%", padding: "10px 16px", border: "1px solid #dadce0", borderRadius: 8, background: "#fff", cursor: "pointer", fontSize: 14, fontWeight: 500, color: "#3c4043" },

  // Navbar
  navbar:      { height: 56, display: "flex", alignItems: "center", padding: "0 16px", borderBottom: "1px solid #e8eaed", gap: 12, flexShrink: 0 },
  brand:       { fontWeight: 700, fontSize: 16, color: "#202124", whiteSpace: "nowrap" },
  navCenter:   { flex: 1, display: "flex", justifyContent: "center", maxWidth: 480, margin: "0 auto" },
  searchWrapper:  { position: "relative", width: "100%" },
  searchIcon:  { position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", fontSize: 13, pointerEvents: "none" },
  navSearch:   { width: "100%", padding: "7px 34px 7px 34px", borderRadius: 20, border: "1px solid #e0e0e0", background: "#f1f3f4", outline: "none", fontSize: 13, color: "#202124" },
  searchClear: { position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", border: "none", background: "transparent", cursor: "pointer", fontSize: 12, color: "#80868b", padding: 2 },
  searchDropdown: { position: "absolute", top: "calc(100% + 6px)", left: 0, right: 0, background: "#fff", border: "1px solid #e0e0e0", borderRadius: 10, boxShadow: "0 4px 16px rgba(0,0,0,0.08)", zIndex: 200, maxHeight: 280, overflowY: "auto" },
  searchItem:  { padding: "10px 14px", cursor: "pointer", borderBottom: "1px solid #f1f3f4" },
  searchItemName: { fontSize: 13, color: "#202124", fontWeight: 500 },
  searchItemDate: { fontSize: 11, color: "#80868b", marginTop: 2 },
  noResult:    { padding: 16, fontSize: 13, color: "#80868b", textAlign: "center" },

  // User
  userSection: { position: "relative", marginLeft: "auto" },
  avatar:      { width: 32, height: 32, borderRadius: "50%", cursor: "pointer", border: "2px solid #e8eaed" },
  userDropdown: { position: "absolute", top: 42, right: 0, background: "#fff", border: "1px solid #e0e0e0", borderRadius: 10, boxShadow: "0 4px 16px rgba(0,0,0,0.1)", minWidth: 220, zIndex: 300 },
  dropdownRow: { display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", cursor: "pointer" },
  dropdownAvatar: { width: 32, height: 32, borderRadius: "50%", flexShrink: 0 },
  dropdownName: { fontSize: 13, fontWeight: 600, color: "#202124" },
  dropdownEmail: { fontSize: 11, color: "#80868b" },
  divider:     { height: 1, background: "#f1f3f4", margin: "2px 0" },

  // Left sidebar
  leftSidebar: { width: 180, borderRight: "1px solid #e8eaed", display: "flex", flexDirection: "column", overflow: "hidden", flexShrink: 0 },
  datePickerWrap: { padding: "10px 10px 6px" },
  datePicker:  { width: "100%", padding: "7px 8px", borderRadius: 8, border: "1px solid #e0e0e0", fontSize: 12, color: "#202124", outline: "none", background: "#fff" },
  dateList:    { flex: 1, overflowY: "auto", padding: "0 6px 8px" },
  monthHeader: { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 6px 4px", cursor: "pointer", fontSize: 11, fontWeight: 700, color: "#80868b", textTransform: "uppercase", letterSpacing: "0.05em", userSelect: "none" },
  dateItem:    { display: "flex", alignItems: "center", justifyContent: "space-between", padding: "5px 8px", cursor: "pointer", fontSize: 12, margin: "1px 0" },
  entryDot:    { width: 5, height: 5, borderRadius: "50%", background: "#1a73e8", flexShrink: 0 },

  // Mid sidebar
  midSidebar:  { width: 220, borderRight: "1px solid #e8eaed", display: "flex", flexDirection: "column", overflow: "hidden", flexShrink: 0 },
  midHeader:   { display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 12px 10px", borderBottom: "1px solid #f1f3f4", flexShrink: 0 },
  midTitle:    { fontSize: 13, fontWeight: 600, color: "#3c4043" },
  addBtn:      { width: 26, height: 26, borderRadius: "50%", border: "none", background: "#1a73e8", color: "#fff", fontSize: 20, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", lineHeight: 1, paddingBottom: 1 },
  fileScroll:  { flex: 1, overflowY: "auto", padding: "6px 8px" },
  emptyState:  { padding: "28px 12px", textAlign: "center", fontSize: 13, color: "#80868b" },
  fileRow:     { display: "flex", alignItems: "center", padding: "7px 8px", borderRadius: 8, cursor: "pointer", gap: 4, marginBottom: 1 },
  fileName:    { flex: 1, fontSize: 13, overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" },
  fileActions: { display: "flex", gap: 0, flexShrink: 0 },
  iconBtn:     { border: "none", background: "transparent", cursor: "pointer", fontSize: 13, padding: "3px 5px", borderRadius: 4 },
  renameInput: { flex: 1, fontSize: 13, padding: "2px 6px", border: "1px solid #1a73e8", borderRadius: 4, outline: "none", minWidth: 0 },

  // Editor
  editorPane:  { flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" },
  emptyEditor: { flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" },
  editorInner: { display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" },

  // Toolbar
  toolbar:     { display: "flex", alignItems: "flex-start", justifyContent: "space-between", padding: "12px 20px 10px", borderBottom: "1px solid #f1f3f4", gap: 12, flexShrink: 0 },
  toolbarLeft: { display: "flex", flexDirection: "column", gap: 2, minWidth: 0 },
  toolbarRight: { display: "flex", alignItems: "center", gap: 8, flexShrink: 0 },
  entryTitle:  { margin: 0, fontSize: 16, fontWeight: 600, color: "#202124", cursor: "pointer", display: "flex", alignItems: "center", gap: 7, userSelect: "none" },
  dirtyDot:    { width: 7, height: 7, borderRadius: "50%", background: "#fbbc04", display: "inline-block", flexShrink: 0 },
  entryMeta:   { fontSize: 11, color: "#9aa0a6" },
  titleInput:  { fontSize: 15, fontWeight: 600, border: "none", borderBottom: "2px solid #1a73e8", outline: "none", padding: "1px 0", color: "#202124", width: 260, background: "transparent" },

  btnPrimary:  { padding: "7px 14px", background: "#1a73e8", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer", fontSize: 13, fontWeight: 500, display: "flex", alignItems: "center", gap: 5, whiteSpace: "nowrap" },
  btnOutline:  { padding: "6px 12px", background: "#fff", color: "#3c4043", border: "1px solid #dadce0", borderRadius: 6, cursor: "pointer", fontSize: 13, whiteSpace: "nowrap" },
  select:      { padding: "6px 8px", border: "1px solid #dadce0", borderRadius: 6, fontSize: 12, color: "#3c4043", outline: "none", background: "#fff" },
  spinner:     { width: 12, height: 12, border: "2px solid rgba(255,255,255,0.35)", borderTop: "2px solid #fff", borderRadius: "50%", display: "inline-block", animation: "spin 0.8s linear infinite" },

  textarea:    { flex: 1, padding: "18px 24px", border: "none", outline: "none", resize: "none", fontSize: 14, lineHeight: 1.8, background: "transparent", fontFamily: "inherit" },

  pagination:  { display: "flex", alignItems: "center", gap: 6, padding: "8px 16px", borderTop: "1px solid #f1f3f4", flexShrink: 0, background: "#fafafa" },
  pageBtn:     { padding: "5px 10px", border: "1px solid #e0e0e0", background: "#fff", borderRadius: 6, cursor: "pointer", fontSize: 12, color: "#3c4043" },
  pageLabel:   { fontSize: 12, color: "#9aa0a6", margin: "0 4px" },

  overlay:     { position: "fixed", inset: 0, background: "rgba(0,0,0,0.3)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 500 },
  modal:       { background: "#fff", borderRadius: 14, padding: "32px 36px", textAlign: "center", boxShadow: "0 8px 30px rgba(0,0,0,0.12)", display: "flex", flexDirection: "column", alignItems: "center" },
  profileImg:  { width: 72, height: 72, borderRadius: "50%", marginBottom: 12, border: "3px solid #e8eaed" },
  profileName: { fontSize: 17, fontWeight: 700, color: "#202124", marginBottom: 2 },
  profileEmail: { fontSize: 13, color: "#80868b" },
};