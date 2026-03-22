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
  
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      if (u) fetchFiles(u.uid);
    });
    return () => unsub();
  }, []);

  // close dropdown
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

  const addFile = async () => {
    setLoading(true);
    const createdAt = new Date(selectedDate).toISOString();

    const docRef = await addDoc(
        collection(db, "users", user.uid, "files"),
        { name: "New Entry", content: "", createdAt }
    );

    const newFile = {
      id: docRef.id,
      name: "New Entry",
      content: "",
      createdAt
    };

    setFiles((prev) => [...prev, newFile]);
    setSelectedFile(newFile);
    setContent("");
    setLoading(false);
  };

  const deleteFile = async (id) => {
    try {
      console.log("DELETE FUNCTION CALLED");
      console.log("Deleting:", id);

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
    console.log("Edit FUNCTION CALLED");
    await updateDoc(doc(db, "users", user.uid, "files", id), {
      name: newName
    });

    setFiles((prev) =>
        prev.map((f) =>
            f.id === id ? { ...f, name: newName } : f
        )
    );

    if (selectedFile?.id === id) {
      setSelectedFile((prev) => ({ ...prev, name: newName }));
    }
  };

  const openFile = (file) => {
    setSelectedFile({ ...file });
    setContent(file.content || "");
    setEditingTitle(false);
  };
  const HoverableDropdownItem = ({ children, onClick }) => {
    const [hover, setHover] = React.useState(false);
    return (
        <div
            style={{ ...styles.userDropdownItem, background: hover ? "#f1f3f4" : "transparent" }}
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
          { content }
      );

      setFiles((prev) =>
          prev.map((f) =>
              f.id === selectedFile.id ? { ...f, content } : f
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

  const filteredFiles = files.filter((f) =>
      isSameDay(f.createdAt, selectedDate)
  );

  const generateDates = () => {
    const dates = [];
    const today = new Date();
    const start = new Date(2024, 0, 1);
    for (let d = new Date(start); d <= today; d.setDate(d.getDate() + 1)) {
      dates.push(new Date(d));
    }
    return dates.reverse();
  };

  if (!user) {
    return (
        <div style={styles.center}>
          <div style={styles.card}>
            <h2>Welcome</h2>
            <button style={styles.googleBtn} onClick={googleLogin}>
              Continue with Google
            </button>
          </div>
        </div>
    );
  }

  return (
      <div style={styles.wrapper}>
        {/* NAVBAR */}
        <div style={styles.navbar}>
          <h2>Diary</h2>

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
                  {/* Profile option */}
                  <HoverableDropdownItem onClick={() => { setShowProfile(true); setShowMenu(false); }}>
                    <img src={user.photoURL} style={styles.userDropdownAvatar} />
                    <span>{user.displayName || "User"}</span>
                  </HoverableDropdownItem>

                  <div style={styles.dropdownDivider}></div>

                  {/* Logout option */}
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
            <input
                type="date"
                style={styles.input}
                max={new Date().toISOString().split("T")[0]}
                value={selectedDate.toISOString().split("T")[0]}
                onChange={(e) => {
                  setSelectedDate(new Date(e.target.value));
                  setSelectedFile(null);   // ✅ clear file
                  setContent("");          // ✅ clear content
                }}
            />

            <div style={styles.dateList}>
              {generateDates().map((d) => {
                const active = isSameDay(d, selectedDate);
                return (
                    <div
                        key={d}
                        onClick={() => {
                          setSelectedDate(d);
                          setSelectedFile(null);   // ✅ reset
                          setContent("");
                        }}
                        style={{
                          ...styles.dateItem,
                          background: active ? "#d2e3fc" : ""
                        }}
                    >
                      {d.toDateString()}
                    </div>
                );
              })}
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
                        {/* FILE NAME */}
                        <div style={styles.fileName} onClick={() => !isEditing && openFile(f)}>
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

                        {/* ACTIONS */}
                        {!isEditing && (
                            <div style={styles.fileActions}>
                              {/* Edit Icon */}
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

                              {/* Delete Icon */}
                              <button
                                  style={styles.iconBtn}
                                  onClick={async (e) => {
                                    e.stopPropagation();
                                    const confirmDelete = confirm("Delete this file?");
                                    if (!confirmDelete) return;

                                    try {
                                      setDeletingFileId(f.id); // mark as deleting
                                      await deleteFile(f.id);   // call delete API
                                    } finally {
                                      setDeletingFileId(null);  // reset state
                                    }
                                  }}
                                  disabled={deletingFileId === f.id} // prevent double click
                              >
                                {deletingFileId === f.id ? (
                                    <span style={styles.spinner}></span> // show spinner
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
                <div style={styles.editorContainer}>

                  <div style={styles.editorHeader}>
                    {editingTitle ? (
                        <div style={styles.titleRow}>
                          <input
                              value={tempTitle}
                              onChange={(e) => setTempTitle(e.target.value)}
                          />
                          <span onClick={() => {
                            renameFile(selectedFile.id, tempTitle);
                            setEditingTitle(false);
                          }}>✔️</span>
                          <span onClick={() => setEditingTitle(false)}>❌</span>
                        </div>
                    ) : (
                        <h3 onClick={() => {
                          setTempTitle(selectedFile.name);
                          setEditingTitle(true);
                        }}>
                          {selectedFile.name}
                        </h3>
                    )}

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
                      ) : "Save"}
                    </button>
                  </div>

                  <textarea
                      style={styles.textarea}
                      value={content}
                      onChange={(e) => setContent(e.target.value)}
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
                onClick={() => setShowProfile(false)} // click outside closes modal
            >
              <div
                  style={styles.profileModal}
                  onClick={(e) => e.stopPropagation()} // prevent modal click from closing
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
    overflow: "hidden" // ✅ prevents page scroll
  },

  container: {
    display: "flex",
    flex: 1,
    overflow: "hidden" // ✅ critical
  },
  navbar: { height: 60, display: "flex", justifyContent: "space-between", padding: "0 20px", alignItems: "center", borderBottom: "1px solid #ddd" },


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
    overflow: "hidden" // ✅ prevents outer scroll
  },

  dateList: {
    flex: 1,
    overflowY: "auto",
    scrollBehavior: "smooth"
  },
  dateItem: { padding: 6, cursor: "pointer" },






  primaryBtn: { padding: 8, background: "#1a73e8", color: "white", border: "none" },
  googleBtn: { padding: 10, background: "#ea4335", color: "white" },

  userSection: { position: "relative" },
  avatar: { width: 35, borderRadius: "50%" },
  dropdown: { position: "absolute", right: 0, top: 40, background: "white", border: "1px solid #ddd" },

  editorHeader: { display: "flex", justifyContent: "space-between", alignItems: "center" },
  titleRow: { display: "flex", gap: 10 },

  center: { display: "flex", justifyContent: "center", alignItems: "center", height: "100vh" },
  card: { padding: 20, border: "1px solid #ccc", textAlign: "center" },
  input: { width: "100%", padding: 8, marginTop: 10 },

  main: {
    flex: 1,
    padding: 20,
    display: "flex",
    flexDirection: "column",
    overflow: "hidden" // ✅ important
  },

  editorContainer: {
    display: "flex",
    flexDirection: "column",
    height: "100%",
    overflow: "hidden"
  },

  textarea: {
    flex: 1,
    marginTop: 10,
    overflowY: "auto" // ✅ only content scrolls
  },

  floatingAddBtn: {
    position: "absolute",
    bottom: 10,
    left: 10,
    right: 10,
    padding: 10,
    background: "#1a73e8",
    color: "#fff",
    border: "none",
    borderRadius: 6,
    cursor: "pointer",
    boxShadow: "0 2px 6px rgba(0,0,0,0.2)"
  },


  icon: {
    cursor: "pointer",
    padding: "6px",
    zIndex: 10,              // ✅ ensures clickable
    position: "relative"     // ✅ important
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
    zIndex: 5,            // ✅ above everything
    position: "relative"
  },

  iconBtn: {
    border: "none",
    background: "transparent",
    cursor: "pointer",
    fontSize: "16px",
    padding: "6px",
    pointerEvents: "auto" // ✅ force click
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
    transition: "background 0.2s",
  },

  userDropdownItemHover: {
    background: "#f1f3f4"
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
  }
};