import React, { useMemo, useEffect } from "react";
import * as THREE from "three";
import { Html, Billboard } from "@react-three/drei";

import { useNPCTexture } from "./npc/hooks/useNPCTexture";
import { useNPCBrain } from "./npc/hooks/useNPCBrain";

const toVector3Array = (value, fallback) => {
  if (!Array.isArray(value)) return [...fallback];

  return [
    Number(value[0] ?? fallback[0]) || 0,
    Number(value[1] ?? fallback[1]) || 0,
    Number(value[2] ?? fallback[2]) || 0
  ];
};

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
  activeDialogueNpcId,
  startDialogue,
  closeDialogue,
  onDialogueClosed
}) {
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
    activeDialogueNpcId,
    startDialogue,
    closeDialogue,
    onDialogueClosed
  });

  const { texture, spriteAspect, spriteReady } = useNPCTexture(npc.textureUrl);

  const spriteHeight = Number(npc.spriteHeight ?? 1.4) || 1.4;
  const safeSpriteAspect = Number(spriteAspect) > 0 ? spriteAspect : 1;
  const spriteWidth = spriteHeight * safeSpriteAspect;

  const isTalking = activeDialogueNpcId === npc.id;
  const isSummoned = npc.isSummoned === true;
  const detectionRadius = Number(npc.detection?.radius ?? 3) || 3;

  /**
   * Dialogue Handoff Synchronization Bridge
   * This effect watches for the 'handoff' or 'autoOpen' flags.
   * If they are set and the NPC is not yet talking, it forces the global 
   * dialogue system to open for this specific NPC using its temporary payload.
   */
  useEffect(() => {
    const shouldAutoOpen = 
      npc.summonAutoOpenPending === true || 
      npc.dialogueHandoffPending === true ||
      npc.forceDialogueOpen === true;

    if (shouldAutoOpen && !isTalking && typeof startDialogue === 'function') {
      // Determine the best payload to show (Tree > Text > Default)
      const payload = npc.temporaryDialogueTree || 
                      npc.temporaryDialogue || 
                      npc.priorityDialogue || 
                      npc.temporaryDialogueText || 
                      npc.dialogueText;

      if (payload) {
        startDialogue(npc.id, payload);
      }
    }
  }, [
    npc.id, 
    npc.summonAutoOpenPending, 
    npc.dialogueHandoffPending, 
    npc.forceDialogueOpen, 
    isTalking, 
    startDialogue,
    npc.temporaryDialogueTree,
    npc.temporaryDialogueText
  ]);

  const isAutoOpenPending = npc.summonAutoOpenPending === true;

  const hasTemporaryDialogue = Boolean(
    npc.hasTemporaryDialogue ||
      npc.temporaryDialogue != null ||
      npc.temporaryDialogueTree != null ||
      npc.temporaryDialogueOptions != null ||
      npc.temporaryPlayerChoices != null ||
      npc.priorityDialogue
  ) && npc.temporaryDialogueDismissed !== true;

  const safePosition = useMemo(
    () => toVector3Array(npc.position, [0, 0, 0]),
    [npc.position]
  );

  const safeRotation = useMemo(
    () => toVector3Array(npc.rotation, [0, 0, 0]),
    [npc.rotation]
  );

  const safeScale = useMemo(() => {
    const scale = toVector3Array(npc.scale, [1, 1, 1]);
    return [
      scale[0] === 0 ? 1 : scale[0],
      scale[1] === 0 ? 1 : scale[1],
      scale[2] === 0 ? 1 : scale[2]
    ];
  }, [npc.scale]);

  // UI Styling based on NPC state
  const labelBackground = isTalking
    ? "rgba(168, 85, 247, 0.95)"
    : isSelected
    ? "rgba(234, 179, 8, 0.95)"
    : isAutoOpenPending
    ? "rgba(245, 158, 11, 0.95)" 
    : isSummoned
    ? "rgba(217, 119, 6, 0.92)"
    : "rgba(15, 23, 42, 0.85)";

  const labelColor =
    isSelected || isTalking || isAutoOpenPending ? "#0f172a" : "#ffffff";

  const actorTint = isTalking
    ? "#f3e8ff"
    : isSelected
    ? "#fff7cc"
    : isAutoOpenPending
    ? "#ffeeb3"
    : hasTemporaryDialogue
    ? "#fff1b8"
    : "#ffffff";

  const capsuleColor = isTalking
    ? "#a855f7"
    : isSelected
    ? "#ffff00"
    : isAutoOpenPending
    ? "#f59e0b"
    : aiState === "Alerted" || aiState === "Chasing"
    ? "#ef4444"
    : isSummoned
    ? "#f59e0b"
    : "#ff8844";

  const capsuleEmissive = isTalking
    ? "#581c87"
    : isSelected
    ? "#ffaa00"
    : isAutoOpenPending
    ? "#b45309"
    : aiState === "Alerted" || aiState === "Chasing"
    ? "#7f1d1d"
    : isSummoned
    ? "#7c2d12"
    : "#000000";

  const displayName = npc.name || `NPC ${index + 1}`;

  return (
    <group
      ref={groupRef}
      position={safePosition}
      rotation={safeRotation}
      scale={safeScale}
    >
      {/* Floating UI Label */}
      <Html
        position={[0, 1.5, 0]}
        center
        distanceFactor={12}
        style={{
          userSelect: "none",
          pointerEvents: "none",
          background: labelBackground,
          color: labelColor,
          padding: "4px 10px",
          borderRadius: "6px",
          fontSize: "11px",
          fontWeight: "bold",
          fontFamily: "sans-serif",
          whiteSpace: "nowrap",
          border:
            isSelected || isTalking || isAutoOpenPending
              ? "1.5px solid #ffffff"
              : hasTemporaryDialogue
              ? "1.5px solid rgba(255, 241, 184, 0.95)"
              : "1.5px solid rgba(255,255,255,0.15)",
          boxShadow: "0 4px 10px rgba(0,0,0,0.3)",
          transition: "all 0.15s ease",
          zIndex: isTalking ? 100 : 1
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          <span>{displayName}</span>

          {isSummoned && (
            <span
              style={{
                fontSize: "9px",
                background: isAutoOpenPending || isTalking
                  ? "#0f172a"
                  : "rgba(255,255,255,0.18)",
                color: "#ffffff",
                padding: "1px 4px",
                borderRadius: "3px"
              }}
            >
              {isTalking ? "Talking" : isAutoOpenPending ? "Next up" : "Clone"}
            </span>
          )}

          {hasTemporaryDialogue && !isAutoOpenPending && !isTalking && (
            <span
              style={{
                fontSize: "9px",
                background: "#fff1b8",
                color: "#5b3b00",
                padding: "1px 4px",
                borderRadius: "3px"
              }}
            >
              Temp
            </span>
          )}

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

      {/* 3D Visual Mesh */}
      {texture && spriteReady ? (
        <Billboard follow lockX={true} lockY={false} lockZ={true}>
          <mesh castShadow receiveShadow onClick={handleNpcClick}>
            <planeGeometry args={[spriteWidth, spriteHeight]} />
            <meshBasicMaterial
              map={texture}
              transparent
              alphaTest={0.5}
              side={THREE.DoubleSide}
              color={actorTint}
            />
          </mesh>
        </Billboard>
      ) : (
        <mesh castShadow receiveShadow onClick={handleNpcClick}>
          <capsuleGeometry args={[0.35, 1.2, 8, 16]} />
          <meshStandardMaterial
            color={capsuleColor}
            emissive={capsuleEmissive}
            emissiveIntensity={
              isSelected || isTalking || isAutoOpenPending
                ? 0.6
                : isSummoned
                ? 0.3
                : 0.2
            }
          />
        </mesh>
      )}

      {/* Detection/Selection Ring */}
      {(isSelected || isAutoOpenPending || isTalking) && (
        <mesh>
          <sphereGeometry args={[detectionRadius, 20, 14]} />
          <meshBasicMaterial
            color={
              isTalking
                ? "#a855f7"
                : isAutoOpenPending
                ? "#f59e0b"
                : aiState === "Alerted" || aiState === "Chasing"
                ? "#ff0000"
                : hasTemporaryDialogue
                ? "#ffd54a"
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
