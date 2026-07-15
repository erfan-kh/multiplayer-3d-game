// App.js
import React, { useRef, useState, useEffect, useCallback } from "react";
import "./App.css";
import * as THREE from "three";

import EditorCanvas from "./components/EditorCanvas";
import UIOverlay from "./components/UIOverlay/UIOverlay";

// ✅ ZOOM UI
import ZoomControl from "./components/ZoomControl";

import useEditorState from "./hooks/useEditorState";
import useGameSettings from "./hooks/useGameSettings";
import useCameraMode from "./hooks/useCameraMode";
import useGameLoop from "./hooks/useGameLoop";
import useSyncSelectedObject from "./hooks/useSyncSelectedObject";
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

  const [currentMapId, setCurrentMapId] = useState(null);
  const [maps, setMaps] = useState([]);
  const [snappingEnabled, setSnappingEnabled] = useState(true);
  const [isMeasureMode, setIsMeasureMode] = useState(false);

  const [clearMeasurementsFn, setClearMeasurementsFn] = useState(null);

  const registerClearMeasurements = useCallback((realFn) => {
    setClearMeasurementsFn(() => realFn);
  }, []);

  const fetchMaps = useCallback(async () => {
    try {
      const res = await fetch(`${process.env.REACT_APP_API_BASE_URL}/api/maps`);
      const data = await res.json();
      setMaps(data);
      if (data?.length > 0) setCurrentMapId(data[0]._id);
    } catch {}
  }, []);

  const fetchObjectsForMap = useCallback(async (mapId) => {
    if (!mapId) return;
    try {
      const res = await fetch(
        `${process.env.REACT_APP_API_BASE_URL}/api/maps/${mapId}/objects`
      );
      const data = await res.json();

      const normalizedObjects = (Array.isArray(data) ? data : []).map((obj) => ({
        ...obj,
        id: obj.id || obj._id,
        material: obj.material || "standard"
      }));
      
      setPlacedObjects(normalizedObjects);

    } catch {}
  }, []);

  useEffect(() => {
    fetchMaps();
  }, [fetchMaps]);

  const [placedObjects, setPlacedObjects] = useState([]);
  const [selectedObjectId, setSelectedObjectId] = useState(null);
  const [position, setPosition] = useState([0, 0, 0]);
  const [isDragging, setIsDragging] = useState(false);
  const [snapSize, setSnapSize] = useState(1);
  const [isDeleteMode, setIsDeleteMode] = useState(false);
  


  useEffect(() => {
    if (currentMapId) fetchObjectsForMap(currentMapId);
  }, [currentMapId, fetchObjectsForMap]);

  const { isPanelOpen, setIsPanelOpen, setPlacedObjects: setGlobalPlacedObjects } =
    useMapEditor();

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
    )
      return;

    lastDragMode.current = isVerticalDrag;
    const e = lastPointerEvent.current;

    const obj = placedObjects.find((o) => o.id === selectedObjectId);
    if (!obj) return;

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
      const { x, z } = e.point;
      dragOffset.current = [x - objectPos.x, 0, z - objectPos.z];
    }
  }, [isVerticalDrag, isDragging, placedObjects, selectedObjectId]);

  const [history, setHistory] = useState([]);
  const [future, setFuture] = useState([]);
  const MAX_HISTORY = 13;

  const recordHistory = useCallback(() => {
    setHistory((prev) => {
      const snapshot = placedObjects.map((o) => ({
        ...o,
        position: [...o.position],
        rotation: [...o.rotation],
        size: [...o.size],
        snapPoints: o.snapPoints
          ? o.snapPoints.map((sp) => ({ ...sp, offset: [...sp.offset] }))
          : [],
      }));

      const updated = [...prev, snapshot];
      return updated.length > MAX_HISTORY
        ? updated.slice(updated.length - MAX_HISTORY)
        : updated;
    });
    setFuture([]);
  }, [placedObjects]);

  const undo = useCallback(() => {
    if (history.length === 0) return;
    const prev = history[history.length - 1];
    setFuture((f) => [placedObjects, ...f]);
    setHistory((h) => h.slice(0, h.length - 1));
    setPlacedObjects(prev);
  }, [history, placedObjects]);

  const redo = useCallback(() => {
    if (future.length === 0) return;
    const next = future[0];
    setHistory((h) => [...h, placedObjects]);
    setFuture((f) => f.slice(1));
    setPlacedObjects(next);
  }, [future, placedObjects]);

  const handleSetIsDragging = useCallback((v) => {
    isDraggingRef.current = v;
    setIsDragging(v);
  }, []);

  const handleSetSelectedObjectId = useCallback((id) => {
    if (id !== lastSelectedIdRef.current) lastSelectedIdRef.current = id;
    setSelectedObjectId(id);
  }, []);

  const editor = useEditorState({
    snapToGrid: (v) => (snapSize > 0 ? Math.round(v / snapSize) * snapSize : v),
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
    const keys = {};

    const updateMovement = () => {
      const x =
        (keys.a || keys.arrowleft ? -1 : 0) +
        (keys.d || keys.arrowright ? 1 : 0);
      const y =
        (keys.w || keys.arrowup ? -1 : 0) +
        (keys.s || keys.arrowdown ? 1 : 0);

      if (x || y) handleJoystickMove({ x, y });
      else handleJoystickEnd();
    };

    const onDown = (e) => {
      if (e.code === "Space") {
        e.preventDefault();
        handleJump();
        return;
      }

      const key = e.key.toLowerCase();
      if (!keys[key]) keys[key] = true;
      updateMovement();
    };

    const onUp = (e) => {
      if (e.code === "Space") return;
      keys[e.key.toLowerCase()] = false;
      updateMovement();
    };

    window.addEventListener("keydown", onDown);
    window.addEventListener("keyup", onUp);

    return () => {
      window.removeEventListener("keydown", onDown);
      window.removeEventListener("keyup", onUp);
    };
  }, [handleJoystickMove, handleJoystickEnd, handleJump]);

  const [cameraMode, setCameraMode] = useCameraMode();
  const [zoom, setZoom] = useState(4.5);

  const { score, setScore, coins, setCoins, collectCoin } = useGameState();

  const resetZoom = useCallback(() => {
    if (cameraMode === "top") setZoom(45);
    else if (cameraMode === "third") setZoom(4.5);
    else setZoom(4.5);
  }, [cameraMode]);

  const settings = useGameSettings();
  useGameLoop(settings);

  useSyncSelectedObject({
    selectedObjectId,
    size: editor.size,
    color: editor.color,
    rotation: editor.rotation,
    position,
    setPlacedObjects,
  });

  const radToDeg = useCallback((r) => Math.round((r * 180) / Math.PI), []);
  const degToRad = useCallback((d) => (d * Math.PI) / 180, []);

  return (
    <div className="canvas-container">
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
        handleGroundClick={editor.handleGroundClick}
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

      />
    </div>
  );
}
