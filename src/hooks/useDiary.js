// src/hooks/useDiary.js
// ─────────────────────────────────────────────────────────────────────────────
// Single hook that owns ALL shared state and Firestore operations.
// Components receive what they need via props from App.jsx — none of them
// import this hook directly, keeping the data layer in one place.
// ─────────────────────────────────────────────────────────────────────────────
import { useState, useEffect, useRef, useCallback } from "react";
import { signOut, onAuthStateChanged, signInWithPopup } from "firebase/auth";
import { collection, addDoc, deleteDoc, doc, updateDoc, getDocs } from "firebase/firestore";
import { auth, db, provider } from "../firebase";
import { ensureMeta } from "../utils/templates";

export function useDiary() {
  // ── Auth ──────────────────────────────────────────────────────────────────
  const [user, setUser] = useState(null);

  // ── File / entry state ────────────────────────────────────────────────────
  const [files, setFiles]                   = useState([]);
  const [selectedFile, setSelectedFile]     = useState(null);
  const [selectedDate, setSelectedDate]     = useState(new Date());
  const [loading, setLoading]               = useState(false);

  // ── Editor state ──────────────────────────────────────────────────────────
  const [pages, setPages]                   = useState([]);
  const [currentPage, setCurrentPage]       = useState(0);
  const [isDirty, setIsDirty]               = useState(false);
  const [saving, setSaving]                 = useState(false);
  const [editingTitle, setEditingTitle]     = useState(false);
  const [tempTitle, setTempTitle]           = useState("");

  // ── File list state ───────────────────────────────────────────────────────
  const [deletingFileId, setDeletingFileId] = useState(null);
  const [editingFileId, setEditingFileId]   = useState(null);
  const [tempFileName, setTempFileName]     = useState("");

  // ── Search state ──────────────────────────────────────────────────────────
  const [searchQuery, setSearchQuery]       = useState("");
  const [searchResults, setSearchResults]   = useState([]);
  const [searchFocused, setSearchFocused]   = useState(false);

  // ── UI state ─────────────────────────────────────────────────────────────
  const [expandedMonths, setExpandedMonths] = useState({});
  const [showMenu, setShowMenu]             = useState(false);
  const [showProfile, setShowProfile]       = useState(false);
  const [showTemplatePicker, setShowTemplatePicker] = useState(false);

  // ── Refs ─────────────────────────────────────────────────────────────────
  const menuRef       = useRef(null);
  const searchRef     = useRef(null);
  const titleInputRef = useRef(null);

  // ── Auth listener ─────────────────────────────────────────────────────────
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      if (u) fetchFiles(u.uid);
    });
    return () => unsub();
  }, []);

  // ── Outside-click: close menu and search dropdown ─────────────────────────
  useEffect(() => {
    const handler = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setShowMenu(false);
      if (searchRef.current && !searchRef.current.contains(e.target)) setSearchFocused(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // ── Search filter ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (!searchQuery.trim()) { setSearchResults([]); return; }
    const q = searchQuery.toLowerCase();
    setSearchResults(
      files.filter((f) => {
        const nameHit = (f.name || "").toLowerCase().includes(q);
        const body = Array.isArray(f.content)
          ? f.content.map((p) => (typeof p === "string" ? p : p?.data ?? "")).join(" ")
          : (f.content ?? "");
        return nameHit || body.toLowerCase().includes(q);
      })
    );
  }, [searchQuery, files]);

  // ── Ctrl/Cmd+S to save ────────────────────────────────────────────────────
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

  // ── Warn before unload when dirty ────────────────────────────────────────
  useEffect(() => {
    const h = (e) => { if (isDirty) { e.preventDefault(); e.returnValue = ""; } };
    window.addEventListener("beforeunload", h);
    return () => window.removeEventListener("beforeunload", h);
  }, [isDirty]);

  // ── Firestore helpers ─────────────────────────────────────────────────────
  const fetchFiles = async (uid) => {
    const snap = await getDocs(collection(db, "users", uid, "files"));
    setFiles(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
  };

  const openFile = useCallback((file) => {
    if (isDirty && !window.confirm("You have unsaved changes. Discard and open this entry?")) return;
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
        name: "New Entry", content: [], createdAt,
      });
      const newFile = { id: docRef.id, name: "New Entry", content: [], createdAt };
      setFiles((prev) => [...prev, newFile]);
      setPages([ensureMeta("")]);
      setCurrentPage(0);
      setSelectedFile(newFile);
      setEditingTitle(false);
      setIsDirty(false);
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
      if (selectedFile?.id === id) { setSelectedFile(null); setPages([]); setIsDirty(false); }
    } catch (e) {
      alert("Delete failed: " + e.message);
    } finally {
      setDeletingFileId(null);
    }
  };

  const renameFile = async (id, newName) => {
    const trimmed = (newName || "").trim();
    if (!trimmed) return;
    await updateDoc(doc(db, "users", user.uid, "files", id), { name: trimmed });
    setFiles((prev) => prev.map((f) => f.id === id ? { ...f, name: trimmed } : f));
    if (selectedFile?.id === id) setSelectedFile((prev) => ({ ...prev, name: trimmed }));
  };

  const saveContent = async () => {
    if (!selectedFile) return;
    try {
      setSaving(true);
      await updateDoc(doc(db, "users", user.uid, "files", selectedFile.id), { content: pages });
      setFiles((prev) => prev.map((f) => f.id === selectedFile.id ? { ...f, content: pages } : f));
      setIsDirty(false);
    } catch {
      alert("Save failed. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  // ── Date helpers ──────────────────────────────────────────────────────────
  const isSameDay = (d1, d2) => new Date(d1).toDateString() === new Date(d2).toDateString();

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
    return Object.entries(map).reverse();
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

  // ── Expose everything components need ─────────────────────────────────────
  return {
    // auth
    user, googleLogin, logout,
    // files
    files, selectedFile, selectedDate, setSelectedDate,
    loading, filteredFiles, isSameDay,
    openFile, addFile, deleteFile, renameFile,
    // editor
    pages, setPages, currentPage, setCurrentPage,
    isDirty, setIsDirty, saving, saveContent,
    editingTitle, setEditingTitle, tempTitle, setTempTitle,
    // file list rename
    editingFileId, setEditingFileId, tempFileName, setTempFileName,
    deletingFileId,
    // search
    searchQuery, setSearchQuery, searchResults, searchFocused, setSearchFocused,
    // UI toggles
    expandedMonths, setExpandedMonths,
    showMenu, setShowMenu,
    showProfile, setShowProfile,
    showTemplatePicker, setShowTemplatePicker,
    // refs
    menuRef, searchRef, titleInputRef,
    // date sidebar
    groupDatesByMonth,
  };
}
