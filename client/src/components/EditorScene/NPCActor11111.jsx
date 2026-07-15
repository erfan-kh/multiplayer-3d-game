import React, { useEffect, useRef, useState, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { Html, Billboard } from "@react-three/drei";

const getWaypointPos = (waypoint) => {
  if (Array.isArray(waypoint)) return waypoint;
  if (waypoint && Array.isArray(waypoint.pos)) return waypoint.pos;
  return null;
};

const getWaypointWaitTime = (waypoint, fallbackWaitTime = 0) => {
  if (waypoint && !Array.isArray(waypoint) && typeof waypoint === "object") {
    return waypoint.waitTime ?? fallbackWaitTime;
  }
  return fallbackWaitTime;
};

const getNextPatrolWaypoint = (
  currentIndex,
  waypointCount,
  patrolMode,
  patrolDirection = 1
) => {
  if (waypointCount <= 1) {
    return {
      nextIndex: 0,
      nextDirection: patrolDirection
    };
  }

  let nextIndex = currentIndex;
  let nextDirection = patrolDirection;

  if (patrolMode === "pingpong") {
    if (currentIndex >= waypointCount - 1 && nextDirection === 1) {
      nextDirection = -1;
    } else if (currentIndex <= 0 && nextDirection === -1) {
      nextDirection = 1;
    }

    nextIndex = currentIndex + nextDirection;
    nextIndex = Math.max(0, Math.min(waypointCount - 1, nextIndex));
  } else {
    nextIndex = (currentIndex + 1) % waypointCount;
  }

  return {
    nextIndex,
    nextDirection
  };
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
  obstacleObjectsRef
}) {
  const groupRef = useRef();

  const [texture, setTexture] = useState(null);
  const [spriteAspect, setSpriteAspect] = useState(1);
  const [spriteReady, setSpriteReady] = useState(false);
  const [aiState, setAiState] = useState("Idle");

  const waitTimerRef = useRef(0);
  const stuckTimerRef = useRef(0);
  const detourDirectionRef = useRef(0);
  const frameCounter = useRef(0);
  const wanderTargetRef = useRef(null);
  const wanderOriginRef = useRef(null);
  const positionSyncTimerRef = useRef(0);
  const detectionTimerRef = useRef(0);
  const aiStateRef = useRef("Idle");
  const nearbyObstacleTimerRef = useRef(0);
  const nearbyObstaclesRef = useRef([]);
  const syncIntervalRef = useRef(1.1 + Math.random() * 0.5);

  // Automatic unstuck system
  const progressSampleTimerRef = useRef(0);
  const noProgressTimerRef = useRef(0);
  const lastProgressPositionRef = useRef(null);
  const lastSafePositionRef = useRef(null);
  const unstuckCooldownRef = useRef(0);
  const unstuckAttemptsRef = useRef(0);

  // Invalid/unreachable waypoint protection
  const blockedWaypointKeysRef = useRef(new Set());
  const waypointValidationCacheRef = useRef(new Map());
  const waypointValidationTimerRef = useRef(0);

  const detectedTargetRef = useRef({
    hasTarget: false,
    type: null,
    name: null,
    behavior: "look",
    distance: Infinity,
    x: 0,
    y: 0,
    z: 0
  });

  const raycaster = useMemo(() => new THREE.Raycaster(), []);
  const upVector = useMemo(() => new THREE.Vector3(0, 1, 0), []);
  const tempVec = useMemo(() => new THREE.Vector3(), []);
  const tempVec2 = useMemo(() => new THREE.Vector3(), []);
  const tempVec3 = useMemo(() => new THREE.Vector3(), []);
  const tempVec4 = useMemo(() => new THREE.Vector3(), []);
  const tempVec5 = useMemo(() => new THREE.Vector3(), []);
  const targetPosVec = useMemo(() => new THREE.Vector3(), []);
  const rayOriginVec = useMemo(() => new THREE.Vector3(), []);
  const predictedPosVec = useMemo(() => new THREE.Vector3(), []);
  const playerPosVec = useMemo(() => new THREE.Vector3(), []);
  const otherPosVec = useMemo(() => new THREE.Vector3(), []);
  const directionVec = useMemo(() => new THREE.Vector3(), []);
  const chosenDirectionVec = useMemo(() => new THREE.Vector3(), []);
  const flatLookTargetVec = useMemo(() => new THREE.Vector3(), []);
  const obstacleCenterVec = useMemo(() => new THREE.Vector3(), []);
  const obstacleWorldPosVec = useMemo(() => new THREE.Vector3(), []);
  const obstacleBox = useMemo(() => new THREE.Box3(), []);
  const lookMatrix = useMemo(() => new THREE.Matrix4(), []);
  const targetQuaternion = useMemo(() => new THREE.Quaternion(), []);

  const unstuckCandidateVec = useMemo(() => new THREE.Vector3(), []);
  const unstuckBestVec = useMemo(() => new THREE.Vector3(), []);
  const unstuckStartVec = useMemo(() => new THREE.Vector3(), []);

  const UNSTUCK_SAMPLE_INTERVAL = 0.35;
  const UNSTUCK_PROGRESS_DISTANCE = 0.08;
  const UNSTUCK_TRIGGER_TIME = 1.5;
  const UNSTUCK_COOLDOWN = 1.25;

  const WAYPOINT_RECHECK_INTERVAL = 1.0;
  const WAYPOINT_BLOCK_PADDING = 0.12;

  const cornerVectors = useMemo(
    () => [
      new THREE.Vector3(),
      new THREE.Vector3(),
      new THREE.Vector3(),
      new THREE.Vector3()
    ],
    []
  );

  const updateAiState = (nextState) => {
    if (aiStateRef.current !== nextState) {
      aiStateRef.current = nextState;
      setAiState(nextState);
    }
  };

  useEffect(() => {
    if (npc.textureUrl) {
      const loader = new THREE.TextureLoader();

      setSpriteReady(false);

      loader.load(
        npc.textureUrl,
        (loadedTex) => {
          loadedTex.minFilter = THREE.LinearFilter;
          loadedTex.magFilter = THREE.LinearFilter;
          loadedTex.generateMipmaps = false;
          loadedTex.colorSpace = THREE.SRGBColorSpace;

          const imageWidth = loadedTex.image?.width || 1;
          const imageHeight = loadedTex.image?.height || 1;
          const aspect = imageWidth / imageHeight;

          setTexture(loadedTex);
          setSpriteAspect(aspect > 0 ? aspect : 1);
          setSpriteReady(true);
        },
        undefined,
        (err) => {
          console.error("Failed to load NPC texture:", err);
          setTexture(null);
          setSpriteAspect(1);
          setSpriteReady(false);
        }
      );
    } else {
      setTexture(null);
      setSpriteAspect(1);
      setSpriteReady(false);
    }
  }, [npc.textureUrl]);

  useEffect(() => {
    if (!npcRefs || !npc?.id) return;

    npcRefs.current[npc.id] = groupRef;

    return () => {
      if (npcRefs.current[npc.id] === groupRef) {
        delete npcRefs.current[npc.id];
      }
    };
  }, [npcRefs, npc?.id]);

  useEffect(() => {
    if (!groupRef.current || !Array.isArray(npc.position)) return;

    const targetX = npc.position[0] ?? 0;
    const targetY = npc.position[1] ?? 0;
    const targetZ = npc.position[2] ?? 0;

    const dx = groupRef.current.position.x - targetX;
    const dy = groupRef.current.position.y - targetY;
    const dz = groupRef.current.position.z - targetZ;
    const distSq = dx * dx + dy * dy + dz * dz;

    if (distSq > 1.0) {
      groupRef.current.position.set(targetX, targetY, targetZ);
    }
  }, [npc.id, npc.position]);

  useEffect(() => {
    wanderTargetRef.current = null;
    waitTimerRef.current = 0;
    stuckTimerRef.current = 0;
    detourDirectionRef.current = 0;
    positionSyncTimerRef.current = 0;
    detectionTimerRef.current = 0;
    nearbyObstacleTimerRef.current = 0;
    nearbyObstaclesRef.current = [];
    syncIntervalRef.current = 1.1 + Math.random() * 0.5;

    progressSampleTimerRef.current = 0;
    noProgressTimerRef.current = 0;
    unstuckCooldownRef.current = 0;
    unstuckAttemptsRef.current = 0;

    blockedWaypointKeysRef.current.clear();
    waypointValidationCacheRef.current.clear();
    waypointValidationTimerRef.current = 0;

    if (Array.isArray(npc.position)) {
      const x = npc.position[0] ?? 0;
      const y = npc.position[1] ?? 0;
      const z = npc.position[2] ?? 0;

      lastProgressPositionRef.current = new THREE.Vector3(x, y, z);
      lastSafePositionRef.current = new THREE.Vector3(x, y, z);
    } else {
      lastProgressPositionRef.current = null;
      lastSafePositionRef.current = null;
    }

    aiStateRef.current = "Idle";
    setAiState("Idle");
  }, [npc.movement?.mode, npc.movement?.type, npc.id, npc.waypoints]);

  useEffect(() => {
    if (Array.isArray(npc.position)) {
      wanderOriginRef.current = [...npc.position];
    }
  }, [npc.id, npc.position]);

  useFrame((_, delta) => {
    const group = groupRef.current;
    if (!group) return;

    frameCounter.current += 1;
    positionSyncTimerRef.current += delta;
    detectionTimerRef.current += delta;
    nearbyObstacleTimerRef.current += delta;
    waypointValidationTimerRef.current += delta;

    if (unstuckCooldownRef.current > 0) {
      unstuckCooldownRef.current = Math.max(0, unstuckCooldownRef.current - delta);
    }

    if (waypointValidationTimerRef.current >= WAYPOINT_RECHECK_INTERVAL) {
      waypointValidationTimerRef.current = 0;
      waypointValidationCacheRef.current.clear();
      blockedWaypointKeysRef.current.clear();
    }

    const currentPos = group.position;
    const movementMode = npc.movement?.mode || npc.movement?.type || "idle";
    const detectionRadius = npc.detection?.radius ?? 6;
    const behaviorMode = npc.detection?.behavior || "look";
    const targetType = npc.detection?.targetType || "both";
    const stopDistance = npc.detection?.stopDistance ?? 0.8;
    const debugDetection = npc.detection?.debug ?? false;
    const reactions = npc.detection?.reactions || {};

    const activeObstacleObjects = obstacleObjectsRef?.current?.length
      ? obstacleObjectsRef.current
      : obstacleObjects;

    const isWaypointInsideObstacle = (
      waypointPosition,
      waypointIndex,
      extraPadding = WAYPOINT_BLOCK_PADDING
    ) => {
      if (
        !Array.isArray(waypointPosition) ||
        waypointPosition.length < 3 ||
        !activeObstacleObjects?.length
      ) {
        return false;
      }

      const x = waypointPosition[0] ?? 0;
      const y = waypointPosition[1] ?? 0;
      const z = waypointPosition[2] ?? 0;

      const waypointKey = `${waypointIndex}:${x.toFixed(3)}:${y.toFixed(3)}:${z.toFixed(3)}`;

      if (waypointValidationCacheRef.current.has(waypointKey)) {
        return waypointValidationCacheRef.current.get(waypointKey);
      }

      const npcRadius = npc.collision?.radius ?? 0.42;
      const npcHeight = npc.collision?.height ?? 1.35;
      const collisionPadding = npc.collision?.padding ?? 0.08;
      const checkRadius = npcRadius + collisionPadding + extraPadding;

      const npcMinY = y + 0.05;
      const npcMaxY = y + npcHeight;

      let blocked = false;

      for (const obstacle of activeObstacleObjects) {
        if (!obstacle || obstacle.visible === false) continue;

        obstacle.updateWorldMatrix?.(true, false);
        obstacleBox.setFromObject(obstacle);

        if (obstacleBox.isEmpty()) continue;

        const verticallyOverlapping =
          npcMaxY >= obstacleBox.min.y && npcMinY <= obstacleBox.max.y;

        if (!verticallyOverlapping) continue;

        const horizontallyBlocked =
          x >= obstacleBox.min.x - checkRadius &&
          x <= obstacleBox.max.x + checkRadius &&
          z >= obstacleBox.min.z - checkRadius &&
          z <= obstacleBox.max.z + checkRadius;

        if (horizontallyBlocked) {
          blocked = true;
          break;
        }
      }

      waypointValidationCacheRef.current.set(waypointKey, blocked);

      if (blocked) {
        blockedWaypointKeysRef.current.add(waypointKey);
      } else {
        blockedWaypointKeysRef.current.delete(waypointKey);
      }

      return blocked;
    };

    let detectedTargetPos = null;
    let detectedTargetType = null;
    let detectedTargetName = null;
    let nearestTargetDistance = Infinity;
    let detectedBehavior = behaviorMode;

    if (detectionTimerRef.current >= 0.25) {
      detectionTimerRef.current = 0;

      detectedTargetRef.current.hasTarget = false;
      detectedTargetRef.current.type = null;
      detectedTargetRef.current.name = null;
      detectedTargetRef.current.behavior = behaviorMode;
      detectedTargetRef.current.distance = Infinity;

      const getPriority = (behavior) => {
        if (behavior === "chase" || behavior === "attack") return 3;
        if (behavior === "flee") return 2;
        if (behavior === "look") return 1;
        return 0;
      };

      let bestPriority = -1;

      if ((targetType === "player" || targetType === "both") && girlRef?.current) {
        girlRef.current.getWorldPosition(playerPosVec);

        const distanceToPlayer = currentPos.distanceTo(playerPosVec);
        if (distanceToPlayer <= detectionRadius) {
          const playerBehavior = reactions["player"] ?? behaviorMode;
          const playerPriority = getPriority(playerBehavior);

          if (playerBehavior !== "ignore") {
            detectedTargetRef.current.hasTarget = true;
            detectedTargetRef.current.type = "player";
            detectedTargetRef.current.name = "Player";
            detectedTargetRef.current.behavior = playerBehavior;
            detectedTargetRef.current.distance = distanceToPlayer;
            targetPosVec.copy(playerPosVec);
            bestPriority = playerPriority;
          }
        }
      }

      if (
        (targetType === "npc" || targetType === "npcs" || targetType === "both") &&
        Array.isArray(npcs) &&
        npcs.length > 1
      ) {
        for (const otherNpc of npcs) {
          if (!otherNpc || otherNpc.id === npc.id) continue;

          const otherRef = npcRefs?.current?.[otherNpc.id];
          const otherGroup = otherRef?.current;

          if (otherGroup) {
            otherGroup.getWorldPosition(otherPosVec);
          } else if (Array.isArray(otherNpc.position) && otherNpc.position.length >= 3) {
            otherPosVec.set(
              otherNpc.position[0] ?? 0,
              otherNpc.position[1] ?? 0,
              otherNpc.position[2] ?? 0
            );
          } else {
            continue;
          }

          const dist = currentPos.distanceTo(otherPosVec);
          if (dist <= detectionRadius) {
            const npcBehavior = reactions[otherNpc.id] ?? behaviorMode;
            const npcPriority = getPriority(npcBehavior);

            if (npcBehavior === "ignore") continue;

            if (
              npcPriority > bestPriority ||
              (npcPriority === bestPriority && dist < detectedTargetRef.current.distance)
            ) {
              detectedTargetRef.current.hasTarget = true;
              detectedTargetRef.current.type = "npc";
              detectedTargetRef.current.name = otherNpc.name || otherNpc.id;
              detectedTargetRef.current.behavior = npcBehavior;
              detectedTargetRef.current.distance = dist;
              targetPosVec.copy(otherPosVec);
              bestPriority = npcPriority;
            }
          }
        }
      }

      if (detectedTargetRef.current.hasTarget) {
        detectedTargetRef.current.x = targetPosVec.x;
        detectedTargetRef.current.y = targetPosVec.y;
        detectedTargetRef.current.z = targetPosVec.z;
      }
    }

    if (detectedTargetRef.current.hasTarget) {
      tempVec.set(
        detectedTargetRef.current.x,
        detectedTargetRef.current.y,
        detectedTargetRef.current.z
      );
      detectedTargetPos = tempVec;
      detectedTargetType = detectedTargetRef.current.type;
      detectedTargetName = detectedTargetRef.current.name;
      nearestTargetDistance = detectedTargetRef.current.distance;
      detectedBehavior = detectedTargetRef.current.behavior || behaviorMode;
    }

    if (debugDetection && detectedTargetPos && frameCounter.current % 90 === 0) {
      console.log(
        `${npc.name || npc.id} detected ${detectedTargetType} ${detectedTargetName} at distance ${nearestTargetDistance.toFixed(2)} with behavior ${detectedBehavior}`
      );
    }

    let targetX = currentPos.x;
    let targetY = currentPos.y;
    let targetZ = currentPos.z;
    let isMoving = false;
    let isTargetReached = false;
    let waypointIndexToSet = null;
    let waypointDirectionToSet = null;

    const activeBehavior = detectedTargetRef.current.hasTarget
      ? detectedTargetRef.current.behavior || behaviorMode
      : behaviorMode;

    if (detectedTargetPos && activeBehavior !== "ignore") {
      wanderTargetRef.current = null;

      if (activeBehavior === "chase" || activeBehavior === "attack") {
        updateAiState("Chasing");

        targetX = detectedTargetPos.x;
        targetY = currentPos.y;
        targetZ = detectedTargetPos.z;

        targetPosVec.set(targetX, targetY, targetZ);
        const distance = currentPos.distanceTo(targetPosVec);

        if (distance > stopDistance) {
          isMoving = true;
        } else {
          flatLookTargetVec.set(detectedTargetPos.x, currentPos.y, detectedTargetPos.z);
          targetQuaternion.setFromRotationMatrix(
            lookMatrix.lookAt(currentPos, flatLookTargetVec, upVector)
          );
          group.quaternion.slerp(targetQuaternion, Math.min(1, 10 * delta));
          return;
        }
      } else if (activeBehavior === "flee") {
        updateAiState("Alerted");

        tempVec2.subVectors(currentPos, detectedTargetPos).setY(0);

        if (tempVec2.lengthSq() > 0.0001) {
          tempVec2.normalize();
          targetX = currentPos.x + tempVec2.x * detectionRadius;
          targetY = currentPos.y;
          targetZ = currentPos.z + tempVec2.z * detectionRadius;
          isMoving = true;
        } else {
          return;
        }
      } else {
        updateAiState("Alerted");

        flatLookTargetVec.set(detectedTargetPos.x, currentPos.y, detectedTargetPos.z);
        targetQuaternion.setFromRotationMatrix(
          lookMatrix.lookAt(currentPos, flatLookTargetVec, upVector)
        );
        group.quaternion.slerp(targetQuaternion, Math.min(1, 10 * delta));
        return;
      }
    } else {
      if (movementMode === "idle" || movementMode === "static") {
        wanderTargetRef.current = null;
        updateAiState("Idle");
        return;
      }

      if (movementMode === "wander") {
        updateAiState("Patrolling");

        const wanderRadius = npc.movement?.wanderRadius ?? npc.wanderRadius ?? 5;

        if (!wanderOriginRef.current) {
          wanderOriginRef.current = [currentPos.x, currentPos.y, currentPos.z];
        }

        if (waitTimerRef.current > 0) {
          waitTimerRef.current -= delta;
          noProgressTimerRef.current = 0;
          progressSampleTimerRef.current = 0;

          if (lastProgressPositionRef.current) {
            lastProgressPositionRef.current.copy(currentPos);
          }

          return;
        }

        if (!wanderTargetRef.current) {
          const angle = Math.random() * Math.PI * 2;
          const distance = Math.max(0.75, Math.random() * wanderRadius);
          const origin = wanderOriginRef.current;

          wanderTargetRef.current = [
            origin[0] + Math.cos(angle) * distance,
            currentPos.y,
            origin[2] + Math.sin(angle) * distance
          ];
        }

        targetX = wanderTargetRef.current[0];
        targetY = wanderTargetRef.current[1];
        targetZ = wanderTargetRef.current[2];

        targetPosVec.set(targetX, targetY, targetZ);

        if (currentPos.distanceTo(targetPosVec) <= 0.2) {
          wanderTargetRef.current = null;
          waitTimerRef.current = npc.movement?.waitTime ?? 1;
          return;
        }

        isMoving = true;
      } else if (movementMode === "patrol") {
        wanderTargetRef.current = null;

        const shouldPatrol = npc.isPatrolling ?? true;
        if (!shouldPatrol) {
          updateAiState("Idle");
          return;
        }

        if (!Array.isArray(npc.waypoints) || npc.waypoints.length === 0) {
          updateAiState("Idle");
          return;
        }

        if (waitTimerRef.current > 0) {
          updateAiState("Idle");
          waitTimerRef.current -= delta;
          noProgressTimerRef.current = 0;
          progressSampleTimerRef.current = 0;

          if (lastProgressPositionRef.current) {
            lastProgressPositionRef.current.copy(currentPos);
          }

          return;
        }

        updateAiState("Patrolling");

        let currentIndex = npc.currentWaypointIndex ?? 0;
        if (currentIndex < 0 || currentIndex >= npc.waypoints.length) {
          currentIndex = 0;
        }

        let currentDirection = npc.patrolDirection ?? 1;
        let targetWaypoint = null;
        let target = null;
        let foundValidWaypoint = false;

        for (
          let checkedCount = 0;
          checkedCount < npc.waypoints.length;
          checkedCount += 1
        ) {
          const candidateWaypoint = npc.waypoints[currentIndex];
          const candidatePosition = getWaypointPos(candidateWaypoint);

          if (
            candidatePosition &&
            !isWaypointInsideObstacle(candidatePosition, currentIndex)
          ) {
            targetWaypoint = candidateWaypoint;
            target = candidatePosition;
            foundValidWaypoint = true;
            break;
          }

          if (debugDetection) {
            console.warn(
              `[NPC Patrol] ${npc.name || npc.id} skipped blocked waypoint ${currentIndex}`,
              candidatePosition
            );
          }

          const nextPatrol = getNextPatrolWaypoint(
            currentIndex,
            npc.waypoints.length,
            npc.patrolMode,
            currentDirection
          );

          if (nextPatrol.nextIndex === currentIndex) {
            break;
          }

          currentIndex = nextPatrol.nextIndex;
          currentDirection = nextPatrol.nextDirection;
        }

        if (!foundValidWaypoint || !target) {
          updateAiState("Idle");

          noProgressTimerRef.current = 0;
          progressSampleTimerRef.current = 0;
          stuckTimerRef.current = 0;
          detourDirectionRef.current = 0;

          if (lastProgressPositionRef.current) {
            lastProgressPositionRef.current.copy(currentPos);
          }

          if (debugDetection && frameCounter.current % 120 === 0) {
            console.warn(
              `[NPC Patrol] ${npc.name || npc.id} has no valid reachable waypoints`
            );
          }

          return;
        }

        if (
          currentIndex !== (npc.currentWaypointIndex ?? 0) ||
          currentDirection !== (npc.patrolDirection ?? 1)
        ) {
          setNpcs((prev) =>
            prev.map((n) =>
              n.id === npc.id
                ? {
                    ...n,
                    currentWaypointIndex: currentIndex,
                    patrolDirection: currentDirection
                  }
                : n
            )
          );

          noProgressTimerRef.current = 0;
          progressSampleTimerRef.current = 0;
          stuckTimerRef.current = 0;
          detourDirectionRef.current = 0;
          return;
        }

        targetX = target[0] ?? currentPos.x;
        targetY = target[1] ?? currentPos.y;
        targetZ = target[2] ?? currentPos.z;

        targetPosVec.set(targetX, targetY, targetZ);
        const distance = currentPos.distanceTo(targetPosVec);

        if (distance <= 0.15) {
          currentPos.set(targetX, targetY, targetZ);

          const nodeWaitTime = getWaypointWaitTime(
            targetWaypoint,
            npc.movement?.waitTime ?? 0
          );

          if (nodeWaitTime > 0) {
            waitTimerRef.current = nodeWaitTime;
          }

          const nextPatrol = getNextPatrolWaypoint(
            currentIndex,
            npc.waypoints.length,
            npc.patrolMode,
            currentDirection
          );

          isTargetReached = true;
          waypointIndexToSet = nextPatrol.nextIndex;
          waypointDirectionToSet = nextPatrol.nextDirection;
        } else {
          isMoving = true;
        }
      } else {
        updateAiState("Idle");
        return;
      }
    }

    if (isTargetReached && waypointIndexToSet !== null) {
      setNpcs((prev) =>
        prev.map((n) =>
          n.id === npc.id
            ? {
                ...n,
                position: [targetX, targetY, targetZ],
                currentWaypointIndex: waypointIndexToSet,
                patrolDirection: waypointDirectionToSet
              }
            : n
        )
      );
      positionSyncTimerRef.current = 0;
      syncIntervalRef.current = 1.1 + Math.random() * 0.5;
      return;
    }

    if (isMoving) {
      const speed = Math.max(0, npc.movement?.speed ?? 2);
      if (speed <= 0) return;

      targetPosVec.set(targetX, targetY, targetZ);

      directionVec.subVectors(targetPosVec, currentPos);
      const distanceToTarget = directionVec.length();
      if (distanceToTarget < 0.0001) return;
      directionVec.divideScalar(distanceToTarget);

      const npcRadius = npc.collision?.radius ?? 0.42;
      const npcHeight = npc.collision?.height ?? 1.35;
      const collisionPadding = npc.collision?.padding ?? 0.08;
      const moveStep = Math.min(speed * delta, distanceToTarget);
      const raycastDist = Math.max(1.1, moveStep + npcRadius + 0.65);

      if (nearbyObstacleTimerRef.current >= 0.2) {
        nearbyObstacleTimerRef.current = 0;

        if (activeObstacleObjects?.length) {
          const nearby = [];
          const maxDistSq = 12 * 12;

          for (const obj of activeObstacleObjects) {
            if (!obj || obj.visible === false) continue;
            obj.getWorldPosition?.(obstacleWorldPosVec);
            if (currentPos.distanceToSquared(obstacleWorldPosVec) <= maxDistSq) {
              nearby.push(obj);
            }
          }

          nearbyObstaclesRef.current = nearby;
        } else {
          nearbyObstaclesRef.current = [];
        }
      }

      const nearbyObstacles = nearbyObstaclesRef.current;

      const isPositionFree = (position, extraPadding = 0.03) => {
        if (!nearbyObstacles || nearbyObstacles.length === 0) {
          return true;
        }

        const checkRadius = npcRadius + collisionPadding + extraPadding;
        const npcMinY = position.y + 0.05;
        const npcMaxY = position.y + npcHeight;

        for (const obstacle of nearbyObstacles) {
          if (!obstacle || obstacle.visible === false) continue;

          obstacle.updateWorldMatrix?.(true, false);
          obstacleBox.setFromObject(obstacle);

          if (obstacleBox.isEmpty()) continue;

          if (npcMaxY < obstacleBox.min.y || npcMinY > obstacleBox.max.y) {
            continue;
          }

          if (
            position.x >= obstacleBox.min.x - checkRadius &&
            position.x <= obstacleBox.max.x + checkRadius &&
            position.z >= obstacleBox.min.z - checkRadius &&
            position.z <= obstacleBox.max.z + checkRadius
          ) {
            return false;
          }
        }

        return true;
      };

      if (isPositionFree(currentPos, 0.01)) {
        if (!lastSafePositionRef.current) {
          lastSafePositionRef.current = currentPos.clone();
        } else {
          lastSafePositionRef.current.copy(currentPos);
        }
      }

      progressSampleTimerRef.current += delta;

      if (!lastProgressPositionRef.current) {
        lastProgressPositionRef.current = currentPos.clone();
      }

      if (progressSampleTimerRef.current >= UNSTUCK_SAMPLE_INTERVAL) {
        const sampleTime = progressSampleTimerRef.current;
        progressSampleTimerRef.current = 0;

        const movedDistance = currentPos.distanceTo(lastProgressPositionRef.current);

        if (movedDistance >= UNSTUCK_PROGRESS_DISTANCE) {
          noProgressTimerRef.current = 0;
          unstuckAttemptsRef.current = 0;
        } else if (unstuckCooldownRef.current <= 0) {
          noProgressTimerRef.current += sampleTime;
        }

        lastProgressPositionRef.current.copy(currentPos);
      }

      if (
        noProgressTimerRef.current >= UNSTUCK_TRIGGER_TIME &&
        unstuckCooldownRef.current <= 0
      ) {
        unstuckAttemptsRef.current += 1;
        unstuckStartVec.copy(currentPos);

        let foundRecoveryPosition = false;
        let bestRecoveryScore = Infinity;

        const attemptBonus = Math.min(unstuckAttemptsRef.current - 1, 3) * 0.35;
        const searchRadii = [
          npcRadius * 2 + 0.2 + attemptBonus,
          npcRadius * 3 + 0.45 + attemptBonus,
          npcRadius * 4 + 0.75 + attemptBonus
        ];

        const baseAngle = Math.atan2(directionVec.z, directionVec.x);

        for (const radius of searchRadii) {
          const candidateCount = 16;

          for (let candidateIndex = 0; candidateIndex < candidateCount; candidateIndex += 1) {
            const alternatingOffset =
              candidateIndex === 0
                ? Math.PI / 2
                : candidateIndex === 1
                ? -Math.PI / 2
                : (candidateIndex / candidateCount) * Math.PI * 2;

            const angle = baseAngle + alternatingOffset;

            unstuckCandidateVec.set(
              unstuckStartVec.x + Math.cos(angle) * radius,
              unstuckStartVec.y,
              unstuckStartVec.z + Math.sin(angle) * radius
            );

            if (!isPositionFree(unstuckCandidateVec, 0.08)) {
              continue;
            }

            const targetScore = unstuckCandidateVec.distanceToSquared(targetPosVec);
            const recoveryDistancePenalty =
              unstuckCandidateVec.distanceToSquared(unstuckStartVec) * 0.15;
            const score = targetScore + recoveryDistancePenalty;

            if (score < bestRecoveryScore) {
              bestRecoveryScore = score;
              unstuckBestVec.copy(unstuckCandidateVec);
              foundRecoveryPosition = true;
            }
          }
        }

        if (
          !foundRecoveryPosition &&
          lastSafePositionRef.current &&
          isPositionFree(lastSafePositionRef.current, 0.08)
        ) {
          unstuckBestVec.copy(lastSafePositionRef.current);
          foundRecoveryPosition = true;
        }

        const activePatrolIndex = npc.currentWaypointIndex ?? 0;
        const activePatrolWaypoint =
          movementMode === "patrol"
            ? npc.waypoints?.[activePatrolIndex]
            : null;

        const activePatrolPosition = getWaypointPos(activePatrolWaypoint);

        const activeWaypointIsBlocked =
          movementMode === "patrol" &&
          activePatrolPosition &&
          isWaypointInsideObstacle(activePatrolPosition, activePatrolIndex);

        if (activeWaypointIsBlocked) {
          const nextPatrol = getNextPatrolWaypoint(
            activePatrolIndex,
            npc.waypoints.length,
            npc.patrolMode,
            npc.patrolDirection ?? 1
          );

          stuckTimerRef.current = 0;
          detourDirectionRef.current = 0;
          noProgressTimerRef.current = 0;
          progressSampleTimerRef.current = 0;
          unstuckAttemptsRef.current = 0;
          unstuckCooldownRef.current = UNSTUCK_COOLDOWN;

          if (foundRecoveryPosition) {
            currentPos.copy(unstuckBestVec);
            lastProgressPositionRef.current.copy(currentPos);

            if (!lastSafePositionRef.current) {
              lastSafePositionRef.current = currentPos.clone();
            } else {
              lastSafePositionRef.current.copy(currentPos);
            }
          }

          setNpcs((prev) =>
            prev.map((n) =>
              n.id === npc.id
                ? {
                    ...n,
                    position: [currentPos.x, currentPos.y, currentPos.z],
                    currentWaypointIndex: nextPatrol.nextIndex,
                    patrolDirection: nextPatrol.nextDirection
                  }
                : n
            )
          );

          if (debugDetection) {
            console.warn(
              `[NPC Patrol] ${npc.name || npc.id} abandoned unreachable waypoint ${activePatrolIndex}`
            );
          }

          return;
        }

        if (foundRecoveryPosition) {
          currentPos.copy(unstuckBestVec);

          stuckTimerRef.current = 0;
          detourDirectionRef.current = 0;
          noProgressTimerRef.current = 0;
          progressSampleTimerRef.current = 0;
          unstuckCooldownRef.current = UNSTUCK_COOLDOWN;

          lastProgressPositionRef.current.copy(currentPos);

          if (!lastSafePositionRef.current) {
            lastSafePositionRef.current = currentPos.clone();
          } else {
            lastSafePositionRef.current.copy(currentPos);
          }

          if (movementMode === "wander") {
            wanderTargetRef.current = null;
            waitTimerRef.current = 0;
          }

          setNpcs((prev) =>
            prev.map((n) =>
              n.id === npc.id
                ? {
                    ...n,
                    position: [currentPos.x, currentPos.y, currentPos.z]
                  }
                : n
            )
          );

          positionSyncTimerRef.current = 0;
          syncIntervalRef.current = 1.1 + Math.random() * 0.5;

          if (debugDetection) {
            console.warn(`[NPC Unstuck] ${npc.name || npc.id} recovered automatically`, {
              attempt: unstuckAttemptsRef.current,
              from: unstuckStartVec.toArray(),
              to: currentPos.toArray()
            });
          }

          return;
        }

        noProgressTimerRef.current = UNSTUCK_TRIGGER_TIME * 0.6;
        unstuckCooldownRef.current = 0.5;
      }

      rayOriginVec.copy(currentPos).addScaledVector(upVector, 0.75);
      raycaster.far = raycastDist;

      let closestBlocker = null;
      let minBlockerDist = Infinity;

      const isDirectionBlocked = (testDirection) => {
        if (!nearbyObstacles || nearbyObstacles.length === 0) return false;

        raycaster.set(rayOriginVec, testDirection);
        const intersections = raycaster.intersectObjects(nearbyObstacles, true);

        if (intersections.length > 0 && intersections[0].distance <= raycastDist) {
          closestBlocker = intersections[0].object;
          return true;
        }

        predictedPosVec
          .copy(currentPos)
          .addScaledVector(testDirection, moveStep + npcRadius + collisionPadding);

        const npcMinY = currentPos.y + 0.05;
        const npcMaxY = currentPos.y + npcHeight;

        for (const obstacle of nearbyObstacles) {
          if (!obstacle || obstacle.visible === false) continue;

          obstacle.updateWorldMatrix?.(true, false);
          obstacleBox.setFromObject(obstacle);
          if (obstacleBox.isEmpty()) continue;

          obstacleBox.expandByScalar(npcRadius + collisionPadding);

          if (!(npcMaxY >= obstacleBox.min.y && npcMinY <= obstacleBox.max.y)) continue;

          if (
            predictedPosVec.x >= obstacleBox.min.x &&
            predictedPosVec.x <= obstacleBox.max.x &&
            predictedPosVec.z >= obstacleBox.min.z &&
            predictedPosVec.z <= obstacleBox.max.z
          ) {
            obstacleBox.getCenter(obstacleCenterVec);
            const dist = currentPos.distanceToSquared(obstacleCenterVec);

            if (dist < minBlockerDist) {
              minBlockerDist = dist;
              closestBlocker = obstacle;
            }
            return true;
          }
        }

        return false;
      };

      chosenDirectionVec.copy(directionVec);

      if (isDirectionBlocked(directionVec)) {
        stuckTimerRef.current += delta;

        if (detourDirectionRef.current === 0) {
          if (closestBlocker) {
            closestBlocker.updateWorldMatrix?.(true, false);
            obstacleBox.setFromObject(closestBlocker);
            obstacleBox.getCenter(obstacleCenterVec);

            tempVec2.set(-directionVec.z, 0, directionVec.x);
            tempVec3.subVectors(obstacleCenterVec, currentPos);

            detourDirectionRef.current = tempVec3.dot(tempVec2) > 0 ? -1 : 1;
          } else {
            detourDirectionRef.current = Math.random() > 0.5 ? 1 : -1;
          }
        }

        const sign = detourDirectionRef.current;
        const steerAngles =
          stuckTimerRef.current > 0.4
            ? [
                sign * Math.PI / 3,
                sign * Math.PI / 2,
                sign * (Math.PI * 0.75),
                -sign * Math.PI / 3,
                -sign * Math.PI / 2,
                -sign * (Math.PI * 0.75),
                Math.PI
              ]
            : [
                sign * Math.PI / 6,
                sign * Math.PI / 4,
                sign * Math.PI / 3,
                sign * Math.PI / 2,
                -sign * Math.PI / 6,
                -sign * Math.PI / 4,
                -sign * Math.PI / 3,
                -sign * Math.PI / 2
              ];

        let foundClearDirection = false;

        for (const angle of steerAngles) {
          tempVec4.copy(directionVec).applyAxisAngle(upVector, angle).normalize();

          if (!isDirectionBlocked(tempVec4)) {
            chosenDirectionVec.copy(tempVec4);
            foundClearDirection = true;
            break;
          }
        }

        if (!foundClearDirection && closestBlocker) {
          closestBlocker.updateWorldMatrix?.(true, false);
          obstacleBox.setFromObject(closestBlocker);
          obstacleBox.expandByScalar(npcRadius + 0.1);

          cornerVectors[0].set(obstacleBox.min.x, currentPos.y, obstacleBox.min.z);
          cornerVectors[1].set(obstacleBox.max.x, currentPos.y, obstacleBox.min.z);
          cornerVectors[2].set(obstacleBox.min.x, currentPos.y, obstacleBox.max.z);
          cornerVectors[3].set(obstacleBox.max.x, currentPos.y, obstacleBox.max.z);

          let bestCorner = null;
          let bestScore = Infinity;

          for (const corner of cornerVectors) {
            tempVec5.subVectors(corner, currentPos);
            if (tempVec5.lengthSq() < 0.0001) continue;

            tempVec4.copy(tempVec5).normalize();

            if (!isDirectionBlocked(tempVec4)) {
              const distToTarget = corner.distanceToSquared(targetPosVec);
              if (distToTarget < bestScore) {
                bestScore = distToTarget;
                bestCorner = corner;
              }
            }
          }

          if (bestCorner) {
            chosenDirectionVec.subVectors(bestCorner, currentPos).normalize();
            foundClearDirection = true;
          }
        }

        if (!foundClearDirection) {
          if (stuckTimerRef.current > 1.2) {
            tempVec4
              .copy(directionVec)
              .applyAxisAngle(upVector, sign * Math.PI * 0.75)
              .normalize();

            if (!isDirectionBlocked(tempVec4)) {
              chosenDirectionVec.copy(tempVec4);
            } else {
              chosenDirectionVec.set(0, 0, 0);
            }
          } else {
            chosenDirectionVec.set(0, 0, 0);
          }
        }
      } else {
        stuckTimerRef.current = 0;
        detourDirectionRef.current = 0;
      }

      if (chosenDirectionVec.lengthSq() > 0.001) {
        currentPos.addScaledVector(chosenDirectionVec, moveStep);

        if (positionSyncTimerRef.current >= syncIntervalRef.current) {
          positionSyncTimerRef.current = 0;
          syncIntervalRef.current = 1.1 + Math.random() * 0.5;

          const lastSaved = npc.position || [0, 0, 0];
          const dx = currentPos.x - lastSaved[0];
          const dy = currentPos.y - lastSaved[1];
          const dz = currentPos.z - lastSaved[2];
          const movedSq = dx * dx + dy * dy + dz * dz;

          if (movedSq > 0.04) {
            setNpcs((prev) =>
              prev.map((n) =>
                n.id === npc.id
                  ? {
                      ...n,
                      position: [currentPos.x, currentPos.y, currentPos.z]
                    }
                  : n
              )
            );
          }
        }

        flatLookTargetVec.set(
          currentPos.x + chosenDirectionVec.x,
          currentPos.y,
          currentPos.z + chosenDirectionVec.z
        );

        targetQuaternion.setFromRotationMatrix(
          lookMatrix.lookAt(currentPos, flatLookTargetVec, upVector)
        );
        group.quaternion.slerp(targetQuaternion, Math.min(1, 8 * delta));
      }
    }
  });

  const getStateColor = () => {
    switch (aiState) {
      case "Alerted":
        return "#ef4444";
      case "Chasing":
        return "#b91c1c";
      case "Patrolling":
        return "#10b981";
      default:
        return "#64748b";
    }
  };

  const handleNpcClick = (e) => {
    e.stopPropagation();
    setSelectedNpcId(npc.id);
    setSelectedObjectId(null);
    if (focusCameraOnNpc) focusCameraOnNpc(npc.position);
  };

  const spriteHeight = npc.spriteHeight ?? 1.4;
  const spriteWidth = spriteHeight * spriteAspect;

  return (
    <group
      ref={groupRef}
      position={npc.position}
      rotation={npc.rotation || [0, 0, 0]}
      scale={npc.scale || [1, 1, 1]}
    >
      <Html
        position={[0, 1.5, 0]}
        center
        distanceFactor={12}
        style={{
          userSelect: "none",
          pointerEvents: "none",
          background: isSelected ? "rgba(234, 179, 8, 0.95)" : "rgba(15, 23, 42, 0.85)",
          color: isSelected ? "#0f172a" : "#ffffff",
          padding: "4px 10px",
          borderRadius: "6px",
          fontSize: "11px",
          fontWeight: "bold",
          fontFamily: "sans-serif",
          whiteSpace: "nowrap",
          border: isSelected ? "1.5px solid #ffffff" : "1.5px solid rgba(255,255,255,0.15)",
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

      {texture && spriteReady ? (
        <Billboard follow lockX={true} lockY={false} lockZ={true}>
          <mesh castShadow receiveShadow onClick={handleNpcClick}>
            <planeGeometry args={[spriteWidth, spriteHeight]} />
            <meshBasicMaterial
              map={texture}
              transparent
              alphaTest={0.5}
              side={THREE.DoubleSide}
              color={isSelected ? "#fff7cc" : "#ffffff"}
            />
          </mesh>
        </Billboard>
      ) : (
        <mesh castShadow receiveShadow onClick={handleNpcClick}>
          <capsuleGeometry args={[0.35, 1.2, 8, 16]} />
          <meshStandardMaterial
            color={
              isSelected
                ? "#ffff00"
                : aiState === "Alerted" || aiState === "Chasing"
                ? "#ef4444"
                : "#ff8844"
            }
            emissive={
              isSelected
                ? "#ffaa00"
                : aiState === "Alerted" || aiState === "Chasing"
                ? "#7f1d1d"
                : "#000000"
            }
            emissiveIntensity={isSelected ? 0.6 : 0.2}
          />
        </mesh>
      )}

      {isSelected && (
        <mesh>
          <sphereGeometry args={[npc.detection?.radius || 3, 20, 14]} />
          <meshBasicMaterial
            color={aiState === "Alerted" || aiState === "Chasing" ? "#ff0000" : "#4da6ff"}
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
