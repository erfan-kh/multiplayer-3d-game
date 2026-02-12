// hooks/usePointerHandlers.js
import { useRef, useCallback } from "react";

export default function usePointerHandlers({
  isDragging,
  selectedObjectId,
  position,
  setPosition,
  snapSize,
  dragOffset,
}) {
  const frameRef = useRef(null);

  const handlePointerMove = useCallback(
    (e) => {
      if (!isDragging || !selectedObjectId) return;
      const { x, z } = e.point;
      const [dx, dz] = dragOffset.current;
      const newX = snapSize > 0 ? Math.round((x - dx) / snapSize) * snapSize : x - dx;
      const newZ = snapSize > 0 ? Math.round((z - dz) / snapSize) * snapSize : z - dz;
      const newY = position[1];
      setPosition([newX, newY, newZ]);
    },
    [isDragging, selectedObjectId, position, snapSize, dragOffset, setPosition]
  );

  const throttledPointerMove = useCallback(
    (e) => {
      if (frameRef.current) return;
      frameRef.current = requestAnimationFrame(() => {
        frameRef.current = null;
        handlePointerMove(e);
      });
    },
    [handlePointerMove]
  );

  return { handlePointerMove, throttledPointerMove };
}
