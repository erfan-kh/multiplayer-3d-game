// IT IS PART OF FUNCTIONALITY OF MAP EDITOR PANEL!

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
  const [isPanelOpen, setIsPanelOpen] = useState(false);

  // Add new object
  const addObject = (type, position) => {
    const newObject = {
      id: Date.now() + Math.random(),
      type,
      position,
    };

    setPlacedObjects((prev) => [...prev, newObject]);
  };

  // Remove object near a position
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

  // Load objects when opening a saved map
  const loadObjects = (objects) => {
    if (!objects || !Array.isArray(objects)) {
      setPlacedObjects([]);
      return;
    }

    setPlacedObjects(objects);
  };

  return (
    <MapEditorContext.Provider
      value={{
        mode,
        setMode,
        placedObjects,
        setPlacedObjects, // important so other components can update it
        addObject,
        removeObjectAt,
        loadObjects,
        isPanelOpen,
        setIsPanelOpen,
      }}
    >
      {children}
    </MapEditorContext.Provider>
  );
};
