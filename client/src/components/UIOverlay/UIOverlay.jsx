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
import SnapToggleButton from "./controls/SnapToggleButton";

import MeasureModeButton from "./controls/MeasureModeButton";
import MeasurementPanel from "./MeasurementPanel";

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

    isMeasureMode,
    setIsMeasureMode,

    showOptions,
    setShowOptions,
    showGameSettings,
    setShowGameSettings,
    showMaps,
    setShowMaps,

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

    snappingEnabled,
    setSnappingEnabled,

    isVerticalDrag,
    undo,
    redo,
    history,
    future,

    setPlacedObjects,
    placedObjects,

    registerClearMeasurements,
    clearMeasurements,

    setPreviewPosition,

    // 🔥 From editor parent:
    selectedObjectId,
    updatePlacedObject,

    // 🔥 The missing part we needed:
    isDragging
  } = props;

  // ---🔥 CLEAN POSITION (remove fallbackPos & safeSetPosition) ----
  const positionToUse =
    Array.isArray(position) && position.length === 3
      ? position
      : [0, 0, 0];

  // ---------- Compute selectedObject ----------
  const selectedObject = useMemo(() => {
    if (!selectedObjectId || !Array.isArray(placedObjects)) return null;
    return placedObjects.find((o) => o.id === selectedObjectId) || null;
  }, [placedObjects, selectedObjectId]);


  // ---------------- MAPS ----------------
  const {
    maps,
    currentMapId,
    setCurrentMapId,
    fetchMaps,
    createMap,
    deleteMap,
    loadMapObjects,
    saveMapObjects
  } = useMaps(setPlacedObjects);

  useEffect(() => {
    fetchMaps();
  }, [fetchMaps]);

  const { savedObjects, fetchObjects } = useObjects(
    currentMapId,
    setPlacedObjects
  );

  useSocketSync(fetchObjects);

  const { templates, loadTemplates } = useTemplates();

  const [objectName, setObjectName] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("walls");
  const [loadedObject, setLoadedObject] = useState(null);
  const [modelPath, setModelPath] = useState("");

  const handleCreateMap = async (name) => {
    await createMap(name);
    await fetchMaps();
  };

  const handleLoadMap = async (id) => {
    await loadMapObjects(id);
  };

  const handleSaveMap = async () => {
    if (!currentMapId) return;

    try {
      const objectsToSave =
        (Array.isArray(placedObjects) ? placedObjects : []).map((o) => ({
          ...o,
          name: o.name || "Object",
          category: o.category || "custom",
          snapSize: o.snapSize ?? snapSize ?? 1
        }));

      await saveMapObjects(currentMapId, objectsToSave);
      alert("Map saved!");
    } catch {
      alert("Failed to save map.");
    }
  };

  const handleDeleteMap = async (id) => {
    await deleteMap(id);

    if (id === currentMapId) {
      setCurrentMapId(null);
      setPlacedObjects([]);
    }

    fetchMaps();
  };

  const handleRenameMap = async (id, name) => {
    try {
      await fetch(`${API_BASE_URL}/api/maps/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name })
      });

      fetchMaps();
    } catch {
      alert("Failed to rename map.");
    }
  };

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

  useEffect(() => {
    loadTemplates();
  }, []);

  // ✅ Clear ghost preview when drag ends
useEffect(() => {
  if (!isDragging) {
    setPreviewPosition(null);
  }
}, [isDragging, setPreviewPosition]);


  useSnapHotkey(setSnappingEnabled);

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

  const handleDeleteLoadedObject = async (id) => {
    if (!window.confirm("Delete this object?")) return;

    try {
      const res = await fetch(`${API_BASE_URL}/api/templates/${id}`, {
        method: "DELETE"
      });

      if (res.ok) {
        await loadTemplates();
        setLoadedObject(null);
        setIsCreatingObject(false);
      }

    } catch {
      alert("Error deleting object.");
    }
  };

  const flatSavedObjects = useMemo(() => {
    return Object.values(savedObjects || {}).flat();
  }, [savedObjects]);


  return (
    <div className="ui">

      <MapEditorPanel
        placedObjects={placedObjects}
        setPlacedObjects={setPlacedObjects}
      />

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

          position={positionToUse}
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
          isCreatingObject={isCreatingObject}
          setIsCreatingObject={setIsCreatingObject}
          setPreviewPosition={setPreviewPosition}

          selectedObjectId={selectedObjectId}
          updatePlacedObject={updatePlacedObject}
          selectedObject={selectedObject}

          // ✅ REQUIRED FIX
          isDragging={isDragging}
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
            activeMapId={currentMapId}
            onCreateMap={handleCreateMap}
            onLoadMap={handleLoadMap}
            onSaveMap={handleSaveMap}
            onDeleteMap={handleDeleteMap}
            onRenameMap={handleRenameMap}
          />
        </div>
      )}

      <Joystick onMove={handleJoystickMove} onEnd={handleJoystickEnd} />
      <JumpButton isJumping={isJumping} jumpVelocity={jumpVelocity} jumpForce={jumpForce} />
      <DeleteModeButton isDeleteMode={isDeleteMode} setIsDeleteMode={setIsDeleteMode} />
      <CameraModeButton cameraMode={cameraMode} setCameraMode={setCameraMode} />
      <SnapToggleButton snappingEnabled={snappingEnabled} setSnappingEnabled={setSnappingEnabled} />

      <MeasureModeButton
        isMeasureMode={isMeasureMode}
        setIsMeasureMode={setIsMeasureMode}
        setIsDeleteMode={setIsDeleteMode}
      />

      <MeasurementPanel
        isMeasureMode={isMeasureMode}
        clearMeasurements={clearMeasurements}
      />

    </div>
  );
}
