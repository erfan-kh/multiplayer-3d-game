import React from "react";

export default function ZoomControl({
  zoom,
  setZoom,
  resetZoom,
  cameraMode,
}) {
  const { min, max } =
    cameraMode === "top"
      ? { min: 10, max: 120 }
      : cameraMode === "third"
      ? { min: 2, max: 10 }
      : { min: 2, max: 20 };

  return (
    <div
      style={{
        position: "absolute",
        right: 16,
        bottom: 680,
        zIndex: 1000,
        background: "rgba(0,0,0,0.55)",
        padding: "10px 12px",
        borderRadius: 10,
        color: "#fff",
        fontSize: 12,
        width: 180,
        userSelect: "none",
      }}
    >
      <div style={{ marginBottom: 6, display: "flex", justifyContent: "space-between" }}>
        <span>Zoom</span>
        <strong>{zoom.toFixed(1)}</strong>
      </div>

      <input
        type="range"
        min={min}
        max={max}
        step="0.1"
        value={zoom}
        onChange={(e) => setZoom(Number(e.target.value))}
        style={{ width: "100%" }}
      />

      <button
        onClick={resetZoom}
        style={{
          marginTop: 6,
          width: "100%",
          padding: "4px 0",
          borderRadius: 6,
          border: "none",
          cursor: "pointer",
        }}
      >
        Reset
      </button>
    </div>
  );
}
