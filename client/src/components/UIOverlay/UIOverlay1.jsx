// components/UIOverlay/UIOverlay.jsx
import React, { useState, useEffect, useCallback, useMemo } from "react";

import MapEditorPanel from "../MapEditorPanel";
import Joystick from "../Joystick";

import ObjectCreatorPanel from "./ObjectCreatorPanel";
import SavedObjectsList from "./SavedObjectsList";
import MapManager from "./MapManager";
import GameSettingsPanel from "./GameSettingsPanel";
import OptionsPanel from "./OptionsPanel";

import useObjects from "./hooks/useObjects";
import useSocketSync from "./hooks/useSocketSync";
import { getCollisionType } from "../utils/collisionUtils";

import JumpButton from "./controls/JumpButton";
import CameraModeButton from "./controls/CameraModeButton";
import DeleteModeButton from "./controls/DeleteModeButton";

// ✅ restored snap toggle UI component
import SnapToggleButton from "./controls/SnapToggleButton";

import useSnapHotkey from "./hooks/useSnapHotkey";
import useMaps from "./hooks/useMaps";

import API_BASE_URL from "../../config";
import useTemplates from "./hooks/useTemplates";

export default function UIOverlay(props) {

  const {
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

    // ✔ these are used by snap system
    snappingEnabled,
    setSnappingEnabled,

    isVerticalDrag,
    undo,
    redo,
    history,
    future,
    setPlacedObjects
  } = props;

  // =================================================
  // MAP SYSTEM
  // =================================================
  const {
    maps,
    currentMapId,
    setCurrentMapId,
    fetchMaps,
    createMap,
    deleteMap
  } = useMaps(setPlacedObjects);

  // =================================================
  // MAP OBJECT SYSTEM
  // =================================================
  const { savedObjects, fetchObjects } = useObjects(
    currentMapId,
    setPlacedObjects
  );

  useSocketSync(fetchObjects);

  // =================================================
  // TEMPLATE SYSTEM
  // =================================================
  const { templates, loadTemplates } = useTemplates();

  // =================================================
  // LOCAL STATE
  // =================================================
  const [objectName, setObjectName] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("walls");
  const [loadedObject, setLoadedObject] = useState(null);
  const [modelPath, setModelPath] = useState("");
  const [newMapName, setNewMapName] = useState("");
  const [showMaps, setShowMaps] = useState(false);

  // =================================================
  // LOAD TEMPLATE INTO CREATOR (FIXED ROTATION)
  // =================================================
  const loadObject = useCallback((obj) => {
    setObjectType(obj.type);
    setSize(obj.size);

    setRotation(
      Array.isArray(obj.rotation)
        ? [...obj.rotation]
        : [
            obj.rotation?.x || 0,
            obj.rotation?.y || 0,
            obj.rotation?.z || 0
          ]
    );

    setColor(obj.color);
    setSnapSize(obj.snapSize);

    setIsCreatingObject(true);
    setLoadedObject(obj);
    setObjectName(obj.name);
    setSelectedCategory(obj.category);
    setModelPath(obj.modelPath || "");
  }, []);

  // =================================================
  // MAP SWITCH
  // =================================================
  useEffect(() => {
    setPlacedObjects([]);
    fetchObjects();
  }, [currentMapId]);

  // =================================================
  // LOAD TEMPLATES WHEN EDITOR OPENS
  // =================================================
  useEffect(() => {
    loadTemplates();
  }, []);

  const handleMapChange = (e) => {
    const id = e.target.value || null;
    setCurrentMapId(id);
  };

  // =================================================
  // SNAP HOTKEY ( "S" )
  // =================================================
  useSnapHotkey(setSnappingEnabled);

  // =================================================
  // SAVE TEMPLATE
  // =================================================
  const handleSaveObject = async () => {
    if (!objectName.trim()) return;

    const isGLTF = objectType === "gltf" || objectType === "car";

    const template = {
      name: objectName.trim(),
      type: objectType,
      category: selectedCategory,
      modelPath: isGLTF ? modelPath : null,
      size,
      color,
      snapSize,
      collision: getCollisionType(selectedCategory),
      createdAt: new Date().toISOString()
    };

    try {
      const res = await fetch(`${API_BASE_URL}/api/templates`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(template)
      });

      if (res.ok) {
        await loadTemplates();
        alert("Template saved!");
        setObjectName("");
        setModelPath("");
      } else {
        alert("Failed to save template.");
      }
    } catch {
      alert("Error saving template.");
    }
  };

  // =================================================
  // UPDATE OBJECT
  // =================================================
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
      collision: getCollisionType(selectedCategory)
    };

    try {
      const res = await fetch(
        `${API_BASE_URL}/api/objects/${loadedObject._id}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(updatedObject)
        }
      );

      if (res.ok) {
        await fetchObjects();
        alert("Object updated!");
      } else {
        alert("Failed to update.");
      }
    } catch {
      alert("Error updating object.");
    }
  };

  // =================================================
  // DELETE OBJECT
  // =================================================
  const handleDeleteLoadedObject = async (id) => {
    if (!window.confirm("Delete this object?")) return;

    try {
      const res = await fetch(`${API_BASE_URL}/api/objects/${id}`, {
        method: "DELETE"
      });

      if (res.ok) {
        fetchObjects();
        setLoadedObject(null);
        setIsCreatingObject(false);
      } else {
        alert("Failed to delete object.");
      }
    } catch {
      alert("Error deleting object.");
    }
  };

  // =================================================
  // FLATTEN MAP OBJECTS
  // =================================================
  const flatSavedObjects = useMemo(() => {
    return Object.values(savedObjects || {}).flat();
  }, [savedObjects]);


  // =================================================
  // RENDER
  // =================================================
  return (
    <div className="ui">

      <MapEditorPanel />

      <OptionsPanel
        showOptions={showOptions}
        setShowOptions={setShowOptions}
        setShowSettings={setShowGameSettings}
        setShowCreator={setIsCreatingObject}
        setShowMaps={setShowMaps}
        showGameSettings={showGameSettings}
        isCreatingObject={isCreatingObject}
        showMaps={showMaps}
      />

      {showGameSettings && (
        <GameSettingsPanel
          speed={speed}
          setSpeed={setSpeed}
          gravity={gravity}
          setGravity={setGravity}
          jumpForce={jumpForce}
          setJumpForce={setJumpForce}
        />
      )}

      {isCreatingObject && (
        <ObjectCreatorPanel
          objectType={objectType}
          setObjectType={setObjectType}
          size={size}
          setSize={setSize}
          color={color}
          setColor={setColor}
          rotation={rotation}
          setRotation={setRotation}
          position={position}
          setPosition={setPosition}
          snapSize={snapSize}
          setSnapSize={setSnapSize}
          objectName={objectName}
          setObjectName={setObjectName}
          selectedCategory={selectedCategory}
          setSelectedCategory={setSelectedCategory}
          savedObjects={templates}
          loadObject={loadObject}
          handleSaveObject={handleSaveObject}
          handleUpdateObject={handleUpdateObject}
          handleDeleteLoadedObject={handleDeleteLoadedObject}
          loadedObject={loadedObject}
          radToDeg={radToDeg}
          degToRad={degToRad}
          isVerticalDrag={isVerticalDrag}
          snappingEnabled={snappingEnabled}
          setSnappingEnabled={setSnappingEnabled}
          isDrawing={isDrawing}
          setIsDrawing={setIsDrawing}
          undo={undo}
          redo={redo}
          history={history}
          future={future}
        />
      )}

      {showMaps && (
        <div className="map-manager-panel">
          <SavedObjectsList
            savedObjects={flatSavedObjects}
            onDeleteObject={handleDeleteLoadedObject}
          />

          <MapManager
            maps={maps}
            currentMapId={currentMapId}
            handleMapChange={handleMapChange}
            createMap={() => createMap(newMapName)}
            deleteMap={deleteMap}
            newMapName={newMapName}
            setNewMapName={setNewMapName}
          />
        </div>
      )}

      <Joystick onMove={handleJoystickMove} onEnd={handleJoystickEnd} />

      <JumpButton
        isJumping={isJumping}
        jumpVelocity={jumpVelocity}
        jumpForce={jumpForce}
      />

      <DeleteModeButton
        isDeleteMode={isDeleteMode}
        setIsDeleteMode={setIsDeleteMode}
      />

      <CameraModeButton
        cameraMode={cameraMode}
        setCameraMode={setCameraMode}
      />

      {/* ✅ Snap toggle restored */}
      <SnapToggleButton
        snappingEnabled={snappingEnabled}
        setSnappingEnabled={setSnappingEnabled}
      />

    </div>
  );
}
