import React, { useRef, useState, useCallback, useEffect, useMemo  } from "react";
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
import { getWorldSnapPoints, findSnapTarget } from './components/utils';
import { v4 as uuid } from "uuid";

import { useSpring, a } from '@react-spring/three';



export default function App() {

  const orbitRef = useRef();

  const [activeSnapTarget, setActiveSnapTarget] = useState(null);


  const [showSnapPoints, setShowSnapPoints] = useState(false);


  const [snapCache, setSnapCache] = useState({});

  const [snapPreview, setSnapPreview] = useState(null);

  const snapAnim = useSpring({
  scale: snapPreview ? [1.1, 1.1, 1.1] : [0, 0, 0],
  config: { tension: 200, friction: 15 },

  });


  const radToDeg = (r) => Math.round((r * 180) / Math.PI);
  const degToRad = (d) => (d * Math.PI) / 180;

  const [showTransformControls, setShowTransformControls] = useState(true);
  const [snapSize, setSnapSize] = useState(1);
  const [isDragging, setIsDragging] = useState(false);
  const dragOffset = useRef([0, 0, 0]);
  const [position, setPosition] = useState([0, 0, 0]);
  const [selectedObjectId, setSelectedObjectId] = useState(null);
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
  const [objectType, setObjectType] = useState("wall");
  const [isDrawing, setIsDrawing] = useState(false);
  const [placedObjects, setPlacedObjects] = useState([]);
  const [size, setSize] = useState([1, 1, 1]);
  const [color, setColor] = useState("#cccccc");
  const [rotation, setRotation] = useState([0, 0, 0]);
  const [previewPosition, setPreviewPosition] = useState(null);

  const [showOptions, setShowOptions] = useState(false);
  const [showGameSettings, setShowGameSettings] = useState(false);
  const { isPanelOpen, setIsPanelOpen } = useMapEditor();

  const frameRef = useRef(null);

  const girlRef = useRef();
  const joystickDir = useRef({ x: 0, y: 0 });
  const isJumping = useRef(false);
  const jumpVelocity = useRef(0);

  const snapToGrid = (value) => {
    return snapSize > 0 ? Math.round(value / snapSize) * snapSize : value;
  };

  const handleJoystickMove = useCallback((dir) => {
    joystickDir.current = dir;
  }, []);

  const handleJoystickEnd = useCallback(() => {
    joystickDir.current = { x: 0, y: 0 };
  }, []);

  const handlePointerMove = useCallback((e) => {
  if (!isDragging || !selectedObjectId) return;

  const { x, z } = e.point;
  const [dx, dz] = dragOffset.current;
  const newX = snapToGrid(x - dx);
  const newZ = snapToGrid(z - dz);
  const newY = position[1];
  const newDragPosition = [newX, newY, newZ];
  setPosition(newDragPosition);
}, [isDragging, selectedObjectId, position, snapToGrid]);


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

  const handleGroundClick = (e) => {
    if (isDeleteMode || !isDrawing) {
      setSelectedObjectId(null);
      return;
    }

    const point = e.point;
    const x = snapToGrid(point.x);
    const z = snapToGrid(point.z);

    const defaultSnapPoints = [
      { id: "top", offset: [0, 0.5, 0] },
      { id: "bottom", offset: [0, -0.5, 0] },
    ];

    const newObject = {
      id: uuid(),
      type: objectType,
      position: previewPosition,
      size,
      color,
      rotation,
      snapPoints: defaultSnapPoints,
    };

    setPlacedObjects((prev) => [...prev, newObject]);
    setIsDrawing(false);
    setPreviewPosition(null);
  };

  const handlePreviewMove = (e) => {
    if (!isDrawing || isDeleteMode) return;
    const { x, z } = e.point;
    const snapped = [snapToGrid(x), size[1] / 2 - 0.5, snapToGrid(z)];
    setPreviewPosition(snapped);
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
  const newCache = {};
  placedObjects.forEach((obj) => {
    newCache[obj.id] = getWorldSnapPoints(obj);
  });
  setSnapCache(newCache);
}, [placedObjects]);


useEffect(() => {
  if (!isDragging || !selectedObjectId) {
    setSnapPreview(null);
    return;
  }

  const draggedObj = placedObjects.find((obj) => obj.id === selectedObjectId);
  if (!draggedObj) return;

  const updatedDraggedObj = {
    ...draggedObj,
    position,
  };

  const snapTarget = findSnapTarget(updatedDraggedObj, snapCache);

  if (
    snapTarget &&
    snapTarget.draggedSnapPoint &&
    snapTarget.targetSnapPoint
  ) {

        const offset = snapTarget.draggedSnapPoint.rotatedOffset;

    const push = [
      snapTarget.direction[0] * (snapTarget.size[0] / 0.999),
      snapTarget.direction[1] * (snapTarget.size[1] / 0.999),
      snapTarget.direction[2] * (snapTarget.size[2] / 0.999),
    ];

    const previewPos = [
      snapTarget.targetSnapPoint.position[0] - offset[0] + push[0],
      snapTarget.targetSnapPoint.position[1] - offset[1] + push[1],
      snapTarget.targetSnapPoint.position[2] - offset[2] + push[2],
    ];



    setSnapPreview(previewPos);

    ////////////////////////
    setActiveSnapTarget(snapTarget);
    ////////////////////////

  } else {
    setSnapPreview(null);

    ///////////////////////
    setActiveSnapTarget(null);
    ///////////////////////
  }
}, [isDragging, selectedObjectId, position, placedObjects, snapCache]);




const handlePointerUp = () => {
  setIsDragging(false);
  if (!selectedObjectId) return;

  const draggedObj = placedObjects.find((obj) => obj.id === selectedObjectId);
  if (!draggedObj) return;

  const updatedDraggedObj = {
    ...draggedObj,
    position,
  };

  const snapTarget = findSnapTarget(updatedDraggedObj, snapCache);

  if (
    snapTarget &&
    snapTarget.draggedSnapPoint &&
    snapTarget.targetSnapPoint
  ) {
    const offset = snapTarget.draggedSnapPoint.rotatedOffset;

    // ✅ Push the object away from the target by half the size of the target object
    const push = [
      snapTarget.direction[0] * (snapTarget.size[0] / 0.999),
      snapTarget.direction[1] * (snapTarget.size[1] / 0.999),
      snapTarget.direction[2] * (snapTarget.size[2] / 0.999),
    ];

    const newPos = [
      snapTarget.targetSnapPoint.position[0] - offset[0] + push[0],
      snapTarget.targetSnapPoint.position[1] - offset[1] + push[1],
      snapTarget.targetSnapPoint.position[2] - offset[2] + push[2],
    ];

    setPlacedObjects((prev) =>
      prev.map((obj) =>
        obj.id === draggedObj.id ? { ...obj, position: newPos } : obj
      )
    );

    setPosition(newPos); // Sync internal state
    dragOffset.current = [0, 0]; // Reset drag offset
  }

  setSnapPreview(null);
  setActiveSnapTarget(null);
};

  const draggedSize = useMemo(() => {
  const obj = placedObjects.find((o) => o.id === selectedObjectId);
  return obj?.size || [1, 1, 1];
}, [placedObjects, selectedObjectId]);

console.log("🔍 snapPreview:", snapPreview);
console.log("🔍 selectedObjectId:", selectedObjectId);

  return (
    
      

      <div className="canvas-container">
      <Canvas
        camera={{ position: [0, 2, 5], fov: 60 }}
        onPointerMissed={(e) => e.stopPropagation()}
        onPointerUp={handlePointerUp}
      >
        <color attach="background" args={["#d0dcff"]} />
        <ambientLight intensity={0.7} />
        <directionalLight position={[5, 5, 5]} intensity={0.8} />

        {snapPreview && selectedObjectId && (
          <>
            {console.log("✅ Rendering snap preview at", snapPreview)}
            <a.mesh position={snapPreview} scale={snapAnim.scale}>
              <boxGeometry args={draggedSize} />
              <meshStandardMaterial color="#1ad051" transparent opacity={0.4} />
            </a.mesh>
          </>
        )}






        {activeSnapTarget?.draggedSnapPoint && activeSnapTarget?.targetSnapPoint && (
  <>
    {/* Dragged snap point (cyan) */}
    <mesh position={activeSnapTarget.draggedSnapPoint.position}>
      <sphereGeometry args={[0.07, 12, 12]} />
      <meshStandardMaterial color="cyan" emissive="cyan" emissiveIntensity={0.5} />
    </mesh>

    {/* Target snap point (magenta) */}
    <mesh position={activeSnapTarget.targetSnapPoint.position}>
      <sphereGeometry args={[0.07, 12, 12]} />
      <meshStandardMaterial color="magenta" emissive="magenta" emissiveIntensity={0.5} />
    </mesh>

    {/* Line between snap points (red) */}
    <line>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          count={2}
          array={new Float32Array([
            ...activeSnapTarget.draggedSnapPoint.position,
            ...activeSnapTarget.targetSnapPoint.position,
          ])}
          itemSize={3}
        />
      </bufferGeometry>
      <lineBasicMaterial color="red" linewidth={2} />
    </line>
  </>
)}







          {snapPreview && selectedObjectId && (
            <line>
              <bufferGeometry>
                <bufferAttribute
                  attach="attributes-position"
                  count={2}
                  array={new Float32Array([
                    ...position, // current dragged object position
                    ...snapPreview, // where it would snap
                  ])}
                  itemSize={3}
                />
              </bufferGeometry>
              <lineBasicMaterial color="lime" linewidth={2} />
            </line>
          )}


        <mesh
          name="ground"
          rotation={[-Math.PI / 2, 0, 0]}
          position={[0, -0.5, 0]}
          receiveShadow
          onClick={handleGroundClick}
          onPointerMove={(e) => {
            if (isDrawing) {
              const { x, z } = e.point;
              const snapped = [snapToGrid(x), size[1] / 2 - 0.5, snapToGrid(z)];
              setPreviewPosition(snapped);
            } else {
              throttledPointerMove(e);
            }
          }}
        >
          <planeGeometry args={[50, 50]} />
          <meshStandardMaterial color="#e0e0e0" side={THREE.DoubleSide} />
        </mesh>

        <gridHelper args={[50, 50]} position={[0, -0.49, 0]} />

        <SpaceGirl
          ref={girlRef}
          joystickDir={joystickDir}
          cameraMode={cameraMode}
          isJumping={isJumping}
          jumpVelocity={jumpVelocity}
        />

        {coins.map((coin) => (
          <Coin key={coin.id} position={coin.pos} onCollect={() => collectCoin(coin.id)} />
        ))}

        {placedObjects.map((obj) => (
          <mesh
            key={obj.id}
            position={obj.position}
            rotation={obj.rotation}
            onPointerDown={(e) => {
              e.stopPropagation();
              if (isDeleteMode) {
                setPlacedObjects((prev) => prev.filter((o) => o.id !== obj.id));
              } else {
                setSelectedObjectId((prev) => (prev === obj.id ? null : obj.id));
                setIsCreatingObject(false);
                setIsDrawing(false);
                setIsDeleteMode(false);
                setSize(obj.size);
                setColor(obj.color);
                setRotation(obj.rotation);
                setPosition(obj.position);

                setIsDragging(true);
                const { x, z } = e.point;
                dragOffset.current = [x - obj.position[0], z - obj.position[2]];
              }
            }}
          >
            <boxGeometry args={obj.size} />
            <meshStandardMaterial
              color={obj.color}
              emissive={selectedObjectId === obj.id ? "#ffff00" : "#000000"}
              emissiveIntensity={selectedObjectId === obj.id ? 0.5 : 0}
            />
          </mesh>
        ))}

            {showSnapPoints && selectedObjectId && (
              <>
                {/* Snap points on the selected object */}
                {getWorldSnapPoints(
                  placedObjects.find((obj) => obj.id === selectedObjectId)
                ).map((sp, i) => (
                  <mesh key={`selected-${i}`} position={sp.position}>
                    <sphereGeometry args={[0.05, 8, 8]} />
                    <meshStandardMaterial color="cyan" emissive="cyan" emissiveIntensity={0.5} />
                  </mesh>
                ))}

                {/* Snap points on other objects */}
                {placedObjects
                  .filter((obj) => obj.id !== selectedObjectId)
                  .flatMap((obj) =>
                    getWorldSnapPoints(obj).map((sp, i) => (
                      <mesh key={`${obj.id}-sp-${i}`} position={sp.position}>
                        <sphereGeometry args={[0.05, 8, 8]} />
                        <meshStandardMaterial color="orange" emissive="orange" emissiveIntensity={0.5} />
                      </mesh>
                    ))
                  )}
              </>
            )}



        <PlacedObjectsRenderer />

        {isDrawing && previewPosition && (
          <mesh position={previewPosition} rotation={rotation}>
            <boxGeometry args={size} />
            <meshStandardMaterial color={color} transparent opacity={0.5} />
          </mesh>
        )}

        <MapEditorInteraction />

            {cameraMode === "orbit" && <OrbitControls
              ref={orbitRef}
              enableZoom={false}
              enableRotate={!isDragging}
              enablePan={!isDragging}
            />

          }
      <CameraController mode={cameraMode} targetRef={girlRef} zoom={zoom} />
      </Canvas>

            {/* UI Overlay */}
      <div className="ui">
        <MapEditorPanel />

        {/* ⚙️ Options Toggle */}
        <div className="options-toggle">
          <button className="btn options" onClick={() => setShowOptions((prev) => !prev)}>
            {showOptions ? "✖️ Close Options" : "⚙️ Options"}
          </button>
        </div>

        {/* 🧩 Options Panel */}
        {showOptions && (
          <>
            {/* 🎛️ Game Settings Toggle */}
            <div className="game-settings-toggle">
              <button
                className="btn settings"
                onClick={() => setShowGameSettings((prev) => !prev)}
              >
                {showGameSettings ? "❌ Close Settings" : "🎛️ Game Settings"}
              </button>
            </div>

            {showGameSettings && (
              <div className="game-settings-panel">
                <label>
                  Speed:
                  <input
                    type="range"
                    min="0.01"
                    max="0.2"
                    step="0.01"
                    defaultValue={GAME_SETTINGS.SPEED}
                    onChange={(e) => (GAME_SETTINGS.SPEED = parseFloat(e.target.value))}
                  />
                </label>
                <label>
                  Gravity:
                  <input
                    type="range"
                    min="0.001"
                    max="0.02"
                    step="0.001"
                    defaultValue={GAME_SETTINGS.GRAVITY}
                    onChange={(e) => (GAME_SETTINGS.GRAVITY = parseFloat(e.target.value))}
                  />
                </label>
                <label>
                  Jump Force:
                  <input
                    type="range"
                    min="0.05"
                    max="0.3"
                    step="0.01"
                    defaultValue={GAME_SETTINGS.JUMP_FORCE}
                    onChange={(e) => (GAME_SETTINGS.JUMP_FORCE = parseFloat(e.target.value))}
                  />
                </label>
              </div>
            )}

            {/* ➕ Object Creator */}
            <div className="object-creator-toggle">
              <button
                className="btn create"
                onClick={() => setIsCreatingObject((prev) => !prev)}
              >
                {isCreatingObject ? "❌ Cancel" : "➕ Create Object"}
              </button>

              <button
                className="btn delete"
                onClick={() => setIsDeleteMode((prev) => !prev)}
                style={{ backgroundColor: isDeleteMode ? "#ff4d4d" : undefined }}
              >
                {isDeleteMode ? "🗑️ Cancel Delete" : "🗑️ Delete Mode"}
              </button>
            </div>

            {isCreatingObject && (
              <div className="object-creator-panel">
                <label>
                  Object Type:
                  <select value={objectType} onChange={(e) => setObjectType(e.target.value)}>
                    <option value="wall">Wall</option>
                    <option value="floor">Floor</option>
                    <option value="table">Table</option>
                    <option value="window">Window</option>
                    <option value="road">Road</option>
                  </select>
                </label>

                <label>
                  Width:
                  <input
                    type="number"
                    step="0.1"
                    value={size[0]}
                    onChange={(e) => setSize([+e.target.value, size[1], size[2]])}
                  />
                </label>
                <label>
                  Height:
                  <input
                    type="number"
                    step="0.1"
                    value={size[1]}
                    onChange={(e) => setSize([size[0], +e.target.value, size[2]])}
                  />
                </label>
                <label>
                  Depth:
                  <input
                    type="number"
                    step="0.1"
                    value={size[2]}
                    onChange={(e) => setSize([size[0], size[1], +e.target.value])}
                  />
                </label>

                <label>
                  Position X:
                  <input
                    type="number"
                    step="0.1"
                    value={position[0]}
                    onChange={(e) => setPosition([+e.target.value, position[1], position[2]])}
                  />
                </label>
                <label>
                  Position Y:
                  <input
                    type="number"
                    step="0.1"
                    value={position[1]}
                    onChange={(e) => setPosition([position[0], +e.target.value, position[2]])}
                  />
                </label>
                <label>
                  Position Z:
                  <input
                    type="number"
                    step="0.1"
                    value={position[2]}
                    onChange={(e) => setPosition([position[0], position[1], +e.target.value])}
                  />
                </label>
                  <label>
                  Snap to Grid:
                  <select value={snapSize} onChange={(e) => setSnapSize(+e.target.value)}>
                    <option value={1}>1</option>
                    <option value={0.5}>0.5</option>
                    <option value={0.25}>0.25</option>
                    <option value={0}>Off</option>
                  </select>
                </label>

                <label>
                  Color:
                  <input
                    type="color"
                    value={color}
                    onChange={(e) => setColor(e.target.value)}
                  />
                </label>

                <label>
                  Rotate X (°):
                  <input
                    type="range"
                    min={0}
                    max={360}
                    value={radToDeg(rotation[0])}
                    onChange={(e) =>
                      setRotation([degToRad(+e.target.value), rotation[1], rotation[2]])
                    }
                  />
                  <input
                    type="number"
                    min={0}
                    max={360}
                    value={radToDeg(rotation[0])}
                    onChange={(e) =>
                      setRotation([degToRad(+e.target.value), rotation[1], rotation[2]])
                    }
                  />
                </label>

                <label>
                  Rotate Y (°):
                  <input
                    type="range"
                    min={0}
                    max={360}
                    value={radToDeg(rotation[1])}
                    onChange={(e) =>
                      setRotation([rotation[0], degToRad(+e.target.value), rotation[2]])
                    }
                  />
                  <input
                    type="number"
                    min={0}
                    max={360}
                    value={radToDeg(rotation[1])}
                    onChange={(e) =>
                      setRotation([rotation[0], degToRad(+e.target.value), rotation[2]])
                    }
                  />
                </label>

                <label>
                  Rotate Z (°):
                  <input
                    type="range"
                    min={0}
                    max={360}
                    value={radToDeg(rotation[2])}
                    onChange={(e) =>
                      setRotation([rotation[0], rotation[1], degToRad(+e.target.value)])
                    }
                  />
                  <input
                    type="number"
                    min={0}
                    max={360}
                    value={radToDeg(rotation[2])}
                    onChange={(e) =>
                      setRotation([rotation[0], rotation[1], degToRad(+e.target.value)])
                    }
                  />
                </label>

                <button
                  className="btn draw"
                  onClick={() => setIsDrawing((prev) => !prev)}
                  style={{ backgroundColor: isDrawing ? "#4caf50" : undefined }}
                >
                  {isDrawing ? "✅ Drawing (Tap to Cancel)" : "🎨 Start Drawing"}
                </button>
              </div>
            )}

            <div className="camera-toggle">
              <button
                className="btn camera"
                onClick={() =>
                  setCameraMode((prev) =>
                    prev === "orbit" ? "third" : prev === "third" ? "top" : "orbit"
                  )
                }
              >
                🎥 Camera: {cameraMode}
              </button>
            </div>
                

            <div className="snap-debug-toggle">
              <button
                className="btn debug"
                onClick={() => setShowSnapPoints((prev) => !prev)}
                style={{ backgroundColor: showSnapPoints ? "#ffa500" : undefined }}
              >
                {showSnapPoints ? "🟠 Hide Snap Points" : "🟠 Show Snap Points"}
              </button>
            </div>


            <div className="edit-map-toggle">
              <button
                className="btn edit-map"
                onClick={() => setIsPanelOpen((prev) => !prev)}
              >
                {isPanelOpen ? "🧹 Hide Editor" : "🛠️ Edit Map"}
              </button>
            </div>
          </>
        )}

        <Joystick onMove={handleJoystickMove} onEnd={handleJoystickEnd} />

        <div className="jump-button">
          <button
            className="btn jump"
            onTouchStart={() => {
              if (!isJumping.current) {
                isJumping.current = true;
                jumpVelocity.current = GAME_SETTINGS.JUMP_FORCE;
              }
            }}
          >
            ⬆️ Jump
          </button>
        </div>
      </div>
    </div>
  );
}