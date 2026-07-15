import React from "react";
import * as THREE from "three";
import { Html, Billboard } from "@react-three/drei";

import { useNPCTexture } from "./npc/hooks/useNPCTexture";
import { useNPCBrain } from "./npc/hooks/useNPCBrain";

export default function NPCActor({
  npc,
  npcs = [],
  npcRefs,
  index,
  isSelected,
  setSelectedNpcId,
  setSelectedObjectId,
  focusCameraOnNpc,
  setNpcs,
  girlRef,
  obstacleObjects = [],
  obstacleObjectsRef,
  activeDialogueNpcId, // Added: Track which NPC is currently engaging in dialogue
  startDialogue        // Added: Function from parent layout to trigger dialogue UI
}) {
  // 1. Core Logic & Frame Update Loop
  const { groupRef, aiState, handleNpcClick, getStateColor } = useNPCBrain({
    npc,
    npcs,
    npcRefs,
    setNpcs,
    girlRef,
    obstacleObjects,
    obstacleObjectsRef,
    setSelectedNpcId,
    setSelectedObjectId,
    focusCameraOnNpc,
    activeDialogueNpcId, // Passed to brain to halt movement logic during dialogue
    startDialogue        // Passed to brain to trigger conversation on click/proximity
  });

  // 2. Texture & Asset Handling
  const { texture, spriteAspect, spriteReady } = useNPCTexture(npc.textureUrl);

  const spriteHeight = npc.spriteHeight ?? 1.4;
  const spriteWidth = spriteHeight * spriteAspect;

  const isTalking = activeDialogueNpcId === npc.id;

  return (
    <group
      ref={groupRef}
      position={npc.position}
      rotation={npc.rotation || [0, 0, 0]}
      scale={npc.scale || [1, 1, 1]}
    >
      {/* Name tag and active AI behavior status overlay */}
      <Html
        position={[0, 1.5, 0]}
        center
        distanceFactor={12}
        style={{
          userSelect: "none",
          pointerEvents: "none",
          background: isTalking 
            ? "rgba(168, 85, 247, 0.95)" // Purple for Dialogue status
            : isSelected 
            ? "rgba(234, 179, 8, 0.95)" 
            : "rgba(15, 23, 42, 0.85)",
          color: isSelected || isTalking ? "#0f172a" : "#ffffff",
          padding: "4px 10px",
          borderRadius: "6px",
          fontSize: "11px",
          fontWeight: "bold",
          fontFamily: "sans-serif",
          whiteSpace: "nowrap",
          border: isSelected || isTalking 
            ? "1.5px solid #ffffff" 
            : "1.5px solid rgba(255,255,255,0.15)",
          boxShadow: "0 4px 10px rgba(0,0,0,0.3)",
          transition: "all 0.15s ease"
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          <span>{npc.name || `NPC ${index + 1}`}</span>
          <span
            style={{
              fontSize: "9px",
              background: getStateColor(),
              color: "#fff",
              padding: "1px 4px",
              borderRadius: "3px"
            }}
          >
            {aiState}
          </span>
        </div>
      </Html>

      {/* Render loaded 2D Sprite or fallback 3D Capsule representation */}
      {texture && spriteReady ? (
        <Billboard follow lockX={true} lockY={false} lockZ={true}>
          <mesh castShadow receiveShadow onClick={handleNpcClick}>
            <planeGeometry args={[spriteWidth, spriteHeight]} />
            <meshBasicMaterial
              map={texture}
              transparent
              alphaTest={0.5}
              side={THREE.DoubleSide}
              color={isTalking ? "#f3e8ff" : isSelected ? "#fff7cc" : "#ffffff"}
            />
          </mesh>
        </Billboard>
      ) : (
        <mesh castShadow receiveShadow onClick={handleNpcClick}>
          <capsuleGeometry args={[0.35, 1.2, 8, 16]} />
          <meshStandardMaterial
            color={
              isTalking
                ? "#a855f7" // Purple
                : isSelected
                ? "#ffff00"
                : aiState === "Alerted" || aiState === "Chasing"
                ? "#ef4444"
                : "#ff8844"
            }
            emissive={
              isTalking
                ? "#581c87"
                : isSelected
                ? "#ffaa00"
                : aiState === "Alerted" || aiState === "Chasing"
                ? "#7f1d1d"
                : "#000000"
            }
            emissiveIntensity={isSelected || isTalking ? 0.6 : 0.2}
          />
        </mesh>
      )}

      {/* Visual wireframe displaying active sensory detection radius */}
      {isSelected && (
        <mesh>
          <sphereGeometry args={[npc.detection?.radius || 3, 20, 14]} />
          <meshBasicMaterial
            color={
              isTalking 
                ? "#a855f7" 
                : aiState === "Alerted" || aiState === "Chasing" 
                ? "#ff0000" 
                : "#4da6ff"
            }
            wireframe
            transparent
            opacity={0.12}
            depthWrite={false}
          />
        </mesh>
      )}
    </group>
  );
}
