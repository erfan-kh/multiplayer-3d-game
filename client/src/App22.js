// App.js
import React, { useRef, useState, useEffect } from "react";
import "./App.css";
import * as THREE from "three";

// Core components
import EditorCanvas from "./components/EditorCanvas";
import UIOverlay from "./components/UIOverlay/UIOverlay";

// Custom hooks
import useEditorState from "./hooks/useEditorState";
import useGameSettings from "./hooks/useGameSettings";
import useCameraMode from "./hooks/useCameraMode";
import useGameLoop from "./hooks/useGameLoop";
import usePointerHandlers from "./hooks/usePointerHandlers";
import useSyncSelectedObject from "./hooks/useSyncSelectedObject";
import useGameState from "./hooks/useGameState";
import usePlayerControls from "./hooks/usePlayerControls";

// Context
import { useMapEditor } from "./contexts/MapEditorContext";

export default function App() {
  const isDraggingRef = useRef(false);
  const lastSelectedIdRef = useRef(null);

  const [history, setHistory] = useState([]);
  const [future, setFuture] = useState([]);

  const [isVerticalDrag, setIsVerticalDrag] = useState(false);

  const [currentMapId, setCurrentMapId] = useState(null);
  const [maps, setMaps] = useState([]);

  const fetchObjectsForMap = async (mapId) => {
    if (!mapId) return;

    try {
      const res = await fetch(
        `${process.env.REACT_APP_API_BASE_URL}/api/maps/${mapId}/objects`
      );

      const data = await res.json();
      setPlacedObjects(data);
    } catch (err) {
      console.error("Failed to fetch objects:", err);
    }
  };

  useEffect(() => {
    if (currentMapId) {
      fetchObjectsForMap(currentMapId);
    }
  }, [currentMapId]);

  useEffect(() => {
    const fetchMaps = async () => {
      try {
        const res = await fetch(`${process.env.REACT_APP_API_BASE_URL}/api/maps`);
        const data = await res.json();
        setMaps(data);

        if (data.length > 0) {
          setCurrentMapId(data[0]._id);
        }
      } catch (err) {
        console.error("Failed to load maps:", err);
      }
    };

    fetchMaps();
  }, []);

  const [placedObjects, setPlacedObjects] = useState([]);
  const [selectedObjectId, setSelectedObjectId] = useState(null);
  const [position, setPosition] = useState([0, 0, 0]);
  const [isDragging, setIsDragging] = useState(false);
  const [snapSize, setSnapSize] = useState(1);
  const dragOffset = useRef([0, 0, 0]);

  // ✅ CONTEXT SYNC (THE FIX)
  const { isPanelOpen, setIsPanelOpen, setPlacedObjects: setGlobalPlacedObjects } = useMapEditor();

  useEffect(() => {
    setGlobalPlacedObjects(placedObjects);
  }, [placedObjects, setGlobalPlacedObjects]);

  const positionRef = useRef(position);
  useEffect(() => {
    positionRef.current = position;
  }, [position]);

  const lastDragMode = useRef(isVerticalDrag);
  const lastPointerEvent = useRef(null);

  useEffect(() => {
    if (isDragging && lastDragMode.current !== isVerticalDrag && lastPointerEvent.current) {
      lastDragMode.current = isVerticalDrag;

      const e = lastPointerEvent.current;
      const obj = placedObjects.find((o) => o.id === selectedObjectId);
      if (!obj || !e) return;

      const objectPos = new THREE.Vector3(...obj.position);
      const intersection = new THREE.Vector3();

      if (isVerticalDrag) {
        const cameraDir = new THREE.Vector3();
        e.camera.getWorldDirection(cameraDir);
        cameraDir.y = 0;
        cameraDir.normalize();

        const verticalPlane = new THREE.Plane(
          cameraDir,
          -new THREE.Vector3(objectPos.x, 0, objectPos.z).dot(cameraDir)
        );

        if (e.ray.intersectPlane(verticalPlane, intersection)) {
          dragOffset.current = [0, intersection.y - objectPos.y, 0];
        }
      } else {
        const { x, y, z } = e.point;
        dragOffset.current = [x - objectPos.x, 0, z - objectPos.z];
      }
    }
  }, [isVerticalDrag, isDragging, placedObjects, selectedObjectId]);

  const [isDeleteMode, setIsDeleteMode] = useState(false);
  const [snappingEnabled, setSnappingEnabled] = useState(true);
  const [isCreatingObject, setIsCreatingObject] = useState(false);
  const [showTransformControls, setShowTransformControls] = useState(true);
  const [showSnapPoints, setShowSnapPoints] = useState(false);
  const [showOptions, setShowOptions] = useState(false);
  const [showGameSettings, setShowGameSettings] = useState(false);

  const MAX_HISTORY = 13;

  const recordHistory = () => {
    setHistory((prev) => {
      const snapshot = placedObjects.map((obj) => ({
        ...obj,
        position: [...obj.position],
        rotation: [...obj.rotation],
        size: [...obj.size],
        snapPoints: obj.snapPoints
          ? obj.snapPoints.map((sp) => ({ ...sp, offset: [...sp.offset] }))
          : [],
      }));

      const newHistory = [...prev, snapshot];
      return newHistory.length > MAX_HISTORY
        ? newHistory.slice(newHistory.length - MAX_HISTORY)
        : newHistory;
    });
    setFuture([]);
  };

  const undo = () => {
    if (history.length === 0) return;
    const previous = history[history.length - 1];
    setFuture((f) => [placedObjects, ...f]);
    setHistory((h) => h.slice(0, h.length - 1));
    setPlacedObjects(previous);
  };

  const redo = () => {
    if (future.length === 0) return;
    const next = future[0];
    setHistory((h) => [...h, placedObjects]);
    setFuture((f) => f.slice(1));
    setPlacedObjects(next);
  };

  const handleSetIsDragging = (value) => {
    isDraggingRef.current = value;
    setIsDragging(value);
  };

  const handleSetSelectedObjectId = (id) => {
    if (id !== lastSelectedIdRef.current) {
      lastSelectedIdRef.current = id;
    }
    setSelectedObjectId(id);
  };

  const {
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
  } = useEditorState({
    snapToGrid: (value) =>
      snapSize > 0 ? Math.round(value / snapSize) * snapSize : value,
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
  } = usePlayerControls();

  const [cameraMode, setCameraMode] = useCameraMode();
  const [zoom, setZoom] = useState(4.5);

  const { score, setScore, coins, setCoins, collectCoin } = useGameState();

  const { speed, setSpeed, gravity, setGravity, jumpForce, setJumpForce } =
    useGameSettings();
  useGameLoop({ speed, gravity, jumpForce });

  const { handlePointerMove, throttledPointerMove } = usePointerHandlers({
    isDragging,
    selectedObjectId,
    positionRef,
    setPosition,
    snapSize,
    dragOffset,
    isVerticalDrag,
    lastPointerEvent,
    snappingEnabled,
    placedObjects,
  });

  useSyncSelectedObject({
    selectedObjectId,
    size,
    color,
    rotation,
    position,
    setPlacedObjects,
  });

  const radToDeg = (r) => Math.round((r * 180) / Math.PI);
  const degToRad = (d) => (d * Math.PI) / 180;

  return (
    <div className="canvas-container">
      <EditorCanvas
        placedObjects={placedObjects}
        setPlacedObjects={setPlacedObjects}
        selectedObjectId={selectedObjectId}
        position={position}
        setPosition={setPosition}
        size={size}
        color={color}
        rotation={rotation}
        isDrawing={isDrawing}
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
        handleGroundClick={handleGroundClick}
        handlePointerMove={handlePointerMove}
        throttledPointerMove={throttledPointerMove}
        previewPosition={previewPosition}
        setPreviewPosition={setPreviewPosition}
        isVerticalDrag={isVerticalDrag}
        setIsVerticalDrag={setIsVerticalDrag}
        recordHistory={recordHistory}
        setIsDragging={handleSetIsDragging}
        setSelectedObjectId={handleSetSelectedObjectId}
        snappingEnabled={snappingEnabled}
      />

      <UIOverlay
        isPanelOpen={isPanelOpen}
        setIsPanelOpen={setIsPanelOpen}
        isCreatingObject={isCreatingObject}
        setIsCreatingObject={setIsCreatingObject}
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
        showTransformControls={showTransformControls}
        setShowTransformControls={setShowTransformControls}
        isDeleteMode={isDeleteMode}
        setIsDeleteMode={setIsDeleteMode}
        showOptions={showOptions}
        setShowOptions={setShowOptions}
        showGameSettings={showGameSettings}
        setShowGameSettings={setShowGameSettings}
        isDrawing={isDrawing}
        setIsDrawing={setIsDrawing}
        cameraMode={cameraMode}
        setCameraMode={setCameraMode}
        showSnapPoints={showSnapPoints}
        setShowSnapPoints={setShowSnapPoints}
        handleJoystickMove={handleJoystickMove}
        handleJoystickEnd={handleJoystickEnd}
        isJumping={isJumping}
        jumpVelocity={jumpVelocity}
        radToDeg={radToDeg}
        degToRad={degToRad}
        speed={speed}
        setSpeed={setSpeed}
        gravity={gravity}
        setGravity={setGravity}
        jumpForce={jumpForce}
        setJumpForce={setJumpForce}
        snappingEnabled={snappingEnabled}
        setSnappingEnabled={setSnappingEnabled}
        isVerticalDrag={isVerticalDrag}
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

      />
    </div>
  );
}
