import { useEffect, useRef, useState, useMemo, useCallback } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import {
  getWaypointPos,
  getWaypointWaitTime,
  getNextPatrolWaypoint
} from "../utils/npcUtils";

const TEMP_WAYPOINT_REACH_DISTANCE = 0.15;
const TEMP_WAYPOINT_DUPLICATE_EPSILON = 0.08;

const areWaypointPositionsEqual = (
  a,
  b,
  epsilon = TEMP_WAYPOINT_DUPLICATE_EPSILON
) => {
  const posA = getWaypointPos(a);
  const posB = getWaypointPos(b);

  if (!Array.isArray(posA) || !Array.isArray(posB)) {
    return false;
  }

  const dx = (posA[0] ?? 0) - (posB[0] ?? 0);
  const dy = (posA[1] ?? 0) - (posB[1] ?? 0);
  const dz = (posA[2] ?? 0) - (posB[2] ?? 0);

  return dx * dx + dy * dy + dz * dz <= epsilon * epsilon;
};

// Inspects both top-level payloads and nested dialogue node assets
const hasAnyDialoguePayload = (targetNpc) => {
  if (!targetNpc) return false;

  const hasDirectPayload = Boolean(
    targetNpc.priorityDialogue != null ||
      targetNpc.temporaryDialogue != null ||
      targetNpc.temporaryDialogueText != null ||
      targetNpc.temporaryDialogueTree != null ||
      targetNpc.temporaryDialogueOptions != null ||
      targetNpc.temporaryPlayerChoices != null ||
      targetNpc.dialogue != null ||
      targetNpc.dialogueTree != null ||
      targetNpc.dialogueText != null ||
      targetNpc.dialogueOptions != null ||
      targetNpc.playerChoices != null ||
      (Array.isArray(targetNpc.talkerNames) &&
        targetNpc.talkerNames.length > 0 &&
        targetNpc.speakerData)
  );

  if (hasDirectPayload) return true;

  const dialogueRoot = targetNpc.dialogue;
  if (dialogueRoot && typeof dialogueRoot === "object") {
    const nodes = dialogueRoot.nodes || dialogueRoot.dialogueNodes;
    if (nodes && typeof nodes === "object" && Object.keys(nodes).length > 0) {
      return true;
    }
  }

  return false;
};

const hasAnyTemporaryDialogueState = (targetNpc) => {
  if (!targetNpc) return false;

  return Boolean(
    targetNpc.hasTemporaryDialogue === true ||
      targetNpc.priorityDialogue != null ||
      targetNpc.temporaryDialogue != null ||
      targetNpc.temporaryDialogueText != null ||
      targetNpc.temporaryDialogueTree != null ||
      targetNpc.temporaryDialogueOptions != null ||
      targetNpc.temporaryPlayerChoices != null
  );
};

/**
 * Safely clamps an index into [0, length - 1].
 */
const clampIndex = (idx, length) => {
  const n = Number(idx);
  if (!Number.isFinite(n) || !Number.isInteger(n) || length <= 0) return 0;
  return Math.max(0, Math.min(length - 1, n));
};

export function useNPCBrain({
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
}) {
  const groupRef = useRef();
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

  const dialogueCooldownTimerRef = useRef(0);
  const hasExitedRadiusRef = useRef(true);
  const hasEnteredDialogueRadiusRef = useRef(false);
  const dialogueRequestPendingRef = useRef(false);

  const dialogueExitTimerRef = useRef(0);
  const dialogueJustClosedRef = useRef(false);
  const dialogueClosedByExitRef = useRef(false);

  // This ref exists specifically to ensure leaving the detection radius closes
  // the active dialogue exactly once. Do not use hasExitedRadiusRef for this:
  // that ref can be updated by syncDialogueRadiusState() before the dialogue
  // frame logic gets a chance to call closeDialogue().
  const dialogueExitCloseRequestedRef = useRef(false);

  const hasConsumedTemporaryDialogueRef = useRef(false);

  const pendingTemporaryDialogueClearRef = useRef(false);
  const openedTemporaryDialogueRef = useRef(false);

  const DIALOGUE_COOLDOWN_TIME = 3.0;

  const speakerTransitionDelayRef = useRef(0);
  const isMidSequenceRef = useRef(false);
  const transitionLockRef = useRef(false);
  const pendingSpeakerIndexRef = useRef(null);
  const manualJumpActiveRef = useRef(false);

  // A manual button selection must remain authoritative until its selected
  // dialogue has actually reopened. This prevents a stale automatic handoff
  // from immediately replacing Talker #1 with Talker #2.
  const manualJumpTargetIndexRef = useRef(null);
  const manualJumpWaitingForCloseRef = useRef(false);

  const lastSequenceJumpAtRef = useRef(0);

  const sequenceCacheRef = useRef({
    active: false,
    talkerNames: null,
    speakerData: null,
    loadedAt: 0
  });

  const dispatchBannerUpdate = useCallback(
    (currentIndexOverride = null) => {
      if (npc.isSummoned) return;

      const cache = sequenceCacheRef.current;
      if (!cache.active) return;

      const list = Array.isArray(cache.talkerNames) ? cache.talkerNames : [];
      const currentIdx = clampIndex(
        currentIndexOverride ??
          pendingSpeakerIndexRef.current ??
          npc.currentSpeakerIndex ??
          0,
        list.length
      );

      const speakerName = list[currentIdx] ?? npc.name;

      window.dispatchEvent(
        new CustomEvent("npcDialogueSequenceBannerUpdate", {
          detail: {
            visible: true,
            npcId: npc.id,
            talkerNames: cache.talkerNames,
            currentSpeakerIndex: currentIdx,
            speakerData: cache.speakerData,
            activeSpeakerName: speakerName
          }
        })
      );
    },
    [npc.id, npc.name, npc.currentSpeakerIndex, npc.isSummoned]
  );

  const dispatchBannerClose = useCallback(() => {
    if (npc.isSummoned) return;

    window.dispatchEvent(
      new CustomEvent("npcDialogueSequenceBannerClose", {
        detail: { npcId: npc.id }
      })
    );
  }, [npc.id, npc.isSummoned]);

  const beginSequenceCacheIfNeeded = useCallback(() => {
    if (npc.isSummoned) return;
    if (sequenceCacheRef.current.active) return;

    const talkers = Array.isArray(npc.talkerNames) ? npc.talkerNames : null;
    const speakers = npc.speakerData ?? null;

    if (!talkers || talkers.length === 0 || !speakers) return;

    sequenceCacheRef.current = {
      active: true,
      talkerNames: talkers,
      speakerData: speakers,
      loadedAt: Date.now()
    };

    console.log("[useNPCBrain] Sequence cache loaded (first time):", {
      npcId: npc.id,
      talkerCount: talkers.length,
      loadedAt: sequenceCacheRef.current.loadedAt
    });

    dispatchBannerUpdate();
  }, [
    npc.id,
    npc.talkerNames,
    npc.speakerData,
    npc.isSummoned,
    dispatchBannerUpdate
  ]);

  const resetSequenceCache = useCallback(() => {
    if (sequenceCacheRef.current.active) {
      console.log("[useNPCBrain] Sequence cache cleared:", {
        npcId: npc.id
      });
      dispatchBannerClose();
    }

    sequenceCacheRef.current = {
      active: false,
      talkerNames: null,
      speakerData: null,
      loadedAt: 0
    };
  }, [npc.id, dispatchBannerClose]);

  const activeDialogueNpcIdRef = useRef(activeDialogueNpcId);

  useEffect(() => {
    activeDialogueNpcIdRef.current = activeDialogueNpcId;

    if (activeDialogueNpcId === npc.id) {
      beginSequenceCacheIfNeeded();
    }

    if (
      activeDialogueNpcId === npc.id &&
      !npc.isSummoned &&
      sequenceCacheRef.current.active
    ) {
      const currentIdx =
        pendingSpeakerIndexRef.current ?? npc.currentSpeakerIndex ?? 0;

      dispatchBannerUpdate(currentIdx);
    }
  }, [
    activeDialogueNpcId,
    npc.id,
    npc.currentSpeakerIndex,
    npc.isSummoned,
    beginSequenceCacheIfNeeded,
    dispatchBannerUpdate
  ]);

  const previousActiveDialogueNpcIdRef = useRef(activeDialogueNpcId);

  const progressSampleTimerRef = useRef(0);
  const noProgressTimerRef = useRef(0);
  const lastProgressPositionRef = useRef(null);
  const lastSafePositionRef = useRef(null);
  const unstuckCooldownRef = useRef(0);
  const unstuckAttemptsRef = useRef(0);

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
  const SUMMON_STOP_DISTANCE = 2.0;

  const cornerVectors = useMemo(
    () => [
      new THREE.Vector3(),
      new THREE.Vector3(),
      new THREE.Vector3(),
      new THREE.Vector3()
    ],
    []
  );

  const npcHasDialogue = useMemo(() => {
    if (npc.isSummoned) return false;

    return Boolean(
      hasAnyDialoguePayload(npc) || npc.hasTemporaryDialogue === true
    );
  }, [
    npc.isSummoned,
    npc.hasTemporaryDialogue,
    npc.priorityDialogue,
    npc.temporaryDialogue,
    npc.temporaryDialogueText,
    npc.temporaryDialogueTree,
    npc.temporaryDialogueOptions,
    npc.temporaryDialoguePlayerChoices,
    npc.dialogue,
    npc.dialogueTree,
    npc.dialogueText,
    npc.dialogueOptions,
    npc.playerChoices,
    npc.talkerNames,
    npc.speakerData
  ]);

  const updateAiState = (nextState) => {
    if (aiStateRef.current !== nextState) {
      aiStateRef.current = nextState;
      setAiState(nextState);
    }
  };

  const hasNpcTemporaryDialogue = useCallback((targetNpc) => {
    return hasAnyTemporaryDialogueState(targetNpc);
  }, []);

  const isResolvedDialogueTemporary = useCallback(
    (targetNpc, resolvedDialogue) => {
      if (!targetNpc || !hasNpcTemporaryDialogue(targetNpc)) {
        return false;
      }

      if (
        targetNpc.priorityDialogue != null &&
        resolvedDialogue === targetNpc.priorityDialogue
      ) {
        return true;
      }

      return (
        resolvedDialogue === targetNpc.temporaryDialogue ||
        resolvedDialogue === targetNpc.temporaryDialogueText ||
        resolvedDialogue === targetNpc.temporaryDialogueTree ||
        resolvedDialogue === targetNpc.temporaryDialogueOptions ||
        resolvedDialogue === targetNpc.temporaryPlayerChoices
      );
    },
    [hasNpcTemporaryDialogue]
  );

  const getTemporaryDialogueClearDelaySeconds = useCallback(
    (targetNpc, fallbackSeconds = DIALOGUE_COOLDOWN_TIME) => {
      const configuredDelayMs =
        targetNpc?.clearTemporaryDialogueDelay ??
        targetNpc?.temporaryDialogueClearDelay ??
        targetNpc?.detection?.clearTemporaryDialogueClearDelay;

      if (configuredDelayMs == null || configuredDelayMs === "") {
        return fallbackSeconds;
      }

      const parsedDelayMs = Number(configuredDelayMs);

      if (!Number.isFinite(parsedDelayMs)) {
        return fallbackSeconds;
      }

      return Math.max(0, parsedDelayMs) / 1000;
    },
    []
  );

  const getActiveNpcDialogue = useCallback(
    (overrideIndex = null) => {
      if (npc.isSummoned) return null;

      const cache = sequenceCacheRef.current;

      const talkerNames =
        cache.active && Array.isArray(cache.talkerNames)
          ? cache.talkerNames
          : npc.talkerNames;

      const speakerData =
        cache.active && cache.speakerData != null
          ? cache.speakerData
          : npc.speakerData;

      if (Array.isArray(talkerNames) && talkerNames.length > 0 && speakerData) {
        const idx = clampIndex(
          overrideIndex ??
            pendingSpeakerIndexRef.current ??
            npc.currentSpeakerIndex ??
            0,
          talkerNames.length
        );

        const speakerName = talkerNames[idx];
        let speakerPayload = null;

        if (speakerName && speakerData && typeof speakerData === "object") {
          speakerPayload = speakerData[speakerName] ?? null;
        }

        if (!speakerPayload && Array.isArray(speakerData)) {
          speakerPayload = speakerData[idx] ?? null;
        }

        if (!speakerPayload && speakerData && typeof speakerData === "object") {
          speakerPayload = speakerData[idx] ?? speakerData[String(idx)] ?? null;
        }

        if (speakerPayload) {
          return (
            speakerPayload.priorityDialogue ??
            speakerPayload.temporaryDialogue ??
            speakerPayload.temporaryDialogueText ??
            speakerPayload.temporaryDialogueTree ??
            speakerPayload.temporaryDialogueOptions ??
            speakerPayload.temporaryPlayerChoices ??
            speakerPayload.dialogue ??
            speakerPayload.dialogueTree ??
            speakerPayload.dialogueText ??
            speakerPayload.dialogueOptions ??
            speakerPayload.playerChoices ??
            null
          );
        }
      }

      const temporaryDialogue =
        npc.priorityDialogue ??
        npc.temporaryDialogue ??
        npc.temporaryDialogueText ??
        npc.temporaryDialogueTree ??
        npc.temporaryDialogueOptions ??
        npc.temporaryPlayerChoices ??
        null;

      return (
        temporaryDialogue ??
        npc.dialogue ??
        npc.dialogueTree ??
        npc.dialogueText ??
        npc.dialogueOptions ??
        npc.playerChoices ??
        null
      );
    },
    [
      npc.isSummoned,
      npc.priorityDialogue,
      npc.temporaryDialogue,
      npc.temporaryDialogueText,
      npc.temporaryDialogueTree,
      npc.temporaryDialogueOptions,
      npc.temporaryPlayerChoices,
      npc.dialogue,
      npc.dialogueTree,
      npc.dialogueText,
      npc.dialogueOptions,
      npc.playerChoices,
      npc.talkerNames,
      npc.speakerData,
      npc.currentSpeakerIndex
    ]
  );

  const syncDialogueRadiusState = useCallback(() => {
    const triggerRadius = npc.detection?.radius ?? 3;

    let npcX = npc.position?.[0] ?? 0;
    let npcY = npc.position?.[1] ?? 0;
    let npcZ = npc.position?.[2] ?? 0;

    if (groupRef.current) {
      npcX = groupRef.current.position.x;
      npcY = groupRef.current.position.y;
      npcZ = groupRef.current.position.z;
    }

    if (!girlRef?.current) {
      hasEnteredDialogueRadiusRef.current = false;
      hasExitedRadiusRef.current = true;
      dialogueExitTimerRef.current = 0;
      return;
    }

    girlRef.current.getWorldPosition(playerPosVec);

    const dx = npcX - playerPosVec.x;
    const dy = npcY - playerPosVec.y;
    const dz = npcZ - playerPosVec.z;
    const distSq = dx * dx + dy * dy + dz * dz;

    if (distSq <= triggerRadius * triggerRadius) {
      hasEnteredDialogueRadiusRef.current = true;
      hasExitedRadiusRef.current = false;
      dialogueExitTimerRef.current = 0;

      // The player came back into range, so a future exit may close a newly
      // opened dialogue.
      dialogueExitCloseRequestedRef.current = false;

      return;
    }

    hasEnteredDialogueRadiusRef.current = false;
    hasExitedRadiusRef.current = true;
    dialogueExitTimerRef.current = 0;

    if (npc.dialogueSequenceCompleted && !npc.isSummoned) {
      pendingSpeakerIndexRef.current = null;
      isMidSequenceRef.current = false;
      transitionLockRef.current = false;
      manualJumpActiveRef.current = false;
      speakerTransitionDelayRef.current = 0;

      resetSequenceCache();

      setNpcs((prev) =>
        prev.map((n) =>
          n.id === npc.id
            ? {
                ...n,
                currentSpeakerIndex: 0,
                activeSpeakerName: undefined,
                dialogueSequenceCompleted: false
              }
            : n
        )
      );
    }
  }, [
    npc.detection?.radius,
    npc.position,
    playerPosVec,
    girlRef,
    npc.dialogueSequenceCompleted,
    npc.isSummoned,
    setNpcs,
    resetSequenceCache
  ]);

  const rearmDialogueTrigger = useCallback(() => {
    if (npc.summonAutoOpenPending === true) return;

    dialogueRequestPendingRef.current = false;

    if (npc.isSummoned) return;

    dialogueCooldownTimerRef.current = DIALOGUE_COOLDOWN_TIME;
    dialogueJustClosedRef.current = true;
  }, [npc.isSummoned, npc.summonAutoOpenPending]);

  const cleanupSummonedCopies = useCallback(
    (force = false) => {
      if (npc.isSummoned) return;

      const shouldDespawnSummonedCopies =
        npc.despawnSummonedCopiesOnDialogueExit === true;

      if (!shouldDespawnSummonedCopies) return;

      let isPlayerNearSummoner = false;

      if (girlRef?.current) {
        girlRef.current.getWorldPosition(playerPosVec);

        let npcX = npc.position?.[0] ?? 0;
        let npcY = npc.position?.[1] ?? 0;
        let npcZ = npc.position?.[2] ?? 0;

        if (groupRef.current) {
          npcX = groupRef.current.position.x;
          npcY = groupRef.current.position.y;
          npcZ = groupRef.current.position.z;
        }

        const triggerRadius = npc.detection?.radius ?? 3;
        const dx = npcX - playerPosVec.x;
        const dy = npcY - playerPosVec.y;
        const dz = npcZ - playerPosVec.z;

        isPlayerNearSummoner =
          dx * dx + dy * dy + dz * dz <= triggerRadius * triggerRadius;
      }

      if (
        !force &&
        (isPlayerNearSummoner || activeDialogueNpcIdRef.current === npc.id)
      ) {
        return;
      }

      const now = Date.now();

      setNpcs((prevNpcs) =>
        prevNpcs.filter((otherNpc) => {
          const isOwnedSummon =
            otherNpc.isSummoned && otherNpc.summonedByNpcId === npc.id;

          if (!isOwnedSummon) return true;

          if (otherNpc.summonedAt && now - otherNpc.summonedAt < 3000) {
            return true;
          }

          if (
            !force &&
            (isPlayerNearSummoner ||
              activeDialogueNpcIdRef.current === otherNpc.id ||
              otherNpc.isTalking)
          ) {
            return true;
          }

          return otherNpc.despawnSummonedCopiesOnDialogueExit === false;
        })
      );
    },
    [
      npc.despawnSummonedCopiesOnDialogueExit,
      npc.id,
      npc.isSummoned,
      npc.position,
      npc.detection?.radius,
      setNpcs,
      girlRef,
      playerPosVec
    ]
  );

  const clearNpcTemporaryDialogue = useCallback(() => {
    setNpcs((prevNpcs) => {
      let changed = false;

      const nextNpcs = prevNpcs.map((otherNpc) => {
        if (otherNpc.id !== npc.id) return otherNpc;

        if (!hasAnyTemporaryDialogueState(otherNpc)) {
          return otherNpc;
        }

        changed = true;

        return {
          ...otherNpc,
          hasTemporaryDialogue: false,
          temporaryDialogueDismissed: true,
          temporaryDialogue: null,
          temporaryDialogueText: null,
          temporaryDialogueTree: null,
          temporaryDialogueOptions: null,
          temporaryPlayerChoices: null,
          priorityDialogue: null,
          summonAutoOpenPending: false,
          dialogueHandoffPending: false,
          currentSpeakerIndex: 0
        };
      });

      return changed ? nextNpcs : prevNpcs;
    });

    dialogueRequestPendingRef.current = false;
    hasConsumedTemporaryDialogueRef.current = false;
    openedTemporaryDialogueRef.current = false;
    pendingTemporaryDialogueClearRef.current = false;
    pendingSpeakerIndexRef.current = null;
    isMidSequenceRef.current = false;
    transitionLockRef.current = false;
    manualJumpActiveRef.current = false;
    manualJumpTargetIndexRef.current = null;
    manualJumpWaitingForCloseRef.current = false;
    speakerTransitionDelayRef.current = 0;

    resetSequenceCache();
  }, [npc.id, setNpcs, resetSequenceCache]);

  const clearNpcTemporaryDialogueState = useCallback((targetNpc) => {
    return {
      ...targetNpc,
      hasTemporaryDialogue: false,
      temporaryDialogueDismissed: true,
      temporaryDialogue: null,
      temporaryDialogueText: null,
      temporaryDialogueTree: null,
      temporaryDialogueOptions: null,
      temporaryPlayerChoices: null,
      priorityDialogue: null,
      summonAutoOpenPending: false,
      dialogueHandoffPending: false,
      currentSpeakerIndex: 0
    };
  }, []);

  const resolveNpcTargetPosition = useCallback(
    (targetNpcId, fallbackToSummoner = false) => {
      let resolvedTargetId = targetNpcId;

      if (
        (!resolvedTargetId ||
          resolvedTargetId === "owner" ||
          resolvedTargetId === "summoner") &&
        fallbackToSummoner
      ) {
        resolvedTargetId = npc.summonedByNpcId || null;
      }

      if (resolvedTargetId === "player") {
        if (!girlRef?.current) return null;
        girlRef.current.getWorldPosition(targetPosVec);
        return targetPosVec.clone();
      }

      if (!resolvedTargetId) return null;

      const targetRef = npcRefs?.current?.[resolvedTargetId];
      const targetGroup = targetRef?.current;

      if (targetGroup) {
        targetGroup.getWorldPosition(targetPosVec);
        return targetPosVec.clone();
      }

      const targetNpc = Array.isArray(npcs)
        ? npcs.find((otherNpc) => otherNpc?.id === resolvedTargetId)
        : null;

      if (Array.isArray(targetNpc?.position) && targetNpc.position.length >= 3) {
        return new THREE.Vector3(
          targetNpc.position[0] ?? 0,
          targetNpc.position[1] ?? 0,
          targetNpc.position[2] ?? 0
        );
      }

      return null;
    },
    [girlRef, npc.summonedByNpcId, npcRefs, npcs, targetPosVec]
  );

  useEffect(() => {
    if (npc.isSummoned) return;

    const handleJumpRequest = (event) => {
      const detail = event?.detail || {};
      const requestedNpcId = detail.npcId;

      if (!requestedNpcId || requestedNpcId !== npc.id) return;

      beginSequenceCacheIfNeeded();

      const cache = sequenceCacheRef.current;
      const talkers = cache.active
        ? cache.talkerNames
        : Array.isArray(npc.talkerNames)
        ? npc.talkerNames
        : [];

      const total = Array.isArray(talkers) ? talkers.length : 0;
      if (total <= 0) return;

      const targetIndex = clampIndex(detail.targetIndex, total);

      const now =
        typeof performance !== "undefined" ? performance.now() : Date.now();

      if (now - lastSequenceJumpAtRef.current < 120) return;
      lastSequenceJumpAtRef.current = now;

      // Manual selection always wins over the automatic handoff system.
      //
      // Do not begin the short reopen delay yet if another dialogue for this
      // NPC is still mounted. First close it, then start the chosen speaker
      // only after React confirms the old dialogue is gone.
      manualJumpActiveRef.current = true;
      manualJumpTargetIndexRef.current = targetIndex;
      manualJumpWaitingForCloseRef.current =
        activeDialogueNpcIdRef.current === npc.id;

      transitionLockRef.current = true;
      isMidSequenceRef.current = true;
      pendingSpeakerIndexRef.current = targetIndex;
      speakerTransitionDelayRef.current =
        activeDialogueNpcIdRef.current === npc.id ? 0 : 0.15;

      setNpcs((prev) =>
        prev.map((n) =>
          n.id === npc.id
            ? {
                ...n,
                currentSpeakerIndex: targetIndex,
                dialogueSequenceCompleted: false
              }
            : n
        )
      );

      if (sequenceCacheRef.current.active) {
        dispatchBannerUpdate(targetIndex);
      }

      if (activeDialogueNpcIdRef.current === npc.id) {
        window.dispatchEvent(
          new CustomEvent("npcDialogueSequenceJumpApplied", {
            detail: {
              npcId: npc.id,
              currentSpeakerIndex: targetIndex,
              activeSpeakerName: Array.isArray(talkers)
                ? talkers[targetIndex]
                : npc.name,
              reason: detail.reason || "jump-request"
            }
          })
        );
      }
    };

    window.addEventListener("npcDialogueSequenceJumpRequest", handleJumpRequest);

    return () => {
      window.removeEventListener(
        "npcDialogueSequenceJumpRequest",
        handleJumpRequest
      );
    };
  }, [
    npc.id,
    npc.name,
    npc.isSummoned,
    npc.talkerNames,
    setNpcs,
    beginSequenceCacheIfNeeded,
    dispatchBannerUpdate,
    closeDialogue
  ]);

  useEffect(() => {
    hasEnteredDialogueRadiusRef.current = false;
    hasExitedRadiusRef.current = true;
    dialogueRequestPendingRef.current = false;

    dialogueExitTimerRef.current = 0;
    dialogueCooldownTimerRef.current = 0;
    dialogueExitCloseRequestedRef.current = false;

    hasConsumedTemporaryDialogueRef.current = false;

    openedTemporaryDialogueRef.current = false;
    pendingTemporaryDialogueClearRef.current = false;
    pendingSpeakerIndexRef.current = null;
    isMidSequenceRef.current = false;
    transitionLockRef.current = false;
    manualJumpActiveRef.current = false;
    manualJumpTargetIndexRef.current = null;
    manualJumpWaitingForCloseRef.current = false;
    speakerTransitionDelayRef.current = 0;

    resetSequenceCache();
    syncDialogueRadiusState();
  }, [npc.id, npc.isSummoned, syncDialogueRadiusState, resetSequenceCache]);

  useEffect(() => {
    return () => {
      cleanupSummonedCopies(true);
    };
  }, [cleanupSummonedCopies]);

  useEffect(() => {
    if (!npcRefs || !npc?.id) return;

    npcRefs.current[npc.id] = groupRef;

    return () => {
      if (npcRefs.current[npc.id] === groupRef) {
        delete npcRefs.current[npc.id];
      }
    };
  }, [npcRefs, npc?.id]);

  // The Three.js group owns the live movement position after initial spawn.
  //
  // npc.position is a persistence/snapshot value and may be older than the
  // current interpolated Three.js position when dialogue state changes.
  // Therefore it must NEVER pull a running NPC backwards after initialization.
  const lastAppliedNpcPositionRef = useRef(null);
  const hasInitializedNpcPositionRef = useRef(false);

  useEffect(() => {
    if (!groupRef.current || !Array.isArray(npc.position)) return;

    const nextPosition = [
      npc.position[0] ?? 0,
      npc.position[1] ?? 0,
      npc.position[2] ?? 0
    ];

    // Only a newly mounted NPC, or a genuinely different NPC ID, may receive
    // its world position from React state.
    if (!hasInitializedNpcPositionRef.current) {
      groupRef.current.position.set(
        nextPosition[0],
        nextPosition[1],
        nextPosition[2]
      );

      hasInitializedNpcPositionRef.current = true;
      lastAppliedNpcPositionRef.current = [...nextPosition];
      syncDialogueRadiusState();
      return;
    }

    // Keep the saved React snapshot reference current, but do not write it
    // back into group.position. This prevents dialogue-close rerenders from
    // snapping the NPC to an old patrol waypoint/saved position.
    lastAppliedNpcPositionRef.current = [...nextPosition];
  }, [npc.id, npc.position, syncDialogueRadiusState]);

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

    dialogueCooldownTimerRef.current = 0;
    dialogueExitTimerRef.current = 0;
    dialogueExitCloseRequestedRef.current = false;
    dialogueRequestPendingRef.current = false;

    hasConsumedTemporaryDialogueRef.current = false;
    openedTemporaryDialogueRef.current = false;
    pendingTemporaryDialogueClearRef.current = false;
    pendingSpeakerIndexRef.current = null;
    isMidSequenceRef.current = false;
    transitionLockRef.current = false;
    manualJumpActiveRef.current = false;
    manualJumpTargetIndexRef.current = null;
    manualJumpWaitingForCloseRef.current = false;
    speakerTransitionDelayRef.current = 0;

    blockedWaypointKeysRef.current.clear();
    waypointValidationCacheRef.current.clear();
    waypointValidationTimerRef.current = 0;

    resetSequenceCache();

    lastAppliedNpcPositionRef.current = null;
    hasInitializedNpcPositionRef.current = false;

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
    syncDialogueRadiusState();
  }, [npc.id]);

  useEffect(() => {
    if (Array.isArray(npc.position)) {
      wanderOriginRef.current = [...npc.position];
    }
  }, [npc.id, npc.position]);

  useEffect(() => {
    if (npc.isSummoned) return;

    const hasTemporaryDialogue = hasAnyTemporaryDialogueState(npc);

    if (!hasTemporaryDialogue) {
      hasConsumedTemporaryDialogueRef.current = false;
      pendingTemporaryDialogueClearRef.current = false;
      return;
    }

    hasConsumedTemporaryDialogueRef.current = false;

    if (npc.temporaryDialogueDismissed === true) {
      setNpcs((prev) =>
        prev.map((item) => {
          if (item.id !== npc.id) return item;
          if (item.isSummoned) return item;

          const itemHasTemporaryDialogue = hasAnyTemporaryDialogueState(item);

          if (
            !itemHasTemporaryDialogue ||
            item.temporaryDialogueDismissed !== true
          ) {
            return item;
          }

          return {
            ...item,
            temporaryDialogueDismissed: false
          };
        })
      );
    }
  }, [
    npc.id,
    npc.isSummoned,
    npc.hasTemporaryDialogue,
    npc.temporaryDialogue,
    npc.temporaryDialogueText,
    npc.temporaryDialogueTree,
    npc.temporaryDialogueOptions,
    npc.temporaryPlayerChoices,
    npc.priorityDialogue,
    npc.temporaryDialogueDismissed,
    setNpcs
  ]);

  useFrame((_, delta) => {
    const group = groupRef.current;
    if (!group) return;

    if (dialogueCooldownTimerRef.current > 0) {
      dialogueCooldownTimerRef.current -= delta;
      if (dialogueCooldownTimerRef.current <= 0) {
        dialogueJustClosedRef.current = false;
      }
    }

    // Radius-driven temporary texture (authored via the
    // "Set NPC Texture While In Detection Radius" dialogue action).
    //
    // This is intentionally independent of the dialogue open/close
    // lifecycle - it is driven purely by the player's distance to this NPC,
    // using the same detection radius as the NPC's general detection system.
    // This guarantees the texture always reverts on radius-exit even if
    // dialogue never opened, closed early, or the sequence got interrupted.
    //
    // IMPORTANT: this action does NOT scan the dialogue tree ahead of
    // time. npc.radiusTextureArmedUrl is only ever set by the real dialogue
    // action pipeline (executeDialogueAction in dialogueActions.js) when
    // this specific action actually runs - i.e. onEnter of the node it
    // lives on, or the specific player choice it is attached to. Until
    // then npc.radiusTextureArmedUrl is undefined and nothing happens here,
    // even if the player is already standing inside the detection radius.
    //
    // The "is it currently applied" flag and the "original texture to
    // restore" value are both persisted on the NPC object itself (not local
    // refs). A local ref can desync from reality if the component
    // remounts, or if the setNpcs updater below reads a stale closure
    // value instead of the live state - persisting on the NPC guarantees
    // there is exactly one source of truth, and every updater below reads
    // the live value from `n`, never from the outer `npc` closure.
    if (!npc.isSummoned) {
      const configuredRadiusTextureUrl = npc.radiusTextureArmedUrl || null;

      if (!configuredRadiusTextureUrl) {
        // Action was removed/cleared while active - revert immediately.
        if (npc.radiusTextureApplied === true) {
          setNpcs((prev) =>
            prev.map((n) => {
              if (n.id !== npc.id) return n;

              return {
                ...n,
                textureUrl: n.originalTextureUrlBeforeRadius ?? null,
                radiusTextureApplied: false,
                originalTextureUrlBeforeRadius: null,
              };
            })
          );
        }
      } else if (girlRef?.current) {
        girlRef.current.getWorldPosition(playerPosVec);

        const textureDistance = group.position.distanceTo(playerPosVec);
        const textureTriggerRadius = npc.detection?.radius ?? 3;
        const isInsideTextureRadius = textureDistance <= textureTriggerRadius;

        if (isInsideTextureRadius && npc.radiusTextureApplied !== true) {
          setNpcs((prev) =>
            prev.map((n) => {
              if (n.id !== npc.id) return n;
              if (n.radiusTextureApplied === true) return n;

              return {
                ...n,
                // Capture the NPC's real current texture (read live from
                // `n`, never from the outer npc closure) before swapping.
                originalTextureUrlBeforeRadius: n.textureUrl ?? null,
                radiusTextureApplied: true,
                textureUrl: configuredRadiusTextureUrl,
              };
            })
          );
        } else if (!isInsideTextureRadius && npc.radiusTextureApplied === true) {
          setNpcs((prev) =>
            prev.map((n) => {
              if (n.id !== npc.id) return n;
              if (n.radiusTextureApplied !== true) return n;

              return {
                ...n,
                textureUrl: n.originalTextureUrlBeforeRadius ?? null,
                radiusTextureApplied: false,
                originalTextureUrlBeforeRadius: null,
                // Disarm too, so leaving the radius fully resets the
                // feature back to "waiting for the action to fire again".
                radiusTextureArmedUrl: null,
              };
            })
          );
        }
      }
    }

    // ALWAYS close this NPC's dialogue the moment the player leaves its
    // detection radius, whenever this NPC currently owns the active
    // dialogue.
    if (
      !npc.isSummoned &&
      girlRef?.current &&
      activeDialogueNpcIdRef.current === npc.id
    ) {
      girlRef.current.getWorldPosition(playerPosVec);

      const exitDistance = group.position.distanceTo(playerPosVec);
      const exitTriggerRadius = npc.detection?.radius ?? 3;

      if (exitDistance > exitTriggerRadius) {
        hasExitedRadiusRef.current = true;
        dialogueRequestPendingRef.current = false;
        dialogueCooldownTimerRef.current = DIALOGUE_COOLDOWN_TIME;

        if (!dialogueExitCloseRequestedRef.current) {
          dialogueExitCloseRequestedRef.current = true;
          dialogueClosedByExitRef.current = true;

          console.warn("[useNPCBrain] RADIUS EXIT - About to call closeDialogue callback", {
            npcId: npc.id,
            npcName: npc.name,
            activeDialogueNpcIdRef: activeDialogueNpcIdRef.current,
          });
          
          console.log(
            `[Dialogue System] Player left detection radius for ${
              npc.name || npc.id
            } - closing dialogue.`
          );

          // Reset NPC dialogue state when exiting radius
          setNpcs((prevNpcs) => {
            return prevNpcs.map((n) => {
              if (n.id !== npc.id) return n;
              return {
                ...n,
                currentSpeakerIndex: 0,
                activeSpeakerName: undefined
              };
            });
          });

          // Reset all dialogue detection flags when closing
          hasEnteredDialogueRadiusRef.current = false;
          hasExitedRadiusRef.current = false;
          dialogueExitTimerRef.current = 0;

          // Reset cooldown timer so player can re-trigger dialogue
          dialogueCooldownTimerRef.current = 0;

          closeDialogue?.({
  npcId: npc.id,
  reason: "radius-exit",
});

        }

        updateAiState("Idle");
      }
    }

    if (activeDialogueNpcIdRef.current === npc.id) {
      dialogueRequestPendingRef.current = false;
    } else if (activeDialogueNpcIdRef.current != null) {
      const isCloneOfActive =
        npc.isSummoned &&
        npc.summonedByNpcId === activeDialogueNpcIdRef.current;

      if (!isCloneOfActive) {
        dialogueRequestPendingRef.current = false;
      }
    }

    const previousActiveDialogueNpcId = previousActiveDialogueNpcIdRef.current;

    if (previousActiveDialogueNpcId !== activeDialogueNpcIdRef.current) {
      const thisNpcDialogueJustClosed =
        previousActiveDialogueNpcId === npc.id &&
        activeDialogueNpcIdRef.current !== npc.id;

      if (thisNpcDialogueJustClosed) {
        const closedDueToRadiusExit = dialogueClosedByExitRef.current;
        dialogueClosedByExitRef.current = false;

        // If a manual jump is active, DO NOT auto-increment the speaker index.
        if (manualJumpActiveRef.current) {
          isMidSequenceRef.current = true;
          transitionLockRef.current = true;
        } else if (!closedDueToRadiusExit) {
          const cache = sequenceCacheRef.current;
          const talkersForCount =
            cache.active && Array.isArray(cache.talkerNames)
              ? cache.talkerNames
              : npc.talkerNames;

          const currentSpeakerIdx = npc.currentSpeakerIndex ?? 0;
          const totalSpeakers = Array.isArray(talkersForCount)
            ? talkersForCount.length
            : 0;

          if (
            !npc.isSummoned &&
            totalSpeakers > 0 &&
            currentSpeakerIdx < totalSpeakers - 1
          ) {
            const nextSpeakerIdx = currentSpeakerIdx + 1;
            pendingSpeakerIndexRef.current = nextSpeakerIdx;
            transitionLockRef.current = true;
            setNpcs((prev) =>
              prev.map((n) =>
                n.id === npc.id && n.currentSpeakerIndex !== nextSpeakerIdx
                  ? { ...n, currentSpeakerIndex: nextSpeakerIdx }
                  : n
              )
            );
            isMidSequenceRef.current = true;
            speakerTransitionDelayRef.current = 0.5;
          } else {
            pendingSpeakerIndexRef.current = null;
            isMidSequenceRef.current = false;
            transitionLockRef.current = false;

            resetSequenceCache();

            if (!npc.isSummoned) {
              setNpcs((prev) =>
                prev.map((n) =>
                  n.id === npc.id
                    ? {
                        ...n,
                        currentSpeakerIndex: 0,
                        activeSpeakerName: undefined,
                        dialogueSequenceCompleted: true
                      }
                    : n
                )
              );
            }

            if (pendingTemporaryDialogueClearRef.current) {
              pendingTemporaryDialogueClearRef.current = false;
              clearNpcTemporaryDialogue();
            }

            openedTemporaryDialogueRef.current = false;
            rearmDialogueTrigger();

            if (typeof onDialogueClosed === "function") {
              onDialogueClosed(npc.id);
            }
          }
        }
      }

      const dialogueClosedFromAnotherNpc =
        previousActiveDialogueNpcId != null &&
        activeDialogueNpcIdRef.current == null &&
        previousActiveDialogueNpcId !== npc.id;

      if (dialogueClosedFromAnotherNpc) {
        rearmDialogueTrigger();

        if (npc.isSummoned) {
          setNpcs((prev) =>
            prev.map((n) =>
              n.id === npc.id ? { ...n, summonedAt: Date.now() } : n
            )
          );
        }
      }

      previousActiveDialogueNpcIdRef.current = activeDialogueNpcIdRef.current;
    }

    // Decrement dialogue cooldown each frame
    if (dialogueCooldownTimerRef.current > 0) {
      dialogueCooldownTimerRef.current = Math.max(0, dialogueCooldownTimerRef.current - delta);
    }

    if (speakerTransitionDelayRef.current > 0 && !npc.isSummoned) {
      if (
        manualJumpActiveRef.current &&
        manualJumpWaitingForCloseRef.current &&
        activeDialogueNpcIdRef.current === npc.id
      ) {
        return;
      }

      speakerTransitionDelayRef.current -= delta;

      if (speakerTransitionDelayRef.current <= 0) {
        beginSequenceCacheIfNeeded();

        const isManualJump = manualJumpActiveRef.current;

        const targetIndex = isManualJump
          ? manualJumpTargetIndexRef.current ??
            pendingSpeakerIndexRef.current ??
            npc.currentSpeakerIndex ??
            0
          : pendingSpeakerIndexRef.current ??
            npc.currentSpeakerIndex ??
            0;

        const nextDialogue = getActiveNpcDialogue(targetIndex);

        if (
          nextDialogue != null &&
          startDialogue &&
          activeDialogueNpcIdRef.current == null
        ) {
          const cache = sequenceCacheRef.current;

          const talkers =
            cache.active && Array.isArray(cache.talkerNames)
              ? cache.talkerNames
              : npc.talkerNames;

          const safeIdx = clampIndex(
            targetIndex,
            Array.isArray(talkers) ? talkers.length : 0
          );

          const currentSpeakerName = Array.isArray(talkers)
            ? talkers[safeIdx]
            : npc.name;

          console.log(
            `[Dialogue System] ${
              isManualJump ? "Manual jump opening" : "Queue advancing to"
            } speaker index ${safeIdx} (${currentSpeakerName})`
          );

          setNpcs((prev) =>
            prev.map((n) =>
              n.id === npc.id
                ? {
                    ...n,
                    currentSpeakerIndex: safeIdx,
                    dialogueSequenceCompleted: false
                  }
                : n
            )
          );

          openedTemporaryDialogueRef.current = isResolvedDialogueTemporary(
            npc,
            nextDialogue
          );

          hasExitedRadiusRef.current = false;
          dialogueRequestPendingRef.current = true;

          const dialoguePayload = {
            ...nextDialogue,
            speakerName: currentSpeakerName
          };

          dialogueExitCloseRequestedRef.current = false;
          dialogueClosedByExitRef.current = false;

          startDialogue(npc.id, dialoguePayload);

          window.dispatchEvent(
            new CustomEvent("npcSequenceHandoff", {
              detail: {
                toNpcId: npc.id,
                currentSpeakerIndex: safeIdx,
                speakerName: currentSpeakerName,
                activeSpeakerName: currentSpeakerName,
                payload: dialoguePayload,
                manual: isManualJump
              }
            })
          );

          if (sequenceCacheRef.current.active) {
            dispatchBannerUpdate(safeIdx);
          }
        }

        pendingSpeakerIndexRef.current = null;
        isMidSequenceRef.current = false;
        transitionLockRef.current = false;
        manualJumpActiveRef.current = false;
        manualJumpTargetIndexRef.current = null;
        manualJumpWaitingForCloseRef.current = false;
      }
    }


    // A speaker hand-off is actively transitioning (Talker N's dialogue has
    // fully closed but Talker N+1's has not opened yet). During this short
    // window activeDialogueNpcIdRef.current is temporarily null, so the
    // radius-exit detection below would otherwise run against a live,
    // possibly-moving player and can incorrectly flag hasExitedRadiusRef
    // before the next speaker's dialogue is mounted - corrupting the
    // hand-off back to Talker #1. The transition logic above already owns
    // opening the next speaker, so skip detection entirely while it is
    // in flight.
    const isHandingOffSpeaker =
      !npc.isSummoned &&
      (speakerTransitionDelayRef.current > 0 ||
        isMidSequenceRef.current ||
        transitionLockRef.current);

    if (isHandingOffSpeaker) {
      return;
    }
    if (girlRef?.current && startDialogue && npcHasDialogue) {
      girlRef.current.getWorldPosition(playerPosVec);

      const distance = group.position.distanceTo(playerPosVec);
      const triggerRadius = npc.detection?.radius ?? 3;
      const isClone = npc.isSummoned;

      if (!isClone) {
        if (activeDialogueNpcIdRef.current === npc.id) {
          beginSequenceCacheIfNeeded();

          if (distance > triggerRadius) {
  if (!hasExitedRadiusRef.current) {
    hasExitedRadiusRef.current = true;
    dialogueRequestPendingRef.current = false;
    // DO NOT set cooldown here - let closeDialogue handler reset it properly
    if (closeDialogue) {
      closeDialogue({
        npcId: npc.id,
        reason: "radius-exit",
      });
    }
  }
  updateAiState("Idle");
  return;
}


          updateAiState("Talking");
          hasExitedRadiusRef.current = false;

          // The player is still in range, therefore a later exit should be
          // allowed to close the dialogue.
          dialogueExitCloseRequestedRef.current = false;

          dialogueRequestPendingRef.current = false;
          dialogueCooldownTimerRef.current = DIALOGUE_COOLDOWN_TIME;
          dialogueExitTimerRef.current = 0;

          const hasTempDialogue = hasAnyTemporaryDialogueState(npc);

          const shouldClearAfterFirstUse =
            npc.clearTemporaryDialogueAfterFirstUse === true ||
            npc.removeTemporaryDialogueAfterFirstUse === true;

          if (
            !hasConsumedTemporaryDialogueRef.current &&
            openedTemporaryDialogueRef.current &&
            hasTempDialogue &&
            shouldClearAfterFirstUse
          ) {
            hasConsumedTemporaryDialogueRef.current = true;
            pendingTemporaryDialogueClearRef.current = true;
          }

          flatLookTargetVec.set(
            playerPosVec.x,
            group.position.y,
            playerPosVec.z
          );

          targetQuaternion.setFromRotationMatrix(
            lookMatrix.lookAt(group.position, flatLookTargetVec, upVector)
          );

          group.quaternion.slerp(targetQuaternion, Math.min(1, 10 * delta));
          return;
        }

        const isPlayerInsideTargetRadius = distance <= triggerRadius;
        const isDialogueActive = activeDialogueNpcIdRef.current != null;

        const isTemporaryDialogueAvailable =
          hasAnyTemporaryDialogueState(npc) &&
          !npc.temporaryDialogueDismissed;

        const isHandoffPending =
          npc.summonAutoOpenPending === true ||
          npc.dialogueHandoffPending === true ||
          npc.forceDialogueOpen === true;

        const midSequence =
          speakerTransitionDelayRef.current > 0 ||
          isMidSequenceRef.current ||
          transitionLockRef.current;

        const isAlreadyCompleted = npc.dialogueSequenceCompleted === true;

        const canTrigger =
          !isAlreadyCompleted &&
          ((isHandoffPending && !isDialogueActive) ||
            (isPlayerInsideTargetRadius &&
              !isDialogueActive &&
              !midSequence &&
              dialogueCooldownTimerRef.current <= 0 &&
              (hasExitedRadiusRef.current || isTemporaryDialogueAvailable) &&
              !dialogueRequestPendingRef.current &&
              !dialogueJustClosedRef.current));

        if (canTrigger) {
          if (
            hasExitedRadiusRef.current &&
            dialogueCooldownTimerRef.current <= 0
          ) {
            pendingSpeakerIndexRef.current = null;
            isMidSequenceRef.current = false;
            transitionLockRef.current = false;
            manualJumpActiveRef.current = false;
            speakerTransitionDelayRef.current = 0;

            setNpcs((prev) =>
              prev.map((n) =>
                n.id === npc.id
                  ? {
                      ...n,
                      currentSpeakerIndex: 0,
                      activeSpeakerName: undefined,
                      dialogueSequenceCompleted: false
                    }
                  : n
              )
            );

            resetSequenceCache();
          }

          dialogueJustClosedRef.current = false;

          beginSequenceCacheIfNeeded();

          const activeDialogue = getActiveNpcDialogue();

          if (activeDialogue != null) {
            console.log(
              `[Dialogue System] Triggering dialogue for ${
                npc.name || npc.id
              }. Handoff flag: ${isHandoffPending}`
            );

            openedTemporaryDialogueRef.current = isResolvedDialogueTemporary(
              npc,
              activeDialogue
            );

            hasExitedRadiusRef.current = false;
            dialogueRequestPendingRef.current = true;
            dialogueCooldownTimerRef.current = DIALOGUE_COOLDOWN_TIME;

            const cache = sequenceCacheRef.current;

            const talkers =
              cache.active && Array.isArray(cache.talkerNames)
                ? cache.talkerNames
                : npc.talkerNames;

            const currentIdx = clampIndex(
              npc.currentSpeakerIndex ?? 0,
              Array.isArray(talkers) ? talkers.length : 0
            );

            const currentSpeakerName = Array.isArray(talkers)
              ? talkers[currentIdx]
              : npc.name;

            const dialoguePayload = {
              ...activeDialogue,
              speakerName: currentSpeakerName
            };

            dialogueExitCloseRequestedRef.current = false;
            dialogueClosedByExitRef.current = false;

            startDialogue(npc.id, dialoguePayload);

            if (sequenceCacheRef.current.active) {
              dispatchBannerUpdate(currentIdx);
            }

            if (isHandoffPending) {
              setNpcs((prev) =>
                prev.map((n) =>
                  n.id === npc.id
                    ? {
                        ...n,
                        summonAutoOpenPending: false,
                        dialogueHandoffPending: false,
                        forceDialogueOpen: false
                      }
                    : n
                )
              );
            }
          }
        }

        if (!isPlayerInsideTargetRadius) {
          hasExitedRadiusRef.current = true;
          dialogueJustClosedRef.current = false;
          dialogueRequestPendingRef.current = false;
          dialogueExitTimerRef.current += delta;

          if (
            npc.dialogueSequenceCompleted &&
            hasEnteredDialogueRadiusRef.current
          ) {
            pendingSpeakerIndexRef.current = null;
            isMidSequenceRef.current = false;
            transitionLockRef.current = false;
            manualJumpActiveRef.current = false;
            speakerTransitionDelayRef.current = 0;

            resetSequenceCache();

            setNpcs((prev) =>
              prev.map((n) =>
                n.id === npc.id
                  ? {
                      ...n,
                      currentSpeakerIndex: 0,
                      activeSpeakerName: undefined,
                      dialogueSequenceCompleted: false
                    }
                  : n
              )
            );

            hasEnteredDialogueRadiusRef.current = false;
            dialogueCooldownTimerRef.current = DIALOGUE_COOLDOWN_TIME;
          }

          const clearDistance =
            npc.clearTemporaryDialogueDistance ??
            npc.temporaryDialogueClearDistance ??
            npc.detection?.clearTemporaryDialogueDistance ??
            triggerRadius;

          const clearDelaySeconds = getTemporaryDialogueClearDelaySeconds(
            npc,
            DIALOGUE_COOLDOWN_TIME
          );

          const hasActiveTemp = hasAnyTemporaryDialogueState(npc);

          const shouldClear =
            hasActiveTemp &&
            distance > clearDistance &&
            dialogueExitTimerRef.current >= clearDelaySeconds;

          if (shouldClear && activeDialogueNpcIdRef.current !== npc.id) {
            clearNpcTemporaryDialogue();
            hasEnteredDialogueRadiusRef.current = false;
            hasExitedRadiusRef.current = true;
            dialogueExitTimerRef.current = 0;
          }

          // IMPORTANT:
          // The detection-radius cooldown must never cancel a movement route.
          // Temporary waypoints belong to movement/summon/path logic, not dialogue
          // logic. They are removed only when reached or when invalid/blocked in the
          // temporary-waypoint handling below.
          if (dialogueExitTimerRef.current >= DIALOGUE_COOLDOWN_TIME) {
            dialogueExitTimerRef.current = 0;
          }
        }
      }
    }

    frameCounter.current += 1;
    positionSyncTimerRef.current += delta;
    detectionTimerRef.current += delta;
    nearbyObstacleTimerRef.current += delta;
    waypointValidationTimerRef.current += delta;

    if (frameCounter.current % 15 === 0) {
      const now = Date.now();

      if (girlRef?.current) {
        girlRef.current.getWorldPosition(playerPosVec);
      } else {
        playerPosVec.set(Infinity, Infinity, Infinity);
      }

      setNpcs((prevNpcs) => {
        let changed = false;

        const nextList = prevNpcs.map((item) => {
          const hasTemp = hasAnyTemporaryDialogueState(item);

          if (!item.isSummoned || !hasTemp) return item;

          const clearDistance =
            item.clearTemporaryDialogueDistance ??
            item.temporaryDialogueClearDistance ??
            item.detection?.clearTemporaryDialogueDistance ??
            item.detection?.radius ??
            3;

          let shouldClear = false;

          if (Array.isArray(item.position) && item.position.length >= 3) {
            const dx = item.position[0] - playerPosVec.x;
            const dy = item.position[1] - playerPosVec.y;
            const dz = item.position[2] - playerPosVec.z;
            const distSq = dx * dx + dy * dy + dz * dz;

            if (distSq > clearDistance * clearDistance) {
              shouldClear = true;
            }
          }

          const clearDelaySeconds = getTemporaryDialogueClearDelaySeconds(
            item,
            DIALOGUE_COOLDOWN_TIME
          );

          if (
            !shouldClear &&
            item.id !== activeDialogueNpcIdRef.current &&
            item.summonAutoOpenPending !== true &&
            Number.isFinite(clearDelaySeconds) &&
            item.summonedAt
          ) {
            const elapsedSeconds = (now - item.summonedAt) / 1000;

            if (elapsedSeconds >= clearDelaySeconds) {
              shouldClear = true;
            }
          }

          if (shouldClear) {
            changed = true;
            return clearNpcTemporaryDialogueState(item);
          }

          return item;
        });

        return changed ? nextList : prevNpcs;
      });

      if (!npc.isSummoned) {
        cleanupSummonedCopies();
      }
    }

    if (unstuckCooldownRef.current > 0) {
      unstuckCooldownRef.current = Math.max(
        0,
        unstuckCooldownRef.current - delta
      );
    }

    if (waypointValidationTimerRef.current >= WAYPOINT_RECHECK_INTERVAL) {
      waypointValidationTimerRef.current = 0;
      waypointValidationCacheRef.current.clear();
      blockedWaypointKeysRef.current.clear();
    }

    const movementMode = npc.movement?.mode || npc.movement?.type || "idle";
    const detectionRadius = npc.detection?.radius ?? 6;
    const behaviorMode = npc.detection?.behavior || "look";
    const targetType = npc.detection?.targetType || "both";

    const stopDistance =
      npc.movement?.stopDistance ??
      npc.detection?.stopDistance ??
      (npc.isSummoned ? 1.25 : 0.8);

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

      const waypointKey = `${waypointIndex}:${x.toFixed(3)}:${y.toFixed(
        3
      )}:${z.toFixed(3)}`;

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

    let targetX = group.position.x;
    let targetY = group.position.y;
    let targetZ = group.position.z;
    let isMoving = false;
    let isTargetReached = false;
    let waypointIndexToSet = null;
    let waypointDirectionToSet = null;
    let reachedTemporaryWaypoint = null;
    let activeRouteType = null;
    let activeRouteWaypoints = null;
    let activeRouteIndex = null;

    if (npc.summonedToNpcId) {
      const callerRef = npcRefs?.current?.[npc.summonedToNpcId];
      const callerGroup = callerRef?.current;

      if (!callerGroup) {
        setNpcs((prev) =>
          prev.map((n) =>
            n.id === npc.id && n.summonedToNpcId !== null
              ? { ...n, summonedToNpcId: null }
              : n
          )
        );
        return;
      }

      updateAiState("Summoned");
      wanderTargetRef.current = null;

      callerGroup.getWorldPosition(targetPosVec);

      targetX = targetPosVec.x;
      targetY = group.position.y;
      targetZ = targetPosVec.z;

      const distanceToCaller = group.position.distanceTo(targetPosVec);

      if (distanceToCaller > SUMMON_STOP_DISTANCE) {
        isMoving = true;
      } else {
        flatLookTargetVec.set(
          targetPosVec.x,
          group.position.y,
          targetPosVec.z
        );

        targetQuaternion.setFromRotationMatrix(
          lookMatrix.lookAt(group.position, flatLookTargetVec, upVector)
        );

        group.quaternion.slerp(targetQuaternion, Math.min(1, 10 * delta));

        setNpcs((prev) =>
          prev.map((n) =>
            n.id === npc.id
              ? {
                  ...n,
                  position: [
                    group.position.x,
                    group.position.y,
                    group.position.z
                  ],
                  summonedToNpcId: null
                }
              : n
          )
        );

        positionSyncTimerRef.current = 0;
        syncIntervalRef.current = 1.1 + Math.random() * 0.5;
        return;
      }
    } else {
      const temporaryWaypoints = Array.isArray(npc.temporaryWaypoints)
        ? npc.temporaryWaypoints
        : [];

      if (temporaryWaypoints.length > 0) {
        wanderTargetRef.current = null;
        waitTimerRef.current = 0;
        updateAiState("Patrolling");

        let tempIndex = 0;
        let targetTempWaypoint = null;
        let targetTempPos = null;

        for (; tempIndex < temporaryWaypoints.length; tempIndex += 1) {
          const candidateWaypoint = temporaryWaypoints[tempIndex];
          const candidatePosition = getWaypointPos(candidateWaypoint);

          if (
            candidatePosition &&
            !isWaypointInsideObstacle(candidatePosition, `temp-${tempIndex}`)
          ) {
            targetTempWaypoint = candidateWaypoint;
            targetTempPos = candidatePosition;
            break;
          }
        }

        if (!targetTempWaypoint || !targetTempPos) {
          setNpcs((prev) =>
            prev.map((n) => {
              if (n.id !== npc.id) return n;

              const restoredIndex =
                n.savedPatrolWaypointIndex ?? n.currentWaypointIndex ?? 0;

              const restoredDirection =
                n.savedPatrolDirection ?? n.patrolDirection ?? 1;

              return {
                ...n,
                temporaryWaypoints: [],
                currentWaypointIndex: restoredIndex,
                patrolDirection: restoredDirection,
                savedPatrolWaypointIndex: undefined,
                savedPatrolDirection: undefined
              };
            })
          );

          noProgressTimerRef.current = 0;
          progressSampleTimerRef.current = 0;
          stuckTimerRef.current = 0;
          detourDirectionRef.current = 1;
          return;
        }

        if (tempIndex > 0) {
          setNpcs((prev) =>
            prev.map((n) => {
              if (n.id !== npc.id) return n;

              return {
                ...n,
                temporaryWaypoints: temporaryWaypoints.slice(tempIndex),
                savedPatrolWaypointIndex:
                  n.savedPatrolWaypointIndex ?? n.currentWaypointIndex ?? 0,
                savedPatrolDirection:
                  n.savedPatrolDirection ?? n.patrolDirection ?? 1
              };
            })
          );

          noProgressTimerRef.current = 0;
          progressSampleTimerRef.current = 0;
          stuckTimerRef.current = 0;
          detourDirectionRef.current = 1;
          return;
        }

        if (
          npc.savedPatrolWaypointIndex === undefined ||
          npc.savedPatrolDirection === undefined
        ) {
          setNpcs((prev) =>
            prev.map((n) => {
              if (n.id !== npc.id) return n;

              if (
                !Array.isArray(n.temporaryWaypoints) ||
                n.temporaryWaypoints.length === 0
              ) {
                return n;
              }

              return {
                ...n,
                savedPatrolWaypointIndex: n.currentWaypointIndex ?? 0,
                savedPatrolDirection: n.patrolDirection ?? 1
              };
            })
          );
        }

        activeRouteType = "temporary";
        activeRouteWaypoints = temporaryWaypoints;
        activeRouteIndex = 0;

        targetX = targetTempPos[0] ?? group.position.x;
        targetY = targetTempPos[1] ?? group.position.y;
        targetZ = targetTempPos[2] ?? group.position.z;

        targetPosVec.set(targetX, targetY, targetZ);

        const distance = group.position.distanceTo(targetPosVec);

        if (distance <= TEMP_WAYPOINT_REACH_DISTANCE) {
          group.position.set(targetX, targetY, targetZ);

          const nodeWaitTime = getWaypointWaitTime(
            targetTempWaypoint,
            npc.movement?.waitTime ?? 0
          );

          if (nodeWaitTime > 0) {
            waitTimerRef.current = nodeWaitTime;
          }

          isTargetReached = true;
          reachedTemporaryWaypoint = targetTempWaypoint;
        } else {
          isMoving = true;
        }
      } else {
        const explicitFollowTarget =
          movementMode === "chase" || movementMode === "follow"
            ? resolveNpcTargetPosition(npc.followTargetNpcId, true)
            : null;

        if (movementMode === "chase" || movementMode === "follow") {
          wanderTargetRef.current = null;
          waitTimerRef.current = 0;
          activeRouteType = "follow";

          if (explicitFollowTarget) {
            targetX = explicitFollowTarget.x;
            targetY = group.position.y;
            targetZ = explicitFollowTarget.z;

            targetPosVec.set(targetX, targetY, targetZ);

            const distanceToTarget = group.position.distanceTo(targetPosVec);

            if (distanceToTarget > stopDistance) {
              updateAiState("Chasing");
              isMoving = true;
            } else {
              updateAiState(
                movementMode === "follow" ? "Summoned" : "Chasing"
              );

              flatLookTargetVec.set(
                targetX,
                group.position.y,
                targetZ
              );

              targetQuaternion.setFromRotationMatrix(
                lookMatrix.lookAt(group.position, flatLookTargetVec, upVector)
              );

              group.quaternion.slerp(
                targetQuaternion,
                Math.min(1, 10 * delta)
              );

              return;
            }
          } else {
            updateAiState("Idle");
            return;
          }
        } else {
          let detectedTargetPos = null;
          let detectedTargetType = null;
          let detectedTargetName = null;
          let nearestTargetDistance = Infinity;

          const reactions = npc.reactions || npc.detection?.reactions || {};

          if (detectionTimerRef.current >= 0.25) {
            detectionTimerRef.current = 0;

            detectedTargetRef.current = {
              hasTarget: false,
              type: null,
              name: null,
              behavior: behaviorMode,
              distance: Infinity,
              x: 0,
              y: 0,
              z: 0
            };

            const getPriority = (behavior) => {
              if (behavior === "chase" || behavior === "attack") return 3;
              if (behavior === "flee") return 2;
              if (behavior === "look") return 1;
              return 0;
            };

            let bestPriority = -1;

            if (
              (targetType === "player" || targetType === "both") &&
              girlRef?.current
            ) {
              girlRef.current.getWorldPosition(playerPosVec);

              const distanceToPlayer = group.position.distanceTo(playerPosVec);

              if (distanceToPlayer <= detectionRadius) {
                const playerBehavior = reactions.player ?? behaviorMode;
                const playerPriority = getPriority(playerBehavior);

                if (playerBehavior !== "ignore") {
                  if (playerPriority > bestPriority) {
                    detectedTargetRef.current = {
                      hasTarget: true,
                      type: "player",
                      name: "Player",
                      behavior: playerBehavior,
                      distance: distanceToPlayer,
                      x: playerPosVec.x,
                      y: playerPosVec.y,
                      z: playerPosVec.z
                    };

                    bestPriority = playerPriority;
                  }
                }
              }
            }

            if (
              (targetType === "npc" ||
                targetType === "npcs" ||
                targetType === "both") &&
              Array.isArray(npcs) &&
              npcs.length > 1
            ) {
              for (const otherNpc of npcs) {
                if (!otherNpc || otherNpc.id === npc.id) continue;

                if (npc.isSummoned) {
                  const sameSummonFamily =
                    otherNpc.id === npc.summonedByNpcId ||
                    otherNpc.summonedByNpcId === npc.summonedByNpcId ||
                    otherNpc.summonedByNpcId === npc.id;

                  if (sameSummonFamily) continue;
                }

                const otherRef = npcRefs?.current?.[otherNpc.id];
                const otherGroup = otherRef?.current;

                if (otherGroup) {
                  otherGroup.getWorldPosition(otherPosVec);
                } else if (
                  Array.isArray(otherNpc.position) &&
                  otherNpc.position.length >= 3
                ) {
                  otherPosVec.set(
                    otherNpc.position[0] ?? 0,
                    otherNpc.position[1] ?? 0,
                    otherNpc.position[2] ?? 0
                  );
                } else {
                  continue;
                }

                const dist = group.position.distanceTo(otherPosVec);

                if (dist <= detectionRadius) {
                  const npcBehavior =
                    reactions[otherNpc.id] ?? behaviorMode;

                  const npcPriority = getPriority(npcBehavior);

                  if (npcBehavior === "ignore") continue;

                  if (
                    npcPriority > bestPriority ||
                    (npcPriority === bestPriority &&
                      dist < detectedTargetRef.current.distance)
                  ) {
                    detectedTargetRef.current = {
                      hasTarget: true,
                      type: "npc",
                      name: otherNpc.name || otherNpc.id,
                      behavior: npcBehavior,
                      distance: dist,
                      x: otherPosVec.x,
                      y: otherPosVec.y,
                      z: otherPosVec.z
                    };

                    bestPriority = npcPriority;
                  }
                }
              }
            }
          }

          if (detectedTargetRef.current.hasTarget) {
            const activeBehavior =
              detectedTargetRef.current.behavior || behaviorMode;

            if (activeBehavior !== "ignore") {
              wanderTargetRef.current = null;

              if (
                activeBehavior === "chase" ||
                activeBehavior === "attack"
              ) {
                updateAiState("Chasing");

                targetPosVec.set(
                  detectedTargetRef.current.x,
                  detectedTargetRef.current.y,
                  detectedTargetRef.current.z
                );

                targetX = targetPosVec.x;
                targetY = group.position.y;
                targetZ = targetPosVec.z;

                const distance = group.position.distanceTo(targetPosVec);

                if (distance > stopDistance) {
                  isMoving = true;
                } else {
                  flatLookTargetVec.set(
                    targetPosVec.x,
                    group.position.y,
                    targetPosVec.z
                  );

                  targetQuaternion.setFromRotationMatrix(
                    lookMatrix.lookAt(
                      group.position,
                      flatLookTargetVec,
                      upVector
                    )
                  );

                  group.quaternion.slerp(
                    targetQuaternion,
                    Math.min(1, 10 * delta)
                  );

                  return;
                }
              } else if (activeBehavior === "flee") {
                updateAiState("Alerted");

                tempVec2
                  .subVectors(
                    group.position,
                    new THREE.Vector3(
                      detectedTargetRef.current.x,
                      detectedTargetRef.current.y,
                      detectedTargetRef.current.z
                    )
                  )
                  .setY(0);

                if (tempVec2.lengthSq() > 0.0001) {
                  tempVec2.normalize();

                  targetX =
                    group.position.x + tempVec2.x * detectionRadius;
                  targetY = group.position.y;
                  targetZ =
                    group.position.z + tempVec2.z * detectionRadius;

                  isMoving = true;
                } else {
                  return;
                }
              } else {
                updateAiState("Alerted");

                flatLookTargetVec.set(
                  detectedTargetRef.current.x,
                  group.position.y,
                  detectedTargetRef.current.z
                );

                targetQuaternion.setFromRotationMatrix(
                  lookMatrix.lookAt(
                    group.position,
                    flatLookTargetVec,
                    upVector
                  )
                );

                group.quaternion.slerp(
                  targetQuaternion,
                  Math.min(1, 10 * delta)
                );

                return;
              }
            }
          } else {
            if (movementMode === "idle" || movementMode === "static") {
              wanderTargetRef.current = null;
              updateAiState("Idle");
              return;
            }

            if (movementMode === "wander") {
              updateAiState("Patrolling");

              const wanderRadius =
                npc.movement?.wanderRadius ?? npc.wanderRadius ?? 5;

              if (!wanderOriginRef.current) {
                wanderOriginRef.current = [
                  group.position.x,
                  group.position.y,
                  group.position.z
                ];
              }

              if (waitTimerRef.current > 0) {
                waitTimerRef.current -= delta;
                noProgressTimerRef.current = 0;
                progressSampleTimerRef.current = 0;

                if (lastProgressPositionRef.current) {
                  lastProgressPositionRef.current.copy(group.position);
                }

                return;
              }

              if (!wanderTargetRef.current) {
                const angle = Math.random() * Math.PI * 2;
                const distance = Math.max(
                  0.75,
                  Math.random() * wanderRadius
                );

                const origin = wanderOriginRef.current;

                wanderTargetRef.current = [
                  origin[0] + Math.cos(angle) * distance,
                  group.position.y,
                  origin[2] + Math.sin(angle) * distance
                ];
              }

              targetX = wanderTargetRef.current[0];
              targetY = wanderTargetRef.current[1];
              targetZ = wanderTargetRef.current[2];

              targetPosVec.set(targetX, targetY, targetZ);

              if (group.position.distanceTo(targetPosVec) <= 0.2) {
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

              if (
                !Array.isArray(npc.waypoints) ||
                npc.waypoints.length === 0
              ) {
                updateAiState("Idle");
                return;
              }

              if (waitTimerRef.current > 0) {
                updateAiState("Idle");
                waitTimerRef.current -= delta;
                noProgressTimerRef.current = 0;
                progressSampleTimerRef.current = 0;

                if (lastProgressPositionRef.current) {
                  lastProgressPositionRef.current.copy(group.position);
                }

                return;
              }

              updateAiState("Patrolling");

              let currentIndex = npc.currentWaypointIndex ?? 0;

              if (
                currentIndex < 0 ||
                currentIndex >= npc.waypoints.length
              ) {
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
                  lastProgressPositionRef.current.copy(group.position);
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

              activeRouteType = "patrol";
              activeRouteWaypoints = npc.waypoints;
              activeRouteIndex = currentIndex;

              targetX = target[0] ?? group.position.x;
              targetY = target[1] ?? group.position.y;
              targetZ = target[2] ?? group.position.z;

              targetPosVec.set(targetX, targetY, targetZ);

              const distance = group.position.distanceTo(targetPosVec);

              if (distance <= 0.15) {
                group.position.set(targetX, targetY, targetZ);

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
        }
      }
    }

    if (isTargetReached && reachedTemporaryWaypoint) {
      setNpcs((prev) =>
        prev.map((n) => {
          if (n.id !== npc.id) return n;

          const existingTemporaryWaypoints = Array.isArray(
            n.temporaryWaypoints
          )
            ? n.temporaryWaypoints
            : [];

          let removeCount = 0;

          while (
            removeCount < existingTemporaryWaypoints.length &&
            areWaypointPositionsEqual(
              existingTemporaryWaypoints[removeCount],
              reachedTemporaryWaypoint
            )
          ) {
            removeCount += 1;
          }

          const remainingTemporaryWaypoints = existingTemporaryWaypoints.slice(
            removeCount || 1
          );

          const nextNpc = {
            ...n,
            position: [
              group.position.x,
              group.position.y,
              group.position.z
            ],
            temporaryWaypoints: remainingTemporaryWaypoints
          };

          if (remainingTemporaryWaypoints.length === 0) {
            nextNpc.currentWaypointIndex =
              n.savedPatrolWaypointIndex ?? n.currentWaypointIndex ?? 0;

            nextNpc.patrolDirection =
              n.savedPatrolDirection ?? n.patrolDirection ?? 1;

            nextNpc.savedPatrolWaypointIndex = undefined;
            nextNpc.savedPatrolDirection = undefined;
          }

          return nextNpc;
        })
      );

      positionSyncTimerRef.current = 0;
      syncIntervalRef.current = 1.1 + Math.random() * 0.5;
      return;
    }

    if (isTargetReached && waypointIndexToSet !== null) {
      setNpcs((prev) =>
        prev.map((n) =>
          n.id === npc.id
            ? {
                ...n,
                position: [
                  group.position.x,
                  group.position.y,
                  group.position.z
                ],
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

      directionVec.subVectors(targetPosVec, group.position);

      const distanceToTarget = directionVec.length();

      if (distanceToTarget < 0.0001) return;

      directionVec.normalize();

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

            if (
              group.position.distanceToSquared(obstacleWorldPosVec) <=
              maxDistSq
            ) {
              nearby.push(obj);
            }
          }

          nearbyObstaclesRef.current = nearby;
        } else {
          nearbyObstaclesRef.current = [];
        }
      }

      const nearbyObstacles = nearbyObstaclesRef.current;

      const isPositionplus = (position, extraPadding = 0.03) => {
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

      if (isPositionplus(group.position, 0.01)) {
        if (!lastSafePositionRef.current) {
          lastSafePositionRef.current = group.position.clone();
        } else {
          lastSafePositionRef.current.copy(group.position);
        }
      }

      progressSampleTimerRef.current += delta;

      if (!lastProgressPositionRef.current) {
        lastProgressPositionRef.current = group.position.clone();
      }

      if (progressSampleTimerRef.current >= UNSTUCK_SAMPLE_INTERVAL) {
        const sampleTime = progressSampleTimerRef.current;
        progressSampleTimerRef.current = 0;

        const movedDistance = group.position.distanceTo(
          lastProgressPositionRef.current
        );

        if (movedDistance >= UNSTUCK_PROGRESS_DISTANCE) {
          noProgressTimerRef.current = 0;
          unstuckAttemptsRef.current = 0;
        } else if (unstuckCooldownRef.current <= 0) {
          noProgressTimerRef.current += sampleTime;
        }

        lastProgressPositionRef.current.copy(group.position);
      }

      if (
        noProgressTimerRef.current >= UNSTUCK_TRIGGER_TIME &&
        unstuckCooldownRef.current <= 0
      ) {
        unstuckAttemptsRef.current += 1;
        unstuckStartVec.copy(group.position);

        let foundRecoveryPosition = false;
        let bestRecoveryScore = Infinity;

        const attemptBonus =
          Math.min(unstuckAttemptsRef.current - 1, 3) * 0.35;

        const searchRadii = [
          npcRadius * 2 + 0.2 + attemptBonus,
          npcRadius * 3 + 0.45 + attemptBonus,
          npcRadius * 4 + 0.75 + attemptBonus
        ];

        const baseAngle = Math.atan2(directionVec.z, directionVec.x);

        for (const radius of searchRadii) {
          const candidateCount = 16;

          for (
            let candidateIndex = 0;
            candidateIndex < candidateCount;
            candidateIndex += 1
          ) {
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

            if (!isPositionplus(unstuckCandidateVec, 0.08)) continue;

            const targetScore =
              unstuckCandidateVec.distanceToSquared(targetPosVec);

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
          isPositionplus(lastSafePositionRef.current, 0.08)
        ) {
          unstuckBestVec.copy(lastSafePositionRef.current);
          foundRecoveryPosition = true;
        }

        const activeWaypoint =
          Array.isArray(activeRouteWaypoints) && activeRouteIndex !== null
            ? activeRouteWaypoints[activeRouteIndex]
            : null;

        const activeWaypointPosition = getWaypointPos(activeWaypoint);

        const activeWaypointIsBlocked =
          activeRouteType &&
          activeWaypointPosition &&
          isWaypointInsideObstacle(
            activeWaypointPosition,
            activeRouteType === "temporary"
              ? `temp-${activeRouteIndex}`
              : activeRouteIndex
          );

        if (activeWaypointIsBlocked) {
          stuckTimerRef.current = 0;
          detourDirectionRef.current = 0;
          noProgressTimerRef.current = 0;
          progressSampleTimerRef.current = 0;
          unstuckAttemptsRef.current = 0;
          unstuckCooldownRef.current = UNSTUCK_COOLDOWN;

          if (foundRecoveryPosition) {
            group.position.copy(unstuckBestVec);
            lastProgressPositionRef.current.copy(group.position);

            if (!lastSafePositionRef.current) {
              lastSafePositionRef.current = group.position.clone();
            } else {
              lastSafePositionRef.current.copy(group.position);
            }
          }

          if (activeRouteType === "temporary") {
            setNpcs((prev) =>
              prev.map((n) =>
                n.id === npc.id
                  ? {
                      ...n,
                      position: [
                        group.position.x,
                        group.position.y,
                        group.position.z
                      ],
                      temporaryWaypoints: Array.isArray(n.temporaryWaypoints)
                        ? n.temporaryWaypoints.slice(1)
                        : []
                    }
                  : n
              )
            );
          } else if (activeRouteType === "patrol") {
            const nextPatrol = getNextPatrolWaypoint(
              activeRouteIndex,
              npc.waypoints.length,
              npc.patrolMode,
              npc.patrolDirection ?? 1
            );

            setNpcs((prev) =>
              prev.map((n) =>
                n.id === npc.id
                  ? {
                      ...n,
                      position: [
                        group.position.x,
                        group.position.y,
                        group.position.z
                      ],
                      currentWaypointIndex: nextPatrol.nextIndex,
                      patrolDirection: nextPatrol.nextDirection
                    }
                  : n
              )
            );
          }

          return;
        }

        if (foundRecoveryPosition) {
          group.position.copy(unstuckBestVec);
          stuckTimerRef.current = 0;
          detourDirectionRef.current = 0;
          noProgressTimerRef.current = 0;
          progressSampleTimerRef.current = 0;
          unstuckCooldownRef.current = UNSTUCK_COOLDOWN;

          lastProgressPositionRef.current.copy(group.position);

          if (!lastSafePositionRef.current) {
            lastSafePositionRef.current = group.position.clone();
          } else {
            lastSafePositionRef.current.copy(group.position);
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
                    position: [
                      group.position.x,
                      group.position.y,
                      group.position.z
                    ]
                  }
                : n
            )
          );

          positionSyncTimerRef.current = 0;
          syncIntervalRef.current = 1.1 + Math.random() * 0.5;
          return;
        }

        noProgressTimerRef.current = UNSTUCK_TRIGGER_TIME * 0.6;
        unstuckCooldownRef.current = 0.5;
      }

      rayOriginVec.copy(group.position).addScaledVector(upVector, 0.75);
      raycaster.far = raycastDist;

      let closestBlocker = null;
      let minBlockerDist = Infinity;

      const isDirectionplusFromObstacles = (testDirection) => {
        if (!nearbyObstacles || nearbyObstacles.length === 0) return true;

        raycaster.set(rayOriginVec, testDirection);

        const intersections = raycaster.intersectObjects(
          nearbyObstacles,
          true
        );

        if (
          intersections.length > 0 &&
          intersections[0].distance <= raycastDist
        ) {
          closestBlocker = intersections[0].object;
          return false;
        }

        predictedPosVec
          .copy(group.position)
          .addScaledVector(
            testDirection,
            moveStep + npcRadius + collisionPadding
          );

        const npcMinY = group.position.y + 0.05;
        const npcMaxY = group.position.y + npcHeight;

        for (const obstacle of nearbyObstacles) {
          if (!obstacle || obstacle.visible === false) continue;

          obstacle.updateWorldMatrix?.(true, false);
          obstacleBox.setFromObject(obstacle);

          if (obstacleBox.isEmpty()) continue;

          obstacleBox.expandByScalar(npcRadius + collisionPadding);

          if (!(npcMaxY >= obstacleBox.min.y && npcMinY <= obstacleBox.max.y)) {
            continue;
          }

          if (
            predictedPosVec.x >= obstacleBox.min.x &&
            predictedPosVec.x <= obstacleBox.max.x &&
            predictedPosVec.z >= obstacleBox.min.z &&
            predictedPosVec.z <= obstacleBox.max.z
          ) {
            obstacleBox.getCenter(obstacleCenterVec);

            const distSq =
              group.position.distanceToSquared(obstacleCenterVec);

            if (distSq < minBlockerDist) {
              minBlockerDist = distSq;
              closestBlocker = obstacle;
            }

            return false;
          }
        }

        return true;
      };

      chosenDirectionVec.copy(directionVec);

      if (!isDirectionplusFromObstacles(directionVec)) {
        stuckTimerRef.current += delta;

        if (detourDirectionRef.current === 0) {
          if (closestBlocker) {
            obstacleBox.setFromObject(closestBlocker);
            obstacleBox.getCenter(obstacleCenterVec);

            tempVec2.set(-directionVec.z, 0, directionVec.x);
            tempVec3.subVectors(obstacleCenterVec, group.position);

            detourDirectionRef.current =
              tempVec3.dot(tempVec2) > 0 ? -1 : 1;
          } else {
            detourDirectionRef.current = Math.random() > 0.5 ? 1 : -1;
          }
        }

        const sign = detourDirectionRef.current;

        const steerAngles =
          stuckTimerRef.current > 0.4
            ? [
                sign * (Math.PI / 3),
                sign * (Math.PI / 2),
                sign * (Math.PI * 0.75),
                -sign * (Math.PI / 3),
                -sign * (Math.PI / 2),
                -sign * (Math.PI * 0.75),
                Math.PI
              ]
            : [
                sign * (Math.PI / 6),
                sign * (Math.PI / 4),
                sign * (Math.PI / 3),
                sign * (Math.PI / 2),
                -sign * (Math.PI / 6),
                -sign * (Math.PI / 4),
                -sign * (Math.PI / 3),
                -sign * (Math.PI / 2)
              ];

        let foundClearDirection = false;

        for (const angle of steerAngles) {
          tempVec4
            .copy(directionVec)
            .applyAxisAngle(upVector, angle)
            .normalize();

          if (isDirectionplusFromObstacles(tempVec4)) {
            chosenDirectionVec.copy(tempVec4);
            foundClearDirection = true;
            break;
          }
        }

        if (!foundClearDirection && closestBlocker) {
          obstacleBox.setFromObject(closestBlocker);
          obstacleBox.expandByScalar(npcRadius + 0.1);

          cornerVectors[0].set(
            obstacleBox.min.x,
            group.position.y,
            obstacleBox.min.z
          );

          cornerVectors[1].set(
            obstacleBox.max.x,
            group.position.y,
            obstacleBox.min.z
          );

          cornerVectors[2].set(
            obstacleBox.min.x,
            group.position.y,
            obstacleBox.max.z
          );

          cornerVectors[3].set(
            obstacleBox.max.x,
            group.position.y,
            obstacleBox.max.z
          );

          let bestCorner = null;
          let bestScore = Infinity;

          for (const corner of cornerVectors) {
            tempVec5.subVectors(corner, group.position);

            if (tempVec5.lengthSq() < 0.0001) continue;

            tempVec4.copy(tempVec5).normalize();

            if (isDirectionplusFromObstacles(tempVec4)) {
              const distToTargetSq =
                corner.distanceToSquared(targetPosVec);

              if (distToTargetSq < bestScore) {
                bestScore = distToTargetSq;
                bestCorner = corner;
              }
            }
          }

          if (bestCorner) {
            chosenDirectionVec
              .subVectors(bestCorner, group.position)
              .normalize();

            foundClearDirection = true;
          }
        }

        if (!foundClearDirection) {
          if (stuckTimerRef.current > 1.2) {
            tempVec4
              .copy(directionVec)
              .applyAxisAngle(upVector, sign * Math.PI * 0.75)
              .normalize();

            if (isDirectionplusFromObstacles(tempVec4)) {
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
        group.position.addScaledVector(chosenDirectionVec, moveStep);

        if (positionSyncTimerRef.current >= syncIntervalRef.current) {
          positionSyncTimerRef.current = 0;
          syncIntervalRef.current = 1.1 + Math.random() * 0.5;

          const lastSaved = npc.position || [0, 0, 0];

          const dx = group.position.x - lastSaved[0];
          const dy = group.position.y - lastSaved[1];
          const dz = group.position.z - lastSaved[2];

          const movedSq = dx * dx + dy * dy + dz * dz;

          if (movedSq > 0.04) {
            setNpcs((prev) =>
              prev.map((n) =>
                n.id === npc.id
                  ? {
                      ...n,
                      position: [
                        group.position.x,
                        group.position.y,
                        group.position.z
                      ]
                    }
                  : n
              )
            );

            lastAppliedNpcPositionRef.current = [
              group.position.x,
              group.position.y,
              group.position.z
            ];
          }
        }

        flatLookTargetVec.set(
          group.position.x + chosenDirectionVec.x,
          group.position.y,
          group.position.z + chosenDirectionVec.z
        );

        targetQuaternion.setFromRotationMatrix(
          lookMatrix.lookAt(group.position, flatLookTargetVec, upVector)
        );

        group.quaternion.slerp(targetQuaternion, Math.min(1, 8 * delta));
      }
    }
  });

  const getStateColor = () => {
    switch (aiState) {
      case "Talking":
        return "#a855f7";
      case "Summoned":
        return "#f59e0b";
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

    if (focusCameraOnNpc) {
      focusCameraOnNpc(npc.position);
    }

    if (npc.isSummoned) return;

    if (
      startDialogue &&
      npcHasDialogue &&
      activeDialogueNpcIdRef.current == null &&
      !dialogueRequestPendingRef.current
    ) {
      beginSequenceCacheIfNeeded();

      const activeDialogue = getActiveNpcDialogue();

      if (activeDialogue != null) {
        openedTemporaryDialogueRef.current = isResolvedDialogueTemporary(
          npc,
          activeDialogue
        );

        pendingTemporaryDialogueClearRef.current = false;
        hasExitedRadiusRef.current = false;
        dialogueRequestPendingRef.current = true;
        dialogueCooldownTimerRef.current = DIALOGUE_COOLDOWN_TIME;

        const cache = sequenceCacheRef.current;

        const talkers =
          cache.active && Array.isArray(cache.talkerNames)
            ? cache.talkerNames
            : npc.talkerNames;

        const currentIdx = clampIndex(
          npc.currentSpeakerIndex ?? 0,
          Array.isArray(talkers) ? talkers.length : 0
        );

        const currentSpeakerName = Array.isArray(talkers)
          ? talkers[currentIdx]
          : npc.name;

        const dialoguePayload = {
          ...activeDialogue,
          speakerName: currentSpeakerName
        };

        setNpcs((prev) =>
          prev.map((n) =>
            n.id === npc.id
              ? {
                  ...n,
                  dialogueSequenceCompleted: false
                }
              : n
          )
        );

        dialogueExitCloseRequestedRef.current = false;
        dialogueClosedByExitRef.current = false;

        startDialogue(npc.id, dialoguePayload);

        if (sequenceCacheRef.current.active) {
          dispatchBannerUpdate(currentIdx);
        }
      }
    }
  };

  return {
    groupRef,
    aiState,
    handleNpcClick,
    getStateColor
  };
}










