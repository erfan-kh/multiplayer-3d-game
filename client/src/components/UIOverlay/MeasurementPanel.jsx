// components/UIOverlay/MeasurementPanel.jsx
import React, { useRef, useEffect, useState } from "react";

export default function MeasurementPanel({ isMeasureMode, clearMeasurements }) {
  const clearRef = useRef(null);
  const [hasClearFn, setHasClearFn] = useState(false);

  useEffect(() => {
    clearRef.current = clearMeasurements;
    setHasClearFn(!!clearMeasurements);
  }, [clearMeasurements]);

  if (!isMeasureMode || !hasClearFn) return null;

  return (
    <div
      style={{
        position: "absolute",
        right: "20px",
        top: "50%",
        transform: "translateY(-50%)",
        minWidth: "220px",
        padding: "12px 16px",
        background: "#18f0f0",
        color: "#003333",
        borderRadius: "12px",
        boxShadow: "0 0 18px rgba(24, 240, 240, 0.6)",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        fontWeight: 600,
        zIndex: 9999999
      }}
    >
      <span style={{ fontSize: "16px" }}>Measuring…</span>

      <button
        onClick={() => clearRef.current?.()}
        style={{
          background: "transparent",
          border: "1px solid rgba(0,0,0,0.25)",
          color: "#003333",
          padding: "4px 12px",
          borderRadius: "6px",
          fontSize: "14px",
          cursor: "pointer",
          transition: "all 0.15s ease"
        }}
        onMouseEnter={e => (e.currentTarget.style.background = "rgba(0,0,0,0.08)")}
        onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
      >
        Clear
      </button>
    </div>
  );
}
