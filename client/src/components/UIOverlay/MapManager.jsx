import React, { useState } from "react";

export default function MapManager({
  maps = [],
  activeMapId,
  onCreateMap,
  onLoadMap,
  onSaveMap,
  onDeleteMap,
  onRenameMap,
}) {
  const [newMapName, setNewMapName] = useState("");
  const [renameStates, setRenameStates] = useState({}); // { [id]: string }

  const getId = (map) => map.id || map._id;

  const handleCreateClick = () => {
    const name = newMapName.trim();
    if (!name) return;
    onCreateMap && onCreateMap(name);
    setNewMapName("");
  };

  const handleRenameChange = (id, value) => {
    setRenameStates((prev) => ({ ...prev, [id]: value }));
  };

  const handleRenameSubmit = (id) => {
    const name = (renameStates[id] ?? "").trim();
    if (!name) return;

    onRenameMap && onRenameMap(id, name);

    // clear rename state after submit
    setRenameStates((prev) => {
      const copy = { ...prev };
      delete copy[id];
      return copy;
    });
  };

  const hasMaps = Array.isArray(maps) && maps.length > 0;

  return (
    <div
      className="map-manager"
      style={{
        padding: "12px",
        color: "#000",
      }}
    >
      <h2 style={{ marginTop: 0 }}>Map Manager</h2>

      {/* CREATE / SAVE */}
      <div
        style={{
          display: "flex",
          gap: 8,
          marginBottom: 12,
        }}
      >
        <input
          type="text"
          placeholder="New map name"
          value={newMapName}
          onChange={(e) => setNewMapName(e.target.value)}
          style={{
            flex: 1,
            padding: "4px 8px",
          }}
        />

        <button onClick={handleCreateClick}>Create Map</button>

        <button
          onClick={onSaveMap}
          disabled={!activeMapId}
          title={!activeMapId ? "No active map to save" : "Save current map"}
        >
          Save Current Map
        </button>
      </div>

      <h3 style={{ margin: "8px 0" }}>Maps</h3>

      {!hasMaps && (
        <div style={{ fontStyle: "italic", opacity: 0.7 }}>
          No maps created yet.
        </div>
      )}

      {hasMaps && (
        <div
          className="map-list"
          style={{
            maxHeight: 200,
            overflowY: "auto",
            border: "1px solid rgba(0,0,0,0.15)",
            borderRadius: 4,
            padding: 8,
            background: "rgba(255,255,255,0.8)",
          }}
        >
          {maps.map((map) => {
            const id = getId(map);
            const isActive = id === activeMapId;

            const renameValue =
              renameStates[id] !== undefined
                ? renameStates[id]
                : map.name || "";

            return (
              <div
                key={id}
                className="map-row"
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "4px 6px",
                  marginBottom: 4,
                  borderRadius: 4,
                  background: isActive
                    ? "rgba(0, 200, 0, 0.2)"
                    : "rgba(255, 255, 255, 0.6)",
                }}
              >
                {/* NAME INPUT */}
                <input
                  type="text"
                  value={renameValue}
                  onChange={(e) => handleRenameChange(id, e.target.value)}
                  style={{
                    flex: 1,
                    padding: "2px 6px",
                    borderRadius: 3,
                    border: "1px solid rgba(0,0,0,0.2)",
                    background: "rgba(255,255,255,0.9)",
                  }}
                />

                {/* LOAD */}
                <button
                  onClick={() => onLoadMap && onLoadMap(id)}
                  style={{ padding: "2px 6px" }}
                >
                  Load
                </button>

                {/* RENAME */}
                <button
                  onClick={() => handleRenameSubmit(id)}
                  style={{ padding: "2px 6px" }}
                >
                  Rename
                </button>

                {/* DELETE */}
                <button
                  onClick={() =>
                    window.confirm("Delete this map?") &&
                    onDeleteMap &&
                    onDeleteMap(id)
                  }
                  style={{
                    padding: "2px 6px",
                    background: "#c33",
                    color: "#fff",
                  }}
                >
                  Delete
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
