// src/components/DateSidebar.jsx
import { useEffect, useRef } from "react";
import { dateSidebar as s } from "../styles/tokens";

export default function DateSidebar({
  files, selectedDate,
  expandedMonths, setExpandedMonths,
  groupDatesByMonth, isSameDay,
  onDateSelect,
}) {
  const listRef        = useRef(null);
  const activeItemRef  = useRef(null);

  // FIX 1 — date-picker value.
  // selectedDate is a local Date object. toISOString() converts to UTC which
  // can shift the date by -1 day in timezones behind UTC.
  // Use local year/month/day to build the YYYY-MM-DD string instead.
  const toLocalISO = (d) => {
    const yy = d.getFullYear();
    const mm  = String(d.getMonth() + 1).padStart(2, "0");
    const dd  = String(d.getDate()).padStart(2, "0");
    return `${yy}-${mm}-${dd}`;
  };

  // FIX 4 — auto-expand the month containing selectedDate and scroll to it.
  // Runs whenever selectedDate changes (sidebar click, date-picker, search select, etc.)
  useEffect(() => {
    const monthKey = selectedDate.toLocaleString("default", {
      month: "long", year: "numeric",
    });

    // Ensure the month is expanded
    setExpandedMonths((prev) => {
      if (prev[monthKey]) return prev;          // already open, no re-render
      return { ...prev, [monthKey]: true };
    });
  }, [selectedDate]); // eslint-disable-line react-hooks/exhaustive-deps

  // Scroll the active date item into view after the month expands and renders
  useEffect(() => {
    if (activeItemRef.current) {
      activeItemRef.current.scrollIntoView({ block: "nearest", behavior: "smooth" });
    }
  });

  return (
    <aside style={s.aside}>
      {/* Date picker input */}
      <div style={s.pickerWrap}>
        <input
          type="date"
          style={s.picker}
          max={toLocalISO(new Date())}
          value={toLocalISO(selectedDate)}
          onChange={(e) => {
            // FIX 1 — parse "YYYY-MM-DD" as LOCAL midnight, not UTC midnight
            const [y, m, d] = e.target.value.split("-").map(Number);
            onDateSelect(new Date(y, m - 1, d));
          }}
        />
      </div>

      {/* Scrollable month / date list */}
      <div style={s.list} ref={listRef}>
        {groupDatesByMonth().map(([month, dates]) => (
          <div key={month}>
            <div
              style={s.monthHeader}
              onClick={() =>
                setExpandedMonths((p) => ({ ...p, [month]: !p[month] }))
              }
            >
              <span>{month}</span>
              <span style={{ fontSize: 9, opacity: 0.55 }}>
                {expandedMonths[month] ? "▲" : "▼"}
              </span>
            </div>

            {expandedMonths[month] &&
              [...dates].reverse().map((d) => {
                const active     = isSameDay(d, selectedDate);
                const hasEntries = files.some((f) => isSameDay(f.createdAt, d));
                return (
                  <div
                    key={d.toDateString()}
                    ref={active ? activeItemRef : null}   // FIX 4 — scroll target
                    onClick={() => onDateSelect(d)}
                    style={{
                      ...s.dateItem,
                      background: active ? "#e8f0fe" : "transparent",
                      fontWeight: active ? 600 : 400,
                      color:      active ? "#1a73e8" : "#3c4043",
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
  );
}
