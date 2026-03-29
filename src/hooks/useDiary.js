// src/hooks/useDiary.js
// ─────────────────────────────────────────────────────────────────────────────
// NEW DATA MODEL
// ─────────────────────────────────────────────────────────────────────────────
// Firestore structure:
//   users/{uid}/diaries/{diaryId}                  → { name, emoji, createdAt }
//   users/{uid}/diaries/{diaryId}/entries/{dateKey} → { date, content:[pages] }
//
// UI model:
//   Sidebar 1 → list of Diaries  (user picks one)
//   Sidebar 2 → list of dates that have entries in the selected diary
//               + a date-picker to jump to any date
//   Editor    → pages for the selected diary + selected date
// ─────────────────────────────────────────────────────────────────────────────
import { useState, useEffect, useRef } from "react";
import { signOut, onAuthStateChanged, signInWithPopup } from "firebase/auth";
import {
  collection, addDoc, deleteDoc, doc,
  updateDoc, getDocs, getDoc, setDoc,
} from "firebase/firestore";
import { auth, db, provider } from "../firebase";
import { ensureMeta } from "../utils/templates";

// dateKey: canonical string key for a date — "YYYY-MM-DD" in local time
const toDateKey = (d) => {
  const dt = d instanceof Date ? d : new Date(d);
  const y  = dt.getFullYear();
  const m  = String(dt.getMonth() + 1).padStart(2, "0");
  const dd = String(dt.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
};

const fromDateKey = (key) => {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d);
};

export { toDateKey, fromDateKey };

export function useDiary() {
  // ── Auth ──────────────────────────────────────────────────────────────────
  const [user, setUser] = useState(null);

  // ── Diary list (sidebar 1) ────────────────────────────────────────────────
  const [diaries, setDiaries]             = useState([]);          // [{id,name,emoji,createdAt}]
  const [selectedDiary, setSelectedDiary] = useState(null);        // the open diary object
  const [loadingDiaries, setLoadingDiaries] = useState(false);
  const [deletingDiaryId, setDeletingDiaryId] = useState(null);
  const [editingDiaryId, setEditingDiaryId]   = useState(null);
  const [tempDiaryName, setTempDiaryName]     = useState("");

  // ── Entry list (sidebar 2) — keyed dates within selected diary ───────────
  // entriesMeta: { [dateKey]: { date, hasContent } } — loaded when diary opens
  const [entriesMeta, setEntriesMeta]   = useState({});
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [expandedMonths, setExpandedMonths] = useState({});

  // ── Editor state ──────────────────────────────────────────────────────────
  const [pages, setPages]             = useState([]);
  const [currentPage, setCurrentPage] = useState(0);
  const [isDirty, setIsDirty]         = useState(false);
  const [saving, setSaving]           = useState(false);
  const [entryTitle, setEntryTitle]     = useState("");  // per-date title, editable in editor

  // ── Search ────────────────────────────────────────────────────────────────
  const [searchQuery, setSearchQuery]     = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [searchFocused, setSearchFocused] = useState(false);

  // ── UI toggles ────────────────────────────────────────────────────────────
  const [showMenu, setShowMenu]           = useState(false);
  const [showProfile, setShowProfile]     = useState(false);
  const [showTemplatePicker, setShowTemplatePicker] = useState(false);
  const [loading, setLoading]             = useState(false);

  // ── App title (customisable) ──────────────────────────────────────────────
  const [appTitle, setAppTitle] = useState(
    () => localStorage.getItem("diaryTitle") || "My Diaries"
  );

  // ── Refs ──────────────────────────────────────────────────────────────────
  const menuRef        = useRef(null);
  const searchRef      = useRef(null);
  const titleInputRef  = useRef(null);

  // ── Auth listener ─────────────────────────────────────────────────────────
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      if (u) {
        fetchDiaries(u.uid);
        fetchSettings(u.uid);
      }
    });
    return () => unsub();
  }, []);

  // ── Outside-click ─────────────────────────────────────────────────────────
  useEffect(() => {
    const h = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target))  setShowMenu(false);
      if (searchRef.current && !searchRef.current.contains(e.target)) setSearchFocused(false);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  // ── Search across all entries of selected diary ────────────────────────────
  useEffect(() => {
    if (!searchQuery.trim() || !selectedDiary) { setSearchResults([]); return; }
    const q = searchQuery.toLowerCase();
    // Search across entriesMeta keys + content already loaded
    const hits = Object.entries(entriesMeta)
      .filter(([key, meta]) => {
        const dateHit = key.toLowerCase().includes(q);
        const bodyHit = (meta.contentText || "").toLowerCase().includes(q);
        return dateHit || bodyHit;
      })
      .map(([key, meta]) => ({ dateKey: key, date: fromDateKey(key), ...meta }));
    setSearchResults(hits);
  }, [searchQuery, entriesMeta, selectedDiary]);

  // ── Ctrl/Cmd+S ────────────────────────────────────────────────────────────
  useEffect(() => {
    const h = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "s") { e.preventDefault(); saveContent(); }
    };
    document.addEventListener("keydown", h);
    return () => document.removeEventListener("keydown", h);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDiary, selectedDate, pages]);

  // ── Unsaved-changes warning ────────────────────────────────────────────────
  useEffect(() => {
    const h = (e) => { if (isDirty) { e.preventDefault(); e.returnValue = ""; } };
    window.addEventListener("beforeunload", h);
    return () => window.removeEventListener("beforeunload", h);
  }, [isDirty]);

  // ────────────────────────────────────────────────────────────────────────────
  // Firestore: diaries
  // ────────────────────────────────────────────────────────────────────────────
  const fetchDiaries = async (uid) => {
    setLoadingDiaries(true);
    try {
      const snap = await getDocs(collection(db, "users", uid, "diaries"));
      const list = snap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
      setDiaries(list);
    } finally {
      setLoadingDiaries(false);
    }
  };

  const addDiary = async (rawName) => {
    // Guard: if called without an argument or with a React event, use default string
    const name = typeof rawName === "string" && rawName.trim() ? rawName.trim() : "New Diary";
    setLoading(true);
    try {
      const createdAt = new Date().toISOString();
      const docRef    = await addDoc(
        collection(db, "users", user.uid, "diaries"),
        { name, emoji: "📔", createdAt }
      );
      const nd = { id: docRef.id, name, emoji: "📔", createdAt };
      setDiaries((prev) => [...prev, nd]);
      // Auto-open the new diary — pass uid explicitly (user state may be stale in closure)
      await openDiary(nd, user.uid);
      // Trigger title edit
      setTimeout(() => {
        setEditingDiaryId(nd.id);
        setTempDiaryName(name);
      }, 60);
    } finally {
      setLoading(false);
    }
  };

  const deleteDiary = async (id) => {
    try {
      setDeletingDiaryId(id);
      // Delete all entries sub-collection first
      const entriesSnap = await getDocs(
        collection(db, "users", user.uid, "diaries", id, "entries")
      );
      await Promise.all(entriesSnap.docs.map((e) => deleteDoc(e.ref)));
      await deleteDoc(doc(db, "users", user.uid, "diaries", id));
      setDiaries((prev) => prev.filter((d) => d.id !== id));
      if (selectedDiary?.id === id) {
        setSelectedDiary(null);
        setEntriesMeta({});
        setPages([]);
        setIsDirty(false);
      }
    } catch (e) {
      alert("Delete failed: " + e.message);
    } finally {
      setDeletingDiaryId(null);
    }
  };

  const renameDiary = async (id, newName) => {
    const trimmed = (newName || "").trim();
    if (!trimmed) return;
    await updateDoc(doc(db, "users", user.uid, "diaries", id), { name: trimmed });
    setDiaries((prev) => prev.map((d) => d.id === id ? { ...d, name: trimmed } : d));
    if (selectedDiary?.id === id) setSelectedDiary((p) => ({ ...p, name: trimmed }));
  };

  const openDiary = async (diary, uid) => {
    // uid can be passed explicitly (e.g. from addDiary before user state updates)
    // or fall back to the current user state
    const resolvedUid = uid || user?.uid;
    if (!resolvedUid) { alert("Not signed in"); return; }
    if (isDirty && !window.confirm("You have unsaved changes. Discard and open this diary?")) return;
    setSelectedDiary(diary);
    setPages([]);
    setEntryTitle("");
    setIsDirty(false);
    setCurrentPage(0);
    setSelectedDate(new Date());
    setEntriesMeta({});
    try {
      const snap = await getDocs(
        collection(db, "users", resolvedUid, "diaries", diary.id, "entries")
      );
      const meta = {};
      snap.docs.forEach((d) => {
        const data = d.data();
        const bodyText = Array.isArray(data.content)
          ? data.content.map((p) => (typeof p === "string" ? p : p?.data ?? "")).join(" ")
          : "";
        meta[d.id] = { date: data.date, contentText: bodyText };
      });
      setEntriesMeta(meta);
    } catch (e) {
      console.warn("Failed to load entries metadata:", e.message);
    }
  };

  // ────────────────────────────────────────────────────────────────────────────
  // Firestore: entries (date-keyed within a diary)
  // ────────────────────────────────────────────────────────────────────────────
  const loadEntry = async (diary, date) => {
    if (!diary || !user?.uid) return;
    const key  = toDateKey(date);
    const ref  = doc(db, "users", user.uid, "diaries", diary.id, "entries", key);
    try {
      const snap = await getDoc(ref);
      if (snap.exists()) {
        const data    = snap.data();
        const content = (data.content || []).map(ensureMeta);
        setPages(content.length ? content : [ensureMeta("")]);
        setEntryTitle(data.entryTitle || "");
      } else {
        setPages([ensureMeta("")]);
        setEntryTitle("");
      }
    } catch (e) {
      console.warn("Failed to load entry:", e.message);
      setPages([ensureMeta("")]);
    }
    setCurrentPage(0);
    setIsDirty(false);
  };

  const saveContent = async () => {
    if (!selectedDiary || !user?.uid) return;
    try {
      setSaving(true);
      const key = toDateKey(selectedDate);
      const ref = doc(db, "users", user.uid, "diaries", selectedDiary.id, "entries", key);
      await setDoc(ref, { date: key, content: pages, entryTitle }, { merge: true });
      const bodyText = pages.map((p) => (typeof p === "string" ? p : p?.data ?? "")).join(" ");
      setEntriesMeta((prev) => ({ ...prev, [key]: { date: key, contentText: bodyText } }));
      setIsDirty(false);
    } catch {
      alert("Save failed. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  // ── Selecting a date (sidebar 2 click or date picker) ─────────────────────
  const selectDate = async (date, diary) => {
    const targetDiary = diary || selectedDiary;
    if (isDirty && !window.confirm("You have unsaved changes. Discard?")) return;
    const newDate = date instanceof Date ? date : fromDateKey(date);
    setSelectedDate(newDate);
    setPages([]);
    setEntryTitle("");
    setIsDirty(false);
    if (targetDiary) await loadEntry(targetDiary, newDate);
  };

  // ── Open diary then jump to date (used from search results) ───────────────
  const openDiaryAndDate = async (diary, dateKey) => {
    await openDiary(diary);
    const date = fromDateKey(dateKey);
    setSelectedDate(date);
    await loadEntry(diary, date);
  };

  // ── Date helpers ──────────────────────────────────────────────────────────
  const isSameDay = (d1, d2) => new Date(d1).toDateString() === new Date(d2).toDateString();

  const groupDatesByMonth = () => {
    const map = {};
    const today = new Date();
    const start = new Date(2024, 0, 1);
    for (let d = new Date(start); d <= today; d.setDate(d.getDate() + 1)) {
      const date = new Date(d);
      const key  = date.toLocaleString("default", { month: "long", year: "numeric" });
      if (!map[key]) map[key] = [];
      map[key].push(new Date(date));
    }
    return Object.entries(map).reverse();
  };

  // ── Settings ──────────────────────────────────────────────────────────────
  const fetchSettings = async (uid) => {
    try {
      const snap = await getDoc(doc(db, "users", uid, "settings", "preferences"));
      if (snap.exists() && snap.data().appTitle) {
        const t = snap.data().appTitle;
        setAppTitle(t);
        localStorage.setItem("diaryTitle", t);
      }
    } catch {}
  };

  const updateAppTitle = async (title) => {
    const trimmed = (title || "").trim() || "My Diaries";
    setAppTitle(trimmed);
    localStorage.setItem("diaryTitle", trimmed);
    if (user) {
      await setDoc(
        doc(db, "users", user.uid, "settings", "preferences"),
        { appTitle: trimmed },
        { merge: true }
      );
    }
  };

  const googleLogin = () => signInWithPopup(auth, provider);
  const logout      = async () => {
    await signOut(auth);
    setDiaries([]); setSelectedDiary(null); setEntriesMeta({}); setPages([]);
  };

  // ── Expose ────────────────────────────────────────────────────────────────
  return {
    // auth
    user, googleLogin, logout,
    // app title
    appTitle, updateAppTitle,
    // diaries (sidebar 1)
    diaries, selectedDiary, loadingDiaries,
    deletingDiaryId, editingDiaryId, setEditingDiaryId,
    tempDiaryName, setTempDiaryName,
    addDiary, deleteDiary, renameDiary, openDiary,
    // dates / entries (sidebar 2)
    entriesMeta, selectedDate, expandedMonths, setExpandedMonths,
    selectDate, openDiaryAndDate,
    groupDatesByMonth, isSameDay,
    // editor
    pages, setPages, currentPage, setCurrentPage,
    isDirty, setIsDirty, saving, saveContent,
    entryTitle, setEntryTitle,
    loading,
    // search
    searchQuery, setSearchQuery, searchResults, searchFocused, setSearchFocused,
    // UI toggles
    showMenu, setShowMenu, showProfile, setShowProfile,
    showTemplatePicker, setShowTemplatePicker,
    // refs
    menuRef, searchRef, titleInputRef,
  };
}
