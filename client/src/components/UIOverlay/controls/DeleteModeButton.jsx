import React from "react";

export default function DeleteModeButton({ isDeleteMode, setIsDeleteMode }) {
  return (
    <button
      className={`options-button ${isDeleteMode ? "active" : ""}`}
      onClick={() => setIsDeleteMode(prev => !prev)}
    >
      {isDeleteMode ? "❌ Cancel Delete" : "🗑 Delete"}
    </button>
  );
}
