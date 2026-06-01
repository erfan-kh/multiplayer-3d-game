// hooks/useEditorDragging.js
import * as THREE from "three";
import { useThree } from "@react-three/fiber";
import { useEffect, useRef } from "react";

export default function useEditorDragging({
  isDrawing,
  isDeleteMode,
  setPlacedObjects,
  setSelectedObjectId,
  setIsVerticalDrag,
  dragOffset,
  recordHistory,
  setPosition,
  setPreviewPosition,
  setIsDragging,
  loadObjectIntoEditorState,
  objectRefs,
}) {
  const { camera } = useThree();

  const activeObject = useRef(null);
  const isDraggingObject = useRef(false);
  const dragPosition = useRef([0, 0, 0]);

  const intersection = new THREE.Vector3();
  const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  const verticalPlane = new THREE.Plane();

  // ===========================================================
  // Begin Drag
  // ===========================================================
  const startDragging = (e, obj) => {
    e.stopPropagation();

    if (isDeleteMode) {
      recordHistory();
      setPlacedObjects((prev) => prev.filter((o) => o.id !== obj.id));
      return;
    }

    if (isDrawing) return;

    loadObjectIntoEditorState(obj);
    setSelectedObjectId(obj.id);
    activeObject.current = obj;

    const vertical = e.shiftKey;
    setIsVerticalDrag(vertical);

    const objPos = new THREE.Vector3(...obj.position);

    if (vertical) {
      const cameraDir = new THREE.Vector3();
      camera.getWorldDirection(cameraDir);
      cameraDir.y = 0;
      cameraDir.normalize();

      verticalPlane.set(
        cameraDir,
        -new THREE.Vector3(objPos.x, 0, objPos.z).dot(cameraDir)
      );

      if (e.ray.intersectPlane(verticalPlane, intersection)) {
        dragOffset.current = [0, intersection.y - objPos.y, 0];
      }
    } else {
      groundPlane.constant = -objPos.y;

      if (e.ray.intersectPlane(groundPlane, intersection)) {
        dragOffset.current = [
          intersection.x - objPos.x,
          0,
          intersection.z - objPos.z,
        ];
      }
    }

    const pos = [...obj.position];
    dragPosition.current = pos;

    setPosition(pos);
    setPreviewPosition(pos);

    requestAnimationFrame(() => {
      isDraggingObject.current = true;
      setIsDragging(true);
    });
  };

  // ===========================================================
  // POINTER-MOVE → LIVE DRAG UPDATE
  // ===========================================================
  const frame = useRef(null);

const handlePointerMove = (e) => {
  if (!isDraggingObject.current || !activeObject.current) return;

  if (frame.current) return;

  frame.current = requestAnimationFrame(() => {
    frame.current = null;

    const obj = activeObject.current;
    const ray = e.ray;
    if (!ray) return;

    const entry = objectRefs?.current?.[obj.id];
    const rb = entry?.rigidBody;
    if (!rb) return;

    // ✅ read real position from physics body
    const current = rb.translation();
    const currentY = current.y;

    let hit = null;

    if (e.shiftKey) {
      hit = ray.intersectPlane(verticalPlane, intersection);
    } else {
      groundPlane.constant = -currentY;
      hit = ray.intersectPlane(groundPlane, intersection);
    }

    if (!hit) return;

    const [dx, dy, dz] = dragOffset.current || [0, 0, 0];

    const newPos = [
      hit.x - dx,
      e.shiftKey ? hit.y - dy : currentY,
      hit.z - dz,
    ];

    dragPosition.current = newPos;

    rb.setNextKinematicTranslation({
      x: newPos[0],
      y: newPos[1],
      z: newPos[2],
    });

    setPreviewPosition(newPos);
  });
};


  // ===========================================================
  // FINISH DRAG → COMMIT STATE + PHYSICS
  // ===========================================================
  const stopDragging = () => {
    if (!isDraggingObject.current || !activeObject.current) return;

    const obj = activeObject.current;
    const finalPos = dragPosition.current;

    if (!finalPos) {
      isDraggingObject.current = false;
      setIsDragging(false);
      activeObject.current = null;
      return;
    }

    setPosition(finalPos);
    setPreviewPosition(finalPos);

    setPlacedObjects((prev) =>
      prev.map((o) =>
        o.id === obj.id ? { ...o, position: [...finalPos] } : o
      )
    );

    const entry = objectRefs?.current?.[obj.id];
    const rb = entry?.rigidBody;

    if (rb?.setTranslation) {
      rb.setTranslation(
        { x: finalPos[0], y: finalPos[1], z: finalPos[2] },
        true
      );
    }

    isDraggingObject.current = false;
    setIsDragging(false);
    activeObject.current = null;
  };

  useEffect(() => {
    window.addEventListener("pointerup", stopDragging);
    return () => window.removeEventListener("pointerup", stopDragging);
  }, []);

  return {
    handleBoxPointerDown: startDragging,
    handleBoxPointerMove: handlePointerMove,
  };
}
