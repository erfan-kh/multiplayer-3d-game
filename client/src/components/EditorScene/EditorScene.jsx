import React, {
  useEffect,
  useRef,
  useState,
  useMemo,
  memo,
  useCallback,
} from "react";
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
import { buildAggregatedSpeakerData } from "../UIOverlay/npcInspector/dialogue/dialogueUtils";

const waypointTempVecA = new THREE.Vector3();
const waypointTempVecB = new THREE.Vector3();
const cleanupTempVecA = new THREE.Vector3();
const cleanupTempVecB = new THREE.Vector3();
const previewIntersectionVec = new THREE.Vector3();

const GRACE_PERIOD_MS = 3000;
const DIALOGUE_SWITCH_LOCK_MS = 250;

/**
 * Cleanup follows the summoner's interaction radius so summoned copies despawn
 * when the player leaves the summoner's session area.
 */
const getCleanupRadiusFromNpc = (npc) => {
  const candidates = [
    npc?.detectionRadius,
    npc?.areaRadius,
    npc?.interactionRadius,
    npc?.triggerRadius,
    npc?.dialogueRadius,
    npc?.restrictAreaRadius,
    npc?.area?.radius,
    npc?.detectionArea?.radius,
    npc?.interactionArea?.radius,
    npc?.detection?.radius,
  ];

  

  
  for (const value of candidates) {
    const numericValue = Number(value);
    if (Number.isFinite(numericValue) && numericValue > 0) {
      return numericValue * 1.1;
    }
  }

  return 6;
};


const getDialogueDetectionRadiusFromNpc = (npc) => {
  const candidates = [
    npc?.detectionRadius,
    npc?.areaRadius,
    npc?.interactionRadius,
    npc?.triggerRadius,
    npc?.dialogueRadius,
    npc?.restrictAreaRadius,
    npc?.area?.radius,
    npc?.detectionArea?.radius,
    npc?.interactionArea?.radius,
    npc?.detection?.radius,
  ];

  for (const value of candidates) {
    const numericValue = Number(value);

    if (Number.isFinite(numericValue) && numericValue > 0) {
      return numericValue;
    }
  }

  // Matches the existing fallback behavior, but without cleanup padding.
  return 6;
};





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

const createDialogueSequenceId = () => {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `dlg-seq-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
};

const normalizeOffset = (offset) => {
  if (!Array.isArray(offset)) return [1.5, 0, 0];
  return [
    Number(offset[0] ?? 1.5),
    Number(offset[1] ?? 0),
    Number(offset[2] ?? 0),
  ];
};

const normalizeDialogueChoices = (choices) => {
  if (!Array.isArray(choices)) return [];

  return choices.map((choice, index) => ({
    id: choice?.id || `choice-${index}`,
    text: choice?.text || choice?.dialogueText || "Choice",
    nextNodeId: choice?.nextNodeId || null,
    actions: Array.isArray(choice?.actions) ? choice.actions : [],
    conditions: Array.isArray(choice?.conditions) ? choice.conditions : [],
  }));
};

const buildDialogueTreeFromText = (text, choices) => {
  if (!text) return null;

  return {
    startNodeId: "root",
    nodes: {
      root: {
        id: "root",
        text,
        choices: normalizeDialogueChoices(choices),
      },
    },
  };
};

const hasAnyTemporaryDialogueState = (npc) => {
  if (!npc) return false;

  return !!(
    npc.hasTemporaryDialogue ||
    npc.temporaryDialogue ||
    npc.temporaryDialogueText ||
    npc.temporaryDialogueTree ||
    npc.temporaryDialogueOptions ||
    npc.temporaryPlayerChoices ||
    npc.priorityDialogue
  );
};

const isSummonedNpcProtectedForDialogue = (npc, activeDialogueNpcId = null) => {
  if (!npc) return false;

  const now = Date.now();

  return !!(
    npc.summonAutoOpenPending === true ||
    npc.dialogueHandoffPending === true ||
    npc.dialogueSequenceActive === true ||
    npc.forceDialogueOpen === true ||
    (npc.dialogueSequenceCompleted !== true &&
      npc.dialogueSequenceId &&
      hasAnyTemporaryDialogueState(npc)) ||
    Number(npc.dialogueLockExpiresAt ?? 0) > now ||
    Number(npc.sequenceLockExpiresAt ?? 0) > now ||
    npc.isTalking === true ||
    activeDialogueNpcId === npc.id
  );
};

/**
 * Lighter-weight version of isSummonedNpcProtectedForDialogue used ONLY by
 * the radius-based despawn cleanup loop.
 *
 * isSummonedNpcProtectedForDialogue() treats a clone as protected if its
 * dialogue sequence is merely "active"/"not completed yet" - which is
 * correct when deciding whether a NEW summon should wipe out an existing
 * clone (removeSummonedNpcsForCaller), but wrong for radius-based despawn:
 * dialogueSequenceActive is set to true the instant the first clone spawns
 * and is only ever cleared once the player actually finishes talking to it.
 * If the player never engages and simply walks away, that flag (and the
 * "sequence not completed" condition) never clears on its own - so the
 * clone was permanently protected from removal no matter how far the
 * player walked from the summoner, even after the summonCleanupArmed fix.
 *
 * This version keeps every genuinely time-bound / "something is happening
 * right now" protection (currently talking, lock timers, pending auto-open,
 * forced open), but drops the two indefinite "hasn't finished its dialogue
 * turn yet" conditions so an unengaged clone can still be despawned once
 * the player has been outside the summoner's detection radius long enough.
 */
const isSummonedNpcProtectedForRadiusCleanup = (npc, activeDialogueNpcId = null) => {
  if (!npc) return false;

  const now = Date.now();

  return !!(
    npc.summonAutoOpenPending === true ||
    npc.dialogueHandoffPending === true ||
    npc.forceDialogueOpen === true ||
    Number(npc.dialogueLockExpiresAt ?? 0) > now ||
    Number(npc.sequenceLockExpiresAt ?? 0) > now ||
    npc.isTalking === true ||
    activeDialogueNpcId === npc.id
  );
};

const removeSummonedNpcsForCaller = (
  prevNpcs,
  callerNpcId,
  { activeDialogueNpcId = null } = {}
) => {
  if (!callerNpcId) return prevNpcs;

  const now = Date.now();

  return prevNpcs.filter((npc) => {
    const isOwnedSummon = npc.isSummoned && npc.summonedByNpcId === callerNpcId;
    if (!isOwnedSummon) return true;

    const isVeryRecent =
      Number.isFinite(npc.summonedAt) && now - npc.summonedAt < GRACE_PERIOD_MS;

    const preserveForActiveSession =
      npc.summonAutoOpenPending === true ||
      npc.forceDialogueOpen === true ||
      npc.isTalking === true ||
      activeDialogueNpcId === npc.id ||
      isSummonedNpcProtectedForDialogue(npc, activeDialogueNpcId);

    const preserveByConfig = npc.despawnSummonedCopiesOnDialogueExit === false;

    return isVeryRecent || preserveForActiveSession || preserveByConfig;
  });
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

const getDistanceSquaredXZ = (a, b) => {
  const dx = a.x - b.x;
  const dz = a.z - b.z;
  return dx * dx + dz * dz;
};

const extractNpcIdFromCloseDialogueArgs = (args, fallbackNpcId = null) => {
  if (!Array.isArray(args) || args.length === 0) {
    return fallbackNpcId ?? null;
  }

  const firstArg = args[0];

  if (typeof firstArg === "string" || typeof firstArg === "number") {
    return firstArg;
  }

  if (firstArg && typeof firstArg === "object") {
    return (
      firstArg.npcId ??
      firstArg.targetNpcId ??
      firstArg.currentNpcId ??
      firstArg.id ??
      fallbackNpcId ??
      null
    );
  }

  return fallbackNpcId ?? null;
};

const getDialogueSequenceIdForNpc = (npc) => {
  if (!npc) return null;
  return npc.dialogueSequenceId || npc.summonBatchId || null;
};

/**
 * Dialogue Speakers Sequence helpers
 * Goal: prevent talkerNames/speakerData/currentSpeakerIndex from being dropped
 * during EditorScene-driven NPC state transitions (especially summon/handoff).
 */

/**
 * IMPORTANT: talkerNames order is authoritative (authored in NPCInspectorPanel).
 * Never "invent" placeholder talkers here. If data is missing, return [].
 */
const normalizeTalkerNames = (value) => {
  if (!Array.isArray(value)) return [];
  return value
    .map((v) => (v == null ? "" : String(v)).trim())
    .filter(Boolean);
};

/**
 * speakerData is a map keyed by speaker name (string) -> bucket object.
 * Never coerce arrays into objects.
 */
const normalizeSpeakerDataObject = (value) => {
  if (!value || typeof value !== "object") return {};
  if (Array.isArray(value)) return {};
  return { ...value };
};

const normalizeSequenceNodes = (value) => {
  if (!Array.isArray(value)) return [];
  return value.map((node, index) => {
    if (!node || typeof node !== "object") {
      return {
        id: `sequence-node-${index}`,
      };
    }

    return {
      ...node,
      id: node.id ?? `sequence-node-${index}`,
    };
  });
};

const extractDialogueSpeakersFields = (npcLike, fallback = null) => {
  const src = npcLike || fallback || {};
  const fromTop = {
    talkerNames: normalizeTalkerNames(src.talkerNames),
    speakerData: normalizeSpeakerDataObject(src.speakerData),
    currentSpeakerIndex: Number.isFinite(src.currentSpeakerIndex)
      ? src.currentSpeakerIndex
      : undefined,
    activeSpeakerName:
      typeof src.activeSpeakerName === "string" && src.activeSpeakerName.trim()
        ? src.activeSpeakerName.trim()
        : undefined,
    sequenceNodes: normalizeSequenceNodes(
      src.sequenceNodes ??
        src.dialogueSequenceNodes ??
        src.nodes ??
        src.dialogueNodes ??
        src.dialogueSequence?.nodes
    ),
    hasTalkersList: src.hasTalkersList === true,
  };

  const nestedTalkers =
    src?.dialogue?.talkers ||
    src?.dialogueSpeakers ||
    src?.dialogueSequence?.talkers ||
    null;

  const nestedSpeakerData =
    src?.dialogue?.speakerData ||
    src?.dialogueSequence?.speakerData ||
    src?.dialogueSpeakersData ||
    null;

  if (fromTop.talkerNames.length === 0 && Array.isArray(nestedTalkers)) {
    fromTop.talkerNames = normalizeTalkerNames(nestedTalkers);
  }

  if (
    Object.keys(fromTop.speakerData).length === 0 &&
    nestedSpeakerData &&
    typeof nestedSpeakerData === "object" &&
    !Array.isArray(nestedSpeakerData)
  ) {
    fromTop.speakerData = normalizeSpeakerDataObject(nestedSpeakerData);
  }

  const hasNames = fromTop.talkerNames.length > 0;
  const hasSpeakers = Object.keys(fromTop.speakerData || {}).length > 0;
  const hasNodes = fromTop.sequenceNodes.length > 0;

  fromTop.hasTalkersList =
    fromTop.hasTalkersList || hasNames || hasSpeakers || hasNodes;

  return fromTop;
};

/**
 * Merge speaker fields without ever replacing authoritative non-empty lists/maps
 * with empty/undefined incoming values.
 */
const mergeDialogueSpeakersFieldsPreserving = (baseNpc, incomingNpc) => {
  const base = extractDialogueSpeakersFields(baseNpc);
  const incoming = extractDialogueSpeakersFields(incomingNpc);

  const mergedTalkers =
    incoming.talkerNames.length > 0 ? incoming.talkerNames : base.talkerNames;

  const mergedSpeakerData =
    Object.keys(incoming.speakerData).length > 0
      ? incoming.speakerData
      : base.speakerData;

  const mergedIndex = Number.isFinite(incoming.currentSpeakerIndex)
    ? incoming.currentSpeakerIndex
    : Number.isFinite(base.currentSpeakerIndex)
    ? base.currentSpeakerIndex
    : 0;

  const mergedActiveSpeakerName =
    typeof incoming.activeSpeakerName === "string" && incoming.activeSpeakerName
      ? incoming.activeSpeakerName
      : typeof base.activeSpeakerName === "string" && base.activeSpeakerName
      ? base.activeSpeakerName
      : undefined;

  const mergedSequenceNodes =
    incoming.sequenceNodes.length > 0
      ? incoming.sequenceNodes
      : base.sequenceNodes;

  const hasTalkersList =
    incoming.hasTalkersList ||
    base.hasTalkersList ||
    mergedTalkers.length > 0 ||
    Object.keys(mergedSpeakerData).length > 0 ||
    mergedSequenceNodes.length > 0;

  return {
    talkerNames: mergedTalkers,
    speakerData: mergedSpeakerData,
    currentSpeakerIndex: mergedIndex,
    activeSpeakerName: mergedActiveSpeakerName,
    sequenceNodes: mergedSequenceNodes,
    hasTalkersList,
  };
};

/**
 * When receiving handoff/summon data, ensure we do not accidentally lose an
 * authored talker list due to partial speakerData, and vice versa.
 */
const ensureSequenceOrderConsistency = (npcLike) => {
  const talkerNames = Array.isArray(npcLike?.talkerNames)
    ? npcLike.talkerNames
    : [];
  const speakerData =
    npcLike?.speakerData &&
    typeof npcLike.speakerData === "object" &&
    !Array.isArray(npcLike.speakerData)
      ? npcLike.speakerData
      : {};

  if (talkerNames.length > 0) {
    return {
      ...npcLike,
      talkerNames: normalizeTalkerNames(talkerNames),
      speakerData: normalizeSpeakerDataObject(speakerData),
      hasTalkersList: true,
    };
  }

  const speakerKeys = Object.keys(speakerData);
  if (speakerKeys.length > 0) {
    return {
      ...npcLike,
      talkerNames: normalizeTalkerNames(speakerKeys),
      speakerData: normalizeSpeakerDataObject(speakerData),
      hasTalkersList: true,
    };
  }

  return npcLike;
};

/**
 * Robust runtime extraction for a single speaker bucket.
 */
const extractRuntimeSpeakerPayload = (speakerBucket) => {
  if (!speakerBucket || typeof speakerBucket !== "object") {
    return {
      dialogue: null,
      dialogueText: "",
      playerChoices: [],
      hasRuntimePayload: false,
    };
  }

  const bucketDialogue = speakerBucket.dialogue ?? null;
  const bucketDialogueText =
    typeof speakerBucket.dialogueText === "string"
      ? speakerBucket.dialogueText
      : "";
  const bucketChoices = Array.isArray(speakerBucket.playerChoices)
    ? speakerBucket.playerChoices
    : [];

  const hasContract =
    !!bucketDialogue ||
    bucketDialogueText.length > 0 ||
    (Array.isArray(speakerBucket.playerChoices) &&
      speakerBucket.playerChoices.length > 0);

  if (hasContract) {
    return {
      dialogue: bucketDialogue,
      dialogueText: bucketDialogueText,
      playerChoices: bucketChoices,
      hasRuntimePayload: true,
    };
  }

  const firstEntry =
    Array.isArray(speakerBucket.dialogues) && speakerBucket.dialogues.length > 0
      ? speakerBucket.dialogues[0]
      : null;

  if (firstEntry && typeof firstEntry === "object") {
    const fallbackText =
      typeof firstEntry.dialogueText === "string"
        ? firstEntry.dialogueText
        : typeof firstEntry.text === "string"
        ? firstEntry.text
        : "";

    const fallbackChoices = Array.isArray(firstEntry.playerChoices)
      ? firstEntry.playerChoices
      : Array.isArray(firstEntry.choices)
      ? firstEntry.choices
      : [];

    return {
      dialogue: firstEntry,
      dialogueText: fallbackText,
      playerChoices: fallbackChoices,
      hasRuntimePayload: fallbackText.length > 0 || fallbackChoices.length > 0,
    };
  }

  return {
    dialogue: null,
    dialogueText: "",
    playerChoices: [],
    hasRuntimePayload: false,
  };
};

const resolveActiveSequenceSpeakerName = (npcLike) => {
  if (!npcLike) return null;

  const talkerNames = Array.isArray(npcLike.talkerNames)
    ? npcLike.talkerNames
    : [];
  const speakerData =
    npcLike.speakerData && typeof npcLike.speakerData === "object"
      ? npcLike.speakerData
      : {};

  if (talkerNames.length === 0 && Object.keys(speakerData).length === 0) {
    return null;
  }

  const explicitActiveSpeaker =
    typeof npcLike.activeSpeakerName === "string" &&
    npcLike.activeSpeakerName.trim()
      ? npcLike.activeSpeakerName.trim()
      : null;

  if (
    explicitActiveSpeaker &&
    (talkerNames.includes(explicitActiveSpeaker) ||
      speakerData[explicitActiveSpeaker])
  ) {
    return explicitActiveSpeaker;
  }

  const clampedIndex = Math.max(
    0,
    Math.min(
      Math.max(talkerNames.length - 1, 0),
      Number.isFinite(npcLike.currentSpeakerIndex)
        ? npcLike.currentSpeakerIndex
        : 0
    )
  );

  const indexedName = talkerNames[clampedIndex];
  if (
    indexedName &&
    (talkerNames.includes(indexedName) || speakerData[indexedName])
  ) {
    return indexedName;
  }

  const firstSpeakerKey = Object.keys(speakerData)[0];
  if (firstSpeakerKey) return firstSpeakerKey;

  return null;
};

const buildNpcRuntimeDialogueFromSequence = (npcLike) => {
  if (!npcLike) return null;

  const talkerNames = Array.isArray(npcLike.talkerNames)
    ? npcLike.talkerNames
    : [];
  const speakerData =
    npcLike.speakerData && typeof npcLike.speakerData === "object"
      ? npcLike.speakerData
      : {};

  if (talkerNames.length === 0 && Object.keys(speakerData).length === 0) {
    return null;
  }

  const resolvedSpeakerName =
    resolveActiveSequenceSpeakerName(npcLike) || npcLike.name || "NPC";

  const resolvedIndex = talkerNames.includes(resolvedSpeakerName)
    ? talkerNames.indexOf(resolvedSpeakerName)
    : Math.max(
        0,
        Math.min(
          Math.max(talkerNames.length - 1, 0),
          Number.isFinite(npcLike.currentSpeakerIndex)
            ? npcLike.currentSpeakerIndex
            : 0
        )
      );

  const speakerBucket = speakerData[resolvedSpeakerName] || null;
  const extracted = extractRuntimeSpeakerPayload(speakerBucket);

  const dialogueText =
    extracted.dialogueText ||
    npcLike.temporaryDialogueText ||
    npcLike.dialogueText ||
    "";

  const dialogue =
    extracted.dialogue ||
    npcLike.temporaryDialogue ||
    npcLike.dialogue ||
    null;

  const playerChoices =
    Array.isArray(extracted.playerChoices) && extracted.playerChoices.length > 0
      ? extracted.playerChoices
      : npcLike.temporaryPlayerChoices || npcLike.playerChoices || [];

  return {
    currentSpeakerIndex: resolvedIndex,
    currentSpeakerName: resolvedSpeakerName,
    dialogueText,
    dialogue,
    playerChoices,
    dialogueTree:
      extracted.dialogue ||
      npcLike.temporaryDialogueTree ||
      npcLike.dialogueTree ||
      null,
    priorityDialogue:
      extracted.dialogue ||
      npcLike.priorityDialogue ||
      npcLike.temporaryDialogue ||
      npcLike.dialogue ||
      null,
  };
};

const applySequenceRuntimeDialogue = (npcLike) => {
  const runtime = buildNpcRuntimeDialogueFromSequence(npcLike);
  if (!runtime) return npcLike;

  return {
    ...npcLike,
    currentSpeakerIndex: runtime.currentSpeakerIndex,
    activeSpeakerName: runtime.currentSpeakerName,
    dialogueText: runtime.dialogueText,
    // IMPORTANT: do NOT overwrite npcLike.dialogue here.
    //
    // npcLike.dialogue is the authored, multi-node dialogue TREE
    // ({ startNodeId, nodes: {...} }) that NPCInspectorPanel.jsx reads and
    // edits directly. runtime.dialogue is only a single flat current
    // speaker's active line snapshot ({ id, nodeId, speakerName, text,
    // choices, ... }), not a tree. Writing it into npcLike.dialogue replaced
    // the real authored tree with that flat snapshot, so the Inspector saw
    // an object with no valid .nodes map and fell back to a blank root node
    // - which caused talker dialogues/choices to appear empty in the panel.
    //
    // This was also unnecessary for gameplay: useNPCBrain's
    // getActiveNpcDialogue() already resolves the active speaker dialogue
    // straight from npc.speakerData[speakerName] whenever talkerNames is
    // non-empty, and never reads npcLike.dialogue in that case.
    playerChoices: runtime.playerChoices,
    dialogueTree: runtime.dialogueTree,
    priorityDialogue: runtime.priorityDialogue,
  };
};

const handoffDialogueSequenceToNextParticipant = ({ closedNpcId, setNpcs }) => {
  if (!closedNpcId || typeof setNpcs !== "function") return;

  setNpcs((prevNpcs) => {
    const closedNpc = prevNpcs.find((npc) => npc.id === closedNpcId);
    if (!closedNpc) return prevNpcs;

    const sequenceId = getDialogueSequenceIdForNpc(closedNpc);
    if (!sequenceId) return prevNpcs;

    const rootNpcId =
      closedNpc.dialogueSequenceRootNpcId ||
      closedNpc.dialogueSequenceOwnerNpcId ||
      closedNpc.summonedByNpcId ||
      (!closedNpc.isSummoned ? closedNpc.id : null);

    const now = Date.now();
    const switchLockMs =
      Number(closedNpc.dialogueSwitchLockMs ?? DIALOGUE_SWITCH_LOCK_MS) ||
      DIALOGUE_SWITCH_LOCK_MS;

    const rootNpc = rootNpcId
      ? prevNpcs.find((npc) => npc.id === rootNpcId)
      : null;

    const sameSequenceClones = prevNpcs
      .filter((npc) => {
        if (npc.isSummoned !== true) return false;
        return getDialogueSequenceIdForNpc(npc) === sequenceId;
      })
      .sort((a, b) => {
        const queueDiff =
          Number(a.summonQueueIndex ?? a.sequenceOrder ?? 0) -
          Number(b.summonQueueIndex ?? b.sequenceOrder ?? 0);

        if (queueDiff !== 0) return queueDiff;

        return Number(a.summonedAt ?? 0) - Number(b.summonedAt ?? 0);
      });

    const participants = [
      ...(rootNpc ? [{ kind: "root", npc: rootNpc }] : []),
      ...sameSequenceClones.map((npc) => ({ kind: "clone", npc })),
    ];

    const closedIndex = participants.findIndex(
      (entry) => entry?.npc?.id === closedNpcId
    );

    if (closedIndex === -1) return prevNpcs;

    const nextParticipant = participants
      .slice(closedIndex + 1)
      .find(({ npc, kind }) => {
        if (!npc) return false;
        if (kind !== "clone") return false;
        if (npc.dialogueSequenceCompleted === true) return false;

        return hasAnyTemporaryDialogueState(npc);
      });

    // Extract sequence fields strictly preserving from root/closed
    const sequenceFieldsFromClosed = extractDialogueSpeakersFields(closedNpc);
    const sequenceFieldsFromRoot = extractDialogueSpeakersFields(
      rootNpc,
      closedNpc
    );

    return prevNpcs.map((npc) => {
      const npcSequenceId = getDialogueSequenceIdForNpc(npc);
      const belongsToSequence =
        npc.id === rootNpcId || npcSequenceId === sequenceId;

      if (!belongsToSequence) return npc;

      // Handle the participant that just finished
      if (npc.id === closedNpcId) {
        let preserved = {};
        if (!npc.isSummoned) {
          preserved = ensureSequenceOrderConsistency(
            mergeDialogueSpeakersFieldsPreserving(npc, sequenceFieldsFromClosed)
          );
        }

        return applySequenceRuntimeDialogue({
          ...npc,
          ...(npc.isSummoned ? {} : preserved),
          summonAutoOpenPending: false,
          summonAutoOpenConsumed: true,
          dialogueHandoffPending: false,
          dialogueSequenceActive: false,
          dialogueSequenceCompleted: true,
          forceDialogueOpen: false,
          dialogueLockExpiresAt: now + switchLockMs,
          sequenceLockExpiresAt: now + switchLockMs,
        });
      }

      // Handle the next queued participant in sequence
      if (nextParticipant && npc.id === nextParticipant.npc.id) {
        let preserved = {};
        if (!npc.isSummoned) {
          preserved = ensureSequenceOrderConsistency(
            mergeDialogueSpeakersFieldsPreserving(npc, sequenceFieldsFromRoot)
          );
        }

        return applySequenceRuntimeDialogue({
          ...npc,
          ...(npc.isSummoned ? {} : preserved),
          summonAutoOpenPending: true,
          temporaryDialogueDismissed: false,
          summonAutoOpenConsumed: false,
          dialogueHandoffPending: true,
          dialogueSequenceActive: true,
          dialogueSequenceCompleted: false,
          forceDialogueOpen: true,
          summonedAt: now,
          hasTemporaryDialogue: true,
          priorityDialogue:
            npc.temporaryDialogueTree ||
            npc.temporaryDialogue ||
            npc.priorityDialogue,
          dialogueLockExpiresAt: 0,
          sequenceLockExpiresAt: now + switchLockMs * 2,
        });
      }

      // If there are no more participants left, finalize sequence on root
      if (!nextParticipant) {
        let preserved = {};
        if (!npc.isSummoned) {
          preserved = ensureSequenceOrderConsistency(
            mergeDialogueSpeakersFieldsPreserving(npc, sequenceFieldsFromRoot)
          );
        }

        return applySequenceRuntimeDialogue({
          ...npc,
          ...(npc.isSummoned ? {} : preserved),
          summonAutoOpenPending: false,
          dialogueHandoffPending: false,
          dialogueSequenceActive: false,
          forceDialogueOpen: false,
          dialogueSequenceCompleted: true,
          sequenceLockExpiresAt: now + switchLockMs,
        });
      }

      // Generic update for other members (clones should not overwrite main sequence states)
      let preserved = {};
      if (!npc.isSummoned) {
        preserved = ensureSequenceOrderConsistency(
          mergeDialogueSpeakersFieldsPreserving(npc, sequenceFieldsFromRoot)
        );
      }

      return applySequenceRuntimeDialogue({
        ...npc,
        ...(npc.isSummoned ? {} : preserved),
      });
    });
  });
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
  isTemporary,
}) {
  const color = isTemporary
    ? isWaypointSelected
      ? "#f43f5e"
      : "#f59e0b"
    : isWaypointSelected
    ? "#eab308"
    : isCurrent
    ? "#38bdf8"
    : "#94a3b8";

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
            isTemporary,
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
        <meshBasicMaterial color={color} />
      </mesh>

      <Html
        position={[0, 0.4, 0]}
        center
        style={{
          userSelect: "none",
          pointerEvents: "none",
          background: color,
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
          border: "2px solid #fff",
          boxShadow: "0 2px 5px rgba(0,0,0,0.3)",
          transition: "background 0.2s ease",
        }}
      >
        {isTemporary ? `T${idx + 1}` : idx + 1}
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
  const tempWaypoints = Array.isArray(npc.temporaryWaypoints)
    ? npc.temporaryWaypoints
    : [];

  const currentWaypointIndex = npc.currentWaypointIndex ?? 0;
  const currentTarget =
    waypoints.length > 0 ? getWaypointPos(waypoints[currentWaypointIndex]) : null;

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
        if (npc.patrolMode === "pingpong" && wIdx === waypoints.length - 1) {
          return null;
        }

        const isCurrentSegment =
          wIdx ===
          ((currentWaypointIndex - 1 + waypoints.length) % waypoints.length);

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
            isTemporary={false}
          />
        );
      })}

      {tempWaypoints.map((wp, wIdx) => {
        const startPos = getWaypointPos(wp);
        const nextWp = tempWaypoints[wIdx + 1];
        if (!nextWp) return null;
        const endPos = getWaypointPos(nextWp);

        return (
          <WaypointLine
            key={`${npc.id}-temp-line-${wIdx}`}
            start={startPos}
            end={endPos}
            color="#fb923c"
          />
        );
      })}

      {tempWaypoints.length > 0 && (
        <WaypointLine
          start={npc.position}
          end={getWaypointPos(tempWaypoints[0])}
          color="#fb923c"
        />
      )}

      {tempWaypoints.map((wp, idx) => {
        const isWaypointSelected = selectedWaypointIndex === idx;
        const wpPos = getWaypointPos(wp);

        return (
          <WaypointMarker
            key={`${npc.id}-temp-wp-${idx}`}
            npcId={npc.id}
            wp={wpPos}
            idx={idx}
            isCurrent={false}
            isWaypointSelected={isWaypointSelected}
            setSelectedWaypointIndex={setSelectedWaypointIndex}
            setSelectedNpcId={setSelectedNpcId}
            setDraggingWaypoint={setDraggingWaypoint}
            isTemporary={true}
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
    placingTempWaypointForNpcId,
    waypointPreviewPos,
    selectedWaypointIndex,
    setSelectedWaypointIndex,
    activeDialogueNpcId,
    startDialogue,
    closeDialogue,
  } = props;

  const { raycaster, camera, size: viewportSize } = useThree();

  const [waypointHeight, setWaypointHeight] = useState(0.2);
  const [localWaypointPreviewPos, setLocalWaypointPreviewPos] = useState(null);
  const isShiftPressed = useRef(false);

  const [draggingWaypoint, setDraggingWaypoint] = useState(null);
  const groundPlaneRef = useRef(new THREE.Plane(new THREE.Vector3(0, 1, 0), 0));

  const obstacleObjects = useMemo(() => {
    return collectObstacleMeshes(objectRefs);
  }, [placedObjects, objectRefs]);

  const obstacleObjectsRef = useRef([]);
  const npcRefs = useRef({});
  const npcsRef = useRef(npcs || []);

  // Guards the sequence-field write-back so it never causes an infinite
  // render loop. Only runs setNpcs when top-level talker data actually changed.
  const normalizedSequenceSignatureRef = useRef(null);

  const summonerExitTimersRef = useRef(new Map());

  // Prevents the EditorScene safety monitor from dispatching the same
// radius-exit close request repeatedly while React state is clearing.
const dialogueRadiusExitInFlightRef = useRef(null);



  // Remembers dialogue closures caused by a real detection-radius exit.
// onDialogueClosed can run later and may receive only an NPC id, so it cannot
// always read the original `{ reason: "radius-exit" }` close metadata itself.
const radiusExitDialogueClosuresRef = useRef(new Set());


  useEffect(() => {
    npcsRef.current = npcs || [];
  }, [npcs]);

  useEffect(() => {
    obstacleObjectsRef.current = obstacleObjects;
  }, [obstacleObjects]);

  useEffect(() => {
    if (!Array.isArray(npcs) || npcs.length === 0) return;

    npcs.forEach((npc) => {
      if (npc?.isSummoned) return;

      const talkerNames = Array.isArray(npc.talkerNames) ? npc.talkerNames : [];

      const speakerSequence = talkerNames.map((name) => {
        const data = npc.speakerData?.[name] || {};
        const runtime = extractRuntimeSpeakerPayload(data);

        return {
          speaker: name,
          dialoguesCount: Array.isArray(data.dialogues) ? data.dialogues.length : 0,
          hasRuntimeDialoguePayload: runtime.hasRuntimePayload,
          dialogueText:
            typeof data.dialogueText === "string"
              ? data.dialogueText
              : typeof data.dialogue?.text === "string"
              ? data.dialogue.text
              : runtime.dialogueText || "",
          playerChoicesCount: Array.isArray(data.playerChoices)
            ? data.playerChoices.length
            : Array.isArray(data.dialogue?.choices)
            ? data.dialogue.choices.length
            : Array.isArray(runtime.playerChoices)
            ? runtime.playerChoices.length
            : 0,
          dialogues: Array.isArray(data.dialogues) ? data.dialogues : [],
        };
      });

      const hasSequenceData =
        talkerNames.length > 0 || speakerSequence.length > 0;

      
    });
  }, [npcs]);

  // Persist lifted sequence speaker fields back into the global npcs state.
  // Without this, talkerNames/speakerData/currentSpeakerIndex only exist on the
  // render-time mappedNpc, so the dialogue box and manager stay empty until some
  // other action forces a setNpcs refresh (e.g. selecting the NPC in the manager).
  useEffect(() => {
    if (!Array.isArray(npcs) || npcs.length === 0) return;

    const signature = npcs
      .filter((n) => n && !n.isSummoned)
      .map((n) => {
        const names = Array.isArray(n.talkerNames) ? n.talkerNames : [];
        const data =
          n.speakerData && !Array.isArray(n.speakerData) ? n.speakerData : {};
        return [
          n.id,
          JSON.stringify(names),
          JSON.stringify(data),
          n.currentSpeakerIndex ?? 0,
        ].join("|");
      })
      .join("\n");

    if (signature === normalizedSequenceSignatureRef.current) return;
    normalizedSequenceSignatureRef.current = signature;

    setNpcs((prev) =>
      prev.map((npc) => {
        if (!npc || npc.isSummoned) return npc;

        const authoredDialogue = npc.dialogue || null;
        const authoredTalkerNames = Array.isArray(npc.talkerNames)
          ? npc.talkerNames
          : [];

        // NEW: build missing speaker data from authored dialogue nodes on scene load
        const aggregatedSpeakerData =
          authoredDialogue && authoredDialogue.nodes
            ? buildAggregatedSpeakerData(authoredDialogue, authoredTalkerNames)
            : null;

        const enriched = applySequenceRuntimeDialogue(
          ensureSequenceOrderConsistency(
            mergeDialogueSpeakersFieldsPreserving(
              {
                ...npc,
                ...(aggregatedSpeakerData
                  ? {
                      talkerNames:
                        authoredTalkerNames.length > 0
                          ? authoredTalkerNames
                          : Object.keys(aggregatedSpeakerData),
                      speakerData: aggregatedSpeakerData,
                      hasTalkersList:
                        authoredTalkerNames.length > 0 ||
                        Object.keys(aggregatedSpeakerData).length > 0,
                    }
                  : {}),
              },
              npc
            )
          )
        );

        const curNames = Array.isArray(npc.talkerNames)
          ? npc.talkerNames
          : [];
        const curData =
          npc.speakerData && !Array.isArray(npc.speakerData)
            ? npc.speakerData
            : {};

        const enrichedNames = Array.isArray(enriched.talkerNames)
          ? enriched.talkerNames
          : [];
        const enrichedData =
          enriched.speakerData && !Array.isArray(enriched.speakerData)
            ? enriched.speakerData
            : {};

        const namesEqual =
          JSON.stringify(curNames) === JSON.stringify(enrichedNames);
        const dataEqual =
          JSON.stringify(curData) === JSON.stringify(enrichedData);
        const indexEqual =
          (npc.currentSpeakerIndex ?? 0) === (enriched.currentSpeakerIndex ?? 0);

        if (namesEqual && dataEqual && indexEqual) return npc;

        // PRESERVE the original NPC identity/position/waypoints. enriched only
        // carries dialogue-sequence fields, so we MUST spread ...npc first.
        return { ...npc, ...enriched };
      })
    );
  }, [npcs, setNpcs]);

  const handleSummonedDialogueClosed = useCallback(
  (closeMeta) => {
    const closedNpcId = extractNpcIdFromCloseDialogueArgs(closeMeta, null);
    if (!closedNpcId) return;

    const closeReason =
      closeMeta &&
      typeof closeMeta === "object" &&
      !Array.isArray(closeMeta)
        ? closeMeta.reason ?? null
        : null;

    const closedBecausePlayerExitedRadius =
      closeReason === "radius-exit" ||
      radiusExitDialogueClosuresRef.current.has(closedNpcId);

    if (radiusExitDialogueClosuresRef.current.has(closedNpcId)) {
      radiusExitDialogueClosuresRef.current.delete(closedNpcId);
    }

    if (closedBecausePlayerExitedRadius) {
      return;
    }

    handoffDialogueSequenceToNextParticipant({
      closedNpcId,
      setNpcs,
    });
  },
  [setNpcs]
);




const handleCloseDialogueWithSummonHandoff = useCallback(
  (...args) => {
    const closeMeta =
      args[0] && typeof args[0] === "object" && !Array.isArray(args[0])
        ? args[0]
        : null;

    const closeReason = closeMeta?.reason ?? null;

    const closingNpcId = extractNpcIdFromCloseDialogueArgs(
      args,
      activeDialogueNpcId ?? null
    );

    const closedBecausePlayerExitedRadius = closeReason === "radius-exit";

    if (closedBecausePlayerExitedRadius && closingNpcId) {
      radiusExitDialogueClosuresRef.current.add(closingNpcId);
      dialogueRadiusExitInFlightRef.current = closingNpcId;
    }

    // Radius exit means cancel/close only. It is NOT dialogue completion.
    if (closingNpcId && !closedBecausePlayerExitedRadius) {
      handoffDialogueSequenceToNextParticipant({
        closedNpcId: closingNpcId,
        setNpcs,
      });
    }

    // This is the actual parent/UI close function.
    if (typeof closeDialogue === "function") {
  // The parent popup controller may be written as closeDialogue() and may not
  // accept metadata arguments. The reason is used only inside EditorScene to
  // block sequence handoff; the parent still receives its normal close call.
  closeDialogue();
}

  },
  [activeDialogueNpcId, closeDialogue, setNpcs]
);



useEffect(() => {
  console.log("[EditorScene] dialogue radius monitor mounted", {
    activeDialogueNpcId,
    activeDialogueNpcIdType: typeof activeDialogueNpcId,
  });

  if (activeDialogueNpcId == null) {
    dialogueRadiusExitInFlightRef.current = null;
    return;
  }

  const checkActiveDialogueRadius = () => {
    const activeNpcId = activeDialogueNpcId;

    if (activeNpcId == null) {
      console.warn("[EditorScene] Radius monitor: activeDialogueNpcId is null");
      return;
    }

    if (dialogueRadiusExitInFlightRef.current === activeNpcId) {
      return;
    }

    const currentNpcs = npcsRef.current || [];

    // Use String comparison so numeric/string id differences cannot prevent
    // the active NPC from being found.
    const activeNpc = currentNpcs.find(
      (npc) => String(npc.id) === String(activeNpcId)
    );

    if (!activeNpc) {
      console.warn("[EditorScene] Radius monitor: active NPC was not found", {
        activeNpcId,
        activeDialogueNpcIdType: typeof activeNpcId,
        availableNpcIds: currentNpcs.map((npc) => ({
          id: npc.id,
          type: typeof npc.id,
          name: npc.name,
        })),
      });
      return;
    }

    // useNPCBrain already owns radius-exit detection (every frame, accurate
    // distance, correct internal bookkeeping) for regular authored NPCs and
    // their talker sequences. This interval-based monitor exists only for the
    // summoned-clone hand-off feature. Running it for non-summoned NPCs too
    // creates a race between the two systems (this one fires on a 250ms
    // interval and bypasses useNPCBrain's refs), which caused the dialogue
    // flicker / random repeat-or-skip behavior when auto-advancing talkers.
    if (!activeNpc.isSummoned) {
      return;
    }

    const hasPlayerPosition = getPlayerWorldPosition(
      girlRef,
      cleanupTempVecA
    );

    if (!hasPlayerPosition) {
      console.warn(
        "[EditorScene] Radius monitor: could not read Space Girl world position",
        {
          girlRefCurrent: girlRef?.current,
        }
      );
      return;
    }

    const hasNpcPosition = getNpcWorldPosition(
      activeNpc,
      npcRefs,
      cleanupTempVecB
    );

    if (!hasNpcPosition) {
      console.warn(
        "[EditorScene] Radius monitor: could not read active NPC world position",
        {
          activeNpcId,
          npcRefEntry: npcRefs.current?.[activeNpc.id],
          savedNpcPosition: activeNpc.position,
        }
      );
      return;
    }

    const dialogueRadius = getDialogueDetectionRadiusFromNpc(activeNpc);

    const distanceSquared = getDistanceSquaredXZ(
      cleanupTempVecA,
      cleanupTempVecB
    );

    const distance = Math.sqrt(distanceSquared);
    const isOutsideDialogueRadius = distance > dialogueRadius;

    console.log("[EditorScene] Radius monitor check", {
      activeNpcId,
      npcName: activeNpc.name,
      playerPosition: [
        cleanupTempVecA.x,
        cleanupTempVecA.y,
        cleanupTempVecA.z,
      ],
      npcPosition: [
        cleanupTempVecB.x,
        cleanupTempVecB.y,
        cleanupTempVecB.z,
      ],
      dialogueRadius,
      distance,
      isOutsideDialogueRadius,
    });

    if (!isOutsideDialogueRadius) {
      return;
    }

    console.warn("[EditorScene] Radius exit detected â€” closing dialogue", {
      activeNpcId,
      npcName: activeNpc.name,
      dialogueRadius,
      distance,
    });

    dialogueRadiusExitInFlightRef.current = activeNpcId;

    // Reset NPC dialogue state when exiting radius
    setNpcs((prevNpcs) => {
      return prevNpcs.map((npc) => {
        if (npc.id !== activeNpc.id) return npc;
        return {
          ...npc,
          currentSpeakerIndex: 0
        };
      });
    });

    handleCloseDialogueWithSummonHandoff({
      npcId: activeNpc.id,
      reason: "radius-exit",
    });
  };

  checkActiveDialogueRadius();

  const intervalId = window.setInterval(checkActiveDialogueRadius, 250);

  return () => {
    window.clearInterval(intervalId);
  };
}, [
  activeDialogueNpcId,
  girlRef,
  handleCloseDialogueWithSummonHandoff,
]);



  useEffect(() => {
    const handleSequenceHandoff = (event) => {
      const detail = event?.detail || {};
      const toNpcId = detail.toNpcId;
      const handoffSpeakerIndex = Number.isFinite(detail.currentSpeakerIndex)
        ? detail.currentSpeakerIndex
        : undefined;
      const handoffSpeakerName =
        typeof detail.activeSpeakerName === "string" &&
        detail.activeSpeakerName.trim()
          ? detail.activeSpeakerName.trim()
          : undefined;

      if (!toNpcId) return;

      setNpcs((prevNpcs) =>
        prevNpcs.map((npc) => {
          if (npc.id !== toNpcId) return npc;
          if (npc.isSummoned) return npc;

          const preserved = ensureSequenceOrderConsistency(
            mergeDialogueSpeakersFieldsPreserving(npc, detail)
          );

          const nextNpc = ensureSequenceOrderConsistency({
            ...npc,
            ...preserved,
            currentSpeakerIndex: Number.isFinite(handoffSpeakerIndex)
              ? handoffSpeakerIndex
              : preserved.currentSpeakerIndex,
            activeSpeakerName:
              handoffSpeakerName ||
              preserved.activeSpeakerName ||
              npc.activeSpeakerName,
          });

          const updatedNpc = applySequenceRuntimeDialogue(nextNpc);

          console.log("[EditorScene] npcSequenceHandoff applied:", {
            npcId: updatedNpc.id,
            currentSpeakerIndex: updatedNpc.currentSpeakerIndex,
            activeSpeakerName: updatedNpc.activeSpeakerName || null,
            dialogueText: updatedNpc.dialogueText || "",
            playerChoicesCount: Array.isArray(updatedNpc.playerChoices)
              ? updatedNpc.playerChoices.length
              : 0,
          });

          return updatedNpc;
        })
      );
    };

    window.addEventListener("npcSequenceHandoff", handleSequenceHandoff);
    return () => {
      window.removeEventListener("npcSequenceHandoff", handleSequenceHandoff);
    };
  }, [setNpcs]);

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

        const nextNpcs = removeSummonedNpcsForCaller(prevNpcs, callerNpcId, {
          activeDialogueNpcId,
        });

        const summonBatchId = `summon-${Date.now()}-${Math.random()
          .toString(36)
          .slice(2, 8)}`;
        const dialogueSequenceId =
          summonConfig.dialogueSequenceId ||
          sourceNpc?.dialogueSequenceId ||
          createDialogueSequenceId();
        const summonTime = Date.now();

        const shouldQueueBehindCaller = !!sourceNpc;
        const rootNpcId =
          summonConfig.dialogueSequenceRootNpcId ??
          sourceNpc?.dialogueSequenceRootNpcId ??
          callerNpcId ??
          null;
        const sequenceOwnerNpcId =
          summonConfig.dialogueSequenceOwnerNpcId ?? callerNpcId ?? null;
        const sequenceInitialLockExpiresAt =
          Number(
            summonConfig.dialogueLockExpiresAt ??
              summonConfig.sequenceLockExpiresAt ??
              0
          ) || 0;

        const mainSequenceFields = sourceNpc?.isSummoned
          ? extractDialogueSpeakersFields(sourceNpc)
          : ensureSequenceOrderConsistency(
              mergeDialogueSpeakersFieldsPreserving(
                mergeDialogueSpeakersFieldsPreserving(
                  extractDialogueSpeakersFields(sourceNpc),
                  extractDialogueSpeakersFields(templateNpc)
                ),
                extractDialogueSpeakersFields(summonConfig)
              )
            );

        const spawnedNpcs = Array.from({ length: count }, (_, index) => {
          const clonedNpc = cloneNpcData(templateNpc);
          const newId = createNpcId();
          const spreadX = count > 1 ? index * 0.8 : 0;

          const nextPosition = [
            Number(basePosition[0] ?? 0) + offset[0] + spreadX,
            Number(basePosition[1] ?? 0) + offset[1],
            Number(basePosition[2] ?? 0) + offset[2],
          ];

          const summonDialogueText =
            summonConfig.temporaryDialogueText ??
            summonConfig.dialogueText ??
            clonedNpc.temporaryDialogueText ??
            null;

          const summonChoices =
            summonConfig.temporaryPlayerChoices ??
            summonConfig.playerChoices ??
            summonConfig.choices ??
            clonedNpc.temporaryPlayerChoices ??
            clonedNpc.temporaryDialogueOptions ??
            [];

          const summonDialogueTree =
            summonConfig.temporaryDialogueTree ??
            summonConfig.dialogueTree ??
            buildDialogueTreeFromText(summonDialogueText, summonChoices) ??
            clonedNpc.temporaryDialogueTree ??
            clonedNpc.temporaryDialogue ??
            null;

          const normalizedChoices = normalizeDialogueChoices(summonChoices);
          const hasTemporaryPayload = !!(
            summonDialogueText ||
            summonDialogueTree ||
            normalizedChoices.length > 0 ||
            clonedNpc.temporaryDialogue ||
            clonedNpc.temporaryDialogueText ||
            clonedNpc.temporaryDialogueTree ||
            clonedNpc.temporaryPlayerChoices ||
            clonedNpc.priorityDialogue
          );

          // Cloned NPCs do not receive authored speaker list or metadata structures
          const formattedClone = {
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
            summonBatchId,
            summonQueueIndex: index,
            summonedAt: summonTime + index,
            dialogueSequenceId,
            dialogueSequenceOwnerNpcId: sequenceOwnerNpcId,
            dialogueSequenceRootNpcId: rootNpcId,
            dialogueSequenceTemplateNpcId: targetNpcId,
            dialogueSequenceActive: hasTemporaryPayload,
            dialogueSequenceCompleted: false,
            dialogueHandoffPending: false,
            dialogueSwitchLockMs:
              Number(summonConfig.dialogueSwitchLockMs) ||
              Number(sourceNpc?.dialogueSwitchLockMs) ||
              DIALOGUE_SWITCH_LOCK_MS,
            dialogueLockExpiresAt: sequenceInitialLockExpiresAt,
            sequenceLockExpiresAt: sequenceInitialLockExpiresAt,
            summonAutoOpenPending:
              summonConfig.disableSummonAutoOpenPending === true
                ? false
                : !shouldQueueBehindCaller && hasTemporaryPayload && index === 0,
            summonAutoOpenConsumed: false,
            forceDialogueOpen:
              summonConfig.forceDialogueOpen === true
                ? true
                : !shouldQueueBehindCaller && hasTemporaryPayload && index === 0,
            hasTemporaryDialogue: hasTemporaryPayload,
            temporaryDialogueDismissed: false,
            temporaryDialogueText: summonDialogueText,
            temporaryDialogueTree: summonDialogueTree,
            temporaryDialogue: summonDialogueTree,
            temporaryDialogueOptions: normalizedChoices,
            temporaryPlayerChoices: normalizedChoices,
            priorityDialogue: summonDialogueTree,
            dialogue: summonDialogueTree ?? null,
            dialogueTree: summonDialogueTree ?? null,
            dialogueText: summonDialogueText ?? null,
            dialogueOptions: normalizedChoices,
            playerChoices: normalizedChoices,
            // Wipe dialogue sequence properties on clones to maintain single-source-of-truth ownership
            talkerNames: [],
            speakerData: {},
            sequenceNodes: [],
            hasTalkersList: false,
          };

          return applySequenceRuntimeDialogue(formattedClone);
        });

        const updatedNpcs = nextNpcs.map((npc) => {
          if (!sourceNpc || npc.id !== sourceNpc.id) return npc;
          if (npc.isSummoned) return npc;

          const preserved = ensureSequenceOrderConsistency(
            mergeDialogueSpeakersFieldsPreserving(npc, mainSequenceFields)
          );

          return applySequenceRuntimeDialogue({
            ...npc,
            ...preserved,
            dialogueSequenceId,
            dialogueSequenceOwnerNpcId: sequenceOwnerNpcId,
            dialogueSequenceRootNpcId: rootNpcId,
            dialogueSequenceActive: true,
            dialogueSequenceCompleted: false,
            dialogueHandoffPending: false,
            dialogueSwitchLockMs:
              Number(summonConfig.dialogueSwitchLockMs) ||
              Number(npc.dialogueSwitchLockMs) ||
              DIALOGUE_SWITCH_LOCK_MS,
            sequenceLockExpiresAt: Math.max(
              Number(npc.sequenceLockExpiresAt ?? 0),
              sequenceInitialLockExpiresAt
            ),
            dialogueLockExpiresAt: Math.max(
              Number(npc.dialogueLockExpiresAt ?? 0),
              sequenceInitialLockExpiresAt
            ),
          });
        });

        return [...updatedNpcs, ...spawnedNpcs];
      });
    };

    window.addEventListener("npcCustomDialogueEvent", handleDialogueCustomEvent);
    return () => {
      window.removeEventListener("npcCustomDialogueEvent", handleDialogueCustomEvent);
    };
  }, [setNpcs, activeDialogueNpcId]);

  useEffect(() => {
    const cleanupInterval = window.setInterval(() => {
      const currentNpcs = npcsRef.current || [];
      const summonedNpcs = currentNpcs.filter(
        (npc) => npc.isSummoned && npc.summonedByNpcId
      );

      if (summonedNpcs.length === 0) {
        summonerExitTimersRef.current.clear();
        return;
      }

      const callerMap = new Map();
      currentNpcs.forEach((npc) => callerMap.set(npc.id, npc));

      const playerAvailable = getPlayerWorldPosition(girlRef, cleanupTempVecA);
      const now = Date.now();
      const activeNpc =
        currentNpcs.find((npc) => npc.id === activeDialogueNpcId) || null;

      const sessionBySummonerId = new Map();

      summonedNpcs.forEach((cloneNpc) => {
        const summonerId = cloneNpc.summonedByNpcId;
        if (!summonerId || sessionBySummonerId.has(summonerId)) return;

        const summonerNpc = callerMap.get(summonerId);
        if (!summonerNpc) {
          sessionBySummonerId.set(summonerId, {
            summonerMissing: true,
            playerNearSummoner: false,
            activeSummonerSession: false,
          });
          return;
        }

        let playerNearSummoner = false;
        if (
          playerAvailable &&
          getNpcWorldPosition(summonerNpc, npcRefs, cleanupTempVecB)
        ) {
          const cleanupRadius = getCleanupRadiusFromNpc(summonerNpc);
          const distanceSq = getDistanceSquaredXZ(cleanupTempVecA, cleanupTempVecB);
          playerNearSummoner = distanceSq <= cleanupRadius * cleanupRadius;
        }

        const activeSummonerSession =
          activeDialogueNpcId === summonerId ||
          (activeNpc &&
            activeNpc.isSummoned === true &&
            activeNpc.summonedByNpcId === summonerId);

        sessionBySummonerId.set(summonerId, {
          summonerMissing: false,
          playerNearSummoner,
          activeSummonerSession,
        });
      });

      sessionBySummonerId.forEach((sessionState, summonerId) => {
        if (sessionState.summonerMissing) {
          summonerExitTimersRef.current.set(summonerId, now);
          return;
        }
        if (sessionState.playerNearSummoner || sessionState.activeSummonerSession) {
          summonerExitTimersRef.current.delete(summonerId);
        } else if (!summonerExitTimersRef.current.has(summonerId)) {
          summonerExitTimersRef.current.set(summonerId, now);
        }
      });

      for (const summonerId of Array.from(summonerExitTimersRef.current.keys())) {
        if (!sessionBySummonerId.has(summonerId)) {
          summonerExitTimersRef.current.delete(summonerId);
        }
      }

      let hasChanges = false;

      // Arm cleanup for any summoned clone once its initial spawn grace
      // period has passed. Until now this flag was set to false at spawn
      // and never set to true anywhere, so every summoned NPC was treated
      // as permanently "unarmed" and force-removed almost immediately -
      // regardless of the player's actual distance from the summoner. This
      // step is what actually turns on the intended distance/grace-period
      // based despawn logic below.
      const armedNpcs = currentNpcs.map((npc) => {
        if (!(npc.isSummoned && npc.summonedByNpcId)) return npc;
        if (npc.summonCleanupArmed) return npc;

        const isRecent =
          Number.isFinite(npc.summonedAt) && now - npc.summonedAt < 1500;
        if (isRecent) return npc;

        hasChanges = true;
        return { ...npc, summonCleanupArmed: true };
      });

      const nextNpcs = armedNpcs.filter((npc) => {
        if (!(npc.isSummoned && npc.summonedByNpcId)) return true;
        if (activeDialogueNpcId === npc.id) return true;
        const isRecent =
          Number.isFinite(npc.summonedAt) && now - npc.summonedAt < 1500;
        if (isRecent) return true;

        const summonerId = npc.summonedByNpcId;
        const callerNpc = callerMap.get(summonerId);
        if (!callerNpc) {
          hasChanges = true;
          return false;
        }

        if (
          npc.isTalking === true ||
          npc.summonAutoOpenPending === true ||
          npc.forceDialogueOpen === true
        ) {
          return true;
        }
        if (npc.despawnSummonedCopiesOnDialogueExit === false) return true;
        if (isSummonedNpcProtectedForRadiusCleanup(npc, activeDialogueNpcId)) return true;

        const sessionState = sessionBySummonerId.get(summonerId);
        if (!sessionState) return true;

        if (sessionState.playerNearSummoner || sessionState.activeSummonerSession) {
          return true;
        }

        // Only despawn once the initial spawn grace period is over (armed)
        // AND the player has been away from the summoner's detection
        // radius for at least GRACE_PERIOD_MS.
        if (!npc.summonCleanupArmed) return true;

        const exitTime = summonerExitTimersRef.current.get(summonerId);
        const timeSinceExit = exitTime ? now - exitTime : 0;
        if (timeSinceExit >= GRACE_PERIOD_MS) {
          hasChanges = true;
          return false;
        }
        return true;
      });

      if (hasChanges || nextNpcs.length !== currentNpcs.length) {
        setNpcs(nextNpcs);
      }
    }, 300);

    return () => window.clearInterval(cleanupInterval);
  }, [girlRef, setNpcs, activeDialogueNpcId]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Shift") isShiftPressed.current = true;
    };
    const handleKeyUp = (e) => {
      if (e.key === "Shift") isShiftPressed.current = false;
    };
    const handleWheel = (e) => {
      const anyPlacingId = placingWaypointForNpcId || placingTempWaypointForNpcId;
      if (anyPlacingId && (waypointPreviewPos || localWaypointPreviewPos)) {
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
  }, [
    placingWaypointForNpcId,
    placingTempWaypointForNpcId,
    waypointPreviewPos,
    localWaypointPreviewPos,
  ]);

  useEffect(() => {
    if (!placingWaypointForNpcId && !placingTempWaypointForNpcId) {
      setLocalWaypointPreviewPos(null);
    }
  }, [placingWaypointForNpcId, placingTempWaypointForNpcId]);

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
            const waypointKey = draggingWaypoint.isTemporary
              ? "temporaryWaypoints"
              : "waypoints";
            const updatedWaypoints = [...(n[waypointKey] || [])];
            const existingWaypoint = updatedWaypoints[draggingWaypoint.index];
            const newPos = [targetX, draggingWaypoint.initialY, targetZ];
            updatedWaypoints[draggingWaypoint.index] = Array.isArray(existingWaypoint)
              ? newPos
              : { ...existingWaypoint, pos: newPos };
            return { ...n, [waypointKey]: updatedWaypoints };
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

  const updateWaypointPreviewFromWorldPoint = (point) => {
    if (!point) return null;
    let x = Number(point.x ?? point[0] ?? 0);
    let y = Number(point.y ?? point[1] ?? 0);
    let z = Number(point.z ?? point[2] ?? 0);

    if (snappingEnabled && snapSize) {
      x = Math.round(x / snapSize) * snapSize;
      z = Math.round(z / snapSize) * snapSize;
    }

    const nextPos = [x, y, z];
    setLocalWaypointPreviewPos((prev) =>
      prev &&
      prev[0] === nextPos[0] &&
      prev[1] === nextPos[1] &&
      prev[2] === nextPos[2]
        ? prev
        : nextPos
    );
    return nextPos;
  };

  const updateWaypointPreviewFromClientPoint = (clientX, clientY) => {
    const activePlacingId = placingWaypointForNpcId || placingTempWaypointForNpcId;
    if (!activePlacingId) return null;
    const mouse = new THREE.Vector2(
      (clientX / viewportSize.width) * 2 - 1,
      -(clientY / viewportSize.height) * 2 + 1
    );
    raycaster.setFromCamera(mouse, camera);
    groundPlaneRef.current.constant = 0;
    if (raycaster.ray.intersectPlane(groundPlaneRef.current, previewIntersectionVec)) {
      return updateWaypointPreviewFromWorldPoint(previewIntersectionVec);
    }
    return null;
  };

  const effectiveWaypointPreviewPos =
    waypointPreviewPos || localWaypointPreviewPos || null;
  const activeWaypointPos = effectiveWaypointPreviewPos
    ? [
        effectiveWaypointPreviewPos[0],
        effectiveWaypointPreviewPos[1] + waypointHeight,
        effectiveWaypointPreviewPos[2],
      ]
    : null;

  const previewSourcePos = useMemo(() => {
    const activePlacingId = placingWaypointForNpcId || placingTempWaypointForNpcId;
    if (!activePlacingId || !activeWaypointPos) return null;
    const targetNpc = npcs?.find((n) => n.id === activePlacingId);
    if (!targetNpc) return null;
    const listKey = !!placingTempWaypointForNpcId ? "temporaryWaypoints" : "waypoints";
    const waypointList = Array.isArray(targetNpc[listKey]) ? targetNpc[listKey] : [];
    if (waypointList.length > 0) {
      return getWaypointPos(waypointList[waypointList.length - 1]);
    }
    return Array.isArray(targetNpc.position) ? targetNpc.position : null;
  }, [placingWaypointForNpcId, placingTempWaypointForNpcId, activeWaypointPos, npcs]);

  const anyPlacingActive = placingWaypointForNpcId || placingTempWaypointForNpcId;

  return (
    <Physics gravity={[0, -Math.abs(gravity || 50.0), 0]}>
      <RigidBody type="fixed" colliders={false}>
        <CuboidCollider
          args={[250, 0.5, 250]}
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
          onPointerMissed={(e) => {
            if (anyPlacingActive && e?.clientX != null && e?.clientY != null) {
              updateWaypointPreviewFromClientPoint(e.clientX, e.clientY);
            }
            if (!isDragging && !anyPlacingActive) setSelectedObjectId(null);
          }}
          onClick={(e) => {
            if (!anyPlacingActive && !isDrawing && !isDragging) {
              setSelectedObjectId(null);
              setSelectedNpcId(null);
            }
            if (anyPlacingActive) {
              e.stopPropagation();
              const previewBase = updateWaypointPreviewFromWorldPoint(e.point);
              const basePoint = previewBase || effectiveWaypointPreviewPos;
              if (!basePoint) return;
              const pointWithHeight = [
                basePoint[0],
                basePoint[1] + waypointHeight,
                basePoint[2],
              ];
              const targetId = placingWaypointForNpcId || placingTempWaypointForNpcId;
              const isTemp = !!placingTempWaypointForNpcId;
              setNpcs((prev) =>
                prev.map((n) => {
                  if (n.id !== targetId) return n;
                  const newWaypoint = {
                    pos: pointWithHeight,
                    waitTime: n.movement?.waitTime ?? 0,
                  };
                  const key = isTemp ? "temporaryWaypoints" : "waypoints";
                  return { ...n, [key]: [...(n[key] || []), newWaypoint] };
                })
              );
              setSelectedNpcId(targetId);
              setSelectedObjectId(null);
              return;
            }
            handleGroundClick(e);
          }}
          onPointerMove={(e) => {
            if (anyPlacingActive) {
              e.stopPropagation();
              updateWaypointPreviewFromWorldPoint(e.point);
              if (isShiftPressed.current) {
                setWaypointHeight((prev) =>
                  Math.max(0.18, prev - (e.movementY || 0) * 0.05)
                );
              }
              return;
            }
            handleGroundPointerMove(e);
            if (props.onPointerMove) props.onPointerMove(e);
          }}
        >
          <boxGeometry args={[250, 1, 250]} />
          <meshStandardMaterial color="#fefefe" side={THREE.DoubleSide} />
        </mesh>
      </RigidBody>

      <gridHelper args={[250, 250]} />
      <EditorRuler size={250} />

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
        const isEditingWaypoints =
          npc.id === placingWaypointForNpcId || npc.id === placingTempWaypointForNpcId;
        const shouldShowWaypointHelpers = isSelected || isEditingWaypoints;

        const mappedNpc = npc.isSummoned
          ? npc
          : applySequenceRuntimeDialogue(
              ensureSequenceOrderConsistency({
                ...npc,
                ...ensureSequenceOrderConsistency(
                  mergeDialogueSpeakersFieldsPreserving(npc, npc)
                ),
              })
            );

        return (
          <React.Fragment key={npc.id}>
            <NPCActor
              npc={mappedNpc}
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
              closeDialogue={handleCloseDialogueWithSummonHandoff}
              onDialogueClosed={handleSummonedDialogueClosed}
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
        renderPreview(
          previewPosition,
          size,
          rotation,
          color,
          objectType,
          material
        )}

      {npcPreviewPos && pendingNpc && (
        <mesh position={npcPreviewPos}>
          <capsuleGeometry args={[0.35, 1.2, 8, 16]} />
          <meshBasicMaterial color="#00ffff" transparent opacity={0.5} />
        </mesh>
      )}

      {previewSourcePos && activeWaypointPos && (
        <WaypointLine
          start={previewSourcePos}
          end={activeWaypointPos}
          color={placingTempWaypointForNpcId ? "#f59e0b" : "#f43f5e"}
        />
      )}

      {activeWaypointPos &&
        anyPlacingActive &&
        (() => {
          const isTempMode = !!placingTempWaypointForNpcId;
          const targetId = isTempMode
            ? placingTempWaypointForNpcId
            : placingWaypointForNpcId;
          const targetNpc = npcs?.find((n) => n.id === targetId);
          const listKey = isTempMode ? "temporaryWaypoints" : "waypoints";
          const nextIndex = targetNpc ? (targetNpc[listKey]?.length || 0) + 1 : "?";
          const previewColor = isTempMode ? "#f59e0b" : "#ff3333";

          return (
            <group position={activeWaypointPos}>
              <mesh>
                <sphereGeometry args={[0.22, 16, 16]} />
                <meshBasicMaterial
                  color={previewColor}
                  transparent
                  opacity={0.78}
                  depthWrite={false}
                />
              </mesh>
              <mesh
                rotation={[-Math.PI / 2, 0, 0]}
                position={[0, -waypointHeight, 0]}
              >
                <ringGeometry args={[0.35, 0.45, 32]} />
                <meshBasicMaterial
                  color={previewColor}
                  transparent
                  opacity={0.55}
                  side={THREE.DoubleSide}
                  depthWrite={false}
                />
              </mesh>
              <mesh
                rotation={[-Math.PI / 2, 0, 0]}
                position={[0, -waypointHeight + 0.01, 0]}
              >
                <ringGeometry args={[0.08, 0.12, 24]} />
                <meshBasicMaterial
                  color="#ffffff"
                  transparent
                  opacity={0.9}
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
                  background: previewColor,
                  color: "#ffffff",
                  width: "20px",
                  height: "20px",
                  borderRadius: "50%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontFamily: "monospace, sans-serif",
                  fontWeight: "bold",
                  fontSize: "10px",
                  border: "2px solid white",
                  boxShadow: "0 2px 5px rgba(0,0,0,0.3)",
                  opacity: 0.9,
                }}
              >
                {isTempMode ? `T${nextIndex}` : nextIndex}
              </Html>
              <Html
                position={[0, 0.72, 0]}
                center
                style={{
                  pointerEvents: "none",
                  userSelect: "none",
                  background: "rgba(0,0,0,0.78)",
                  color: "#ffffff",
                  fontSize: "10px",
                  fontWeight: "bold",
                  padding: "3px 7px",
                  borderRadius: "5px",
                  whiteSpace: "nowrap",
                }}
              >
                {isTempMode
                  ? "Click to place temporary waypoint"
                  : "Click to place waypoint"}
              </Html>
              {waypointHeight > 0.25 && (
                <Html
                  position={[0, -waypointHeight / 2, 0]}
                  center
                  style={{
                    pointerEvents: "none",
                    userSelect: "none",
                    background: "rgba(0,0,0,0.75)",
                    color: previewColor,
                    fontSize: "9px",
                    fontWeight: "bold",
                    padding: "4px 6px",
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

