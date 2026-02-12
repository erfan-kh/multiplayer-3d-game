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
          ? { ...obj, size, color, rotation, position }
          : obj
      )
    );
  }, [selectedObjectId, size, color, rotation, position, setPlacedObjects]);
}
