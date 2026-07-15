// hooks/useSyncSelectedObject.js
import { useEffect, useRef } from "react";

function arraysEqual(a, b) {
  if (a === b) return true;
  if (!a || !b || a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

export default function useSyncSelectedObject({
  selectedObjectId,
  size,
  color,
  rotation,
  position,
  setPlacedObjects,
}) {
  const lastValuesRef = useRef({
    size: null,
    color: null,
    rotation: null,
    position: null,
  });

  useEffect(() => {
    if (!selectedObjectId) return;

    const last = lastValuesRef.current;

    // ✅ Bail out if nothing actually changed
    if (
      last.color === color &&
      arraysEqual(last.size, size) &&
      arraysEqual(last.rotation, rotation) &&
      arraysEqual(last.position, position)
    ) {
      return;
    }

    // ✅ Store new values
    lastValuesRef.current = {
      size: [...size],
      color,
      rotation: [...rotation],
      position: [...position],
    };

    setPlacedObjects((prev) => {
      let changed = false;

      const next = prev.map((obj) => {
        if (obj.id !== selectedObjectId) return obj;

        changed = true;

        return {
          ...obj,
          size: [...size],
          color,
          rotation: [...rotation],
          position: [...position],
        };
      });

      // ✅ If object wasn't found, don't trigger update
      return changed ? next : prev;
    });
  }, [selectedObjectId, size, color, rotation, position, setPlacedObjects]);
}
