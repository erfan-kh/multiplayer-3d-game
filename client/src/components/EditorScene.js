// components/EditorScene.js
import React from "react";
import * as THREE from "three";
import { a } from "@react-spring/three";

import SpaceGirl from "./SpaceGirl";
import Coin from "./Coin";
import PlacedObjectsRenderer from "./PlacedObjectsRenderer";
import MapEditorInteraction from "./MapEditorInteraction";
import { getWorldSnapPoints } from "./utils";

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
  girlRef // ✅ Added here
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

      {/* Snap Target Visuals */}
      {activeSnapTarget?.draggedSnapPoint && activeSnapTarget?.targetSnapPoint && (
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
          if (isDrawing) {
            const { x, z } = e.point;
            const snapped = [Math.round(x / snapSize) * snapSize, size[1] / 2 - 0.5, Math.round(z / snapSize) * snapSize];
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
        ref={girlRef} // ✅ Correctly attached
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
              setIsDragging(true);
              const { x, z } = e.point;
              dragOffset.current = [x - obj.position[0], z - obj.position[2]];
              setPosition(obj.position);
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

      {/* Snap Point Debug */}
      {placedObjects.length > 0 && selectedObjectId && (
        <>
          {getWorldSnapPoints(placedObjects.find((obj) => obj.id === selectedObjectId)).map((sp, i) => (
            <mesh key={`selected-${i}`} position={sp.position}>
              <sphereGeometry args={[0.05, 8, 8]} />
              <meshStandardMaterial color="cyan" emissive="cyan" emissiveIntensity={0.5} />
            </mesh>
          ))}
        </>
      )}

      {/* Preview Object */}
      {isDrawing && previewPosition && (
        <mesh position={previewPosition} rotation={rotation}>
          <boxGeometry args={size} />
          <meshStandardMaterial color={color} transparent opacity={0.5} />
        </mesh>
      )}

      <PlacedObjectsRenderer />
      <MapEditorInteraction />
    </>
  );
}
