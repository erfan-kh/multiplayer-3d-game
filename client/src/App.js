// App.js
import React, { useRef, useState } from "react";
import "./App.css";

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
  // 🧱 Object Placement & Selection
  const [placedObjects, setPlacedObjects] = useState([]);
  const [selectedObjectId, setSelectedObjectId] = useState(null);
  const [position, setPosition] = useState([0, 0, 0]);
  const [isDragging, setIsDragging] = useState(false);
  const [snapSize, setSnapSize] = useState(1);
  const dragOffset = useRef([0, 0, 0]);

  // 🧩 UI Toggles
  const [isDeleteMode, setIsDeleteMode] = useState(false);
  const [isCreatingObject, setIsCreatingObject] = useState(false);
  const [showTransformControls, setShowTransformControls] = useState(true);
  const [showSnapPoints, setShowSnapPoints] = useState(false);
  const [showOptions, setShowOptions] = useState(false);
  const [showGameSettings, setShowGameSettings] = useState(false);

  // 📐 Snapping logic for object alignment
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
  });

  // ✏️ Editor state for drawing and modifying objects
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

  // 🎮 Player control and joystick input
  const {
    girlRef,
    joystickDir,
    isJumping,
    jumpVelocity,
    handleJoystickMove,
    handleJoystickEnd,
  } = usePlayerControls();

  // 🧭 Camera mode and zoom
  const [cameraMode, setCameraMode] = useCameraMode();
  const [zoom, setZoom] = useState(4.5);

  // 🪙 Game state: coins and score
  const {
    score,
    setScore,
    coins,
    setCoins,
    collectCoin,
  } = useGameState();

  // ⚙️ Game physics settings
  const {
    speed, setSpeed,
    gravity, setGravity,
    jumpForce, setJumpForce,
  } = useGameSettings();
  useGameLoop({ speed, gravity, jumpForce });

  // 🖱️ Pointer movement for dragging objects
  const { handlePointerMove, throttledPointerMove } = usePointerHandlers({
    isDragging,
    selectedObjectId,
    position,
    setPosition,
    snapSize,
    dragOffset,
  });

  // 🔁 Sync selected object with editor state
  useSyncSelectedObject({
    selectedObjectId,
    size,
    color,
    rotation,
    position,
    setPlacedObjects,
  });

  // 🧩 UI panel state from context
  const { isPanelOpen, setIsPanelOpen } = useMapEditor();

  // 🔢 Utility converters
  const radToDeg = (r) => Math.round((r * 180) / Math.PI);
  const degToRad = (d) => (d * Math.PI) / 180;

  return (
    <div className="canvas-container">
      <EditorCanvas
        // Scene and object state
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

        // Player and camera
        joystickDir={joystickDir}
        isJumping={isJumping}
        jumpVelocity={jumpVelocity}
        cameraMode={cameraMode}
        zoom={zoom}
        girlRef={girlRef}

        // Game state
        coins={coins}
        setCoins={setCoins}
        collectCoin={collectCoin}

        // Interaction handlers
        handleGroundClick={handleGroundClick}
        handlePointerMove={handlePointerMove}
        throttledPointerMove={throttledPointerMove}
        handlePointerUp={handlePointerUp}
        previewPosition={previewPosition}
        setPreviewPosition={setPreviewPosition}
      />

      <UIOverlay
        // UI state and controls
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

        // Player controls
        handleJoystickMove={handleJoystickMove}
        handleJoystickEnd={handleJoystickEnd}
        isJumping={isJumping}
        jumpVelocity={jumpVelocity}

        // Utilities
        radToDeg={radToDeg}
        degToRad={degToRad}

        // Game settings
        speed={speed}
        setSpeed={setSpeed}
        gravity={gravity}
        setGravity={setGravity}
        jumpForce={jumpForce}
        setJumpForce={setJumpForce}
      />
    </div>
  );
}
