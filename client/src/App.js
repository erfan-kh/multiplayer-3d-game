// App.js
import React, { useRef, useState, useEffect } from "react";
import "./App.css";
import * as THREE from "three";

// Core components
import EditorCanvas from "./components/EditorCanvas";
import UIOverlay from "./components/UIOverlay";

// Custom hooks
import useSnapping from "./hooks/useSnapping";
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
  const [isVerticalDrag, setIsVerticalDrag] = useState(false);

  // 🧱 Object Placement & Selection
  const [placedObjects, setPlacedObjects] = useState([]);
  const [selectedObjectId, setSelectedObjectId] = useState(null);
  const [position, setPosition] = useState([0, 0, 0]);
  const [isDragging, setIsDragging] = useState(false);
  const [snapSize, setSnapSize] = useState(1);
  const dragOffset = useRef([0, 0, 0]);

  const positionRef = useRef(position);
  useEffect(() => {
    positionRef.current = position;
  }, [position]);

  // 🧩 Advanced drag mode tracking
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
        dragOffset.current = [
          0,
          intersection.y - objectPos.y,
          0
        ];
        console.log("🔄 Switched to vertical drag");
        console.log("Intersection Y:", intersection.y);
        console.log("Object Y:", objectPos.y);
        console.log("New dragOffset:", dragOffset.current);
      }
    } else {
      // Horizontal drag: use e.point directly for consistent offset
      const { x, y, z } = e.point;
      dragOffset.current = [
        x - objectPos.x,
        0,
        z - objectPos.z
      ];
      console.log("🔄 Switched to horizontal drag (using e.point)");
      console.log("Object position:", objectPos.toArray());
      console.log("Pointer point:", [x, y, z]);
      console.log("Calculated dragOffset:", dragOffset.current);
    }
  }
}, [isVerticalDrag, isDragging, placedObjects, selectedObjectId]);




  // 🧩 UI Toggles
  const [isDeleteMode, setIsDeleteMode] = useState(false);
  const [snappingEnabled, setSnappingEnabled] = useState(true);
  const [isCreatingObject, setIsCreatingObject] = useState(false);
  const [showTransformControls, setShowTransformControls] = useState(true);
  const [showSnapPoints, setShowSnapPoints] = useState(false);
  const [showOptions, setShowOptions] = useState(false);
  const [showGameSettings, setShowGameSettings] = useState(false);

  const {
    snapPreview,
    activeSnapTarget,
    setSnapPreview,
    setActiveSnapTarget,
    handlePointerUp,
  } = useSnapping({
    placedObjects,
    selectedObjectId,
    position,
    setPlacedObjects,
    setPosition,
    isDragging,
    setIsDragging,
    snappingEnabled,
  });

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
    handlePreviewMove,
  } = useEditorState({
    snapToGrid: (value) => (snapSize > 0 ? Math.round(value / snapSize) * snapSize : value),
    setPlacedObjects,
    setSelectedObjectId,
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

  const {
    score,
    setScore,
    coins,
    setCoins,
    collectCoin,
  } = useGameState();

  const {
    speed, setSpeed,
    gravity, setGravity,
    jumpForce, setJumpForce,
  } = useGameSettings();
  useGameLoop({ speed, gravity, jumpForce });

  const { handlePointerMove, throttledPointerMove } = usePointerHandlers({
    isDragging,
    selectedObjectId,
    positionRef,
    setPosition,
    snapSize,
    dragOffset,
    isVerticalDrag,
    lastPointerEvent, // ✅ pass pointer event ref
  });

  useSyncSelectedObject({
    selectedObjectId,
    size,
    color,
    rotation,
    position,
    setPlacedObjects,
  });

  const { isPanelOpen, setIsPanelOpen } = useMapEditor();

  const radToDeg = (r) => Math.round((r * 180) / Math.PI);
  const degToRad = (d) => (d * Math.PI) / 180;

  return (
    <div className="canvas-container">
      <EditorCanvas
        placedObjects={placedObjects}
        setPlacedObjects={setPlacedObjects}
        selectedObjectId={selectedObjectId}
        setSelectedObjectId={setSelectedObjectId}
        position={position}
        setPosition={setPosition}
        size={size}
        color={color}
        rotation={rotation}
        isDrawing={isDrawing}
        isDeleteMode={isDeleteMode}
        snapSize={snapSize}
        snapPreview={snapPreview}
        setSnapPreview={setSnapPreview}
        activeSnapTarget={activeSnapTarget}
        setActiveSnapTarget={setActiveSnapTarget}
        isDragging={isDragging}
        setIsDragging={setIsDragging}
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
        handlePointerUp={handlePointerUp}
        previewPosition={previewPosition}
        setPreviewPosition={setPreviewPosition}
        isVerticalDrag={isVerticalDrag}
        setIsVerticalDrag={setIsVerticalDrag}
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
      />
    </div>
  );
}
