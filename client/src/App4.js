import React, { useRef, useState, useCallback, useEffect, useMemo } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import * as THREE from "three";
import "./App.css";
import { GAME_SETTINGS } from "./constants";

import SpaceGirl from "./components/SpaceGirl";
import Coin from "./components/Coin";
import CameraController from "./components/CameraController";
import Joystick from "./components/Joystick";

import MapEditorPanel from "./components/MapEditorPanel";
import PlacedObjectsRenderer from "./components/PlacedObjectsRenderer";
import MapEditorInteraction from "./components/MapEditorInteraction";
import { useMapEditor } from "./contexts/MapEditorContext";
import { v4 as uuid } from "uuid";

import { useSpring, a } from '@react-spring/three';

import EditorScene from "./components/EditorScene";
import useSnapping from "./hooks/useSnapping";
import useEditorState from "./hooks/useEditorState";
import useJoystick from "./hooks/useJoystick";

import EditorCanvas from "./components/EditorCanvas";
import UIOverlay from "./components/UIOverlay";
import useGameSettings from "./hooks/useGameSettings";



export default function App() {
  const [placedObjects, setPlacedObjects] = useState([]);
  const [selectedObjectId, setSelectedObjectId] = useState(null);
  const [position, setPosition] = useState([0, 0, 0]);
  const [isDragging, setIsDragging] = useState(false);
  const orbitRef = useRef();

  const [showSnapPoints, setShowSnapPoints] = useState(false);

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

  const snapAnim = useSpring({
    scale: snapPreview ? [1.1, 1.1, 1.1] : [0, 0, 0],
    config: { tension: 200, friction: 15 },
  });

  const radToDeg = (r) => Math.round((r * 180) / Math.PI);
  const degToRad = (d) => (d * Math.PI) / 180;

  const [showTransformControls, setShowTransformControls] = useState(true);
  const [snapSize, setSnapSize] = useState(1);

  const dragOffset = useRef([0, 0, 0]);
  const [isDeleteMode, setIsDeleteMode] = useState(false);

  const [zoom, setZoom] = useState(4.5);
  const [cameraMode, setCameraMode] = useState("orbit");
  const [score, setScore] = useState(0);
  const [coins, setCoins] = useState([
    { id: 1, pos: [2, 0.5, -2] },
    { id: 2, pos: [-3, 0.5, 1] },
    { id: 3, pos: [1, 0.5, 3] },
  ]);

  const [isCreatingObject, setIsCreatingObject] = useState(false);

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

  const [showOptions, setShowOptions] = useState(false);
  const [showGameSettings, setShowGameSettings] = useState(false);
  const { isPanelOpen, setIsPanelOpen } = useMapEditor();

  const frameRef = useRef(null);
  const girlRef = useRef();
  


    const {
      joystickDir,
      isJumping,
      jumpVelocity,
      handleJoystickMove,
      handleJoystickEnd,
    } = useJoystick();

    const {
    speed,
    setSpeed,
    gravity,
    setGravity,
    jumpForce,
    setJumpForce,
  } = useGameSettings();


  const handlePointerMove = useCallback((e) => {
    if (!isDragging || !selectedObjectId) return;
    const { x, z } = e.point;
    const [dx, dz] = dragOffset.current;
    const newX = snapSize > 0 ? Math.round((x - dx) / snapSize) * snapSize : x - dx;
    const newZ = snapSize > 0 ? Math.round((z - dz) / snapSize) * snapSize : z - dz;
    const newY = position[1];
    setPosition([newX, newY, newZ]);
  }, [isDragging, selectedObjectId, position, snapSize]);

  const throttledPointerMove = useCallback((e) => {
    if (frameRef.current) return;
    frameRef.current = requestAnimationFrame(() => {
      frameRef.current = null;
      handlePointerMove(e);
    });
  }, [handlePointerMove]);

  const collectCoin = (id) => {
    setCoins((c) => c.filter((coin) => coin.id !== id));
    setScore((s) => s + 1);
  };

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key.toLowerCase() === "c") {
        setCameraMode((prev) =>
          prev === "orbit" ? "third" : prev === "third" ? "top" : "orbit"
        );
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  useEffect(() => {
    if (!selectedObjectId) return;
    setPlacedObjects((prev) =>
      prev.map((obj) =>
        obj.id === selectedObjectId
          ? { ...obj, size, color, rotation, position }
          : obj
      )
    );
  }, [selectedObjectId, size, color, rotation, position]);

  useEffect(() => {
  GAME_SETTINGS.SPEED = speed;
  GAME_SETTINGS.GRAVITY = gravity;
  GAME_SETTINGS.JUMP_FORCE = jumpForce;
}, [speed, gravity, jumpForce]);


  const draggedSize = useMemo(() => {
    const obj = placedObjects.find((o) => o.id === selectedObjectId);
    return obj?.size || [1, 1, 1];
  }, [placedObjects, selectedObjectId]);

  console.log("🔍 snapPreview:", snapPreview);
  console.log("🔍 selectedObjectId:", selectedObjectId);

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
  coins={coins}
  setCoins={setCoins}
  collectCoin={collectCoin}
  handleGroundClick={handleGroundClick}
  handlePointerMove={handlePointerMove}
  throttledPointerMove={throttledPointerMove}
  handlePointerUp={handlePointerUp}
  previewPosition={previewPosition}
  setPreviewPosition={setPreviewPosition}
  girlRef={girlRef}
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
/>

    </div>
  );
} 