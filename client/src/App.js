// App.js
import React, { useRef, useState, useEffect, useCallback } from "react";
import "./App.css";
import * as THREE from "three";

import EditorCanvas from "./components/EditorCanvas";
import UIOverlay from "./components/UIOverlay/UIOverlay";
import DialogueOverlay from "./components/UIOverlay/DialogueOverlay";

import ZoomControl from "./components/ZoomControl";

import useEditorState from "./hooks/useEditorState";
import useGameSettings from "./hooks/useGameSettings";
import useCameraMode from "./hooks/useCameraMode";
import useGameLoop from "./hooks/useGameLoop";
import useGameState from "./hooks/useGameState";
import usePlayerControls from "./hooks/usePlayerControls";

import { useMapEditor } from "./contexts/MapEditorContext";

export default function App() {
  const isDraggingRef = useRef(false);
  const lastSelectedIdRef = useRef(null);
  const dragOffset = useRef([0, 0, 0]);
  const positionRef = useRef([0, 0, 0]);
  const lastDragMode = useRef(false);
  const lastPointerEvent = useRef(null);

  const objectRefs = useRef({});

  const [showOptions, setShowOptions] = useState(false);
  const [showGameSettings, setShowGameSettings] = useState(false);
  const [showMaps, setShowMaps] = useState(false);

  // Single Source of Truth states for active Map
  const [currentMapId, setCurrentMapId] = useState(null);
  const [maps, setMaps] = useState([]);
  const [snappingEnabled, setSnappingEnabled] = useState(true);
  const [isMeasureMode, setIsMeasureMode] = useState(false);

  const [clearMeasurementsFn, setClearMeasurementsFn] = useState(null);

  const [cameraFocusTarget, setCameraFocusTarget] = useState(null);

  // NPC waypoint placement states
  const [pendingNpc, setPendingNpc] = useState(null);
  const [placingWaypointForNpcId, setPlacingWaypointForNpcId] =
    useState(null);
  const [waypointPreviewPos, setWaypointPreviewPos] = useState(null);

  // Selected Waypoint Index
  const [selectedWaypointIndex, setSelectedWaypointIndex] = useState(null);

  // Runtime Dialogue & Flag States
  const [activeDialogueNpcId, setActiveDialogueNpcId] = useState(null);
  const [gameFlags, setGameFlags] = useState({});

  const focusCameraOnNpc = useCallback((position) => {
    if (!position) return;
    setCameraFocusTarget([...position]);
  }, []);

  const registerClearMeasurements = useCallback((realFn) => {
    setClearMeasurementsFn(() => realFn);
  }, []);

  const [placedObjects, setPlacedObjects] = useState([]);
  const [selectedObjectId, setSelectedObjectId] = useState(null);
  const [position, setPosition] = useState([0, 0, 0]);
  const [isDragging, setIsDragging] = useState(false);
  const [snapSize, setSnapSize] = useState(1);
  const [isDeleteMode, setIsDeleteMode] = useState(false);

  const [npcs, setNpcs] = useState([]);
  const [selectedNpcId, setSelectedNpcId] = useState(null);
  const [showNpcManager, setShowNpcManager] = useState(false);

  const [npcPreviewPos, setNpcPreviewPos] = useState(null);

  const {
    isPanelOpen,
    setIsPanelOpen,
    setPlacedObjects: setGlobalPlacedObjects,
  } = useMapEditor();

  useEffect(() => {
    setGlobalPlacedObjects(placedObjects);
  }, [placedObjects, setGlobalPlacedObjects]);

  useEffect(() => {
    positionRef.current = position;
  }, [position]);

  const [isVerticalDrag, setIsVerticalDrag] = useState(false);

  useEffect(() => {
    if (
      !isDragging ||
      lastDragMode.current === isVerticalDrag ||
      !lastPointerEvent.current
    ) {
      return;
    }

    lastDragMode.current = isVerticalDrag;
    const event = lastPointerEvent.current;

    const object = placedObjects.find(
      (placedObject) => placedObject.id === selectedObjectId
    );

    if (!object) return;

    const objectPos = new THREE.Vector3(...object.position);
    const intersection = new THREE.Vector3();

    if (isVerticalDrag) {
      if (!event.camera || !event.ray) return;

      const cameraDir = new THREE.Vector3();
      event.camera.getWorldDirection(cameraDir);
      cameraDir.y = 0;

      if (cameraDir.lengthSq() === 0) return;

      cameraDir.normalize();

      const verticalPlane = new THREE.Plane(
        cameraDir,
        -new THREE.Vector3(objectPos.x, 0, objectPos.z).dot(cameraDir)
      );

      if (event.ray.intersectPlane(verticalPlane, intersection)) {
        dragOffset.current = [0, intersection.y - objectPos.y, 0];
      }
    } else {
      if (!event.point) return;

      const { x, z } = event.point;
      dragOffset.current = [x - objectPos.x, 0, z - objectPos.z];
    }
  }, [isVerticalDrag, isDragging, placedObjects, selectedObjectId]);

  const [history, setHistory] = useState([]);
  const [future, setFuture] = useState([]);
  const MAX_HISTORY = 13;

  const recordHistory = useCallback(() => {
    setHistory((previousHistory) => {
      const snapshot = placedObjects.map((object) => ({
        ...object,
        position: [...object.position],
        rotation: [...object.rotation],
        size: [...object.size],
        snapPoints: object.snapPoints
          ? object.snapPoints.map((snapPoint) => ({
              ...snapPoint,
              offset: [...snapPoint.offset],
            }))
          : [],
      }));

      const updatedHistory = [...previousHistory, snapshot];

      return updatedHistory.length > MAX_HISTORY
        ? updatedHistory.slice(updatedHistory.length - MAX_HISTORY)
        : updatedHistory;
    });

    setFuture([]);
  }, [placedObjects]);

  const undo = useCallback(() => {
    if (history.length === 0) return;

    const previousState = history[history.length - 1];

    setFuture((previousFuture) => [placedObjects, ...previousFuture]);
    setHistory((previousHistory) =>
      previousHistory.slice(0, previousHistory.length - 1)
    );
    setPlacedObjects(previousState);
  }, [history, placedObjects]);

  const redo = useCallback(() => {
    if (future.length === 0) return;

    const nextState = future[0];

    setHistory((previousHistory) => [
      ...previousHistory,
      placedObjects,
    ]);
    setFuture((previousFuture) => previousFuture.slice(1));
    setPlacedObjects(nextState);
  }, [future, placedObjects]);

  const handleSetIsDragging = useCallback((value) => {
    isDraggingRef.current = value;
    setIsDragging(value);
  }, []);

  const handleSetSelectedObjectId = useCallback((id) => {
    if (id !== lastSelectedIdRef.current) {
      lastSelectedIdRef.current = id;
    }

    setSelectedObjectId(id);
  }, []);

  const editor = useEditorState({
    snapToGrid: (value) =>
      snapSize > 0
        ? Math.round(value / snapSize) * snapSize
        : value,
    setPlacedObjects,
    recordHistory,
    setSelectedObjectId: handleSetSelectedObjectId,
  });

  const {
    girlRef,
    joystickDir,
    isJumping,
    jumpVelocity,
    handleJoystickMove,
    handleJoystickEnd,
    handleJump,
  } = usePlayerControls();

  useEffect(() => {
    if (activeDialogueNpcId) {
      handleJoystickEnd();
      return undefined;
    }

    const keys = {};

    const shouldIgnoreKeyboardEvent = (event) => {
      const target = event?.target;

      if (!target) return false;

      const tagName =
        typeof target.tagName === "string"
          ? target.tagName.toLowerCase()
          : "";

      return (
        tagName === "input" ||
        tagName === "textarea" ||
        tagName === "select" ||
        target.isContentEditable === true
      );
    };

    const getEventKey = (event) => {
      return typeof event?.key === "string"
        ? event.key.toLowerCase()
        : "";
    };

    const updateMovement = () => {
      const x =
        (keys.a || keys.arrowleft ? -1 : 0) +
        (keys.d || keys.arrowright ? 1 : 0);

      const y =
        (keys.w || keys.arrowup ? -1 : 0) +
        (keys.s || keys.arrowdown ? 1 : 0);

      if (x || y) {
        handleJoystickMove({ x, y });
      } else {
        handleJoystickEnd();
      }
    };

    const onDown = (event) => {
      if (shouldIgnoreKeyboardEvent(event)) return;

      if (event?.code === "Space") {
        event.preventDefault();

        if (!event.repeat) {
          handleJump();
        }

        return;
      }

      const key = getEventKey(event);
      if (!key) return;

      if (!keys[key]) {
        keys[key] = true;
        updateMovement();
      }
    };

    const onUp = (event) => {
      if (shouldIgnoreKeyboardEvent(event)) return;
      if (event?.code === "Space") return;

      const key = getEventKey(event);
      if (!key) return;

      keys[key] = false;
      updateMovement();
    };

    const onWindowBlur = () => {
      Object.keys(keys).forEach((key) => {
        keys[key] = false;
      });

      handleJoystickEnd();
    };

    window.addEventListener("keydown", onDown);
    window.addEventListener("keyup", onUp);
    window.addEventListener("blur", onWindowBlur);

    return () => {
      window.removeEventListener("keydown", onDown);
      window.removeEventListener("keyup", onUp);
      window.removeEventListener("blur", onWindowBlur);
      handleJoystickEnd();
    };
  }, [
    activeDialogueNpcId,
    handleJoystickMove,
    handleJoystickEnd,
    handleJump,
  ]);

  const [cameraMode, setCameraMode] = useCameraMode();
  const [zoom, setZoom] = useState(4.5);

  const { coins, setCoins, collectCoin } = useGameState();

  const resetZoom = useCallback(() => {
    if (cameraMode === "top") {
      setZoom(45);
    } else {
      setZoom(4.5);
    }
  }, [cameraMode]);

  const settings = useGameSettings();
  useGameLoop(settings);

  const radToDeg = useCallback(
    (radians) => Math.round((radians * 180) / Math.PI),
    []
  );

  const degToRad = useCallback(
    (degrees) => (degrees * Math.PI) / 180,
    []
  );

  const updateNpc = useCallback((id, updates) => {
    setNpcs((previousNpcs) =>
      previousNpcs.map((npc) =>
        npc.id === id || npc.npcId === id
          ? {
              ...npc,
              ...updates,
              npcId: npc.npcId || npc.id,
            }
          : npc
      )
    );
  }, []);

  const handleSetSelectedNpcId = useCallback((id) => {
    setSelectedNpcId(id);
    setSelectedWaypointIndex(null);
  }, []);

  const startDialogue = useCallback(
    (npcId) => {
      if (!npcId) return;

      setActiveDialogueNpcId(npcId);
      handleJoystickEnd();
    },
    [handleJoystickEnd]
  );

  const handleMapClick = useCallback(
    (event) => {
      if (!event?.point) return;

      const point = [
        event.point.x,
        event.point.y,
        event.point.z,
      ];

      if (pendingNpc) {
        const stableNpcId = pendingNpc.npcId || pendingNpc.id;

        if (!stableNpcId) return;

        const newNpc = {
          ...pendingNpc,
          id: stableNpcId,
          npcId: stableNpcId,
          position: [point[0], point[1] + 1, point[2]],
        };

        setNpcs((previousNpcs) => [...previousNpcs, newNpc]);
        setPendingNpc(null);
        handleSetSelectedNpcId(newNpc.id);
        focusCameraOnNpc(newNpc.position);
        setNpcPreviewPos(null);
        return;
      }

      if (placingWaypointForNpcId) {
        const npc = npcs.find(
          (candidate) =>
            candidate.id === placingWaypointForNpcId ||
            candidate.npcId === placingWaypointForNpcId
        );

        if (npc) {
          const nextWaypoint = {
            pos: [
              Number.isFinite(Number(point[0]))
                ? Number(point[0])
                : 0,
              Number.isFinite(Number(point[1]))
                ? Number(point[1])
                : 0.2,
              Number.isFinite(Number(point[2]))
                ? Number(point[2])
                : 0,
            ],
            waitTime: Math.max(
              0,
              Number.isFinite(Number(npc.movement?.waitTime))
                ? Number(npc.movement.waitTime)
                : 0
            ),
          };

          const nextWaypoints = [
            ...(npc.waypoints || []),
            nextWaypoint,
          ];

          updateNpc(npc.id || npc.npcId, {
            waypoints: nextWaypoints,
          });
        }

        setPlacingWaypointForNpcId(null);
        setWaypointPreviewPos(null);
        return;
      }

      if (!editor.isDrawing && !isDragging) {
        setSelectedObjectId(null);
        handleSetSelectedNpcId(null);
      }

      editor.handleGroundClick(event);
    },
    [
      pendingNpc,
      placingWaypointForNpcId,
      npcs,
      editor,
      isDragging,
      updateNpc,
      focusCameraOnNpc,
      handleSetSelectedNpcId,
    ]
  );

  return (
    <div className="canvas-container">
      {(pendingNpc || placingWaypointForNpcId) && (
        <div
          style={{
            position: "absolute",
            top: "20px",
            left: "50%",
            transform: "translateX(-50%)",
            zIndex: 2000,
            background: "rgba(0, 123, 255, 0.9)",
            color: "white",
            padding: "10px 20px",
            borderRadius: "20px",
            fontWeight: "bold",
            boxShadow: "0 4px 10px rgba(0,0,0,0.3)",
          }}
        >
          {pendingNpc
            ? `Click ground to place: ${pendingNpc.name}`
            : "Click ground to add Waypoint"}

          <button
            type="button"
            onClick={() => {
              setPendingNpc(null);
              setPlacingWaypointForNpcId(null);
              setWaypointPreviewPos(null);
              setNpcPreviewPos(null);
            }}
            style={{
              marginLeft: "15px",
              cursor: "pointer",
            }}
          >
            Cancel
          </button>
        </div>
      )}

      <ZoomControl
        zoom={zoom}
        setZoom={setZoom}
        resetZoom={resetZoom}
        cameraMode={cameraMode}
      />

      <EditorCanvas
        placedObjects={placedObjects}
        setPlacedObjects={setPlacedObjects}
        selectedObjectId={selectedObjectId}
        position={position}
        setPosition={setPosition}
        size={editor.size}
        color={editor.color}
        rotation={editor.rotation}
        isDrawing={editor.isDrawing}
        isDeleteMode={isDeleteMode}
        snapSize={snapSize}
        isDragging={isDragging}
        dragOffset={dragOffset}
        joystickDir={joystickDir}
        isJumping={isJumping}
        jumpVelocity={jumpVelocity}
        cameraMode={cameraMode}
        zoom={zoom}
        girlRef={girlRef}
        coins={coins}
        setCoins={setCoins}
        collectCoin={collectCoin}
        handleGroundClick={handleMapClick}
        previewPosition={editor.previewPosition}
        setPreviewPosition={editor.setPreviewPosition}
        isVerticalDrag={isVerticalDrag}
        setIsVerticalDrag={setIsVerticalDrag}
        recordHistory={recordHistory}
        setIsDragging={handleSetIsDragging}
        setSelectedObjectId={handleSetSelectedObjectId}
        snappingEnabled={snappingEnabled}
        isMeasureMode={isMeasureMode}
        setIsMeasureMode={setIsMeasureMode}
        clearMeasurements={clearMeasurementsFn}
        registerClearMeasurements={registerClearMeasurements}
        setObjectType={editor.setObjectType}
        setSize={editor.setSize}
        setColor={editor.setColor}
        setRotation={editor.setRotation}
        objectType={editor.objectType}
        isCreatingObject={editor.isCreatingObject}
        setZoom={setZoom}
        gravity={settings.gravity}
        material={editor.material}
        setMaterial={editor.setMaterial}
        npcs={npcs}
        setNpcs={setNpcs}
        selectedNpcId={selectedNpcId}
        setSelectedNpcId={handleSetSelectedNpcId}
        selectedWaypointIndex={selectedWaypointIndex}
        setSelectedWaypointIndex={setSelectedWaypointIndex}
        cameraFocusTarget={cameraFocusTarget}
        focusCameraOnNpc={focusCameraOnNpc}
        pendingNpc={pendingNpc}
        npcPreviewPos={npcPreviewPos}
        placingWaypointForNpcId={placingWaypointForNpcId}
        waypointPreviewPos={waypointPreviewPos}
        activeDialogueNpcId={activeDialogueNpcId}
        startDialogue={startDialogue}
        onPointerMove={(event) => {
          if (pendingNpc && event?.point) {
            setNpcPreviewPos([
              event.point.x,
              event.point.y + 1,
              event.point.z,
            ]);
            setWaypointPreviewPos(null);
          } else if (placingWaypointForNpcId && event?.point) {
            setWaypointPreviewPos([
              event.point.x,
              event.point.y,
              event.point.z,
            ]);
            setNpcPreviewPos(null);
          } else {
            setNpcPreviewPos(null);
            setWaypointPreviewPos(null);
          }
        }}
        onObjectRefsReady={(refs) => {
          objectRefs.current = refs || {};
        }}
      />

      <UIOverlay
        {...editor}
        position={position}
        setPosition={setPosition}
        selectedObjectId={selectedObjectId}
        updatePlacedObject={editor.updatePlacedObject}
        cameraMode={cameraMode}
        setCameraMode={setCameraMode}
        snapSize={snapSize}
        setSnapSize={setSnapSize}
        handleJoystickMove={handleJoystickMove}
        handleJoystickEnd={handleJoystickEnd}
        isJumping={isJumping}
        jumpVelocity={jumpVelocity}
        radToDeg={radToDeg}
        degToRad={degToRad}
        {...settings}
        undo={undo}
        redo={redo}
        history={history}
        future={future}
        currentMapId={currentMapId}
        setCurrentMapId={setCurrentMapId}
        maps={maps}
        setMaps={setMaps}
        setPlacedObjects={setPlacedObjects}
        placedObjects={placedObjects}
        isPanelOpen={isPanelOpen}
        setIsPanelOpen={setIsPanelOpen}
        showOptions={showOptions}
        setShowOptions={setShowOptions}
        showGameSettings={showGameSettings}
        setShowGameSettings={setShowGameSettings}
        showMaps={showMaps}
        setShowMaps={setShowMaps}
        isCreatingObject={editor.isCreatingObject}
        setIsCreatingObject={editor.setIsCreatingObject}
        snappingEnabled={snappingEnabled}
        setSnappingEnabled={setSnappingEnabled}
        isDeleteMode={isDeleteMode}
        setIsDeleteMode={setIsDeleteMode}
        isMeasureMode={isMeasureMode}
        setIsMeasureMode={setIsMeasureMode}
        clearMeasurements={clearMeasurementsFn}
        registerClearMeasurements={registerClearMeasurements}
        material={editor.material}
        setMaterial={editor.setMaterial}
        npcs={npcs}
        setNpcs={setNpcs}
        selectedNpcId={selectedNpcId}
        setSelectedNpcId={handleSetSelectedNpcId}
        showNpcManager={showNpcManager}
        setShowNpcManager={setShowNpcManager}
        selectedWaypointIndex={selectedWaypointIndex}
        setSelectedWaypointIndex={setSelectedWaypointIndex}
        focusCameraOnNpc={focusCameraOnNpc}
        updateNpc={updateNpc}
        setPendingNpc={setPendingNpc}
        setPlacingWaypointForNpcId={setPlacingWaypointForNpcId}
        placingWaypointForNpcId={placingWaypointForNpcId}
      />

      {activeDialogueNpcId && (
        <DialogueOverlay
          activeDialogueNpcId={activeDialogueNpcId}
          npcs={npcs}
          setNpcs={setNpcs}
          gameFlags={gameFlags}
          setGameFlags={setGameFlags}
          onClose={() => setActiveDialogueNpcId(null)}
        />
      )}
    </div>
  );
}
