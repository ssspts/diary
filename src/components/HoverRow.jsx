// src/components/HoverRow.jsx
import { useState } from "react";

/**
 * A div that highlights on hover. Used in dropdowns and file lists.
 * Props: children, onClick, style
 */
export default function HoverRow({ children, onClick, style }) {
  const [hov, setHov] = useState(false);
  return (
    <div
      style={{
        ...style,
        background: hov ? "#f1f3f4" : (style?.background || "transparent"),
        transition: "background 0.12s",
      }}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      onClick={onClick}
    >
      {children}
    </div>
  );
}
