// hooks/usePointerHandlers.js
import { useRef, useCallback } from "react";
import * as THREE from "three";

export default function usePointerHandlers({
  isDragging,
  selectedObjectId,
  positionRef,
  snapSize,
  dragOffset,
  isVerticalDrag,
  lastPointerEvent,

  // contains RigidBody refs now
  objectRefs,
}) {
  const frameRef = useRef(null);
  const lastAppliedPosition = useRef(null);

  // Mirror isDragging into a ref so callbacks always see fresh value
  const isDraggingRef = useRef(isDragging);
  isDraggingRef.current = isDragging;

  const handlePointerMove = useCallback(
    (e) => {
      if (!isDraggingRef.current || !selectedObjectId) return;

      lastPointerEvent.current = e;

      const [dx, dy] = dragOffset.current;
      const [px, py, pz] = positionRef.current;

      let newX = px;
      let newY = py;
      let newZ = pz;

      if (isVerticalDrag) {
        // Move vertically along camera facing plane
        const cameraDir = new THREE.Vector3();
        e.camera.getWorldDirection(cameraDir);
        cameraDir.y = 0;
        cameraDir.normalize();

        const plane = new THREE.Plane(
          cameraDir,
          -new THREE.Vector3(px, 0, pz).dot(cameraDir)
        );

        const intersection = new THREE.Vector3();
        e.ray.intersectPlane(plane, intersection);

        if (intersection) {
          newY = intersection.y - dy;
        }
      } else {
        // Ground drag
        const { x, z } = e.point;
        newX = x - dx;
        newZ = z - dragOffset.current[2];
      }

      // Snap
      let newPosition = [newX, newY, newZ];
      if (snapSize) {
        newPosition = [
          Math.round(newPosition[0] / snapSize) * snapSize,
          newPosition[1],
          Math.round(newPosition[2] / snapSize) * snapSize,
        ];
      }

      // Avoid redundant updates
      const prev = lastAppliedPosition.current;

      if (
        !prev ||
        prev[0] !== newPosition[0] ||
        prev[1] !== newPosition[1] ||
        prev[2] !== newPosition[2]
      ) {
        lastAppliedPosition.current = newPosition;

        // store for end-of-drag commit
        positionRef.current = newPosition;

        // 🚀 NEW: Move the PHYSICS BODY, not the mesh
        const rb = objectRefs?.current?.[selectedObjectId];

        if (rb?.setTranslation) {
          rb.setTranslation(
            {
              x: newPosition[0],
              y: newPosition[1],
              z: newPosition[2],
            },
            true // don't wake physics
          );
        }
      }
    },
    [
      selectedObjectId,
      dragOffset,
      isVerticalDrag,
      snapSize,
      positionRef,
      lastPointerEvent,
      objectRefs,
    ]
  );

  const throttledPointerMove = useCallback(
    (e) => {
      if (frameRef.current !== null) return;

      frameRef.current = requestAnimationFrame(() => {
        frameRef.current = null;
        handlePointerMove(e);
      });
    },
    [handlePointerMove]
  );

  return { handlePointerMove, throttledPointerMove };
}
