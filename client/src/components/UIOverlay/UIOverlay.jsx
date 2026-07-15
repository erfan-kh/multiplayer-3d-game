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
import NPCManagerPanel from "./NPCManagerPanel";

export default function UIOverlay(props) {
  const {
    material,
    setMaterial,

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

    selectedObjectId,
    updatePlacedObject,

    isDragging,

    npcs,
    setNpcs,
    selectedNpcId,
    setSelectedNpcId,
    showNpcManager,
    setShowNpcManager,
    focusCameraOnNpc,

    updateNpc,

    setPendingNpc,
    setPlacingWaypointForNpcId,
    placingWaypointForNpcId,

    selectedWaypointIndex,
    setSelectedWaypointIndex,

    currentMapId,
    setCurrentMapId,
  } = props;

  const positionToUse =
    Array.isArray(position) && position.length === 3 ? position : [0, 0, 0];

  const selectedObject = useMemo(() => {
    if (!selectedObjectId || !Array.isArray(placedObjects)) return null;
    return placedObjects.find((o) => o.id === selectedObjectId) || null;
  }, [placedObjects, selectedObjectId]);

  const { maps, fetchMaps, createMap, deleteMap, loadMapObjects, normalizeNpcFromApi } = useMaps(
    setPlacedObjects,
    currentMapId,
    setCurrentMapId,
    setNpcs
  );

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
    if (!currentMapId) {
      alert("No active map selected!");
      return;
    }

    const validBehavior = (value) => {
      if (["look", "chase", "attack", "ignore", "flee"].includes(value)) return value;
      return "look";
    };

    const validTargetType = (value) => {
      if (value === "npcs") return "npc";
      if (["player", "npc", "both"].includes(value)) return value;
      return "both";
    };

    const validPatrolMode = (value) => {
      if (["loop", "pingpong"].includes(value)) return value;
      return "loop";
    };

    const validMovementMode = (value) => {
      if (["idle", "static", "wander", "patrol"].includes(value)) return value;
      return "idle";
    };

    const toFiniteNumber = (value, fallback = 0) => {
      const parsed = Number(value);
      return Number.isFinite(parsed) ? parsed : fallback;
    };

    try {
      const objectsToSave = (Array.isArray(placedObjects) ? placedObjects : []).map((o) => ({
        ...o,
        name: o.name || "Object",
        category: o.category || "custom",
        material: o.material || "standard",
        snapSize: o.snapSize ?? snapSize ?? 1,
      }));

      const npcsToSave = (Array.isArray(npcs) ? npcs : []).map((npc) => {
        const movementMode = npc.movement?.mode || npc.movement?.type || "idle";
        const fallbackWaitTime = toFiniteNumber(npc.movement?.waitTime, 0);

        const serializedWaypoints = Array.isArray(npc.waypoints)
          ? npc.waypoints.map((waypoint) => {
              const rawPos = Array.isArray(waypoint)
                ? waypoint
                : Array.isArray(waypoint?.pos)
                  ? waypoint.pos
                  : [0, 0.2, 0];

              return {
                pos: [
                  toFiniteNumber(rawPos[0], 0),
                  toFiniteNumber(rawPos[1], 0.2),
                  toFiniteNumber(rawPos[2], 0),
                ],
                waitTime: Math.max(
                  0,
                  toFiniteNumber(
                    !Array.isArray(waypoint) ? waypoint?.waitTime : fallbackWaitTime,
                    fallbackWaitTime
                  )
                ),
              };
            })
          : [];

        // Normalize dialogue structure client-side during save operation
        let finalDialogue = npc.dialogue;
        if (typeof finalDialogue === "string") {
          finalDialogue = {
            startNodeId: "root",
            nodes: {
              root: {
                id: "root",
                text: finalDialogue || "Hello traveler!",
                choices: [],
                onEnter: [],
                onExit: [],
              },
            },
          };
        } else if (!finalDialogue || typeof finalDialogue !== "object") {
          finalDialogue = {
            startNodeId: "root",
            nodes: {
              root: {
                id: "root",
                text: "Hello traveler!",
                choices: [],
                onEnter: [],
                onExit: [],
              },
            },
          };
        }

        return {
          ...npc,
          id: npc.npcId || npc.id,
          npcId: npc.npcId || npc.id,

          movement: {
            mode: validMovementMode(movementMode),
            speed: toFiniteNumber(npc.movement?.speed, 2),
            waitTime: fallbackWaitTime,
            wanderRadius: toFiniteNumber(npc.movement?.wanderRadius, 5),
          },

          detection: {
            radius: toFiniteNumber(npc.detection?.radius, 6),
            behavior: validBehavior(npc.detection?.behavior),
            targetType: validTargetType(npc.detection?.targetType),
            stopDistance: toFiniteNumber(npc.detection?.stopDistance, 0.8),
            debug: Boolean(npc.detection?.debug),
            reactions:
              npc.detection?.reactions &&
              typeof npc.detection.reactions === "object"
                ? npc.detection.reactions
                : {},
          },

          patrolMode: validPatrolMode(npc.patrolMode),

          isPatrolling:
            typeof npc.isPatrolling === "boolean" ? npc.isPatrolling : true,

          currentWaypointIndex: Math.max(
            0,
            toFiniteNumber(npc.currentWaypointIndex, 0)
          ),

          waypoints: serializedWaypoints,

          dialogue: finalDialogue,
        };
      });

      console.log("NPCs being saved:", npcsToSave);

      const objectsRes = await fetch(`${API_BASE_URL}/api/maps/${currentMapId}/objects`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ objects: objectsToSave }),
      });

      if (!objectsRes.ok) {
        const errorText = await objectsRes.text();
        throw new Error(`Object save failed (${objectsRes.status}): ${errorText}`);
      }

      const npcsRes = await fetch(`${API_BASE_URL}/api/maps/${currentMapId}/npcs`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ npcs: npcsToSave }),
      });

      if (!npcsRes.ok) {
        const errorText = await npcsRes.text();
        throw new Error(`NPC save failed (${npcsRes.status}): ${errorText}`);
      }

      const npcSaveResult = await npcsRes.json();

      if (Array.isArray(npcSaveResult.npcs)) {
        const mappedNpcs = npcSaveResult.npcs.map(normalizeNpcFromApi);
        setNpcs(mappedNpcs);
      }

      alert("Map and NPCs saved successfully!");
    } catch (err) {
      console.error("Save failed:", err);
      alert(`Failed to save map/NPCs.\n${err.message}`);
    }
  };

  const handleDeleteMap = async (id) => {
    await deleteMap(id);
    fetchMaps();
  };

  const handleRenameMap = async (id, name) => {
    try {
      await fetch(`${API_BASE_URL}/api/maps/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });

      fetchMaps();
    } catch {
      alert("Failed to rename map.");
    }
  };

  const loadObject = useCallback(
    (obj) => {
      setObjectType(obj.type);
      setSize(Array.isArray(obj.size) ? obj.size : [1, 1, 1]);

      setRotation(
        Array.isArray(obj.rotation)
          ? [...obj.rotation]
          : [obj.rotation?.x || 0, obj.rotation?.y || 0, obj.rotation?.z || 0]
      );

      setColor(obj.color || "#cccccc");
      setMaterial(obj.material || "standard");
      setSnapSize(obj.snapSize ?? 1);

      setIsCreatingObject(true);

      setLoadedObject(obj);
      setObjectName(obj.name || "");
      setSelectedCategory(obj.category || "custom");
      setModelPath(obj.modelPath || "");
    },
    [
      setObjectType,
      setSize,
      setRotation,
      setColor,
      setMaterial,
      setSnapSize,
      setIsCreatingObject,
    ]
  );

  useEffect(() => {
    loadTemplates();
  }, [loadTemplates]);

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
      material: material || "standard",
      rotation,
      snapSize,
      collision: getCollisionType(selectedCategory),
      createdAt: new Date().toISOString(),
    };

    try {
      const res = await fetch(`${API_BASE_URL}/api/templates`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(template),
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
        method: "DELETE",
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
        showNpcManager={showNpcManager}
        setShowNpcManager={setShowNpcManager}
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
          isDragging={isDragging}
          material={material}
          setMaterial={setMaterial}
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

      {showNpcManager && (
        <NPCManagerPanel
          npcs={npcs}
          setNpcs={setNpcs}
          selectedNpcId={selectedNpcId}
          setSelectedNpcId={setSelectedNpcId}
          focusCameraOnNpc={focusCameraOnNpc}
          updateNpc={updateNpc}
          setPendingNpc={setPendingNpc}
          setPlacingWaypointForNpcId={setPlacingWaypointForNpcId}
          placingWaypointForNpcId={placingWaypointForNpcId}
          selectedWaypointIndex={selectedWaypointIndex}
          setSelectedWaypointIndex={setSelectedWaypointIndex}
        />
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
      <CameraModeButton cameraMode={cameraMode} setCameraMode={setCameraMode} />
      <SnapToggleButton
        snappingEnabled={snappingEnabled}
        setSnappingEnabled={setSnappingEnabled}
      />

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
