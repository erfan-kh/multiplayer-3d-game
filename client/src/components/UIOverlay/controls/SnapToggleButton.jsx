import React from "react";

export default function SnapToggleButton({ snappingEnabled, setSnappingEnabled }) {

  const toggleSnap = () => {
    setSnappingEnabled(prev => !prev);
  };

  return (
    <button
      onClick={toggleSnap}
      style={{
        position: "absolute",
        right: "20px",
        bottom: "120px",
        padding: "10px 14px",
        background: snappingEnabled ? "#4CAF50" : "#333",
        color: "white",
        border: "none",
        borderRadius: "6px",
        cursor: "pointer"
      }}
    >
      Snap: {snappingEnabled ? "ON" : "OFF"}
    </button>
  );
}
