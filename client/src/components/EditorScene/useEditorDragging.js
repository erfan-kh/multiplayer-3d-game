import * as THREE from "three";
import { useThree } from "@react-three/fiber";
import { useRef, useEffect } from "react";

export default function useEditorDragging({
  isDrawing,
  isDeleteMode,
  setPlacedObjects,
  placedObjects,
  setSelectedObjectId,
  setIsVerticalDrag,
  dragOffset,
  recordHistory,
  setPosition,
  setPreviewPosition,
  setIsDragging,
  loadObjectIntoEditorState,
  objectRefs,
  snapSize = 0,
  snappingEnabled = false,
}) {
  const { camera } = useThree();

  const activeObject = useRef(null);
  const dragging = useRef(false);

  const dragPlane = useRef(new THREE.Plane());
  const intersection = useRef(new THREE.Vector3());

  const frame = useRef(null);
  const lastSnapCell = useRef(null);

  const cleanupDrag = () => {
    dragging.current = false;
    activeObject.current = null;
    lastSnapCell.current = null;
    setIsDragging(false);
    setIsVerticalDrag(false);
  };

  const getSurfaceY = (x, z, currentObj) => {
    let highestY = 0;
    if (!placedObjects || !currentObj) return highestY;

    const curSize = currentObj.size || [1, 1, 1];

    const curMinX = x - curSize[0] / 2;
    const curMaxX = x + curSize[0] / 2;
    const curMinZ = z - curSize[2] / 2;
    const curMaxZ = z + curSize[2] / 2;

    for (const obj of placedObjects) {
      if (!obj || obj.id === currentObj.id) continue;

      const [ox, oy, oz] = obj.position || [0, 0, 0];
      const [sx, sy, sz] = obj.size || [1, 1, 1];

      const targetMinX = ox - sx / 2;
      const targetMaxX = ox + sx / 2;
      const targetMinZ = oz - sz / 2;
      const targetMaxZ = oz + sz / 2;

      const overlapsX = curMinX < targetMaxX && curMaxX > targetMinX;
      const overlapsZ = curMinZ < targetMaxZ && curMaxZ > targetMinZ;

      if (overlapsX && overlapsZ) {
        const topSurface = oy + sy / 2;
        if (topSurface > highestY) highestY = topSurface;
      }
    }

    return highestY + curSize[1] / 2;
  };

  const startDragging = (e, obj) => {
    if (!obj?.id) return;

    lastSnapCell.current = null;
    e.stopPropagation();

    if (isDeleteMode) {
      recordHistory();
      setPlacedObjects((prev) => prev.filter((o) => o.id !== obj.id));
      return;
    }

    if (isDrawing) return;

    loadObjectIntoEditorState(obj);
    setSelectedObjectId(obj.id);

    const entry = objectRefs.current?.[obj.id];
    const rb = entry?.rigidBody;

    if (!rb) {
      cleanupDrag();
      return;
    }

    activeObject.current = obj;

    const pos = rb.translation();
    const objectPos = new THREE.Vector3(pos.x, pos.y, pos.z);

    const vertical = e.shiftKey;
    setIsVerticalDrag(vertical);

    if (vertical) {
      const camDir = new THREE.Vector3();
      camera.getWorldDirection(camDir);
      camDir.y = 0;
      camDir.normalize();
      dragPlane.current.setFromNormalAndCoplanarPoint(camDir, objectPos);
    } else {
      dragPlane.current.setFromNormalAndCoplanarPoint(
        new THREE.Vector3(0, 1, 0),
        objectPos
      );
    }

    if (e.ray.intersectPlane(dragPlane.current, intersection.current)) {
      dragOffset.current = [
        intersection.current.x - objectPos.x,
        intersection.current.y - objectPos.y,
        intersection.current.z - objectPos.z,
      ];
    }

    dragging.current = true;
    setIsDragging(true);
  };

  const handlePointerMove = (e) => {
    if (!dragging.current || !activeObject.current) return;
    if (frame.current) return;

    frame.current = requestAnimationFrame(() => {
      frame.current = null;

      const obj = activeObject.current;

      // ✅ Important: object may become null before RAF runs
      if (!dragging.current || !obj?.id) return;

      const entry = objectRefs.current?.[obj.id];
      const rb = entry?.rigidBody;
      if (!rb) return;

      if (!e.ray.intersectPlane(dragPlane.current, intersection.current)) return;

      let targetX = intersection.current.x - dragOffset.current[0];
      let targetZ = intersection.current.z - dragOffset.current[2];

      let finalX = targetX;
      let finalZ = targetZ;
      let finalY;

      if (snapSize > 0) {
        finalX = Math.round(targetX / snapSize) * snapSize;
        finalZ = Math.round(targetZ / snapSize) * snapSize;

        const cellKey = `${finalX}_${finalZ}`;
        if (lastSnapCell.current === cellKey) return;
        lastSnapCell.current = cellKey;
      }

      finalY = getSurfaceY(finalX, finalZ, obj);

      if (e.shiftKey) {
        finalY = intersection.current.y - dragOffset.current[1];
      }

      rb.setNextKinematicTranslation({ x: finalX, y: finalY, z: finalZ });
    });
  };

  const stopDragging = () => {
    if (!dragging.current || !activeObject.current) {
      cleanupDrag();
      return;
    }

    const obj = activeObject.current;

    if (!obj?.id) {
      cleanupDrag();
      return;
    }

    const entry = objectRefs.current?.[obj.id];
    const rb = entry?.rigidBody;

    if (!rb) {
      cleanupDrag();
      return;
    }

    const pos = rb.translation();
    const finalPos = [pos.x, pos.y, pos.z];

    setPlacedObjects((prev) =>
      prev.map((o) => (o.id === obj.id ? { ...o, position: finalPos } : o))
    );

    setPreviewPosition(finalPos);
    setPosition(finalPos);

    cleanupDrag();
  };

  useEffect(() => {
    window.addEventListener("pointerup", stopDragging);

    return () => {
      window.removeEventListener("pointerup", stopDragging);

      if (frame.current) {
        cancelAnimationFrame(frame.current);
        frame.current = null;
      }
    };
  }, []);

  return {
    handleBoxPointerDown: startDragging,
    handleBoxPointerMove: handlePointerMove,
  };
}
