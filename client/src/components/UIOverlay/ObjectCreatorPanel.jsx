import React, { useEffect, useRef } from "react";
import LivePreview from "../LivePreview";

export default function ObjectCreatorPanel({

  objectType,
  setObjectType,

  size,
  setSize,

  color,
  setColor,

  material,
  setMaterial,

  rotation,
  setRotation,

  position,
  setPosition,

  snapSize,
  setSnapSize,

  objectName,
  setObjectName,

  selectedCategory,
  setSelectedCategory,

  savedObjects,
  loadObject,

  handleSaveObject,
  handleUpdateObject,
  handleDeleteLoadedObject,

  loadedObject,

  radToDeg,
  degToRad,

  isVerticalDrag,

  snappingEnabled,
  setSnappingEnabled,

  isDrawing,
  setIsDrawing,

  undo,
  redo,
  history,
  future,

  setIsCreatingObject,

  setPreviewPosition,

  selectedObjectId,
  updatePlacedObject,

  selectedObject,

  isDragging
}) {

  const lastSyncedId = useRef(null);

  const safeSize =
    Array.isArray(size) && size.length === 3 ? size : [1, 1, 1];

  const safePosition =
    Array.isArray(position) && position.length === 3 ? position : [0, 0, 0];

  const safeRotation =
    Array.isArray(rotation) && rotation.length === 3 ? rotation : [0, 0, 0];

  const safeSavedObjects =
    savedObjects && typeof savedObjects === "object" ? savedObjects : {};

  // ======================================================
  // No more infinite update depth + prevents ghost preview
  // ======================================================
  useEffect(() => {
  if (!selectedObject) return;
  if (isDrawing) return;
  if (isDragging) return;

  if (lastSyncedId.current === selectedObject.id) return;
  lastSyncedId.current = selectedObject.id;

  if (Array.isArray(selectedObject.position)) {
    setPosition([...selectedObject.position]);
  }

  if (Array.isArray(selectedObject.size)) {
    setSize([...selectedObject.size]);
  }

  if (Array.isArray(selectedObject.rotation)) {
    setRotation([...selectedObject.rotation]);
  }

  if (selectedObject.color) {
    setColor(selectedObject.color);
  }

  if (selectedObject.material) {
    setMaterial(selectedObject.material);
  }

}, [selectedObject?.id, isDrawing, isDragging, setPosition, setSize, setRotation, setColor, setMaterial]);


  // ======================================================
  // HARD SAFETY: preview must be cleared when NOT drawing
  // ======================================================
  useEffect(() => {
    if (!isDrawing) {
      setPreviewPosition(null);
    }
  }, [isDrawing, setPreviewPosition]);

  // ------------------------------------------------------

  const updatePosition = (axis, value) => {
    const val = parseFloat(value) || 0;
    const newPos = [...safePosition];
    newPos[axis] = val;

    setPosition(newPos);

    if (isDrawing) {
      // Only show preview during active drawing
      setPreviewPosition(newPos);
    } else if (selectedObjectId) {
      // Live update selected object
      updatePlacedObject(selectedObjectId, { position: newPos });
      setPreviewPosition(null);
    } else {
      // Critical fix: never resurrect preview
      setPreviewPosition(null);
    }
  };

  const updateSize = (axis, value) => {
    const val = parseFloat(value) || 0;
    const newSize = [...safeSize];
    newSize[axis] = val;

    setSize(newSize);

    if (!isDrawing && selectedObjectId) {
      updatePlacedObject(selectedObjectId, { size: newSize });
    }
  };

  const updateRotation = (axis, valueDeg) => {
    const deg = parseFloat(valueDeg) || 0;
    const rad = degToRad(deg);
    const newRot = [...safeRotation];
    newRot[axis] = rad;

    setRotation(newRot);

    if (!isDrawing && selectedObjectId) {
      updatePlacedObject(selectedObjectId, { rotation: newRot });
    }
  };

  return (
    <div className="object-creator-panel">

      <label>
        Object Type:
        <select
          value={objectType}
          onChange={(e) => setObjectType(e.target.value)}
        >
          <optgroup label="Primitives">
            <option value="box">Box</option>
            <option value="cylinder">Cylinder</option>
            <option value="pyramid">Pyramid</option>
            <option value="ramp">Ramp</option>
          </optgroup>

          <optgroup label="Semantic Objects">
            <option value="wall">Wall</option>
            <option value="floor">Floor</option>
            <option value="table">Table</option>
            <option value="window">Window</option>
            <option value="road">Road</option>
          </optgroup>

          <optgroup label="Models">
            <option value="gltf">GLTF Model</option>
            <option value="car">Car (GLTF)</option>
          </optgroup>
        </select>
      </label>

      <label>
        Width
        <input
          type="number"
          step="0.1"
          value={safeSize[0]}
          onChange={(e) => updateSize(0, e.target.value)}
        />
      </label>

      <label>
        Height
        <input
          type="number"
          step="0.1"
          value={safeSize[1]}
          onChange={(e) => updateSize(1, e.target.value)}
        />
      </label>

      <label>
        Depth
        <input
          type="number"
          step="0.1"
          value={safeSize[2]}
          onChange={(e) => updateSize(2, e.target.value)}
        />
      </label>

      <label>
        Pos X
        <input
          type="number"
          value={safePosition[0]}
          onChange={(e) => updatePosition(0, e.target.value)}
        />
      </label>

      <label>
        Pos Y
        <input
          type="number"
          value={safePosition[1]}
          onChange={(e) => updatePosition(1, e.target.value)}
        />
      </label>

      <label>
        Pos Z
        <input
          type="number"
          value={safePosition[2]}
          onChange={(e) => updatePosition(2, e.target.value)}
        />
      </label>

      <label>
        Snap
        <select
          value={snapSize}
          onChange={(e) => setSnapSize(+e.target.value)}
        >
          <option value={1}>1</option>
          <option value={0.5}>0.5</option>
          <option value={0.25}>0.25</option>
          <option value={0.1}>0.1</option>
          <option value={0.000000000000001}>Off</option>
          
        </select>
      </label>

      <label>
        Color
        <input
          type="color"
          value={color}
          onChange={(e) => {
            setColor(e.target.value);

            if (!isDrawing && selectedObjectId) {
              updatePlacedObject(selectedObjectId, { color: e.target.value });
            }
          }}
        />
      </label>

      <label>
        Material
        <select
          value={material || "standard"}
          onChange={(e) => {
            setMaterial(e.target.value);
          
            if (!isDrawing && selectedObjectId) {
              updatePlacedObject(selectedObjectId, {
                material: e.target.value,
              });
            }
          }}
        >
          <option value="standard">Standard</option>
          <option value="glass">Glass</option>
        </select>
      </label>


      {[0, 1, 2].map((axis) => (
        <label key={axis}>
          Rotate {["X", "Y", "Z"][axis]}

          <input
            type="range"
            min={0}
            max={360}
            value={radToDeg(safeRotation[axis])}
            onChange={(e) => updateRotation(axis, e.target.value)}
          />

          <input
            type="number"
            value={radToDeg(safeRotation[axis])}
            onChange={(e) => updateRotation(axis, e.target.value)}
          />
        </label>
      ))}

      <div className="object-creator-section">
        <h5>Save Object</h5>

        <input
          value={objectName}
          onChange={(e) => setObjectName(e.target.value)}
          placeholder="Object Name"
        />

        <select
          value={selectedCategory}
          onChange={(e) => setSelectedCategory(e.target.value)}
        >
          <option value="walls">Walls</option>
          <option value="floors">Floors</option>
          <option value="furniture">Furniture</option>
          <option value="car">Car</option>
          <option value="custom">Custom</option>
        </select>

        <button onClick={handleSaveObject}>
          💾 Save
        </button>

        {loadedObject && (
          <>
            <button onClick={handleUpdateObject}>
              🔄 Update
            </button>

            <button
              style={{ background: "#ff4d4d" }}
              onClick={() =>
                handleDeleteLoadedObject(
                  loadedObject.id || loadedObject._id
                )
              }
            >
              ❌ Delete
            </button>
          </>
        )}
      </div>

      {Object.entries(safeSavedObjects).map(([category, objects]) => (
        <div key={category}>
          <h5>{category}</h5>

          {(Array.isArray(objects) ? objects : []).map((obj) => (
            <button
              key={obj.id || obj._id}
              onClick={() => loadObject(obj)}
            >
              📦 {obj.name}
            </button>
          ))}
        </div>
      ))}

      <LivePreview
        objectType={objectType}
        size={safeSize}
        color={color}
        material={material || "standard"}
        rotation={safeRotation}
      />

      {isVerticalDrag && (
        <div className="drag-indicator">
          Vertical Drag Mode
        </div>
      )}

      <button
        onClick={() => {
          if (isDrawing) {
            setIsDrawing(false);
            setPreviewPosition(null);
          } else {
            setIsDrawing(true);
          }
        }}
      >
        {isDrawing ? "Stop Drawing" : "Start Drawing"}
      </button>

      <button onClick={() => setSnappingEnabled((p) => !p)}>
        {snappingEnabled ? "Disable Snapping" : "Enable Snapping"}
      </button>

      <button onClick={undo} disabled={!history.length}>
        Undo
      </button>

      <button onClick={redo} disabled={!future.length}>
        Redo
      </button>

    </div>
  );
}
