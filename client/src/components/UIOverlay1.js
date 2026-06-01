// HERE WE ARE PUTING OUR UI LIKE JOYSTICK/CAMERA MODE/OBJECT CREATOR PANNEL/ MAP EDITOR PANNEL/ GAME SETTING PANNEL ETC . . .

// components/UIOverlay.js
import React, { useState, useEffect, useCallback, useRef } from "react";

import MapEditorPanel from "./MapEditorPanel";
import Joystick from "./Joystick";
import LivePreview from "./LivePreview";
import API_BASE_URL from "../config";


import { io } from "socket.io-client";


const socket = io(process.env.REACT_APP_API_BASE_URL);


export default function UIOverlay({
  isPanelOpen,
  setIsPanelOpen,
  isCreatingObject,
  setIsCreatingObject,
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
  showTransformControls,
  setShowTransformControls,
  isDeleteMode,
  setIsDeleteMode,
  showOptions,
  setShowOptions,
  showGameSettings,
  setShowGameSettings,
  isDrawing,
  setIsDrawing,
  cameraMode,
  setCameraMode,
  showSnapPoints,
  setShowSnapPoints,
  handleJoystickMove,
  handleJoystickEnd,
  isJumping,
  jumpVelocity,
  radToDeg,
  degToRad,
  speed,
  setSpeed,
  gravity,
  setGravity,
  jumpForce,
  setJumpForce,

  snappingEnabled,
  setSnappingEnabled,

  isVerticalDrag,

  recordHistory, // ✅ NEW

  undo,
  redo,
  history,
  future,
}) {
  const [savedObjects, setSavedObjects] = useState({
    walls: [],
    floors: [],
    furniture: [],
    custom: [],
    car: [], // ✅ New category for GLTF objects
  });

  const [objectName, setObjectName] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("walls");
  const [loadedObject, setLoadedObject] = useState(null);

  const [modelPath, setModelPath] = useState("");

  const [uploadedFile, setUploadedFile] = useState(null);




const getCollisionType = (category) => {
  switch (category) {
    case "walls":
    case "floors":
    case "furniture":
    case "car":
      return "solid";
    case "custom":
      return "none";
    default:
      return "solid";
  }
};
 


const fetchObjects = useCallback(async () => {
  try {
    const res = await fetch(`${API_BASE_URL}/api/objects`);
    const data = await res.json();

    const grouped = {
      walls: [],
      floors: [],
      furniture: [],
      custom: [],
      car: [],
    };

    data.forEach((obj) => {
      if (grouped[obj.category]) {
        grouped[obj.category].push(obj);
      }
    });

    // Always create a new object reference
    setSavedObjects({ ...grouped });
  } catch (err) {
    console.error("Failed to load saved objects:", err);
  }
}, []);




useEffect(() => {
  const handleChange = (change) => {
    console.log("🔄 Real-time update received:", change);
    fetchObjects();
  };

  socket.on("objectChange", handleChange);

  return () => {
    socket.off("objectChange", handleChange);
  };
}, [fetchObjects]);




  useEffect(() => {
    fetchObjects();
  }, []);

  const loadObject = (obj) => {
    setObjectType(obj.type);
    setSize(obj.size);
    setPosition(obj.position);
    setRotation(obj.rotation);
    setColor(obj.color);
    setSnapSize(obj.snapSize);
    setIsCreatingObject(true);
    setLoadedObject(obj);
    setObjectName(obj.name);
    setSelectedCategory(obj.category);
    setModelPath(obj.modelPath || ""); // ✅ Load model path
  };


const setSnapRef = useRef(setSnappingEnabled);
useEffect(() => {
  setSnapRef.current = setSnappingEnabled;
}, [setSnappingEnabled]);



useEffect(() => {
  const handleKeyDown = (e) => {
    if (e.key.toLowerCase() === "s") {
      if (typeof setSnapRef.current === "function") {
        setSnapRef.current((prev) => !prev);
      }
    }
  };
  window.addEventListener("keydown", handleKeyDown);
  return () => window.removeEventListener("keydown", handleKeyDown);
}, []);



const handleSaveObject = async () => {
  if (!objectName.trim()) return;

  const isGLTF = objectType === "gltf" || objectType === "car";

  const newObject = {
    name: objectName.trim(),
    type: objectType,
    category: selectedCategory,
    modelPath: isGLTF ? modelPath : null,
    size,
    position,
    rotation,
    color,
    snapSize,
    collision: getCollisionType(selectedCategory), // ✅ ADDED
    createdAt: new Date().toISOString(),
  };

  try {
    const res = await fetch(`${API_BASE_URL}/api/objects`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(newObject),
    });

    if (res.ok) {
      const saved = await res.json();
      console.log("Saved to DB:", saved);

      fetchObjects();
      setObjectName("");
      setModelPath("");
    } else {
      alert("Failed to save object.");
    }
  } catch (err) {
    console.error(err);
    alert("Error saving object.");
  }
};



  const handleUpdateObject = async () => {
    if (!loadedObject) return;

    const updatedObject = {
  name: objectName,
  category: selectedCategory,
  type: objectType,
  size,
  position,
  rotation,
  color,
  snapSize,
  collision: getCollisionType(selectedCategory), // ✅ ADDED
};


    try {
      const res = await fetch(`${API_BASE_URL}/api/objects/${loadedObject._id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updatedObject),
      });

      if (res.ok) {
        await fetchObjects();

        setObjectName("");
        setObjectType("wall");
        setSize([1, 1, 1]);
        setPosition([0, 0, 0]);
        setRotation([0, 0, 0]);
        setColor("#ffffff");
        setSnapSize(0.5);
        setIsCreatingObject(false);
        setLoadedObject(null);

        alert("✅ Object updated!");
      } else {
        alert("Failed to update object.");
      }
    } catch (err) {
      console.error(err);
      alert("Error updating object.");
    }
  };

  const handleDeleteLoadedObject = async (id) => {
    const confirm = window.confirm("Are you sure you want to delete this object?");
    if (!confirm) return;

    try {
      const res = await fetch(`${API_BASE_URL}/api/objects/${id}`, {
        method: "DELETE",
      });

      if (res.ok) {

        fetchObjects(); // ✅ Refresh from server

        setLoadedObject(null);
        setIsCreatingObject(false);
      } else {
        alert("Failed to delete object.");
      }
    } catch (err) {
      console.error(err);
      alert("Error deleting object.");
    }
  };


  return (
    
    <div className="ui">
      <MapEditorPanel />

      <div className="options-toggle">
        <button className="btn options" onClick={() => setShowOptions((prev) => !prev)}>
          {showOptions ? "✖️ Close Options" : "⚙️ Options"}
        </button>
      </div>

      {showOptions && (
        <>
          <div className="game-settings-toggle">
            <button
              className="btn settings"
              onClick={() => setShowGameSettings((prev) => !prev)}
            >
              {showGameSettings ? "❌ Close Settings" : "🎛️ Game Settings"}
            </button>
          </div>

          {showGameSettings && (
            <div className="game-settings-panel">
              <label>
                Speed:
                <input
                  type="range"
                  min="0.01"
                  max="0.2"
                  step="0.01"
                  value={speed}
                  onChange={(e) => setSpeed(parseFloat(e.target.value))}
                />
              </label>
              <label>
                Gravity:
                <input
                  type="range"
                  min="0.001"
                  max="0.02"
                  step="0.001"
                  value={gravity}
                  onChange={(e) => setGravity(parseFloat(e.target.value))}
                />
              </label>
              <label>
                Jump Force:
                <input
                  type="range"
                  min="0.05"
                  max="0.3"
                  step="0.01"
                  value={jumpForce}
                  onChange={(e) => setJumpForce(parseFloat(e.target.value))}
                />
              </label>
            </div>
          )}


          <div className="object-creator-toggle">
            
            <button
              className="btn create"
              onClick={() => setIsCreatingObject((prev) => !prev)}
            >
              {isCreatingObject ? "❌ Cancel" : "➕ Create Object"}
            </button>

            <button
              className="btn delete"
              onClick={() => setIsDeleteMode((prev) => !prev)}
              style={{ backgroundColor: isDeleteMode ? "#ff4d4d" : undefined }}
            >
              {isDeleteMode ? "🗑️ Cancel Delete" : "🗑️ Delete Mode"}
            </button>
          </div>

          {isCreatingObject && (
            <div className="object-creator-panel">
              <label>
              Object Type:
              <select value={objectType} onChange={(e) => setObjectType(e.target.value)}>
                <option value="wall">Wall</option>
                <option value="floor">Floor</option>
                <option value="table">Table</option>
                <option value="window">Window</option>
                <option value="road">Road</option>
                <option value="gltf">GLTF Model</option> {/* ✅ Add this */}
                <option value="car">Car (GLTF)</option>   {/* ✅ Optional alias */}
              </select>
            </label>


              <label>
                Width:
                <input
                  type="number"
                  step="0.1"
                  value={size[0]}
                  onChange={(e) => setSize([+e.target.value, size[1], size[2]])}
                />
              </label>
              <label>
                Height:
                <input
                  type="number"
                  step="0.1"
                  value={size[1]}
                  onChange={(e) => setSize([size[0], +e.target.value, size[2]])}
                />
              </label>
              <label>
                Depth:
                <input
                  type="number"
                  step="0.1"
                  value={size[2]}
                  onChange={(e) => setSize([size[0], size[1], +e.target.value])}
                />
              </label>

              <label>
                Position X:
                <input
                  type="number"
                  step="0.1"
                  value={position[0]}
                  onChange={(e) => setPosition([+e.target.value, position[1], position[2]])}
                />
              </label>
              <label>
                Position Y:
                <input
                  type="number"
                  step="0.1"
                  value={position[1]}
                  onChange={(e) => setPosition([position[0], +e.target.value, position[2]])}
                />
              </label>
              <label>
                Position Z:
                <input
                  type="number"
                  step="0.1"
                  value={position[2]}
                  onChange={(e) => setPosition([position[0], position[1], +e.target.value])}
                />
              </label>

              <label>
                Snap to Grid:
                <select value={snapSize} onChange={(e) => setSnapSize(+e.target.value)}>
                  <option value={1}>1</option>
                  <option value={0.5}>0.5</option>
                  <option value={0.25}>0.25</option>
                  <option value={0}>Off</option>
                </select>
              </label>

              <label>
                Color:
                <input
                  type="color"
                  value={color}
                  onChange={(e) => setColor(e.target.value)}
                />
              </label>

              <label>
                Rotate X (°):
                <input
                  type="range"
                  min={0}
                  max={360}
                  value={radToDeg(rotation[0])}
                  onChange={(e) =>
                    setRotation([degToRad(+e.target.value), rotation[1], rotation[2]])
                  }
                />
                <input
                  type="number"
                  min={0}
                  max={360}
                  value={radToDeg(rotation[0])}
                  onChange={(e) =>
                    setRotation([degToRad(+e.target.value), rotation[1], rotation[2]])
                  }
                />
              </label>

              <label>
                Rotate Y (°):
                <input
                  type="range"
                  min={0}
                  max={360}
                  value={radToDeg(rotation[1])}
                  onChange={(e) =>
                    setRotation([rotation[0], degToRad(+e.target.value), rotation[2]])
                  }
                />
                <input
                  type="number"
                  min={0}
                  max={360}
                  value={radToDeg(rotation[1])}
                  onChange={(e) =>
                    setRotation([rotation[0], degToRad(+e.target.value), rotation[2]])
                  }
                />
              </label>

              <label>
                Rotate Z (°):
                <input
                  type="range"
                  min={0}
                  max={360}
                  value={radToDeg(rotation[2])}
                  onChange={(e) =>
                    setRotation([rotation[0], rotation[1], degToRad(+e.target.value)])
                  }
                />
                <input
                  type="number"
                  min={0}
                  max={360}
                  value={radToDeg(rotation[2])}
                  onChange={(e) =>
                    setRotation([rotation[0], rotation[1], degToRad(+e.target.value)])
                  }
                />
              </label>

               <div className="object-creator-section">
              <h5>Save Object</h5>

              <label>
                Name:
                <input
                  type="text"
                  placeholder="e.g. Tall Wall"
                  value={objectName}
                  onChange={(e) => setObjectName(e.target.value)}
                />
              </label>

              <label>
                Category:
                <select value={selectedCategory} onChange={(e) => setSelectedCategory(e.target.value)}>
                  <option value="walls">Walls</option>
                  <option value="floors">Floors</option>
                  <option value="furniture">Furniture</option>
                  <option value="car">Car (GLTF)</option> {/* ✅ New type */}
                  <option value="custom">Custom</option>
                </select>
              </label>








              <button className="btn save" onClick={handleSaveObject}>
                💾 Save Object
              </button>

                  {loadedObject && (
                    <button className="btn update" onClick={handleUpdateObject}>
                      🔄 Update Object
                    </button>
                  )}

              {loadedObject && (
                <button
                  className="btn delete"
                  onClick={() => handleDeleteLoadedObject(loadedObject._id)}
                  style={{ backgroundColor: "#ff4d4d", marginTop: "10px" }}
                >
                  ❌ Delete This Object
                </button>
              )}




            </div>
                  

                  {Object.entries(savedObjects).map(([category, objects]) => (
  <div key={category} className="saved-category">
    <h5>{category.toUpperCase()}</h5>
    {objects.length === 0 ? (
      <p style={{ fontSize: "12px", color: "#c55d5d" }}>No saved objects</p>
    ) : (
      objects.map((obj, i) => (
        <button
          key={i}
          className="btn"
          onClick={() => loadObject(obj)}
          style={{ marginBottom: "6px" }}
        >
          📦 {obj.name}
        </button>
      ))
    )}
  </div>
))}

              

             {/* 🔍 Add the preview here */}
             <div>
              
<LivePreview
  size={size}
  color={color}
  rotation={rotation}
/>



{isVerticalDrag && (
  <div style={{
    position: "absolute",
    top: 50,
    left: 10,
    background: "rgba(0,0,0,0.7)",
    color: "white",
    padding: "4px 8px",
    borderRadius: "4px",
    zIndex: 1000,
    fontSize: "14px",
    pointerEvents: "none"
  }}>
    Vertical Drag Mode (Shift)
  </div>
)}



             </div>

              <button
                className="btn draw"
                onClick={() => setIsDrawing((prev) => !prev)}
                style={{ backgroundColor: isDrawing ? "#4caf50" : undefined }}
              >
                {isDrawing ? "✅ Drawing (Tap to Cancel)" : "🎨 Start Drawing"}
              </button>

              <button onClick={() => setSnappingEnabled((prev) => !prev)}>
                {snappingEnabled ? "Disable Snapping (S)" : "Enable Snapping (S)"}
              </button>

                <button onClick={undo} disabled={history.length === 0}>Undo</button>
                <button onClick={redo} disabled={future.length === 0}>Redo</button>
            </div>    
            

            
          )}




   


          <div className="camera-toggle">
            <button
              className="btn camera"
              onClick={() =>
                setCameraMode((prev) =>
                  prev === "orbit" ? "third" : prev === "third" ? "top" : "orbit"
                )
              }
            >
              🎥 Camera: {cameraMode}
            </button>
          </div>
    
              <div className="edit-map-toggle">
                <button
                  className="btn edit-map"
                  onClick={() => setIsPanelOpen((prev) => !prev)}
                >
                  {isPanelOpen ? "🧹 Hide Editor" : "🛠️ Edit Map"}
                </button>
          </div>
        </>
      )}

      <Joystick onMove={handleJoystickMove} onEnd={handleJoystickEnd} />

      <div className="jump-button">
        <button
          className="btn jump"
            onTouchStart={() => {
          if (!isJumping.current) {
            isJumping.current = true;
            jumpVelocity.current = jumpForce;
          }
        }}


        >
          ⬆️ Jump
        </button>
      </div>
    </div>
  );
}
