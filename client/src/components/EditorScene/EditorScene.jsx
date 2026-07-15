import React, { useEffect, useRef, useState, useMemo, memo } from "react";
import { useThree } from "@react-three/fiber";

import * as THREE from "three";
import { Physics, RigidBody, CuboidCollider } from "@react-three/rapier";

import SpaceGirl from "../SpaceGirl";
import Coin from "../Coin";
import MapEditorInteraction from "../MapEditorInteraction";
import EditorGizmo from "../editor/EditorGizmo";
import EditorRuler from "../../editor/EditorRuler";

import useSceneMetadata from "./useSceneMetadata";
import useEditorDragging from "./useEditorDragging";
import useEditorPreview from "./useEditorPreview";
import { renderObject, renderPreview } from "./renderObjects";
import { Html } from "@react-three/drei";

import { collectObstacleMeshes } from "./obstacleUtils";
import NPCActor from "./NPCActor";

const waypointTempVecA = new THREE.Vector3();
const waypointTempVecB = new THREE.Vector3();
const cleanupTempVecA = new THREE.Vector3();
const cleanupTempVecB = new THREE.Vector3();

const getWaypointPos = (waypoint) => {
  if (Array.isArray(waypoint)) return waypoint;
  if (waypoint && Array.isArray(waypoint.pos)) return waypoint.pos;
  return [0, 0, 0];
};

const cloneNpcData = (npc) => {
  if (typeof structuredClone === "function") {
    return structuredClone(npc);
  }
  return JSON.parse(JSON.stringify(npc));
};

const createNpcId = () => {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `npc-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
};

const normalizeOffset = (offset) => {
  if (!Array.isArray(offset)) return [1.5, 0, 0];
  return [
    Number(offset[0] ?? 1.5),
    Number(offset[1] ?? 0),
    Number(offset[2] ?? 0),
  ];
};

const removeSummonedNpcsForCaller = (prevNpcs, callerNpcId) => {
  if (!callerNpcId) return prevNpcs;
  return prevNpcs.filter(
    (npc) => !(npc.isSummoned && npc.summonedByNpcId === callerNpcId)
  );
};

const getVectorFromPositionLike = (value, target) => {
  if (!value || !target) return false;

  if (Array.isArray(value)) {
    target.set(
      Number(value[0] ?? 0),
      Number(value[1] ?? 0),
      Number(value[2] ?? 0)
    );
    return true;
  }

  if (
    typeof value.x === "number" &&
    typeof value.y === "number" &&
    typeof value.z === "number"
  ) {
    target.set(value.x, value.y, value.z);
    return true;
  }

  return false;
};

const getNpcWorldPosition = (npc, npcRefs, target) => {
  const refEntry = npcRefs?.current?.[npc.id];
  const refObject =
    refEntry?.group ||
    refEntry?.mesh ||
    refEntry?.rigidBody ||
    refEntry?.object ||
    refEntry;

  if (refObject?.getWorldPosition) {
    refObject.getWorldPosition(target);
    return true;
  }

  if (refObject?.translation) {
    const pos = refObject.translation();
    target.set(Number(pos.x ?? 0), Number(pos.y ?? 0), Number(pos.z ?? 0));
    return true;
  }

  return getVectorFromPositionLike(npc?.position, target);
};

const getPlayerWorldPosition = (girlRef, target) => {
  const player = girlRef?.current;
  if (!player) return false;

  if (player.getWorldPosition) {
    player.getWorldPosition(target);
    return true;
  }

  if (player.translation) {
    const pos = player.translation();
    target.set(Number(pos.x ?? 0), Number(pos.y ?? 0), Number(pos.z ?? 0));
    return true;
  }

  if (player.rigidBody?.translation) {
    const pos = player.rigidBody.translation();
    target.set(Number(pos.x ?? 0), Number(pos.y ?? 0), Number(pos.z ?? 0));
    return true;
  }

  if (player.group?.getWorldPosition) {
    player.group.getWorldPosition(target);
    return true;
  }

  return getVectorFromPositionLike(player.position, target);
};

const getCleanupRadiusFromNpc = (npc) => {
  const candidates = [
    npc?.restrictAreaRadius,
    npc?.interactionRadius,
    npc?.dialogueRadius,
    npc?.triggerRadius,
    npc?.detectionRadius,
    npc?.areaRadius,
    npc?.restrictArea?.radius,
    npc?.interactionArea?.radius,
    npc?.dialogueArea?.radius,
    npc?.triggerArea?.radius,
    npc?.area?.radius,
    npc?.restrictArea?.distance,
    npc?.interactionArea?.distance,
    npc?.dialogueDistance,
  ];

  for (const value of candidates) {
    const numericValue = Number(value);
    if (Number.isFinite(numericValue) && numericValue > 0) {
      return numericValue;
    }
  }

  return 4;
};

const getDistanceSquaredXZ = (a, b) => {
  const dx = a.x - b.x;
  const dz = a.z - b.z;
  return dx * dx + dz * dz;
};

const WaypointLine = memo(function WaypointLine({ start, end, color }) {
  const geometryRef = useRef();

  useEffect(() => {
    if (!geometryRef.current || !start || !end) return;

    waypointTempVecA.set(start[0] ?? 0, start[1] ?? 0, start[2] ?? 0);
    waypointTempVecB.set(end[0] ?? 0, end[1] ?? 0, end[2] ?? 0);

    geometryRef.current.setFromPoints([
      waypointTempVecA.clone(),
      waypointTempVecB.clone(),
    ]);
  }, [start, end]);

  return (
    <line>
      <bufferGeometry ref={geometryRef} />
      <lineBasicMaterial color={color} />
    </line>
  );
});

const WaypointMarker = memo(function WaypointMarker({
  npcId,
  wp,
  idx,
  isCurrent,
  isWaypointSelected,
  setSelectedWaypointIndex,
  setSelectedNpcId,
  setDraggingWaypoint,
}) {
  return (
    <group position={wp}>
      <mesh
        onPointerDown={(e) => {
          e.stopPropagation();
          if (setSelectedWaypointIndex) {
            setSelectedWaypointIndex(idx);
          }
          setSelectedNpcId(npcId);
          setDraggingWaypoint({
            npcId,
            index: idx,
            initialY: wp[1],
          });
        }}
        onPointerOver={() => {
          document.body.style.cursor = "grab";
        }}
        onPointerOut={() => {
          document.body.style.cursor = "default";
        }}
      >
        <sphereGeometry args={[isWaypointSelected ? 0.26 : 0.18, 12, 12]} />
        <meshBasicMaterial
          color={isWaypointSelected ? "#eab308" : isCurrent ? "#38bdf8" : "#94a3b8"}
        />
      </mesh>

      <Html
        position={[0, 0.4, 0]}
        center
        style={{
          userSelect: "none",
          pointerEvents: "none",
          background: isWaypointSelected
            ? "#eab308"
            : isCurrent
            ? "#38bdf8"
            : "#475569",
          color: isWaypointSelected ? "#000" : "#ffffff",
          width: "20px",
          height: "20px",
          borderRadius: "50%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "monospace, sans-serif",
          fontWeight: "bold",
          fontSize: "11px",
          border: "2px solid #fff",
          boxShadow: "0 2px 5px rgba(0,0,0,0.3)",
          transition: "background 0.2s ease",
        }}
      >
        {idx + 1}
      </Html>
    </group>
  );
});

const NPCWaypointHelpers = memo(function NPCWaypointHelpers({
  npc,
  selectedWaypointIndex,
  setSelectedWaypointIndex,
  setSelectedNpcId,
  setDraggingWaypoint,
}) {
  const waypoints = Array.isArray(npc.waypoints) ? npc.waypoints : [];
  if (waypoints.length === 0) return null;

  const currentWaypointIndex = npc.currentWaypointIndex ?? 0;
  const currentTarget = getWaypointPos(waypoints[currentWaypointIndex]);

  return (
    <group>
      {currentTarget && (
        <WaypointLine start={npc.position} end={currentTarget} color="#22c55e" />
      )}

      {waypoints.map((wp, wIdx) => {
        const startPos = getWaypointPos(wp);
        const nextWp = waypoints[(wIdx + 1) % waypoints.length];
        const endPos = getWaypointPos(nextWp);

        if (!nextWp || waypoints.length < 2) return null;
        if (npc.patrolMode === "pingpong" && wIdx === waypoints.length - 1) return null;

        const isCurrentSegment =
          wIdx === ((currentWaypointIndex - 1 + waypoints.length) % waypoints.length);

        return (
          <WaypointLine
            key={`${npc.id}-line-${wIdx}`}
            start={startPos}
            end={endPos}
            color={isCurrentSegment ? "#a855f7" : "#64748b"}
          />
        );
      })}

      {waypoints.map((wp, idx) => {
        const isCurrent = idx === currentWaypointIndex;
        const isWaypointSelected = selectedWaypointIndex === idx;
        const wpPos = getWaypointPos(wp);

        return (
          <WaypointMarker
            key={`${npc.id}-wp-${idx}`}
            npcId={npc.id}
            wp={wpPos}
            idx={idx}
            isCurrent={isCurrent}
            isWaypointSelected={isWaypointSelected}
            setSelectedWaypointIndex={setSelectedWaypointIndex}
            setSelectedNpcId={setSelectedNpcId}
            setDraggingWaypoint={setDraggingWaypoint}
          />
        );
      })}
    </group>
  );
});

export default function EditorScene(props) {
  const {
    gravity,
    placedObjects,
    setPlacedObjects,
    selectedObjectId,
    setSelectedObjectId,
    setPosition,
    size,
    color,
    rotation,
    objectType,
    isDrawing,
    isDeleteMode,
    isDragging,
    setIsDragging,
    dragOffset,
    previewPosition,
    setPreviewPosition,
    setIsVerticalDrag,
    objectRefs,
    recordHistory,
    joystickDir,
    isJumping,
    jumpVelocity,
    cameraMode,
    coins,
    collectCoin,
    handleGroundClick,
    girlRef,
    setObjectType,
    setSize,
    setColor,
    setRotation,
    material,
    setMaterial,
    npcs,
    setNpcs,
    selectedNpcId,
    setSelectedNpcId,
    focusCameraOnNpc,
    pendingNpc,
    npcPreviewPos,
    snappingEnabled,
    snapSize,
    placingWaypointForNpcId,
    waypointPreviewPos,
    selectedWaypointIndex,
    setSelectedWaypointIndex,

    // dialogue props
    activeDialogueNpcId,
    startDialogue,
    closeDialogue,
  } = props;

  const { raycaster, camera } = useThree();

  const [waypointHeight, setWaypointHeight] = useState(0.2);
  const isShiftPressed = useRef(false);

  const [draggingWaypoint, setDraggingWaypoint] = useState(null);
  const groundPlaneRef = useRef(new THREE.Plane(new THREE.Vector3(0, 1, 0), 0));

  // memoized computation of static geometries
  const obstacleObjects = useMemo(() => {
    return collectObstacleMeshes(objectRefs);
  }, [placedObjects]); // Depend only on placedObjects, not objectRefs object identity

  const obstacleObjectsRef = useRef([]);
  const npcRefs = useRef({});
  const npcsRef = useRef(npcs || []);

  useEffect(() => {
    npcsRef.current = npcs || [];
  }, [npcs]);

  useEffect(() => {
    obstacleObjectsRef.current = obstacleObjects;
  }, [obstacleObjects]);

  useEffect(() => {
    const handleDialogueCustomEvent = (event) => {
      const detail = event?.detail || {};
      const { eventName, targetNpcId, sourceNpcId, value } = detail;

      if (eventName !== "summonNpc") return;
      if (!targetNpcId) return;

      const callerNpcId =
        sourceNpcId ||
        detail.currentNpcId ||
        detail.callerNpcId ||
        detail.npcId ||
        activeDialogueNpcId ||
        null;

      setNpcs((prevNpcs) => {
        const templateNpc = prevNpcs.find((npc) => npc.id === targetNpcId);
        if (!templateNpc) return prevNpcs;

        const sourceNpc = callerNpcId
          ? prevNpcs.find((npc) => npc.id === callerNpcId)
          : null;

        const summonConfig = value && typeof value === "object" ? value : {};

        const count = Math.max(1, Number(summonConfig.count ?? 1) || 1);
        const offset = normalizeOffset(summonConfig.offset);
        const behaviorOverride = summonConfig.behavior;

        const basePosition = Array.isArray(sourceNpc?.position)
          ? sourceNpc.position
          : Array.isArray(templateNpc.position)
          ? templateNpc.position
          : [0, 0, 0];

        const nextNpcs = removeSummonedNpcsForCaller(prevNpcs, callerNpcId);

        const spawnedNpcs = Array.from({ length: count }, (_, index) => {
          const clonedNpc = cloneNpcData(templateNpc);
          const newId = createNpcId();
          const spreadX = count > 1 ? index * 0.8 : 0;

          const nextPosition = [
            Number(basePosition[0] ?? 0) + offset[0] + spreadX,
            Number(basePosition[1] ?? 0) + offset[1],
            Number(basePosition[2] ?? 0) + offset[2],
          ];

          return {
            ...clonedNpc,
            id: newId,
            npcId: newId,
            position: nextPosition,
            currentWaypointIndex: 0,
            isPatrolling: clonedNpc.isPatrolling ?? true,
            movement: {
              ...(clonedNpc.movement || {}),
              mode: behaviorOverride || clonedNpc.movement?.mode || "idle",
            },
            isSummoned: true,
            summonedByNpcId: callerNpcId,
            summonedFromTemplateId: targetNpcId,
            summonCleanupArmed: false,
            summonedAt: Date.now(),
          };
        });

        return [...nextNpcs, ...spawnedNpcs];
      });
    };

    window.addEventListener("npcCustomDialogueEvent", handleDialogueCustomEvent);

    return () => {
      window.removeEventListener("npcCustomDialogueEvent", handleDialogueCustomEvent);
    };
  }, [setNpcs, activeDialogueNpcId]);

  // Optimized cleanup loop running every 300ms instead of 150ms to prevent main thread choke
  useEffect(() => {
    const cleanupInterval = window.setInterval(() => {
      const currentNpcs = npcsRef.current || [];
      const summonedNpcs = currentNpcs.filter(
        (npc) => npc.isSummoned && npc.summonedByNpcId
      );

      if (summonedNpcs.length === 0) return;
      if (!getPlayerWorldPosition(girlRef, cleanupTempVecA)) return;

      const callerMap = new Map();
      currentNpcs.forEach((npc) => callerMap.set(npc.id, npc));

      let hasChanges = false;
      const nextNpcs = currentNpcs.map((npc) => {
        if (!(npc.isSummoned && npc.summonedByNpcId)) return npc;

        // Skip check if the clone is fresh (within 1.5 seconds)
        const isRecent = npc.summonedAt && Date.now() - npc.summonedAt < 1500;
        if (isRecent) return npc;

        const callerNpc = callerMap.get(npc.summonedByNpcId);
        if (!callerNpc) {
          hasChanges = true;
          return null; 
        }

        if (!getNpcWorldPosition(callerNpc, npcRefs, cleanupTempVecB)) {
          return npc;
        }

        const cleanupRadius = getCleanupRadiusFromNpc(callerNpc);
        const distanceSq = getDistanceSquaredXZ(cleanupTempVecA, cleanupTempVecB);
        const insideArea = distanceSq <= cleanupRadius * cleanupRadius;

        if (!npc.summonCleanupArmed) {
          if (!insideArea) return npc;
          hasChanges = true;
          return { ...npc, summonCleanupArmed: true };
        }

        if (!insideArea) {
          hasChanges = true;
          return null; 
        }

        return npc;
      }).filter(Boolean);

      if (hasChanges) {
        setNpcs(nextNpcs);
      }
    }, 300);

    return () => {
      window.clearInterval(cleanupInterval);
    };
  }, [girlRef, setNpcs]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Shift") isShiftPressed.current = true;
    };

    const handleKeyUp = (e) => {
      if (e.key === "Shift") isShiftPressed.current = false;
    };

    const handleWheel = (e) => {
      if (placingWaypointForNpcId && waypointPreviewPos) {
        e.preventDefault();
        setWaypointHeight((prev) => Math.max(0.18, prev - e.deltaY * 0.002));
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    window.addEventListener("wheel", handleWheel, { passive: false });

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
      window.removeEventListener("wheel", handleWheel);
    };
  }, [placingWaypointForNpcId, waypointPreviewPos]);

  useEffect(() => {
    if (!draggingWaypoint) return;

    if (setIsDragging) setIsDragging(true);

    const handlePointerMove = (e) => {
      const mouse = new THREE.Vector2(
        (e.clientX / window.innerWidth) * 2 - 1,
        -(e.clientY / window.innerHeight) * 2 + 1
      );

      raycaster.setFromCamera(mouse, camera);
      const intersectionPoint = new THREE.Vector3();

      groundPlaneRef.current.constant = -draggingWaypoint.initialY;

      if (raycaster.ray.intersectPlane(groundPlaneRef.current, intersectionPoint)) {
        let targetX = intersectionPoint.x;
        let targetZ = intersectionPoint.z;

        if (snappingEnabled && snapSize) {
          targetX = Math.round(targetX / snapSize) * snapSize;
          targetZ = Math.round(targetZ / snapSize) * snapSize;
        }

        setNpcs((prev) =>
          prev.map((n) => {
            if (n.id !== draggingWaypoint.npcId) return n;

            const updatedWaypoints = [...(n.waypoints || [])];
            const existingWaypoint = updatedWaypoints[draggingWaypoint.index];
            const newPos = [targetX, draggingWaypoint.initialY, targetZ];

            if (Array.isArray(existingWaypoint)) {
              updatedWaypoints[draggingWaypoint.index] = newPos;
            } else {
              updatedWaypoints[draggingWaypoint.index] = {
                ...existingWaypoint,
                pos: newPos,
              };
            }

            return {
              ...n,
              waypoints: updatedWaypoints,
            };
          })
        );
      }
    };

    const handlePointerUp = () => {
      setDraggingWaypoint(null);
      if (setIsDragging) setIsDragging(false);
      document.body.style.cursor = "default";
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);

    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
    };
  }, [
    draggingWaypoint,
    raycaster,
    camera,
    setNpcs,
    snappingEnabled,
    snapSize,
    setIsDragging,
  ]);

  useSceneMetadata(placedObjects, objectRefs);

  const { handleBoxPointerDown, handleBoxPointerMove } = useEditorDragging({
    isDrawing,
    isDeleteMode,
    setPlacedObjects,
    setSelectedObjectId,
    setIsVerticalDrag,
    dragOffset,
    recordHistory,
    setPosition,
    setPreviewPosition,
    setIsDragging,
    objectRefs,
    snappingEnabled,
    snapSize,
    placedObjects,
    loadObjectIntoEditorState: (obj) => {
      setObjectType(obj.type);
      setSize([...obj.size]);
      setColor(obj.color || "#cccccc");
      setMaterial?.(obj.material || "standard");
      setRotation([...(obj.rotation || [0, 0, 0])]);
      setPosition([...obj.position]);
      setPreviewPosition([...obj.position]);
    },
  });

  const { handleGroundPointerMove } = useEditorPreview({
    isDrawing,
    isDragging,
    previewPosition,
    setPreviewPosition,
    snapSize,
    size,
    rotation,
    color,
    handleBoxPointerMove,
  });

  const activeWaypointPos = waypointPreviewPos
    ? [waypointPreviewPos[0], waypointPreviewPos[1] + waypointHeight, waypointPreviewPos[2]]
    : null;

  return (
    <Physics gravity={[0, -Math.abs(gravity || 50.0), 0]}>
      <RigidBody type="fixed" colliders={false}>
        <CuboidCollider
          args={[150, 0.5, 150]}
          position={[0, -0.5, 0]}
          friction={0}
          restitution={0}
        />

        <mesh
          name="ground"
          position={[0, -0.5, 0]}
          receiveShadow
          onPointerUp={(e) => {
            if (props.handlePointerUp) props.handlePointerUp(e);
            if (!isDrawing) setIsDragging(false);
          }}
          onPointerMissed={() => {
            if (!isDragging && !placingWaypointForNpcId) {
              setSelectedObjectId(null);
            }
          }}
          onClick={(e) => {
            if (!placingWaypointForNpcId && !isDrawing && !isDragging) {
              setSelectedObjectId(null);
              setSelectedNpcId(null);
            }

            if (placingWaypointForNpcId && waypointPreviewPos) {
              e.stopPropagation();

              const pointWithHeight = [
                e.point.x,
                e.point.y + waypointHeight,
                e.point.z,
              ];

              setNpcs((prev) =>
                prev.map((n) => {
                  if (n.id !== placingWaypointForNpcId) return n;

                  const defaultWaitTime = n.movement?.waitTime ?? 0;
                  const newWaypoint = {
                    pos: pointWithHeight,
                    waitTime: defaultWaitTime,
                  };

                  return {
                    ...n,
                    waypoints: [...(n.waypoints || []), newWaypoint],
                  };
                })
              );

              setSelectedNpcId(placingWaypointForNpcId);
              setSelectedObjectId(null);
              return;
            }

            handleGroundClick(e);
          }}
          onPointerMove={(e) => {
            if (placingWaypointForNpcId && isShiftPressed.current) {
              e.stopPropagation();
              const movementY = e.movementY || 0;
              setWaypointHeight((prev) => Math.max(0.18, prev - movementY * 0.05));
            } else {
              handleGroundPointerMove(e);
              if (props.onPointerMove) {
                props.onPointerMove(e);
              }
            }
          }}
        >
          <boxGeometry args={[150, 1, 150]} />
          <meshStandardMaterial color="#fefefe" side={THREE.DoubleSide} />
        </mesh>
      </RigidBody>

      <gridHelper args={[150, 150]} />
      <EditorRuler size={150} />

      <SpaceGirl
        ref={girlRef}
        joystickDir={joystickDir}
        cameraMode={cameraMode}
        isJumping={isJumping}
        jumpVelocity={jumpVelocity}
      />

      {coins.map((c) => (
        <Coin key={c.id} position={c.pos} onCollect={() => collectCoin(c.id)} />
      ))}

      <EditorGizmo
        selectedMesh={
          selectedObjectId && objectRefs?.current
            ? objectRefs.current[selectedObjectId]?.mesh || null
            : null
        }
        selectedObjectId={selectedObjectId}
        setPlacedObjects={setPlacedObjects}
        objectRefs={objectRefs}
      />

      {placedObjects.map((obj) => (
        <React.Fragment key={obj.id}>
          {renderObject(obj, selectedObjectId, handleBoxPointerDown, objectRefs)}
        </React.Fragment>
      ))}

      {npcs?.map((npc, index) => {
        const isSelected = npc.id === selectedNpcId;
        const isEditingWaypointsForThisNpc = npc.id === placingWaypointForNpcId;
        const shouldShowWaypointHelpers = isSelected || isEditingWaypointsForThisNpc;

        return (
          <React.Fragment key={npc.id}>
            <NPCActor
              npc={npc}
              npcs={npcs}
              npcRefs={npcRefs}
              index={index}
              isSelected={isSelected}
              setSelectedNpcId={setSelectedNpcId}
              setSelectedObjectId={setSelectedObjectId}
              focusCameraOnNpc={focusCameraOnNpc}
              setNpcs={setNpcs}
              girlRef={girlRef}
              obstacleObjects={obstacleObjects}
              obstacleObjectsRef={obstacleObjectsRef}
              activeDialogueNpcId={activeDialogueNpcId}
              startDialogue={startDialogue}
              closeDialogue={closeDialogue}
            />

            {shouldShowWaypointHelpers && (
              <NPCWaypointHelpers
                npc={npc}
                selectedWaypointIndex={selectedWaypointIndex}
                setSelectedWaypointIndex={setSelectedWaypointIndex}
                setSelectedNpcId={setSelectedNpcId}
                setDraggingWaypoint={setDraggingWaypoint}
              />
            )}
          </React.Fragment>
        );
      })}

      {previewPosition &&
        renderPreview(previewPosition, size, rotation, color, objectType, material)}

      {npcPreviewPos && pendingNpc && (
        <mesh position={npcPreviewPos}>
          <capsuleGeometry args={[0.35, 1.2, 8, 16]} />
          <meshBasicMaterial color="#00ffff" transparent opacity={0.5} />
        </mesh>
      )}

      {activeWaypointPos &&
        placingWaypointForNpcId &&
        (() => {
          const targetNpc = npcs?.find((n) => n.id === placingWaypointForNpcId);
          const nextIndex = targetNpc ? (targetNpc.waypoints?.length || 0) + 1 : "?";

          return (
            <group position={activeWaypointPos}>
              <mesh>
                <sphereGeometry args={[0.22, 16, 16]} />
                <meshBasicMaterial
                  color="#ff3333"
                  transparent
                  opacity={0.7}
                  depthWrite={false}
                />
              </mesh>

              <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -waypointHeight, 0]}>
                <ringGeometry args={[0.35, 0.45, 32]} />
                <meshBasicMaterial
                  color="#ff3333"
                  transparent
                  opacity={0.5}
                  side={THREE.DoubleSide}
                  depthWrite={false}
                />
              </mesh>

              <Html
                position={[0, 0.4, 0]}
                center
                style={{
                  userSelect: "none",
                  pointerEvents: "none",
                  background: "#ff3333",
                  color: "#ffffff",
                  width: "20px",
                  height: "20px",
                  borderRadius: "50%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontFamily: "monospace, sans-serif",
                  fontWeight: "bold",
                  fontSize: "11px",
                  border: "2px solid white",
                  boxShadow: "0 2px 5px rgba(0,0,0,0.3)",
                  opacity: 0.9,
                }}
              >
                {nextIndex}
              </Html>

              {waypointHeight > 0.25 && (
                <Html
                  position={[0, -waypointHeight / 2, 0]}
                  center
                  style={{
                    pointerEvents: "none",
                    userSelect: "none",
                    background: "rgba(0,0,0,0.75)",
                    color: "#ff3333",
                    fontSize: "9px",
                    fontWeight: "bold",
                    padding: "2px 6px",
                    borderRadius: "4px",
                    whiteSpace: "nowrap",
                  }}
                >
                  H: {waypointHeight.toFixed(1)}m
                </Html>
              )}
            </group>
          );
        })()}

      <MapEditorInteraction />
    </Physics>
  );
}
