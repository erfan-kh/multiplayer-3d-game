// useSnapping.js
import { useEffect, useState, useMemo } from "react";
import { getWorldSnapPoints, findSnapTarget } from "../components/utils";

export default function useSnapping({
  placedObjects,
  selectedObjectId,
  position,
  setPlacedObjects,
  setPosition,
  isDragging,
  setIsDragging,
}) {
  const [snapCache, setSnapCache] = useState({});
  const [snapPreview, setSnapPreview] = useState(null);
  const [activeSnapTarget, setActiveSnapTarget] = useState(null);

  // Update snap cache when placedObjects change
  useEffect(() => {
    const newCache = {};
    placedObjects.forEach((obj) => {
      newCache[obj.id] = getWorldSnapPoints(obj);
    });
    setSnapCache(newCache);
  }, [placedObjects]);

  // Update snap preview while dragging
  useEffect(() => {
    if (!isDragging || !selectedObjectId) {
      setSnapPreview(null);
      setActiveSnapTarget(null);
      return;
    }

    const draggedObj = placedObjects.find((obj) => obj.id === selectedObjectId);
    if (!draggedObj) return;

    const updatedDraggedObj = {
      ...draggedObj,
      position,
    };

    const snapTarget = findSnapTarget(updatedDraggedObj, snapCache);

    if (
      snapTarget &&
      snapTarget.draggedSnapPoint &&
      snapTarget.targetSnapPoint
    ) {
      const offset = snapTarget.draggedSnapPoint.rotatedOffset;

      const push = [
        snapTarget.direction[0] * (snapTarget.size[0] / 0.999),
        snapTarget.direction[1] * (snapTarget.size[1] / 0.999),
        snapTarget.direction[2] * (snapTarget.size[2] / 0.999),
      ];

      const previewPos = [
        snapTarget.targetSnapPoint.position[0] - offset[0] + push[0],
        snapTarget.targetSnapPoint.position[1] - offset[1] + push[1],
        snapTarget.targetSnapPoint.position[2] - offset[2] + push[2],
      ];

      setSnapPreview(previewPos);
      setActiveSnapTarget(snapTarget);
    } else {
      setSnapPreview(null);
      setActiveSnapTarget(null);
    }
  }, [isDragging, selectedObjectId, position, placedObjects, snapCache]);

  // Handle pointer up to finalize snapping
  const handlePointerUp = () => {
    setIsDragging(false);
    if (!selectedObjectId) return;

    const draggedObj = placedObjects.find((obj) => obj.id === selectedObjectId);
    if (!draggedObj) return;

    const updatedDraggedObj = {
      ...draggedObj,
      position,
    };

    const snapTarget = findSnapTarget(updatedDraggedObj, snapCache);

    if (
      snapTarget &&
      snapTarget.draggedSnapPoint &&
      snapTarget.targetSnapPoint
    ) {
      const offset = snapTarget.draggedSnapPoint.rotatedOffset;

      const push = [
        snapTarget.direction[0] * (snapTarget.size[0] / 0.999),
        snapTarget.direction[1] * (snapTarget.size[1] / 0.999),
        snapTarget.direction[2] * (snapTarget.size[2] / 0.999),
      ];

      const newPos = [
        snapTarget.targetSnapPoint.position[0] - offset[0] + push[0],
        snapTarget.targetSnapPoint.position[1] - offset[1] + push[1],
        snapTarget.targetSnapPoint.position[2] - offset[2] + push[2],
      ];

      setPlacedObjects((prev) =>
        prev.map((obj) =>
          obj.id === draggedObj.id ? { ...obj, position: newPos } : obj
        )
      );

      setPosition(newPos);
    }

    setSnapPreview(null);
    setActiveSnapTarget(null);
  };

  return {
    snapPreview,
    activeSnapTarget,
    setSnapPreview,
    setActiveSnapTarget,
    handlePointerUp,
    
  };
}
