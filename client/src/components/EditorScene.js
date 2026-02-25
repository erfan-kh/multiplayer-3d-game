// components/EditorScene.js
import React, { useRef, useEffect, useState } from "react";
import * as THREE from "three";
import { a } from "@react-spring/three";
import { useGLTF } from "@react-three/drei";

import SpaceGirl from "./SpaceGirl";
import Coin from "./Coin";
import PlacedObjectsRenderer from "./PlacedObjectsRenderer";
import MapEditorInteraction from "./MapEditorInteraction";
import { getWorldSnapPoints } from "./utils";

// ✅ Component to render GLTF models
function GLTFObject({ modelPath, position, rotation, size }) {
  const { scene } = useGLTF(modelPath);
  return (
    <primitive
      object={scene}
      position={position}
      rotation={rotation}
      scale={size}
    />
  );
}

// ✅ Component to render and attach mesh ref for snapping
function SnappableBox({ obj,
   setPlacedObjects,
   setSelectedObjectId,
   setIsDragging,
   setPosition, 
   isDeleteMode, 
   dragOffset, 
   isVerticalDrag,
   setIsVerticalDrag, }) {
  const meshRef = useRef();

  useEffect(() => {
    if (meshRef.current) {
      setPlacedObjects((prev) =>
        prev.map((o) =>
          o.id === obj.id ? { ...o, mesh: meshRef.current } : o
        )
      );
    }
  }, [meshRef.current]);

  

  return (
    <mesh
      ref={meshRef}
      key={obj.id}
      position={obj.position}
      rotation={obj.rotation}
        onPointerDown={(e) => {
  e.stopPropagation();
  if (isDeleteMode) {
    setPlacedObjects((prev) => prev.filter((o) => o.id !== obj.id));
  } else {
    setSelectedObjectId((prev) => (prev === obj.id ? null : obj.id));
    setIsDragging(true);

    const vertical = e.shiftKey;
    setIsVerticalDrag(vertical);

    const objectPos = new THREE.Vector3(...obj.position);
    const intersection = new THREE.Vector3();

    if (vertical) {
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
      } else {
        dragOffset.current = [0, 0, 0]; // fallback
      }
    } else {
      const horizontalPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -objectPos.y);
      if (e.ray.intersectPlane(horizontalPlane, intersection)) {
        dragOffset.current = [
          intersection.x - objectPos.x,
          0,
          intersection.z - objectPos.z
        ];
      } else {
        dragOffset.current = [0, 0, 0]; // fallback
      }
    }

    setPosition(obj.position);

    console.log("Pointer down at:", e.point);
    console.log("Shift key held:", vertical);
    console.log("Initial object position:", obj.position);
    console.log("Calculated dragOffset:", dragOffset.current);
  }
}}





    >
      <boxGeometry args={obj.size} />
      <meshStandardMaterial
        color={obj.color}
        emissive={obj.id === obj.selectedObjectId ? "#ffff00" : "#000000"}
        emissiveIntensity={obj.id === obj.selectedObjectId ? 0.5 : 0}
      />
    </mesh>
  );
}

export default function EditorScene({
  placedObjects,
  setPlacedObjects,
  selectedObjectId,
  setSelectedObjectId,
  position,
  setPosition,
  size,
  color,
  rotation,
  isDrawing,
  isDeleteMode,
  snapSize,
  snapPreview,
  setSnapPreview,
  activeSnapTarget,
  setActiveSnapTarget,
  isDragging,
  setIsDragging,
  dragOffset,
  joystickDir,
  isJumping,
  jumpVelocity,
  cameraMode,
  coins,
  setCoins,
  collectCoin,
  handleGroundClick,
  handlePointerMove,
  throttledPointerMove,
  previewPosition,
  setPreviewPosition,
  girlRef,
  objectType,
  modelPath,

  snappingEnabled,
  setSnappingEnabled,

  isVerticalDrag={isVerticalDrag} ,
  setIsVerticalDrag={setIsVerticalDrag}
}) {
  const draggedSize = React.useMemo(() => {
    const obj = placedObjects.find((o) => o.id === selectedObjectId);
    return obj?.size || [1, 1, 1];
  }, [placedObjects, selectedObjectId]);

 
  return (
    <>
      {/* Snap Preview */}
      {snapPreview && selectedObjectId && (
        <a.mesh position={snapPreview} scale={[1.1, 1.1, 1.1]}>
          <boxGeometry args={draggedSize} />
          <meshStandardMaterial color="#1ad051" transparent opacity={0.4} />
        </a.mesh>
      )}

      {snapPreview && (
        <mesh position={snapPreview}>
          <boxGeometry args={[1, 1, 1]} />
          <meshStandardMaterial color="white" opacity={0.5} transparent />
        </mesh>
      )}

      {/* Snap Target Visuals */}

{activeSnapTarget?.draggedSnapPoint?.position &&
 activeSnapTarget?.targetSnapPoint?.position &&
 Array.isArray(activeSnapTarget.draggedSnapPoint.position) &&
 Array.isArray(activeSnapTarget.targetSnapPoint.position) &&
 activeSnapTarget.draggedSnapPoint.position.length === 3 &&
 activeSnapTarget.targetSnapPoint.position.length === 3 && (
  <>
    <mesh position={activeSnapTarget.draggedSnapPoint.position}>
      <sphereGeometry args={[0.07, 12, 12]} />
      <meshStandardMaterial color="cyan" emissive="cyan" emissiveIntensity={0.5} />
    </mesh>
    <mesh position={activeSnapTarget.targetSnapPoint.position}>
      <sphereGeometry args={[0.07, 12, 12]} />
      <meshStandardMaterial color="magenta" emissive="magenta" emissiveIntensity={0.5} />
    </mesh>
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

      {/* Snap Line */}
      {snapPreview && selectedObjectId && (
        <line>
          <bufferGeometry>
            <bufferAttribute
              attach="attributes-position"
              count={2}
              array={new Float32Array([...position, ...snapPreview])}
              itemSize={3}
            />
          </bufferGeometry>
          <lineBasicMaterial color="lime" linewidth={2} />
        </line>
      )}

      {/* Ground */}
      <mesh
        name="ground"
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, -0.5, 0]}
        receiveShadow
        onClick={handleGroundClick}
        onPointerMove={(e) => {
          //if (isDragging) return; // ✅ Skip ground logic, but allow event to bubble
          //e.stopPropagation();     // ❌ REMOVE this if present — it blocks bubbling
                
          if (isDrawing) {
            const { x, z } = e.point;
            const snapped = [
              Math.round(x / snapSize) * snapSize,
              size[1] / 2 - 0.5,
              Math.round(z / snapSize) * snapSize,
            ];
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

      {/* Character */}
      <SpaceGirl
        ref={girlRef}
        joystickDir={joystickDir}
        cameraMode={cameraMode}
        isJumping={isJumping}
        jumpVelocity={jumpVelocity}
      />

      {/* Coins */}
      {coins.map((coin) => (
        <Coin key={coin.id} position={coin.pos} onCollect={() => collectCoin(coin.id)} />
      ))}

      {/* Placed Objects */}
      {placedObjects.map((obj) => {
        if ((obj.type === "gltf" || obj.type === "car") && obj.modelPath) {
          return (
            <GLTFObject
              key={obj.id}
              modelPath={obj.modelPath}
              position={obj.position}
              rotation={obj.rotation}
              size={obj.size}
            />
          );
        }

        return (
          <SnappableBox
            key={obj.id}
            obj={obj}
            setPlacedObjects={setPlacedObjects}
            setSelectedObjectId={setSelectedObjectId}
            setIsDragging={setIsDragging}
            setPosition={setPosition}
            isDeleteMode={isDeleteMode}
            dragOffset={dragOffset}

            isVerticalDrag={isVerticalDrag} 
            setIsVerticalDrag={setIsVerticalDrag}
          />
        );
      })}

      {/* Snap Point Debug */}
      {placedObjects.length > 0 && selectedObjectId && (() => {
  const selectedObj = placedObjects.find((obj) => obj.id === selectedObjectId);
  if (!selectedObj) return null;

  const snapPoints = getWorldSnapPoints(selectedObj);
  if (!Array.isArray(snapPoints)) return null;

  return (
    <>
      {snapPoints.map((sp, i) =>
        Array.isArray(sp.position) && sp.position.length === 3 ? (
          <mesh key={`selected-${i}`} position={sp.position}>
            <sphereGeometry args={[0.05, 8, 8]} />
            <meshStandardMaterial color="cyan" emissive="cyan" emissiveIntensity={0.5} />
          </mesh>
        ) : null
      )}
    </>
  );
})()}



      {/* Preview Object */}
      {isDrawing && previewPosition && (
        (objectType === "gltf" || objectType === "car") && modelPath ? (
          <GLTFObject
            modelPath={modelPath}
            position={previewPosition}
            rotation={rotation}
            size={size}
          />
        ) : (
          <mesh position={previewPosition} rotation={rotation}>
            <boxGeometry args={size} />
            <meshStandardMaterial color={color} transparent opacity={0.5} />
          </mesh>
        )
      )}

      

      <PlacedObjectsRenderer />
      <MapEditorInteraction />
    </>
  );
}