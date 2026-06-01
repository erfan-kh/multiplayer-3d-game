// components/UIOverlay/UIOverlay.jsx
import React, { useState, useEffect, useRef, useCallback } from "react";

import MapEditorPanel from "./MapEditorPanel";
import Joystick from "./Joystick";
import LivePreview from "./LivePreview";

import useObjects from "./UIOverlay/hooks/useObjects";
import useSocketSync from "./UIOverlay/hooks/useSocketSync";
import { getCollisionType } from "./utils/collisionUtils";

import API_BASE_URL from "../config";

export default function UIOverlay(props) {

  const {
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
    recordHistory,
    undo,
    redo,
    history,
    future,
    currentMapId,
    setCurrentMapId,
    maps,
    setMaps,
    setPlacedObjects
  } = props;

  // =================================================
  // OBJECT SYSTEM
  // =================================================
  const { savedObjects, fetchObjects, setSavedObjects } = useObjects(
    currentMapId,
    setPlacedObjects
  );

  useSocketSync(fetchObjects);

  // =================================================
  // LOCAL STATE
  // =================================================
  const [objectName, setObjectName] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("walls");
  const [loadedObject, setLoadedObject] = useState(null);
  const [modelPath, setModelPath] = useState("");
  const [uploadedFile, setUploadedFile] = useState(null);
  const [newMapName, setNewMapName] = useState("");

  // =================================================
  // HELPERS
  // =================================================

  const updateArrayValue = (setter, arr, index, value) => {
    const copy = [...arr];
    copy[index] = value;
    setter(copy);
  };

  const updateRotation = (axis, value) => {
    const copy = [...rotation];
    copy[axis] = degToRad(value);
    setRotation(copy);
  };

  const loadObject = useCallback((obj) => {
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
    setModelPath(obj.modelPath || "");
  }, []);

  // =================================================
  // MAP CHANGE
  // =================================================

  useEffect(() => {
    setPlacedObjects([]);
    fetchObjects();
  }, [currentMapId]);

  const handleMapChange = (e) => {
    const id = e.target.value || null;
    setCurrentMapId(id);
  };

  // =================================================
  // SNAP TOGGLE (S KEY)
  // =================================================

  const setSnapRef = useRef(setSnappingEnabled);

  useEffect(() => {
    setSnapRef.current = setSnappingEnabled;
  }, [setSnappingEnabled]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key.toLowerCase() === "s") {
        setSnapRef.current(prev => !prev);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // =================================================
  // OBJECT SAVE
  // =================================================

  const handleSaveObject = async () => {

    if (!objectName.trim()) return;
    if (!currentMapId) return alert("Select a map first!");

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
      collision: getCollisionType(selectedCategory),
      createdAt: new Date().toISOString(),
      mapId: currentMapId
    };

    try {

      const res = await fetch(`${API_BASE_URL}/api/objects`, {
        method: "POST",
        headers: {"Content-Type":"application/json"},
        body: JSON.stringify(newObject)
      });

      if(res.ok){

        await fetchObjects();

        setObjectName("");
        setModelPath("");

      } else {

        alert("Failed to save object.");

      }

    } catch {

      alert("Error saving object.");

    }

  };

  // =================================================
  // OBJECT UPDATE
  // =================================================

  const handleUpdateObject = async () => {

    if(!loadedObject) return;

    const updatedObject = {
      name: objectName,
      category: selectedCategory,
      type: objectType,
      size,
      position,
      rotation,
      color,
      snapSize,
      collision: getCollisionType(selectedCategory)
    };

    try{

      const res = await fetch(`${API_BASE_URL}/api/objects/${loadedObject._id}`,{
        method:"PUT",
        headers:{"Content-Type":"application/json"},
        body:JSON.stringify(updatedObject)
      });

      if(res.ok){

        await fetchObjects();
        alert("Object updated!");

      } else {

        alert("Failed to update.");

      }

    }catch{

      alert("Error updating object.");

    }

  };

  // =================================================
  // OBJECT DELETE
  // =================================================

  const handleDeleteLoadedObject = async(id)=>{

    if(!window.confirm("Delete this object?")) return;

    try{

      const res = await fetch(`${API_BASE_URL}/api/objects/${id}`,{
        method:"DELETE"
      });

      if(res.ok){

        fetchObjects();

        setLoadedObject(null);
        setIsCreatingObject(false);

      } else {

        alert("Failed to delete object.");

      }

    }catch{

      alert("Error deleting object.");

    }

  };

  // =================================================
  // CREATE MAP
  // =================================================

  const createMap = async () => {

    if(!newMapName.trim()) return alert("Enter a map name.");

    try{

      const res = await fetch(`${API_BASE_URL}/api/maps`,{
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body:JSON.stringify({name:newMapName.trim()})
      });

      if(!res.ok) throw new Error();

      const newMap = await res.json();

      const mapsRes = await fetch(`${API_BASE_URL}/api/maps`);
      const allMaps = await mapsRes.json();

      setMaps(allMaps);
      setCurrentMapId(newMap._id);
      setNewMapName("");

      alert("Map created!");

    }catch{

      alert("Failed to create map.");

    }

  };

  // =================================================
  // DELETE MAP
  // =================================================

  const deleteMap = async () => {

    if(!window.confirm("Delete this map and all its objects?")) return;

    try{

      await fetch(`${API_BASE_URL}/api/maps/${currentMapId}`,{
        method:"DELETE"
      });

      const mapsRes = await fetch(`${API_BASE_URL}/api/maps`);
      const data = await mapsRes.json();

      const updated = data.filter(m => m._id !== currentMapId);

      setMaps(updated);
      setCurrentMapId(null);

      setSavedObjects({
        walls:[],
        floors:[],
        furniture:[],
        custom:[],
        car:[]
      });

      alert("Map deleted.");

    }catch{

      alert("Failed to delete map.");

    }

  };

  // =================================================
  // RENDER
  // =================================================

  return (
    <div className="ui">

      <MapEditorPanel/>

      <div className="options-toggle">
        <button className="btn options" onClick={()=>setShowOptions(p=>!p)}>
          {showOptions ? "✖️ Close Options" : "⚙️ Options"}
        </button>
      </div>

      {showOptions && (

        <>

          {/* GAME SETTINGS */}

          <div className="game-settings-toggle">
            <button className="btn settings" onClick={()=>setShowGameSettings(p=>!p)}>
              {showGameSettings ? "❌ Close Settings" : "🎛️ Game Settings"}
            </button>
          </div>

          {showGameSettings && (

            <div className="game-settings-panel">

              <label>
                Speed
                <input
                  type="range"
                  min="0.01"
                  max="0.2"
                  step="0.01"
                  value={speed}
                  onChange={e=>setSpeed(parseFloat(e.target.value))}
                />
              </label>

              <label>
                Gravity
                <input
                  type="range"
                  min="0.001"
                  max="0.02"
                  step="0.001"
                  value={gravity}
                  onChange={e=>setGravity(parseFloat(e.target.value))}
                />
              </label>

              <label>
                Jump Force
                <input
                  type="range"
                  min="0.05"
                  max="0.3"
                  step="0.01"
                  value={jumpForce}
                  onChange={e=>setJumpForce(parseFloat(e.target.value))}
                />
              </label>

            </div>

          )}

          {/* OBJECT CREATOR BUTTONS */}

          <div className="object-creator-toggle">

            <button
              className="btn create"
              onClick={()=>setIsCreatingObject(p=>!p)}
            >
              {isCreatingObject ? "❌ Cancel" : "➕ Create Object"}
            </button>

            <button
              className="btn delete"
              onClick={()=>setIsDeleteMode(p=>!p)}
              style={{backgroundColor:isDeleteMode ? "#ff4d4d" : undefined}}
            >
              {isDeleteMode ? "🗑️ Cancel Delete" : "🗑️ Delete Mode"}
            </button>

          </div>

          {/* CAMERA */}

          <div className="camera-toggle">
            <button
              className="btn camera"
              onClick={()=>{
                setCameraMode(prev =>
                  prev==="orbit"
                    ? "third"
                    : prev==="third"
                    ? "top"
                    : "orbit"
                );
              }}
            >
              🎥 Camera: {cameraMode}
            </button>
          </div>

          {/* MAP EDITOR */}

          <div className="edit-map-toggle">
            <button className="btn edit-map" onClick={()=>setIsPanelOpen(p=>!p)}>
              {isPanelOpen ? "🧹 Hide Editor" : "🛠️ Edit Map"}
            </button>
          </div>

        </>

      )}

      <Joystick onMove={handleJoystickMove} onEnd={handleJoystickEnd}/>

      <div className="jump-button">

        <button
          className="btn jump"
          onTouchStart={()=>{
            if(!isJumping.current){
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
