import { useState, useCallback } from "react";
import { v4 as uuid } from "uuid";

export default function useEditorState({
  snapToGrid,
  setPlacedObjects,
  setSelectedObjectId,
  recordHistory
}) {

  // ----------------------------------
  // Internal state owned by the hook
  // ----------------------------------

  // ✅ Controls ONLY preview + placement
  const [isDrawing, setIsDrawing] = useState(false);

  // ✅ Controls ONLY panel visibility
  const [isCreatingObject, setIsCreatingObject] = useState(false);

  const [objectType, setObjectType] = useState("wall");
  const [size, setSize] = useState([1, 1, 1]);
  const [color, setColor] = useState("#cccccc");
  const [rotation, setRotation] = useState([0, 0, 0]);

  const [previewPosition, setPreviewPosition] = useState(null);

  // ----------------------------------
  // ✅ NEW: SAFE UPDATE FOR LIVE EDITING
  // ----------------------------------
  const updatePlacedObject = useCallback(
    (id, updates) => {
      if (!id) return;

      recordHistory();

      setPlacedObjects((prev) =>
        prev.map((obj) =>
          obj.id === id
            ? {
                ...obj,
                ...updates
              }
            : obj
        )
      );
    },
    [setPlacedObjects, recordHistory]
  );

  // ----------------------------------
  // PLACE OBJECT ON GROUND
  // ----------------------------------
  const handleGroundClick = useCallback(
    (e) => {
      // ✅ Placement depends ONLY on isDrawing
      if (!isDrawing) {
        setSelectedObjectId(null);
        return;
      }

      const point = e.point;

      const x = snapToGrid(point.x);
      const z = snapToGrid(point.z);
      const y = size[1] / 2;

      const newObject = {
        id: uuid(),
        type: objectType,
        position: [x, y, z],
        size: [...size],
        color,
        rotation: [...rotation],
        snapPoints: [
          { id: "top", offset: [0, size[1] / 2, 0] },
          { id: "bottom", offset: [0, -size[1] / 2, 0] }
        ]
      };

      recordHistory();
      setPlacedObjects(prev => [...prev, newObject]);

      // ✅ Stop drawing after placement
      setIsDrawing(false);
      setPreviewPosition(null);

      // ✅ DO NOT touch isCreatingObject
      // Panel stays open
    },
    [
      isDrawing,
      objectType,
      size,
      color,
      rotation,
      snapToGrid,
      setPlacedObjects,
      setSelectedObjectId,
      recordHistory
    ]
  );

  // ----------------------------------
  // MOVE PREVIEW WHILE HOVERING
  // ----------------------------------
  const handlePreviewMove = useCallback(
    (e) => {
      // ✅ Preview depends ONLY on isDrawing
      if (!isDrawing) return;

      const { x, z } = e.point;

      const snapped = [
        snapToGrid(x),
        size[1] / 2,
        snapToGrid(z)
      ];

      setPreviewPosition(snapped);
    },
    [isDrawing, size, snapToGrid]
  );

  // ----------------------------------
  // EXPOSE HOOK API
  // ----------------------------------
  return {
    // Drawing state (preview + placement)
    isDrawing,
    setIsDrawing,

    // Panel visibility
    isCreatingObject,
    setIsCreatingObject,

    // Object properties
    objectType,
    setObjectType,
    size,
    setSize,
    color,
    setColor,
    rotation,
    setRotation,

    // Preview
    previewPosition,
    setPreviewPosition,

    // ✅ NEW: Live editing support
    updatePlacedObject,

    // Handlers
    handleGroundClick,
    handlePreviewMove
  };
}
