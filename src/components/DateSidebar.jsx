// src/components/DateSidebar.jsx
// Sidebar 2 — shows dates within the selected diary.
// Only dates that have entries show a blue dot; all dates are clickable.
import { useEffect, useRef } from "react";
import { toDateKey } from "../hooks/useDiary";

export default function DateSidebar({
  selectedDiary,
  entriesMeta,      // { [dateKey]: { date, contentText } }
  selectedDate,
  expandedMonths, setExpandedMonths,
  groupDatesByMonth, isSameDay,
  onDateSelect,
}) {
  const listRef      = useRef(null);
  const activeRef    = useRef(null);

  // Local helper
  const toLocalISO = (d) => {
    const yy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${yy}-${mm}-${dd}`;
  };

  // Auto-expand and scroll to the active date whenever selectedDate changes
  useEffect(() => {
    const monthKey = selectedDate.toLocaleString("default", { month:"long", year:"numeric" });
    setExpandedMonths((prev) => prev[monthKey] ? prev : { ...prev, [monthKey]: true });
  }, [selectedDate]); // eslint-disable-line

  useEffect(() => {
    activeRef.current?.scrollIntoView({ block:"nearest", behavior:"smooth" });
  });

  if (!selectedDiary) {
    return (
      <aside style={s.aside}>
        <div style={s.placeholder}>
          <div style={{ fontSize:28, marginBottom:8 }}>📅</div>
          <div style={{ fontSize:12, color:"#9aa0a6" }}>Select a diary first</div>
        </div>
      </aside>
    );
  }

  return (
    <aside style={s.aside}>
      <div style={s.pickerWrap}>
        <input
          type="date"
          style={s.picker}
          max={toLocalISO(new Date())}
          value={toLocalISO(selectedDate)}
          onChange={(e) => {
            const [y,m,d] = e.target.value.split("-").map(Number);
            onDateSelect(new Date(y, m-1, d));
          }}
        />
      </div>

      <div style={s.list} ref={listRef}>
        {groupDatesByMonth().map(([month, dates]) => (
          <div key={month}>
            <div
              style={s.monthHeader}
              onClick={() => setExpandedMonths((p) => ({ ...p, [month]: !p[month] }))}
            >
              <span>{month}</span>
              <span style={{ fontSize:9, opacity:0.5 }}>{expandedMonths[month] ? "▲" : "▼"}</span>
            </div>

            {expandedMonths[month] && [...dates].reverse().map((d) => {
              const active    = isSameDay(d, selectedDate);
              const key       = toDateKey(d);
              const hasEntry  = Boolean(entriesMeta[key]);
              return (
                <div
                  key={d.toDateString()}
                  ref={active ? activeRef : null}
                  onClick={() => onDateSelect(d)}
                  style={{
                    ...s.dateItem,
                    background: active ? "#e8f0fe" : "transparent",
                    fontWeight: active ? 600 : 400,
                    color:      active ? "#1a73e8" : "#3c4043",
                  }}
                >
                  <span>{d.toDateString().slice(4, 10)}</span>
                  {hasEntry && <span style={s.dot} />}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </aside>
  );
}

const s = {
  aside:       { width:180, borderRight:"1px solid #e8eaed", display:"flex", flexDirection:"column", overflow:"hidden", flexShrink:0 },
  placeholder: { flex:1, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", padding:16, textAlign:"center" },
  pickerWrap:  { padding:"10px 10px 6px" },
  picker:      { width:"100%", padding:"7px 8px", borderRadius:8, border:"1px solid #e0e0e0", fontSize:12, color:"#202124", outline:"none", background:"#fff" },
  list:        { flex:1, overflowY:"auto", padding:"0 6px 8px" },
  monthHeader: { display:"flex", justifyContent:"space-between", alignItems:"center", padding:"10px 6px 4px", cursor:"pointer", fontSize:11, fontWeight:700, color:"#80868b", textTransform:"uppercase", letterSpacing:"0.05em", userSelect:"none" },
  dateItem:    { display:"flex", alignItems:"center", justifyContent:"space-between", padding:"5px 8px", cursor:"pointer", fontSize:12, margin:"1px 0", borderRadius:6 },
  dot:         { width:5, height:5, borderRadius:"50%", background:"#1a73e8", flexShrink:0 },
};
