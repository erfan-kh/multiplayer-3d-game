// hooks/usePointerHandlers.js
import { useRef, useCallback } from "react";
import * as THREE from "three";

export default function usePointerHandlers({
  isDragging,
  selectedObjectId,
  positionRef,
  setPosition,
  snapSize,
  dragOffset,
  isVerticalDrag,
  lastPointerEvent,
}) {
  const frameRef = useRef(null);

  const handlePointerMove = useCallback(
    (e) => {
      if (!isDragging || !selectedObjectId) return;

      // ✅ Store the latest pointer event for drag mode switching
      lastPointerEvent.current = e;

      const [dx, dy, dz] = dragOffset.current;
      const [px, py, pz] = positionRef.current;

      let newX = px;
      let newY = py;
      let newZ = pz;

      if (isVerticalDrag) {
        // Create a vertical plane perpendicular to the camera's view direction
        const cameraDir = new THREE.Vector3();
        e.camera.getWorldDirection(cameraDir);
        cameraDir.y = 0; // flatten to horizontal
        cameraDir.normalize();

        const plane = new THREE.Plane(cameraDir, -new THREE.Vector3(px, 0, pz).dot(cameraDir));
        const intersection = new THREE.Vector3();
        e.ray.intersectPlane(plane, intersection);

        if (intersection) {
          const y = intersection.y;
          newY = snapSize > 0 ? Math.round((y - dy) / snapSize) * snapSize : y - dy;
        }
      } else {
        const { x, z } = e.point;
        newX = snapSize > 0 ? Math.round((x - dx) / snapSize) * snapSize : x - dx;
        newZ = snapSize > 0 ? Math.round((z - dz) / snapSize) * snapSize : z - dz;
      }

      setPosition([newX, newY, newZ]);

      console.log("Dragging:", isDragging);
      console.log("Vertical mode:", isVerticalDrag);
      console.log("New position:", [newX, newY, newZ]);
    },
    [isDragging, selectedObjectId, snapSize, dragOffset, isVerticalDrag, setPosition, positionRef, lastPointerEvent]
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
