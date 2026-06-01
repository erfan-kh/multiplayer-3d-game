// HERE IS UI OF MAP EDITOR PANNEL!

import React from "react";
import { useMapEditor, EditorModes } from "../contexts/MapEditorContext";

export default function MapEditorPanel() {
  const { mode, setMode, isPanelOpen } = useMapEditor();

  return (
    isPanelOpen && (
      <div className="map-editor-panel">
        <h4>🛠️ Map Editor</h4>
        <button
          className={mode === EditorModes.PLACE_COIN ? "active" : ""}
          onClick={() => setMode(EditorModes.PLACE_COIN)}
        >
          ➕ Place Coin
        </button>
        <button
          className={mode === EditorModes.DELETE ? "active" : ""}
          onClick={() => setMode(EditorModes.DELETE)}
        >
          ❌ Delete
        </button>
        <button
          className={mode === EditorModes.NONE ? "active" : ""}
          onClick={() => setMode(EditorModes.NONE)}
        >
          🚫 Exit Edit Mode
        </button>
      </div>
    )
  );
}
