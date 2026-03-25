import React, { useState, useEffect, useRef } from "react";
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

export default function App() {
  const [user, setUser] = useState(null);
  const [files, setFiles] = useState([]);
  const [selectedFile, setSelectedFile] = useState(null);
  const [content, setContent] = useState("");
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [loading, setLoading] = useState(false);

  const [editingTitle, setEditingTitle] = useState(false);
  const [tempTitle, setTempTitle] = useState("");

  const [showMenu, setShowMenu] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [saving, setSaving] = useState(false);
  const menuRef = useRef(null);
  const [deletingFileId, setDeletingFileId] = useState(null);
  const [editingFileId, setEditingFileId] = useState(null);
  const [tempFileName, setTempFileName] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  // FIX 1: Removed showSearchDropdown state — dropdown now shows whenever
  // searchQuery is non-empty and there are results (or a "no results" message).
  const [expandedMonths, setExpandedMonths] = useState({});
  const [pages, setPages] = useState([]);
  const [currentPage, setCurrentPage] = useState(0);

  // FIX 2: PDF export now correctly reads page.data (or falls back to string)
  // instead of using the raw page object, which was printing "[object Object]".
  const downloadPDF = () => {
    if (!selectedFile || !pages?.length) return;

    const doc = new jsPDF();

    pages.forEach((page, index) => {
      if (index !== 0) doc.addPage();

      // Normalise: pages can be plain strings (old format) or {data, meta} objects
      const pageContent = typeof page === "string" ? page : (page?.data || "");

      doc.setFontSize(16);
      doc.text(selectedFile.name || "Diary Entry", 10, 10);

      doc.setFontSize(10);
      doc.text(`Page ${index + 1}`, 180, 10, { align: "right" });

      doc.text(
          new Date(selectedFile.createdAt).toDateString(),
          10,
          18
      );

      doc.setFontSize(12);
      const lines = doc.splitTextToSize(pageContent, 180);
      doc.text(lines, 10, 30);
    });

    doc.save(`${selectedFile.name || "diary"}.pdf`);
  };

  const toggleMonth = (month) => {
    setExpandedMonths((prev) => ({
      ...prev,
      [month]: !prev[month]
    }));
  };

  const handleSearchSelect = (file) => {
    setSelectedFile(file);
    const filePages = file.content?.length ? file.content : [""];
    setPages(filePages);
    setCurrentPage(0);
    setSelectedDate(new Date(file.createdAt));
    setSearchQuery("");
  };

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      if (u) fetchFiles(u.uid);
    });
    return () => unsub();
  }, []);

  // FIX 1 (cont): Search results are stored as plain file objects (not wrapped
  // in { file } like before), so the dropdown can render them directly.
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }

    const results = (files || []).filter((f) => {
      const nameMatch = (f.name || "")
          .toLowerCase()
          .includes(searchQuery.toLowerCase());

      let contentText = "";
      if (Array.isArray(f.content)) {
        contentText = f.content
            .map((p) => (typeof p === "string" ? p : p?.data || ""))
            .join(" ");
      } else {
        contentText = f.content || "";
      }

      const contentMatch = contentText
          .toLowerCase()
          .includes(searchQuery.toLowerCase());

      return nameMatch || contentMatch;
    });

    // Store results as flat file objects (no extra wrapping)
    setSearchResults(results);
  }, [searchQuery, files]);

  useEffect(() => {
    const handler = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setShowMenu(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const fetchFiles = async (uid) => {
    const snap = await getDocs(collection(db, "users", uid, "files"));
    setFiles(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
  };

  const googleLogin = async () => {
    await signInWithPopup(auth, provider);
  };

  const logout = async () => {
    await signOut(auth);
  };

  const ensureMeta = (page) => ({
    data: page.data || "",
    meta: {
      template: page.meta?.template || "plain"
    }
  });

  const addFile = async () => {
    setLoading(true);
    const createdAt = new Date(selectedDate).toISOString();

    const docRef = await addDoc(
        collection(db, "users", user.uid, "files"),
        { name: "New Entry", content: ["", ""], createdAt }
    );

    const newFile = {
      id: docRef.id,
      name: "New Entry",
      content: ["", ""],
      createdAt
    };

    setFiles((prev) => [...prev, newFile]);
    setSelectedFile(newFile);
    setContent("");
    setLoading(false);
  };

  const deleteFile = async (id) => {
    try {
      await deleteDoc(doc(db, "users", user.uid, "files", id));
      setFiles((prev) => prev.filter((f) => f.id !== id));
      if (selectedFile?.id === id) {
        setSelectedFile(null);
        setContent("");
      }
    } catch (e) {
      console.error("Delete failed:", e);
      alert("Delete failed: " + e.message);
    }
  };

  const renameFile = async (id, newName) => {
    await updateDoc(doc(db, "users", user.uid, "files", id), {
      name: newName
    });
    setFiles((prev) =>
        prev.map((f) => (f.id === id ? { ...f, name: newName } : f))
    );
    if (selectedFile?.id === id) {
      setSelectedFile((prev) => ({ ...prev, name: newName }));
    }
  };

  const openFile = (file) => {
    let filePages = [];

    if (!file.content || file.content.length === 0) {
      filePages = [ensureMeta({ data: "" })];
    } else if (typeof file.content[0] === "string") {
      filePages = file.content.map((text) => ensureMeta({ data: text }));
    } else {
      filePages = file.content.map(ensureMeta);
    }

    setPages(filePages);
    setCurrentPage(0);
    setSelectedFile(file);
    setEditingTitle(false);
  };

  const PAGE_TEMPLATES = {
    plain: {},
    lined: {
      backgroundImage:
          "repeating-linear-gradient(to bottom, transparent, transparent 28px, #ccc 29px)",
      backgroundSize: "100% 30px"
    },
    dots: {
      backgroundImage: "radial-gradient(#ccc 1px, transparent 1px)",
      backgroundSize: "20px 20px"
    },
    stars: {
      backgroundImage: "radial-gradient(#fbbc04 1px, transparent 1px)",
      backgroundSize: "25px 25px"
    },
    dark: {
      background: "#202124",
      color: "#fff"
    }
  };

  const getTemplateStyle = (template) => {
    return PAGE_TEMPLATES[template] || PAGE_TEMPLATES.plain;
  };

  const HoverableDropdownItem = ({ children, onClick }) => {
    const [hover, setHover] = React.useState(false);
    return (
        <div
            style={{
              ...styles.userDropdownItem,
              background: hover ? "#f1f3f4" : "transparent"
            }}
            onMouseEnter={() => setHover(true)}
            onMouseLeave={() => setHover(false)}
            onClick={onClick}
        >
          {children}
        </div>
    );
  };

  const saveContent = async () => {
    if (!selectedFile) return;
    try {
      setSaving(true);
      await updateDoc(
          doc(db, "users", user.uid, "files", selectedFile.id),
          { content: pages }
      );
      setFiles((prev) =>
          prev.map((f) =>
              f.id === selectedFile.id ? { ...f, content: pages } : f
          )
      );
    } catch (e) {
      alert("Save failed");
    } finally {
      setSaving(false);
    }
  };

  const isSameDay = (d1, d2) =>
      new Date(d1).toDateString() === new Date(d2).toDateString();

  const filteredFiles = files.filter((f) => {
    if (!searchQuery) {
      return isSameDay(f.createdAt, selectedDate);
    }
    const query = searchQuery.toLowerCase();
    const contentText = Array.isArray(f.content)
        ? f.content.map((p) => (typeof p === "string" ? p : p?.data || "")).join(" ")
        : f.content || "";
    return (
        f.name?.toLowerCase().includes(query) ||
        contentText.toLowerCase().includes(query)
    );
  });

  const groupDatesByMonth = () => {
    const map = {};
    const today = new Date();
    const start = new Date(2024, 0, 1);

    for (let d = new Date(start); d <= today; d.setDate(d.getDate() + 1)) {
      const date = new Date(d);
      const monthKey = date.toLocaleString("default", {
        month: "long",
        year: "numeric"
      });
      if (!map[monthKey]) map[monthKey] = [];
      map[monthKey].push(new Date(date));
    }

    return Object.entries(map).reverse();
  };

  if (!user) {
    return (
        <div>
          <h1 style={styles.loginTitle}>Diary</h1>
          <div style={styles.center}>
            <div style={styles.card}>
              <h3 style={styles.loginSubtitle}>Welcome</h3>
              <button style={styles.googleBtn} onClick={googleLogin}>
                Continue with Google
              </button>
            </div>
          </div>
        </div>
    );
  }

  return (
      <div style={styles.wrapper}>
        {/* NAVBAR */}
        <div style={styles.navbar}>
          <h2>Diary</h2>

          {/* SEARCH BAR */}
          <div style={styles.navCenter}>
            <div style={styles.searchWrapper}>
              <input
                  type="text"
                  placeholder="Search..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onFocus={() => {}} // keep for future use
                  style={styles.navSearch}
              />

              {/* FIX 1: Dropdown renders whenever searchQuery is non-empty —
                no longer gated behind showSearchDropdown which was never set. */}
              {searchQuery && (
                  <div style={styles.searchDropdown}>
                    {searchResults.length > 0 ? (
                        searchResults.map((f) => (
                            <div
                                key={f.id}
                                style={styles.searchItem}
                                onClick={() => {
                                  setSelectedDate(new Date(f.createdAt));
                                  openFile(f);
                                  setSearchQuery("");
                                }}
                            >
                              <div>{f.name}</div>
                              <small>{new Date(f.createdAt).toDateString()}</small>
                            </div>
                        ))
                    ) : (
                        <div style={styles.noResult}>No results found</div>
                    )}
                  </div>
              )}
            </div>
          </div>

          <div ref={menuRef} style={styles.userSection}>
            <img
                src={user.photoURL}
                style={styles.avatar}
                onClick={(e) => {
                  e.stopPropagation();
                  setShowMenu(!showMenu);
                }}
            />

            {showMenu && (
                <div style={styles.userDropdown}>
                  <HoverableDropdownItem
                      onClick={() => {
                        setShowProfile(true);
                        setShowMenu(false);
                      }}
                  >
                    <img src={user.photoURL} style={styles.userDropdownAvatar} />
                    <span>{user.displayName || "User"}</span>
                  </HoverableDropdownItem>
                  <div style={styles.dropdownDivider}></div>
                  <HoverableDropdownItem onClick={logout}>
                    Logout
                  </HoverableDropdownItem>
                </div>
            )}
          </div>
        </div>

        {/* MAIN */}
        <div style={styles.container}>
          {/* LEFT */}
          <div style={styles.leftSidebar}>
            <div style={styles.dateInputWrapper}>
              <input
                  type="date"
                  style={styles.calendarPicker}
                  max={new Date().toISOString().split("T")[0]}
                  value={selectedDate.toISOString().split("T")[0]}
                  onChange={(e) => {
                    const picked = new Date(e.target.value);
                    setSelectedDate(picked);
                    setSelectedFile(null);
                    setContent("");
                  }}
              />
            </div>

            <div style={styles.dateList}>
              {groupDatesByMonth().map(([month, dates]) => (
                  <div key={month}>
                    <div
                        style={styles.monthHeader}
                        onClick={() => toggleMonth(month)}
                    >
                      {expandedMonths[month] ? "▼" : "▶"} {month}
                    </div>

                    {expandedMonths[month] &&
                        dates.reverse().map((d) => {
                          const active = isSameDay(d, selectedDate);
                          return (
                              <div
                                  key={d.toDateString()}
                                  onClick={() => {
                                    setSelectedDate(d);
                                    setSelectedFile(null);
                                    setContent("");
                                  }}
                                  style={{
                                    ...styles.dateItem,
                                    background: active ? "#d2e3fc" : ""
                                  }}
                              >
                                {d.toDateString().slice(0, 10)}
                              </div>
                          );
                        })}
                  </div>
              ))}
            </div>
          </div>

          {/* FILES */}
          <div style={styles.middleSidebar}>
            <div style={styles.fileScrollArea}>
              <div style={styles.fileList}>
                {filteredFiles.map((f) => {
                  const active = selectedFile?.id === f.id;
                  const isEditing = editingFileId === f.id;

                  return (
                      <div
                          key={f.id}
                          style={{
                            ...styles.fileRow,
                            background: active ? "#e8f0fe" : ""
                          }}
                      >
                        <div
                            style={styles.fileName}
                            onClick={() => !isEditing && openFile(f)}
                        >
                          {isEditing ? (
                              <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                                <input
                                    value={tempFileName}
                                    onChange={(e) => setTempFileName(e.target.value)}
                                />
                                <button
                                    style={styles.iconBtn}
                                    onClick={async (e) => {
                                      e.stopPropagation();
                                      await renameFile(f.id, tempFileName);
                                      setEditingFileId(null);
                                    }}
                                >
                                  ✔️
                                </button>
                                <button
                                    style={styles.iconBtn}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setEditingFileId(null);
                                    }}
                                >
                                  ❌
                                </button>
                              </div>
                          ) : (
                              f.name
                          )}
                        </div>

                        {!isEditing && (
                            <div style={styles.fileActions}>
                              <button
                                  style={styles.iconBtn}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setEditingFileId(f.id);
                                    setTempFileName(f.name);
                                  }}
                              >
                                ✏️
                              </button>
                              <button
                                  style={styles.iconBtn}
                                  onClick={async (e) => {
                                    e.stopPropagation();
                                    const confirmDelete = confirm("Delete this file?");
                                    if (!confirmDelete) return;
                                    try {
                                      setDeletingFileId(f.id);
                                      await deleteFile(f.id);
                                    } finally {
                                      setDeletingFileId(null);
                                    }
                                  }}
                                  disabled={deletingFileId === f.id}
                              >
                                {deletingFileId === f.id ? (
                                    <span style={styles.spinner}></span>
                                ) : (
                                    "🗑️"
                                )}
                              </button>
                            </div>
                        )}
                      </div>
                  );
                })}
              </div>
            </div>
            <button style={styles.addFileBtn} onClick={addFile}>
              + Add File
            </button>
          </div>

          {/* CONTENT */}
          <div style={styles.main}>
            {loading ? (
                <div>Creating file...</div>
            ) : selectedFile ? (
                <div
                    style={{
                      ...styles.editorContainer,
                      ...getTemplateStyle(pages[currentPage]?.meta?.template)
                    }}
                >
                  <div style={styles.editorHeader}>
                    {editingTitle ? (
                        <div style={styles.titleRow}>
                          <input
                              value={tempTitle}
                              onChange={(e) => setTempTitle(e.target.value)}
                          />
                          <span
                              onClick={() => {
                                renameFile(selectedFile.id, tempTitle);
                                setEditingTitle(false);
                              }}
                          >
                      ✔️
                    </span>
                          <span onClick={() => setEditingTitle(false)}>❌</span>
                        </div>
                    ) : (
                        <h3
                            onClick={() => {
                              setTempTitle(selectedFile.name);
                              setEditingTitle(true);
                            }}
                        >
                          {selectedFile.name}
                        </h3>
                    )}
                    <button style={styles.secondaryBtn} onClick={downloadPDF}>
                      Download PDF
                    </button>
                    <button
                        style={{
                          ...styles.primaryBtn,
                          opacity: saving ? 0.7 : 1,
                          cursor: saving ? "not-allowed" : "pointer"
                        }}
                        onClick={saveContent}
                        disabled={saving}
                    >
                      {saving ? (
                          <>
                            <span style={styles.spinner}></span> Saving...
                          </>
                      ) : (
                          "Save"
                      )}
                    </button>
                    <select
                        value={pages[currentPage]?.meta?.template || "plain"}
                        onChange={(e) => {
                          const updated = [...pages];
                          updated[currentPage] = ensureMeta(updated[currentPage]);
                          updated[currentPage].meta.template = e.target.value;
                          setPages(updated);
                        }}
                    >
                      <option value="plain">Plain</option>
                      <option value="lined">Lined</option>
                      <option value="dots">Dots</option>
                      <option value="stars">Stars</option>
                      <option value="dark">Dark</option>
                    </select>
                    <div style={styles.pagination}>
                      <button
                          disabled={currentPage === 0}
                          onClick={() => setCurrentPage((p) => p - 1)}
                      >
                        ⬅ Prev
                      </button>
                      <span>
                    Page {currentPage + 1} / {pages.length}
                  </span>
                      <button
                          disabled={currentPage === pages.length - 1}
                          onClick={() => setCurrentPage((p) => p + 1)}
                      >
                        Next ➡
                      </button>
                      <button
                          onClick={() => {
                            setPages([...pages, ""]);
                            setCurrentPage(pages.length);
                          }}
                      >
                        + Add Page
                      </button>
                    </div>
                  </div>

                  <textarea
                      style={{
                        ...styles.textarea,
                        ...getTemplateStyle(pages[currentPage]?.meta?.template)
                      }}
                      value={pages[currentPage]?.data || ""}
                      onChange={(e) => {
                        const updated = [...pages];
                        updated[currentPage] = {
                          ...updated[currentPage],
                          data: e.target.value
                        };
                        setPages(updated);
                      }}
                  />
                </div>
            ) : (
                <div>Select a file</div>
            )}
          </div>
        </div>

        {/* PROFILE MODAL */}
        {showProfile && (
            <div
                style={styles.profileOverlay}
                onClick={() => setShowProfile(false)}
            >
              <div
                  style={styles.profileModal}
                  onClick={(e) => e.stopPropagation()}
              >
                <img src={user.photoURL} style={styles.profileImage} />
                <div style={styles.profileName}>{user.displayName}</div>
                <div style={styles.profileEmail}>{user.email}</div>
                <button
                    style={styles.profileCloseBtn}
                    onClick={() => setShowProfile(false)}
                >
                  Close
                </button>
              </div>
            </div>
        )}
      </div>
  );
}

const styles = {
  wrapper: {
    height: "100vh",
    display: "flex",
    flexDirection: "column",
    overflow: "hidden"
  },
  container: {
    display: "flex",
    flex: 1,
    overflow: "hidden"
  },
  navbar: {
    height: 60,
    display: "flex",
    justifyContent: "space-between",
    padding: "0 20px",
    alignItems: "center",
    borderBottom: "1px solid #ddd"
  },
  fileList: {
    flex: 1,
    overflowY: "auto"
  },
  leftSidebar: {
    width: "15%",
    borderRight: "1px solid #ddd",
    padding: 10,
    display: "flex",
    flexDirection: "column",
    overflow: "hidden"
  },
  dateList: {
    flex: 1,
    overflowY: "auto",
    scrollBehavior: "smooth"
  },
  primaryBtn: {
    padding: 8,
    background: "#1a73e8",
    color: "white",
    border: "none"
  },
  googleBtn: { padding: 10, background: "#ea4335", color: "white" },
  userSection: { position: "relative" },
  avatar: { width: 35, borderRadius: "50%" },
  editorHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center"
  },
  titleRow: { display: "flex", gap: 10 },
  center: {
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    height: "100vh"
  },
  card: { padding: 20, border: "1px solid #ccc", textAlign: "center" },
  input: { width: "100%", padding: 8, marginTop: 10 },
  main: {
    flex: 1,
    padding: 20,
    display: "flex",
    flexDirection: "column",
    overflow: "hidden"
  },
  editorContainer: {
    display: "flex",
    flexDirection: "column",
    height: "100%",
    overflow: "hidden"
  },
  icon: {
    cursor: "pointer",
    padding: "6px",
    zIndex: 10,
    position: "relative"
  },
  fileRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "8px",
    gap: "10px",
    position: "relative"
  },
  fileName: {
    flex: 1,
    cursor: "pointer",
    overflow: "hidden",
    whiteSpace: "nowrap",
    textOverflow: "ellipsis",
    zIndex: 1
  },
  fileActions: {
    display: "flex",
    gap: "8px",
    zIndex: 5,
    position: "relative"
  },
  iconBtn: {
    border: "none",
    background: "transparent",
    cursor: "pointer",
    fontSize: "16px",
    padding: "6px",
    pointerEvents: "auto"
  },
  spinner: {
    border: "2px solid #fff",
    borderTop: "2px solid transparent",
    borderRadius: "50%",
    width: 14,
    height: 14,
    display: "inline-block",
    animation: "spin 1s linear infinite",
    marginRight: 6
  },
  profileOverlay: {
    position: "fixed",
    top: 0,
    left: 0,
    width: "100%",
    height: "100%",
    background: "rgba(0,0,0,0.3)",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 1000
  },
  profileModal: {
    background: "#fff",
    padding: 20,
    borderRadius: 10,
    minWidth: 300,
    maxWidth: "90%",
    boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
    textAlign: "center",
    display: "flex",
    flexDirection: "column",
    alignItems: "center"
  },
  profileImage: {
    width: 80,
    height: 80,
    borderRadius: "50%",
    marginBottom: 10
  },
  profileName: {
    fontWeight: 600,
    fontSize: 18,
    margin: "5px 0"
  },
  profileEmail: {
    fontSize: 14,
    color: "#555",
    marginBottom: 15
  },
  profileCloseBtn: {
    padding: "8px 12px",
    background: "#1a73e8",
    color: "#fff",
    border: "none",
    borderRadius: 5,
    cursor: "pointer"
  },
  userDropdown: {
    position: "absolute",
    top: 50,
    right: 0,
    background: "#fff",
    boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
    borderRadius: 8,
    minWidth: 180,
    zIndex: 100,
    display: "flex",
    flexDirection: "column",
    padding: "8px 0"
  },
  userDropdownItem: {
    display: "flex",
    alignItems: "center",
    padding: "8px 16px",
    cursor: "pointer",
    gap: 10,
    transition: "background 0.2s"
  },
  userDropdownAvatar: {
    width: 30,
    height: 30,
    borderRadius: "50%"
  },
  dropdownDivider: {
    height: 1,
    background: "#ddd",
    margin: "4px 0"
  },
  middleSidebar: {
    width: "20%",
    borderRight: "1px solid #ddd",
    display: "flex",
    flexDirection: "column",
    position: "relative",
    padding: 10,
    overflow: "hidden"
  },
  fileScrollArea: {
    flex: 1,
    overflowY: "auto"
  },
  addFileBtn: {
    marginTop: 10,
    padding: 10,
    background: "#1a73e8",
    color: "white",
    border: "none",
    borderRadius: 6,
    cursor: "pointer",
    width: "100%"
  },
  navCenter: {
    flex: 4,
    display: "flex",
    justifyContent: "center"
  },
  searchWrapper: {
    position: "relative",
    width: "100%"
  },
  navSearch: {
    width: "90%",
    padding: "10px 16px",
    borderRadius: "24px",
    border: "1px solid #ddd",
    background: "#f1f3f4",
    outline: "none",
    fontSize: "14px"
  },
  monthHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "10px 8px",
    cursor: "pointer",
    borderRadius: "8px",
    fontWeight: "600",
    fontSize: "14px",
    color: "#202124",
    transition: "all 0.2s ease"
  },
  dateItem: {
    padding: "6px 10px",
    cursor: "pointer",
    fontSize: "13px"
  },
  dateInputWrapper: {
    padding: "8px",
    marginBottom: "10px"
  },
  calendarPicker: {
    width: "100%",
    padding: "8px 10px",
    borderRadius: "8px",
    border: "1px solid #dadce0",
    background: "#fff",
    boxSizing: "border-box",
    outline: "none",
    fontSize: "14px"
  },
  secondaryBtn: {
    padding: "8px",
    background: "#34a853",
    color: "white",
    border: "none",
    borderRadius: "6px",
    cursor: "pointer",
    marginLeft: "10px"
  },
  loginTitle: {
    marginBottom: "10px",
    fontSize: "28px",
    fontWeight: "700",
    color: "#1a73e8",
    textAlign: "center"
  },
  loginSubtitle: {
    marginBottom: "20px",
    fontSize: "16px",
    color: "#5f6368",
    textAlign: "center"
  },
  pagination: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    marginTop: "10px"
  },
  searchDropdown: {
    position: "absolute",
    top: 50,
    left: 0,
    width: "400px",
    background: "#fff",
    border: "1px solid #ddd",
    borderRadius: "8px",
    maxHeight: "300px",
    overflowY: "auto",
    zIndex: 100
  },
  searchItem: {
    padding: "10px",
    cursor: "pointer",
    borderBottom: "1px solid #eee"
  },
  noResult: {
    padding: "10px",
    color: "#888"
  },
  textarea: {
    flex: 1,
    marginTop: 10,
    backgroundColor: "#fff",
    color: "#000",
    border: "1px solid #ddd",
    outline: "none",
    resize: "none",
    lineHeight: "1.6",
    padding: "20px",
    boxShadow: "inset 0 0 5px rgba(0,0,0,0.05)",
    borderRadius: "12px"
  }
};