// hooks/useSyncSelectedObject.js
import { useEffect } from "react";

export default function useSyncSelectedObject({
  selectedObjectId,
  size,
  color,
  rotation,
  position,
  setPlacedObjects,
}) {
  useEffect(() => {
    if (!selectedObjectId) return;

    setPlacedObjects((prev) =>
      prev.map((obj) =>
        obj.id === selectedObjectId
          ? {
              ...obj,
              size: [...size],          // ✅ clone
              color,
              rotation: [...rotation],  // ✅ clone
              position: [...position],  // ✅ clone
            }
          : obj
      )
    );
  }, [selectedObjectId, size, color, rotation, position, setPlacedObjects]);
}
