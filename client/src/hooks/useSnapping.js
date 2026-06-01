// useSnapping.js
import { useEffect, useState, useCallback, useRef } from "react";
import * as THREE from "three";

const SNAP_DISTANCE = 4; // max distance allowed to snap

export default function useSnapping({
  placedObjects,
  objectRefs,
  selectedObjectId,
  position,
  setPlacedObjects,
  setPosition,
  isDragging,
  setIsDragging,
  snappingEnabled,
  recordHistory,
}) {
  const [snapPreview, setSnapPreview] = useState(null);

  const lastSnapTargetRef = useRef(null);

  // Always read live refs
  const getRefs = () => objectRefs?.current ?? {};

  const getBoundingBox = (mesh) => {
    if (!mesh) return null;

    mesh.updateWorldMatrix(true, true);

    const box = new THREE.Box3().setFromObject(mesh);

    if (!box || box.isEmpty()) return null;

    return box;
  };

  // ==== FIND SNAP TARGET (NOW WITH VERTICAL SNAP SUPPORT + FIXED DISTANCE LOGIC) ====
  const findSnapTarget = (draggedObj) => {
    const refs = getRefs();
    if (!draggedObj) return null;

    const draggedMesh = refs[draggedObj.id];
    if (!draggedMesh) return null;

    // live world position
    const livePos = new THREE.Vector3();
    draggedMesh.getWorldPosition(livePos);

    const draggedBox = getBoundingBox(draggedMesh);
    if (!draggedBox) return null;

    const draggedSize = new THREE.Vector3();
    draggedBox.getSize(draggedSize);

    let closest = null;
    let closestDist = Infinity;

    for (const obj of placedObjects) {
      if (!obj?.id || obj.id === draggedObj.id) continue;

      const targetMesh = refs[obj.id];
      if (!targetMesh) continue;

      const targetBox = getBoundingBox(targetMesh);
      if (!targetBox) continue;

      const targetCenter = targetBox.getCenter(new THREE.Vector3());

      // deltas
      const dx = livePos.x - targetCenter.x;
      const dy = livePos.y - targetCenter.y;
      const dz = livePos.z - targetCenter.z;

      // distances
      const horizontalDist = Math.sqrt(dx * dx + dz * dz);
      const verticalDist = Math.abs(dy);

      // ---------- FIXED AXIS DOMINANCE + DISTANCE VALIDATION ----------
      const absX = Math.abs(dx);
      const absY = Math.abs(dy);
      const absZ = Math.abs(dz);

      let axis = "horizontal";
      if (absY > absX && absY > absZ) {
        axis = "vertical";
      }

      // correct dedicated distance check
      if (axis === "vertical") {
        if (verticalDist > SNAP_DISTANCE) continue;
      } else {
        if (horizontalDist > SNAP_DISTANCE) continue;
      }
      // ---------------------------------------------------------------

      let snapDirection;

      // ---------- VERTICAL SNAPPING ----------
      if (axis === "vertical") {
        snapDirection =
          dy > 0
            ? new THREE.Vector3(0, 1, 0) // top
            : new THREE.Vector3(0, -1, 0); // bottom
      } else {
        // ---------- EXISTING HORIZONTAL LOGIC ----------
        const targetQuat = targetMesh.getWorldQuaternion(
          new THREE.Quaternion()
        );

        const right = new THREE.Vector3(1, 0, 0)
          .applyQuaternion(targetQuat)
          .normalize();

        const forward = new THREE.Vector3(0, 0, 1)
          .applyQuaternion(targetQuat)
          .normalize();

        const toDragged = new THREE.Vector3(dx, 0, dz).normalize();

        const dotRight = toDragged.dot(right);
        const dotForward = toDragged.dot(forward);

        if (Math.abs(dotRight) > Math.abs(dotForward)) {
          snapDirection = dotRight > 0 ? right : right.clone().negate();
        } else {
          snapDirection = dotForward > 0 ? forward : forward.clone().negate();
        }
      }

      const targetSize = new THREE.Vector3();
      targetBox.getSize(targetSize);

      // ---------- EXTENT CALC INCLUDING Y ----------
      const draggedExtent =
        Math.abs(snapDirection.x) * draggedSize.x +
        Math.abs(snapDirection.y) * draggedSize.y +
        Math.abs(snapDirection.z) * draggedSize.z;

      const targetExtent =
        Math.abs(snapDirection.x) * targetSize.x +
        Math.abs(snapDirection.y) * targetSize.y +
        Math.abs(snapDirection.z) * targetSize.z;

      const offset = snapDirection
        .clone()
        .multiplyScalar((draggedExtent + targetExtent) / 2);

      const snapPos = [
        targetCenter.x + offset.x,
        targetCenter.y + offset.y,
        targetCenter.z + offset.z,
      ];

      const totalDist = Math.sqrt(dx * dx + dy * dy + dz * dz);

      if (totalDist < closestDist) {
        closestDist = totalDist;
        closest = { position: snapPos, targetId: obj.id };
      }
    }

    return closest;
  };

  useEffect(() => {
    if (!snappingEnabled || !isDragging || !selectedObjectId) {
      lastSnapTargetRef.current = null;
      setSnapPreview(null);
      return;
    }

    const draggedObj = placedObjects.find(
      (obj) => obj.id === selectedObjectId
    );

    if (!draggedObj) {
      setSnapPreview(null);
      return;
    }

    const snapTarget = findSnapTarget(draggedObj);

    if (!snapTarget) {
      lastSnapTargetRef.current = null;
      setSnapPreview(null);
      return;
    }

    if (
      lastSnapTargetRef.current &&
      lastSnapTargetRef.current.targetId === snapTarget.targetId
    ) {
      return;
    }

    lastSnapTargetRef.current = snapTarget;
    setSnapPreview(snapTarget.position);
  }, [
    isDragging,
    selectedObjectId,
    position,
    placedObjects,
    snappingEnabled,
  ]);

  const arraysEqual = (a, b) =>
    a && b && a.length === b.length && a.every((v, i) => v === b[i]);

  const handlePointerUp = useCallback(() => {
    setIsDragging(false);

    if (!selectedObjectId || !snappingEnabled) {
      setSnapPreview(null);
      return;
    }

    const draggedObj = placedObjects.find(
      (obj) => obj.id === selectedObjectId
    );

    if (!draggedObj) {
      setSnapPreview(null);
      return;
    }

    const snapTarget = findSnapTarget(draggedObj);

    const draggedMesh = objectRefs.current[selectedObjectId];
    const liveWorldPos = new THREE.Vector3();
    draggedMesh.getWorldPosition(liveWorldPos);

    let finalPosition = [
      liveWorldPos.x,
      liveWorldPos.y,
      liveWorldPos.z,
    ];

    if (snapTarget && snapPreview) {
      finalPosition = snapTarget.position;
    }

    const hasMoved = !arraysEqual(draggedObj.position, finalPosition);

    if (hasMoved) {
      recordHistory();

      setPlacedObjects((prev) =>
        prev.map((obj) =>
          obj.id === draggedObj.id
            ? { ...obj, position: finalPosition }
            : obj
        )
      );

      setPosition(finalPosition);
    }

    lastSnapTargetRef.current = null;
    setSnapPreview(null);
  }, [
    selectedObjectId,
    placedObjects,
    setPlacedObjects,
    setPosition,
    setIsDragging,
    snappingEnabled,
    recordHistory,
    snapPreview,
  ]);

  return { snapPreview, handlePointerUp };
}
