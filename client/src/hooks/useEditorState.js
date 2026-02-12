import { useState, useCallback } from "react";
import { v4 as uuid } from "uuid";

export default function useEditorState({
  snapToGrid,
  setPlacedObjects,
  setSelectedObjectId,
}) {
  const [isDrawing, setIsDrawing] = useState(false);
  const [objectType, setObjectType] = useState("wall");
  const [size, setSize] = useState([1, 1, 1]);
  const [color, setColor] = useState("#cccccc");
  const [rotation, setRotation] = useState([0, 0, 0]);
  const [previewPosition, setPreviewPosition] = useState(null);

  const handleGroundClick = useCallback(
    (e) => {
      if (!isDrawing) {
        setSelectedObjectId(null);
        return;
      }

      const point = e.point;
      const x = snapToGrid(point.x);
      const z = snapToGrid(point.z);

      const defaultSnapPoints = [
        { id: "top", offset: [0, 0.5, 0] },
        { id: "bottom", offset: [0, -0.5, 0] },
      ];

      const newObject = {
        id: uuid(),
        type: objectType,
        position: previewPosition,
        size,
        color,
        rotation,
        snapPoints: defaultSnapPoints,
      };

      setPlacedObjects((prev) => [...prev, newObject]);
      setIsDrawing(false);
      setPreviewPosition(null);
    },
    [isDrawing, objectType, previewPosition, size, color, rotation, snapToGrid]
  );

  const handlePreviewMove = useCallback(
    (e) => {
      if (!isDrawing) return;
      const { x, z } = e.point;
      const snapped = [snapToGrid(x), size[1] / 2 - 0.5, snapToGrid(z)];
      setPreviewPosition(snapped);
    },
    [isDrawing, size, snapToGrid]
  );

  return {
    isDrawing,
    setIsDrawing,
    objectType,
    setObjectType,
    size,
    setSize,
    color,
    setColor,
    rotation,
    setRotation,
    previewPosition,
    setPreviewPosition,
    handleGroundClick,
    handlePreviewMove,
  };
}
