// src/hooks/useDiary.js
import { useState, useEffect, useRef } from "react";
import { signOut, onAuthStateChanged, signInWithPopup } from "firebase/auth";
import {
  collection, addDoc, deleteDoc, doc,
  updateDoc, getDocs, getDoc, setDoc,
} from "firebase/firestore";
import { auth, db, provider } from "../firebase";
import { ensureMeta } from "../utils/templates";

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

const buildDefaultTitle = (diaryName, date) => {
  const d = date instanceof Date ? date : new Date(date);
  const formatted = d.toLocaleDateString("en-GB", {
    weekday: "short", day: "numeric", month: "short", year: "numeric",
  });
  return `${diaryName} · ${formatted}`;
};

export { toDateKey, fromDateKey, buildDefaultTitle };

export function useDiary() {
  const [user, setUser] = useState(null);

  const [diaries,         setDiaries]         = useState([]);
  const [selectedDiary,   setSelectedDiary]   = useState(null);
  const [loadingDiaries,  setLoadingDiaries]  = useState(false);
  const [deletingDiaryId, setDeletingDiaryId] = useState(null);
  const [editingDiaryId,  setEditingDiaryId]  = useState(null);
  const [tempDiaryName,   setTempDiaryName]   = useState("");

  const [entriesMeta,    setEntriesMeta]    = useState({});
  const [selectedDate,   setSelectedDate]   = useState(new Date());
  const [expandedMonths, setExpandedMonths] = useState({});

  const [pages,       setPages]       = useState([]);
  const [currentPage, setCurrentPage] = useState(0);
  const [isDirty,     setIsDirty]     = useState(false);
  const [saving,      setSaving]      = useState(false);
  const [entryTitle,  setEntryTitle]  = useState("");

  const [searchQuery,   setSearchQuery]   = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [searchFocused, setSearchFocused] = useState(false);

  const [showMenu,           setShowMenu]           = useState(false);
  const [showProfile,        setShowProfile]        = useState(false);
  const [showTemplatePicker, setShowTemplatePicker] = useState(false);
  const [loading,            setLoading]            = useState(false);

  const [appTitle, setAppTitle] = useState(
    () => localStorage.getItem("diaryTitle") || "My Diaries"
  );

  const menuRef       = useRef(null);
  const searchRef     = useRef(null);
  const titleInputRef = useRef(null);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      if (u) { fetchDiaries(u.uid); fetchSettings(u.uid); }
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    const h = (e) => {
      if (menuRef.current   && !menuRef.current.contains(e.target))   setShowMenu(false);
      if (searchRef.current && !searchRef.current.contains(e.target)) setSearchFocused(false);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  // Search
  useEffect(() => {
    if (!searchQuery.trim() || !selectedDiary) { setSearchResults([]); return; }
    const q = searchQuery.toLowerCase();
    const hits = Object.entries(entriesMeta)
      .filter(([key, meta]) => {
        const dateHit  = key.toLowerCase().includes(q);
        const titleHit = (meta.entryTitle || "").toLowerCase().includes(q);
        const bodyHit  = (meta.contentText || "").toLowerCase().includes(q);
        return dateHit || titleHit || bodyHit;
      })
      .map(([key, meta]) => ({
        dateKey:     key,
        date:        fromDateKey(key),
        entryTitle:  meta.entryTitle || "",
        contentText: meta.contentText || "",
        diaryId:     selectedDiary.id,
        diaryName:   selectedDiary.name,
        diaryEmoji:  selectedDiary.emoji || "📔",
      }))
      .sort((a, b) => b.dateKey.localeCompare(a.dateKey));
    setSearchResults(hits);
  }, [searchQuery, entriesMeta, selectedDiary]);

  useEffect(() => {
    const h = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "s") { e.preventDefault(); saveContent(); }
    };
    document.addEventListener("keydown", h);
    return () => document.removeEventListener("keydown", h);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDiary, selectedDate, pages, entryTitle]);

  useEffect(() => {
    const h = (e) => { if (isDirty) { e.preventDefault(); e.returnValue = ""; } };
    window.addEventListener("beforeunload", h);
    return () => window.removeEventListener("beforeunload", h);
  }, [isDirty]);

  const fetchDiaries = async (uid) => {
    setLoadingDiaries(true);
    try {
      const snap = await getDocs(collection(db, "users", uid, "diaries"));
      const list = snap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
      setDiaries(list);
    } finally { setLoadingDiaries(false); }
  };

  const addDiary = async (rawName) => {
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
      await openDiary(nd, user.uid);
      setTimeout(() => { setEditingDiaryId(nd.id); setTempDiaryName(name); }, 60);
    } finally { setLoading(false); }
  };

  const deleteDiary = async (id) => {
    try {
      setDeletingDiaryId(id);
      const snap = await getDocs(collection(db, "users", user.uid, "diaries", id, "entries"));
      await Promise.all(snap.docs.map((e) => deleteDoc(e.ref)));
      await deleteDoc(doc(db, "users", user.uid, "diaries", id));
      setDiaries((prev) => prev.filter((d) => d.id !== id));
      if (selectedDiary?.id === id) {
        setSelectedDiary(null); setEntriesMeta({}); setPages([]); setIsDirty(false);
      }
    } catch (e) { alert("Delete failed: " + e.message); }
    finally { setDeletingDiaryId(null); }
  };

  const renameDiary = async (id, newName) => {
    const trimmed = (newName || "").trim();
    if (!trimmed) return;
    await updateDoc(doc(db, "users", user.uid, "diaries", id), { name: trimmed });
    setDiaries((prev) => prev.map((d) => d.id === id ? { ...d, name: trimmed } : d));
    if (selectedDiary?.id === id) setSelectedDiary((p) => ({ ...p, name: trimmed }));
  };

  // ── FIX 3: openDiary auto-selects today (or most recent entry) ────────────
  const openDiary = async (diary, uid) => {
    const resolvedUid = uid || user?.uid;
    if (!resolvedUid) { alert("Not signed in"); return; }
    if (isDirty && !window.confirm("You have unsaved changes. Discard?")) return;

    setSelectedDiary(diary);
    setPages([]); setEntryTitle(""); setIsDirty(false);
    setCurrentPage(0); setEntriesMeta({});

    let meta = {};
    try {
      const snap = await getDocs(
        collection(db, "users", resolvedUid, "diaries", diary.id, "entries")
      );
      snap.docs.forEach((d) => {
        const data     = d.data();
        const bodyText = Array.isArray(data.content)
          ? data.content.map((p) => (typeof p === "string" ? p : p?.data ?? "")).join(" ")
          : "";
        meta[d.id] = {
          date:        data.date,
          contentText: bodyText,
          entryTitle:  data.entryTitle || "",
        };
      });
      setEntriesMeta(meta);
    } catch (e) { console.warn("Failed to load entries metadata:", e.message); }

    // Auto-select today's date and load (or create) its entry
    const today    = new Date();
    const todayKey = toDateKey(today);

    // Expand today's month so it's visible in the sidebar
    const monthKey = today.toLocaleString("default", { month: "long", year: "numeric" });
    setExpandedMonths({ [monthKey]: true });
    setSelectedDate(today);

    // Load existing entry for today, or start a fresh one
    await loadEntryInner(diary, resolvedUid, today, meta);
  };

  // ── Internal loader (used by openDiary and selectDate) ───────────────────
  const loadEntryInner = async (diary, uid, date, metaSnapshot) => {
    const key = toDateKey(date);
    const ref = doc(db, "users", uid || user?.uid, "diaries", diary.id, "entries", key);
    try {
      const snap = await getDoc(ref);
      if (snap.exists()) {
        const data    = snap.data();
        const content = (data.content || []).map(ensureMeta);
        setPages(content.length ? content : [ensureMeta("")]);
        setEntryTitle(data.entryTitle || buildDefaultTitle(diary.name, date));
        // ── FIX 2: existing entry — not dirty ────────────────────────────
        setIsDirty(false);
      } else {
        // ── FIX 2: brand new entry — mark dirty so Save button is active ─
        setPages([ensureMeta("")]);
        setEntryTitle(buildDefaultTitle(diary.name, date));
        setIsDirty(true);
      }
    } catch (e) {
      console.warn("Failed to load entry:", e.message);
      setPages([ensureMeta("")]);
      setEntryTitle(buildDefaultTitle(diary.name, date));
      setIsDirty(true);
    }
    setCurrentPage(0);
  };

  const loadEntry = async (diary, date) => {
    if (!diary || !user?.uid) return;
    await loadEntryInner(diary, user.uid, date, null);
  };

  const saveContent = async () => {
    if (!selectedDiary || !user?.uid) return;
    try {
      setSaving(true);
      const key         = toDateKey(selectedDate);
      const ref         = doc(db, "users", user.uid, "diaries", selectedDiary.id, "entries", key);
      const titleToSave = entryTitle.trim() || buildDefaultTitle(selectedDiary.name, selectedDate);
      await setDoc(ref, { date: key, content: pages, entryTitle: titleToSave }, { merge: true });
      const bodyText = pages.map((p) => (typeof p === "string" ? p : p?.data ?? "")).join(" ");
      setEntriesMeta((prev) => ({
        ...prev,
        [key]: { date: key, contentText: bodyText, entryTitle: titleToSave },
      }));
      setEntryTitle(titleToSave);
      setIsDirty(false);
    } catch { alert("Save failed. Please try again."); }
    finally { setSaving(false); }
  };

  const selectDate = async (date, diary) => {
    const targetDiary = diary || selectedDiary;
    if (isDirty && !window.confirm("You have unsaved changes. Discard?")) return;
    const newDate = date instanceof Date ? date : fromDateKey(date);
    setSelectedDate(newDate);
    setPages([]); setEntryTitle("");
    if (targetDiary) await loadEntry(targetDiary, newDate);
  };

  const openDiaryAndDate = async (diary, dateKey) => {
    await openDiary(diary);
    const date = fromDateKey(dateKey);
    setSelectedDate(date);
    await loadEntry(diary, date);
  };

  const isSameDay = (d1, d2) =>
    new Date(d1).toDateString() === new Date(d2).toDateString();

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

  const fetchSettings = async (uid) => {
    try {
      const snap = await getDoc(doc(db, "users", uid, "settings", "preferences"));
      if (snap.exists() && snap.data().appTitle) {
        const t = snap.data().appTitle;
        setAppTitle(t); localStorage.setItem("diaryTitle", t);
      }
    } catch {}
  };

  const updateAppTitle = async (title) => {
    const trimmed = (title || "").trim() || "My Diaries";
    setAppTitle(trimmed); localStorage.setItem("diaryTitle", trimmed);
    if (user) {
      await setDoc(
        doc(db, "users", user.uid, "settings", "preferences"),
        { appTitle: trimmed }, { merge: true }
      );
    }
  };

  const googleLogin = () => signInWithPopup(auth, provider);
  const logout = async () => {
    await signOut(auth);
    setDiaries([]); setSelectedDiary(null); setEntriesMeta({}); setPages([]);
  };

  return {
    user, googleLogin, logout,
    appTitle, updateAppTitle,
    diaries, selectedDiary, loadingDiaries,
    deletingDiaryId, editingDiaryId, setEditingDiaryId,
    tempDiaryName, setTempDiaryName,
    addDiary, deleteDiary, renameDiary, openDiary,
    entriesMeta, selectedDate, expandedMonths, setExpandedMonths,
    selectDate, openDiaryAndDate,
    groupDatesByMonth, isSameDay,
    pages, setPages, currentPage, setCurrentPage,
    isDirty, setIsDirty, saving, saveContent,
    entryTitle, setEntryTitle,
    loading,
    searchQuery, setSearchQuery, searchResults, searchFocused, setSearchFocused,
    showMenu, setShowMenu, showProfile, setShowProfile,
    showTemplatePicker, setShowTemplatePicker,
    menuRef, searchRef, titleInputRef,
  };
}
