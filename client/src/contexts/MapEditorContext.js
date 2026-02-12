import React, { createContext, useContext, useState } from "react";

// Define available editor modes
export const EditorModes = {
  NONE: "none",
  PLACE_COIN: "place_coin",
  DELETE: "delete",
};

// Create the context
const MapEditorContext = createContext();

// Hook for easy access
export const useMapEditor = () => useContext(MapEditorContext);

// Provider component
export const MapEditorProvider = ({ children }) => {
  const [mode, setMode] = useState(EditorModes.NONE);
  const [placedObjects, setPlacedObjects] = useState([]);
  const [isPanelOpen, setIsPanelOpen] = useState(false); // NEW: panel visibility

  const addObject = (type, position) => {
    setPlacedObjects((prev) => [
      ...prev,
      { id: Date.now(), type, position },
    ]);
  };

  const removeObjectAt = (position, radius = 0.5) => {
    setPlacedObjects((prev) =>
      prev.filter((obj) => {
        const dist = Math.hypot(
          obj.position[0] - position[0],
          obj.position[2] - position[2]
        );
        return dist > radius;
      })
    );
  };

  return (
    <MapEditorContext.Provider
      value={{
        mode,
        setMode,
        placedObjects,
        addObject,
        removeObjectAt,
        isPanelOpen,
        setIsPanelOpen, // NEW: expose toggle
      }}
    >
      {children}
    </MapEditorContext.Provider>
  );
};
