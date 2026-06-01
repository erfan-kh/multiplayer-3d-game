import { useCallback, useRef } from "react";

export default function useEditorPreview({
  isDrawing,
  isDragging,
  previewPosition,
  setPreviewPosition,
  snapSize,
  size,
  // ✅ Accept the move handler from useEditorDragging
  handleBoxPointerMove 
}) {

  const lastSentPos = useRef([0, 0, 0]);

  const computeSnap = useCallback((x, z) => {
    const nx = Math.round(x / snapSize) * snapSize;
    const nz = Math.round(z / snapSize) * snapSize;
    const ny = size ? size[1] / 2 : 0.5;
    return [nx, ny, nz];
  }, [snapSize, size]);

  const handleGroundPointerMove = useCallback((e) => {
    // ---------------------------------------------------------
    // DRAGGING MODE: Forward movement to the dragging hook
    // ---------------------------------------------------------
    if (isDragging) {
      if (handleBoxPointerMove) {
        handleBoxPointerMove(e);
      }
      return;
    }

    // ---------------------------------------------------------
    // IDLE: Hide preview
    // ---------------------------------------------------------
    if (!isDrawing && !isDragging) {
      if (previewPosition !== null) {
        setPreviewPosition(null);
      }
      return;
    }

    // ---------------------------------------------------------
    // DRAWING MODE: Show snapped preview
    // ---------------------------------------------------------
    if (isDrawing) {
      const [nx, ny, nz] = computeSnap(e.point.x, e.point.z);
      const [lx, ly, lz] = lastSentPos.current;

      if (nx !== lx || ny !== ly || nz !== lz) {
        lastSentPos.current = [nx, ny, nz];
        setPreviewPosition([nx, ny, nz]);
      }
      return;
    }
  }, [
    isDrawing,
    isDragging,
    previewPosition,
    setPreviewPosition,
    computeSnap,
    handleBoxPointerMove // ✅ Add to dependencies
  ]);

  return { handleGroundPointerMove };
}
