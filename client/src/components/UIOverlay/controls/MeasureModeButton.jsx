import React from "react";

export default function MeasureModeButton({
  isMeasureMode,
  setIsMeasureMode,
  setIsDeleteMode
}) {
  const activeStyle = {
    background: "#00ffff",
    color: "#000",
    border: "2px solid #00ffff",
    boxShadow: "0 0 12px #00ffff",
    transform: "scale(1.05)",
  };

  const inactiveStyle = {
    background: "#222",
    color: "#ccc",
    border: "2px solid #555",
    boxShadow: "none",
    transform: "scale(1)",
  };

  return (
    <button
      style={{
        padding: "10px 18px",
        borderRadius: "6px",
        cursor: "pointer",
        fontSize: "15px",
        transition: "all 0.2s ease",
        ...(!isMeasureMode ? inactiveStyle : activeStyle)
      }}
      onClick={() => {
        setIsMeasureMode(v => !v);
        setIsDeleteMode(false);
      }}
    >
      {isMeasureMode ? "Measuring…" : "Measure"}
    </button>
  );
}
