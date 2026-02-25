// useSnapping.js

import { useEffect, useState, useCallback } from "react";
import * as THREE from "three";

export default function useSnapping({
  placedObjects,
  selectedObjectId,
  position,
  setPlacedObjects,
  setPosition,
  isDragging,
  setIsDragging,
  snappingEnabled, // ✅ NEW
}) {
  const [snapPreview, setSnapPreview] = useState(null);

  const getBoundingBox = (mesh) => {
    return new THREE.Box3().setFromObject(mesh);
  };

  const findSnapTarget = (draggedObj) => {
    const draggedBox = getBoundingBox(draggedObj.mesh);
    const draggedSize = new THREE.Vector3();
    draggedBox.getSize(draggedSize);

    for (const obj of placedObjects) {
      if (obj.id === draggedObj.id || !obj.mesh) continue;

      const targetBox = getBoundingBox(obj.mesh);
      const targetCenter = targetBox.getCenter(new THREE.Vector3());

      const dx = position[0] - targetCenter.x;
      const dz = position[2] - targetCenter.z;
      const distance = Math.sqrt(dx * dx + dz * dz);
      if (distance > 1.5 * Math.max(draggedSize.x, draggedSize.z)) continue;

      // Get target's local axes in world space
      const targetQuat = obj.mesh.getWorldQuaternion(new THREE.Quaternion());
      const right = new THREE.Vector3(1, 0, 0).applyQuaternion(targetQuat).normalize();
      const forward = new THREE.Vector3(0, 0, 1).applyQuaternion(targetQuat).normalize();

      // Vector from target to dragged
      const toDragged = new THREE.Vector3(dx, 0, dz).normalize();

      // Determine closest axis
      const dotRight = toDragged.dot(right);
      const dotForward = toDragged.dot(forward);

      let snapDirection;
      if (Math.abs(dotRight) > Math.abs(dotForward)) {
        snapDirection = dotRight > 0 ? right : right.clone().negate();
      } else {
        snapDirection = dotForward > 0 ? forward : forward.clone().negate();
      }

      // Get target size
      const targetSize = new THREE.Vector3();
      targetBox.getSize(targetSize);

      // Project sizes onto the snap direction to get accurate half-extents
      const draggedExtent = draggedSize.clone().multiply(new THREE.Vector3(
        Math.abs(snapDirection.x),
        0,
        Math.abs(snapDirection.z)
      )).length();

      const targetExtent = targetSize.clone().multiply(new THREE.Vector3(
        Math.abs(snapDirection.x),
        0,
        Math.abs(snapDirection.z)
      )).length();

      const offset = snapDirection.clone().multiplyScalar((draggedExtent + targetExtent) / 2);

      const snapPos = [
        targetCenter.x + offset.x,
        position[1],
        targetCenter.z + offset.z,
      ];

      return {
        position: snapPos,
        targetId: obj.id,
      };
    }

    return null;
  };

  useEffect(() => {
    if (!isDragging || !selectedObjectId || !snappingEnabled) {
      setSnapPreview(null);
      return;
    }

    const draggedObj = placedObjects.find((obj) => obj.id === selectedObjectId);
    if (!draggedObj || !draggedObj.mesh) return;

    const snapTarget = findSnapTarget(draggedObj);
    if (snapTarget) {
      setSnapPreview(snapTarget.position);
    } else {
      setSnapPreview(null);
    }
  }, [isDragging, selectedObjectId, position, placedObjects, snappingEnabled]);

  const handlePointerUp = useCallback(() => {
    setIsDragging(false);
    if (!selectedObjectId || !snappingEnabled) return;

    const draggedObj = placedObjects.find((obj) => obj.id === selectedObjectId);
    if (!draggedObj || !draggedObj.mesh) return;

    const snapTarget = findSnapTarget(draggedObj);
    if (snapTarget) {
      setPlacedObjects((prev) =>
        prev.map((obj) =>
          obj.id === draggedObj.id
            ? { ...obj, position: snapTarget.position }
            : obj
        )
      );
      setPosition(snapTarget.position);
    }

    setSnapPreview(null);
  }, [selectedObjectId, placedObjects, setPlacedObjects, setPosition, setIsDragging, snappingEnabled]);

  return {
    snapPreview,
    handlePointerUp,
  };
}
