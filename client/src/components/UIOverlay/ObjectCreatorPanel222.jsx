import React from "react";
import LivePreview from "../LivePreview";

export default function ObjectCreatorPanel({

  objectType,
  setObjectType,

  size,
  setSize,

  color,
  setColor,

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
  future

}) {

  // ⭐ SAFETY FALLBACKS — prevent "Cannot read property '[0]' of undefined"
  const safeSize = Array.isArray(size) && size.length === 3 ? size : [1, 1, 1];
  const safePosition = Array.isArray(position) && position.length === 3 ? position : [0, 0, 0];
  const safeRotation = Array.isArray(rotation) && rotation.length === 3 ? rotation : [0, 0, 0];

  const safeSavedObjects =
    savedObjects && typeof savedObjects === "object" ? savedObjects : {};

  return (
    <div className="object-creator-panel">

      <label>
        Object Type:
        <select
          value={objectType}
          onChange={(e)=>setObjectType(e.target.value)}
        >
          <option value="wall">Wall</option>
          <option value="floor">Floor</option>
          <option value="table">Table</option>
          <option value="window">Window</option>
          <option value="road">Road</option>
          <option value="gltf">GLTF Model</option>
          <option value="car">Car (GLTF)</option>
        </select>
      </label>

      {/* SIZE */}

      <label>
        Width
        <input
          type="number"
          step="0.1"
          value={safeSize[0]}
          onChange={(e)=>setSize([+e.target.value, safeSize[1], safeSize[2]])}
        />
      </label>

      <label>
        Height
        <input
          type="number"
          step="0.1"
          value={safeSize[1]}
          onChange={(e)=>setSize([safeSize[0], +e.target.value, safeSize[2]])}
        />
      </label>

      <label>
        Depth
        <input
          type="number"
          step="0.1"
          value={safeSize[2]}
          onChange={(e)=>setSize([safeSize[0], safeSize[1], +e.target.value])}
        />
      </label>

      {/* POSITION */}

      <label>
        Pos X
        <input
          type="number"
          value={safePosition[0]}
          onChange={(e)=>setPosition([+e.target.value, safePosition[1], safePosition[2]])}
        />
      </label>

      <label>
        Pos Y
        <input
          type="number"
          value={safePosition[1]}
          onChange={(e)=>setPosition([safePosition[0], +e.target.value, safePosition[2]])}
        />
      </label>

      <label>
        Pos Z
        <input
          type="number"
          value={safePosition[2]}
          onChange={(e)=>setPosition([safePosition[0], safePosition[1], +e.target.value])}
        />
      </label>

      {/* SNAP */}

      <label>
        Snap
        <select
          value={snapSize}
          onChange={(e)=>setSnapSize(+e.target.value)}
        >
          <option value={1}>1</option>
          <option value={0.5}>0.5</option>
          <option value={0.25}>0.25</option>
          <option value={0}>Off</option>
        </select>
      </label>

      {/* COLOR */}

      <label>
        Color
        <input
          type="color"
          value={color}
          onChange={(e)=>setColor(e.target.value)}
        />
      </label>

      {/* ROTATION */}

      {[0,1,2].map(axis=>(
        <label key={axis}>
          Rotate {["X","Y","Z"][axis]}

          <input
            type="range"
            min={0}
            max={360}
            value={radToDeg(safeRotation[axis])}
            onChange={(e)=>{
              const r=[...safeRotation];
              r[axis] = degToRad(+e.target.value);
              setRotation(r);
            }}
          />

          <input
            type="number"
            value={radToDeg(safeRotation[axis])}
            onChange={(e)=>{
              const r=[...safeRotation];
              r[axis] = degToRad(+e.target.value);
              setRotation(r);
            }}
          />

        </label>
      ))}

      {/* SAVE SECTION */}

      <div className="object-creator-section">

        <h5>Save Object</h5>

        <input
          value={objectName}
          onChange={(e)=>setObjectName(e.target.value)}
          placeholder="Object Name"
        />

        <select
          value={selectedCategory}
          onChange={(e)=>setSelectedCategory(e.target.value)}
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
              style={{background:"#ff4d4d"}}
              onClick={()=>handleDeleteLoadedObject(loadedObject.id || loadedObject._id)}
            >
              ❌ Delete
            </button>
          </>
        )}

      </div>

      {/* SAVED OBJECTS */}

      {Object.entries(safeSavedObjects).map(([category,objects])=>(
        <div key={category}>

          <h5>{category}</h5>

          {(Array.isArray(objects) ? objects : []).map(obj=>(
            <button
              key={obj.id || obj._id}
              onClick={()=>loadObject(obj)}
            >
              📦 {obj.name}
            </button>
          ))}

        </div>
      ))}

      {/* PREVIEW */}

      <LivePreview
        size={safeSize}
        color={color}
        rotation={safeRotation}
      />

      {isVerticalDrag && (
        <div className="drag-indicator">
          Vertical Drag Mode
        </div>
      )}

      {/* DRAW */}

      <button
        onClick={()=>setIsDrawing(prev=>!prev)}
      >
        {isDrawing ? "Stop Drawing":"Start Drawing"}
      </button>

      {/* SNAP */}

      <button
        onClick={()=>setSnappingEnabled(prev=>!prev)}
      >
        {snappingEnabled ? "Disable Snapping":"Enable Snapping"}
      </button>

      {/* HISTORY */}

      <button onClick={undo} disabled={!history.length}>
        Undo
      </button>

      <button onClick={redo} disabled={!future.length}>
        Redo
      </button>

    </div>
  );
}
