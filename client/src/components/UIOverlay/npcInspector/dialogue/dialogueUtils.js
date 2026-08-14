export function createUniqueId(prefix = "id") {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

export function getDefaultActionValue(type) {
  switch (type) {
    case "setFlag":
    case "clearFlag":
    case "playSound":
    case "giveItem":
    case "removeItem":
    case "teleport":
    case "startQuest":
    case "completeQuest":
      return "";

    case "setNpcWaypointWaitTime":
      return { target: "main", waypointIndex: 0, waitTime: 0 };

    case "setNpcWaypointDialogue":
      return { target: "main", waypointIndex: 0, dialogueNodeId: "", trigger: "onReach" };

    case "setNpcWaypoints":
      return {
        target: "main",
        mode: "append",
        priority: true,
        resumePatrol: true,
        clearOnComplete: true,
        clearOnPlayerDistance: false,
        maxPlayerDistance: 12,
        distanceTimeoutMs: 3000,
        waypoints: [],
      };

    case "resetNpcEventSequence":
      return {
        target: "all",
        maxPlayerDistance: 12,
        timeoutMs: 3000,
        clearDialogueFlags: true,
        despawnClones: true,
        resumePatrol: true,
      };

    case "despawnOwnedClones":
      return { target: "all" };

    case "summonNpc":
      return {
        count: 1,
        behavior: "idle",
        offset: [1, 0, 1],
        spawnTargetType: "owner",
        spawnTargetNpcId: null,
        behaviorTargetType: "owner",
        behaviorTargetNpcId: null,
        spawnNearOwner: true,
        inheritOwnerWaypoints: true,
        replaceExistingOwnedClones: true,
        hasTemporaryDialogue: false,
        temporaryDialogueText: "",
        clearTemporaryDialogueAfterFirstUse: true,
        playerChoices: [],
      };

    case "setTemporaryDialogue":
      return {
        target: "main",
        temporaryDialogue: "",
        priorityDialogue: true,
        clearDistance: 12,
        clearDelay: 3000,
        clearTemporaryDialogueAfterFirstUse: false,
        speakerTargetType: "owner",
        speakerTargetNpcId: null,
        responseTargetType: "owner",
        responseTargetNpcId: null,
      };


    case "setNpcTextureWhileInRadius":
      return {
        textureUrl: "",
      };

    default:
      return "";
  }
}

export function getObjectActionValue(action, fallback = {}) {
  if (!action || typeof action !== "object") return { ...fallback };
  if (action.value && typeof action.value === "object" && !Array.isArray(action.value)) {
    return { ...fallback, ...action.value };
  }
  if (typeof action.payload === "object" && action.payload !== null && !Array.isArray(action.payload)) {
    return { ...fallback, ...action.payload };
  }
  return { ...fallback };
}

export function normalizeDialogueAction(action) {
  if (!action || typeof action !== "object") {
    return { type: "playSound", targetNpcId: null, value: "" };
  }

  const type = action.type || "playSound";
  const defaultValue = getDefaultActionValue(type);

  let normalizedValue;
  if (typeof defaultValue === "object" && defaultValue !== null && !Array.isArray(defaultValue)) {
    normalizedValue = getObjectActionValue(action, defaultValue);

    if (type === "setNpcWaypoints") {
      if (!normalizedValue.mode) {
        normalizedValue.mode = normalizedValue.replaceExisting === false ? "append" : "replace";
      }
      normalizedValue.priority = normalizedValue.priority ?? true;
      normalizedValue.resumePatrol = normalizedValue.resumePatrol ?? true;
      normalizedValue.clearOnComplete = normalizedValue.clearOnComplete ?? true;
      normalizedValue.clearOnPlayerDistance = normalizedValue.clearOnPlayerDistance ?? false;
      normalizedValue.maxPlayerDistance = normalizedValue.maxPlayerDistance ?? 12;
      normalizedValue.distanceTimeoutMs = normalizedValue.distanceTimeoutMs ?? 3000;
      normalizedValue.waypoints = Array.isArray(normalizedValue.waypoints) ? normalizedValue.waypoints : [];
    }

    if (type === "summonNpc") {
      normalizedValue.count = normalizedValue.count ?? 1;
      normalizedValue.behavior = normalizedValue.behavior || "idle";
      normalizedValue.offset = Array.isArray(normalizedValue.offset) ? normalizedValue.offset : [1, 0, 1];
      normalizedValue.spawnTargetType = normalizedValue.spawnTargetType || "owner";
      normalizedValue.spawnTargetNpcId = normalizedValue.spawnTargetNpcId ?? null;
      normalizedValue.behaviorTargetType = normalizedValue.behaviorTargetType || "owner";
      normalizedValue.behaviorTargetNpcId = normalizedValue.behaviorTargetNpcId ?? null;
      normalizedValue.inheritOwnerWaypoints = normalizedValue.inheritOwnerWaypoints ?? true;
      normalizedValue.replaceExistingOwnedClones = normalizedValue.replaceExistingOwnedClones ?? true;
      normalizedValue.hasTemporaryDialogue = normalizedValue.hasTemporaryDialogue ?? false;
      normalizedValue.temporaryDialogueText = normalizedValue.temporaryDialogueText ?? "";
      normalizedValue.clearTemporaryDialogueAfterFirstUse = normalizedValue.clearTemporaryDialogueAfterFirstUse ?? true;
      normalizedValue.playerChoices = Array.isArray(normalizedValue.playerChoices) ? normalizedValue.playerChoices : [];
    }

    if (type === "setTemporaryDialogue") {
      normalizedValue.target = normalizedValue.target || "main";
      normalizedValue.temporaryDialogue = normalizedValue.temporaryDialogue || "";
      normalizedValue.priorityDialogue = normalizedValue.priorityDialogue ?? true;
      
      // Ensure compatible keys for runtime
      normalizedValue.clearTemporaryDialogueDistance = normalizedValue.clearTemporaryDialogueDistance ?? normalizedValue.clearDistance ?? 12;
      normalizedValue.clearTemporaryDialogueDelay = normalizedValue.clearTemporaryDialogueDelay ?? normalizedValue.clearDelay ?? 3000;
      
      normalizedValue.clearDistance = normalizedValue.clearDistance ?? 12;
      normalizedValue.clearDelay = normalizedValue.clearDelay ?? 3000;
      normalizedValue.clearTemporaryDialogueAfterFirstUse = normalizedValue.clearTemporaryDialogueAfterFirstUse ?? false;
      normalizedValue.speakerTargetType = normalizedValue.speakerTargetType || "owner";
      normalizedValue.speakerTargetNpcId = normalizedValue.speakerTargetNpcId ?? null;
      normalizedValue.responseTargetType = normalizedValue.responseTargetType || "owner";
      normalizedValue.responseTargetNpcId = normalizedValue.responseTargetNpcId ?? null;
    }
  } else {
    normalizedValue = typeof action.value === "undefined" ? defaultValue : action.value;
  }

  return { ...action, type, targetNpcId: action.targetNpcId ?? null, value: normalizedValue };
}

export function normalizeDialogueChoice(choice) {
  return {
    id: choice?.id || createUniqueId("choice"),
    text: choice?.text || "",
    nextNodeId: choice?.nextNodeId ?? null,
    actions: Array.isArray(choice?.actions) ? choice.actions.map(normalizeDialogueAction) : [],
    conditions: Array.isArray(choice?.conditions) ? [...choice.conditions] : [],
  };
}

export function createDefaultDialogueNode(id, text = "") {
  return { id, text, choices: [], onEnter: [], onExit: [] };
}

export function normalizeDialogueNode(node, fallbackId = "root") {
  const nodeId = node?.id || fallbackId;
  return {
    id: nodeId,
    text: node?.text || "",
    choices: Array.isArray(node?.choices) ? node.choices.map(normalizeDialogueChoice) : [],
    onEnter: Array.isArray(node?.onEnter) ? node.onEnter.map(normalizeDialogueAction) : [],
    onExit: Array.isArray(node?.onExit) ? node.onExit.map(normalizeDialogueAction) : [],
  };
}

export function normalizeDialogue(dialogue) {
  const rawNodes = dialogue?.nodes || { root: createDefaultDialogueNode("root", "") };
  const normalizedNodes = {};
  Object.entries(rawNodes).forEach(([nodeId, node]) => {
    normalizedNodes[nodeId] = normalizeDialogueNode(node, nodeId);
  });
  const finalNodeIds = Object.keys(normalizedNodes);
  const startNodeId = dialogue?.startNodeId && normalizedNodes[dialogue.startNodeId] ? dialogue.startNodeId : finalNodeIds[0];
  return { startNodeId, nodes: normalizedNodes };
}


/* ------------------------------------------------------------------ */
/* Dialogue Speakers Sequence aggregation (moved from NPCInspectorPanel) */
/* ------------------------------------------------------------------ */

function cloneChoiceList(choices) {
  if (!Array.isArray(choices)) {
    return [];
  }

  return choices.map((choice) => ({
    ...choice,
    actions: Array.isArray(choice.actions)
      ? choice.actions.map((action) => ({ ...action }))
      : [],
    conditions: Array.isArray(choice.conditions)
      ? choice.conditions.map((condition) => ({ ...condition }))
      : [],
  }));
}

function normalizeDialogueActionForRuntime(action) {
  if (!action || typeof action !== "object" || Array.isArray(action)) {
    return action;
  }

  const nextAction = { ...action };

  if (
    nextAction.temporaryDialogue == null &&
    nextAction.temporaryDialogueText != null &&
    nextAction.temporaryDialogueText !== ""
  ) {
    nextAction.temporaryDialogue = nextAction.temporaryDialogueText;
  }

  if (
    nextAction.temporaryPlayerChoices == null &&
    Array.isArray(nextAction.playerChoices) &&
    nextAction.playerChoices.length > 0
  ) {
    nextAction.temporaryPlayerChoices = cloneChoiceList(nextAction.playerChoices);
  }

  if (
    nextAction.temporaryPlayerChoices == null &&
    Array.isArray(nextAction.temporaryChoices) &&
    nextAction.temporaryChoices.length > 0
  ) {
    nextAction.temporaryPlayerChoices = cloneChoiceList(nextAction.temporaryChoices);
  }

  return nextAction;
}

function normalizeChoiceForSpeakerAggregation(choice) {
  if (!choice || typeof choice !== "object") {
    return {
      text: "",
      nextId: null,
      nextNodeId: null,
      actions: [],
      conditions: [],
    };
  }

  const nextNodeId = choice.nextNodeId || choice.nextId || null;

  return {
    ...choice,
    text: choice.text || "",
    nextId: nextNodeId,
    nextNodeId,
    actions: Array.isArray(choice.actions)
      ? choice.actions.map(normalizeDialogueAction)
      : [],
    conditions: Array.isArray(choice.conditions)
      ? choice.conditions.map((condition) => ({ ...condition }))
      : [],
  };
}

/**
 * Aggregate dialogue node sequence into runtime-consumable speaker payloads.
 * useNPCBrain.js expects:
 *   npc.talkerNames
 *   npc.speakerData[speakerName].dialogue / dialogueText / playerChoices / ...
 */
export function buildAggregatedSpeakerData(dialogue, targetTalkerNames = []) {
  const aggregated = {};

  const ensureSpeakerBucket = (speakerName) => {
    if (!speakerName) return null;

    if (!aggregated[speakerName]) {
      aggregated[speakerName] = {
        dialogues: [],
        dialogue: null,
        dialogueText: "",
        playerChoices: [],
      };
    }

    return aggregated[speakerName];
  };

  targetTalkerNames.forEach((name) => {
    const trimmed = `${name ?? ""}`.trim();
    if (trimmed) {
      ensureSpeakerBucket(trimmed);
    }
  });

  if (dialogue && typeof dialogue === "object" && dialogue.nodes) {
    Object.entries(dialogue.nodes).forEach(([nodeId, node]) => {
      if (!node || typeof node !== "object") return;

      const candidateSpeakers = new Set();

      if (node.speakerName && node.speakerName !== "default" && node.speakerName !== "undefined") {
        candidateSpeakers.add(`${node.speakerName}`.trim());
      }

      if (node.speakerData && typeof node.speakerData === "object") {
        Object.keys(node.speakerData).forEach((key) => {
          if (key && key !== "default" && key !== "undefined") {
            candidateSpeakers.add(`${key}`.trim());
          }
        });
      }

      candidateSpeakers.forEach((speakerName) => {
        if (!speakerName) return;
        const bucket = ensureSpeakerBucket(speakerName);
        if (!bucket) return;

        if (bucket.dialogues.some((d) => d.id === nodeId || d.nodeId === nodeId)) {
          return;
        }

        const scopedSpeakerPayload =
          node.speakerData &&
          typeof node.speakerData === "object" &&
          node.speakerData[speakerName] &&
          typeof node.speakerData[speakerName] === "object"
            ? node.speakerData[speakerName]
            : null;

        const resolvedText =
          scopedSpeakerPayload?.text != null && scopedSpeakerPayload.text !== ""
            ? scopedSpeakerPayload.text
            : node.text != null
              ? node.text
              : "";

        const resolvedChoices =
          Array.isArray(scopedSpeakerPayload?.choices) && scopedSpeakerPayload.choices.length > 0
            ? scopedSpeakerPayload.choices
            : Array.isArray(node.choices)
              ? node.choices
              : [];

        const normalizedChoices = resolvedChoices.map(normalizeChoiceForSpeakerAggregation);

        const runtimeDialogueEntry = {
          id: nodeId,
          nodeId,
          speakerName,
          text: resolvedText,
          dialogueText: resolvedText,
          choices: normalizedChoices,
          playerChoices: cloneChoiceList(normalizedChoices),
          nextId: normalizedChoices[0]?.nextId ?? null,
          nextNodeId: normalizedChoices[0]?.nextNodeId ?? null,
          onEnter: Array.isArray(node.onEnter)
            ? node.onEnter.map(normalizeDialogueActionForRuntime)
            : [],
          onExit: Array.isArray(node.onExit)
            ? node.onExit.map(normalizeDialogueActionForRuntime)
            : [],
        };

        bucket.dialogues.push(runtimeDialogueEntry);

        if (bucket.dialogue == null || (!bucket.dialogueText && resolvedText)) {
          bucket.dialogue = runtimeDialogueEntry;
        }

        if (!bucket.dialogueText && resolvedText) {
          bucket.dialogueText = resolvedText;
        }

        if (
          (!Array.isArray(bucket.playerChoices) || bucket.playerChoices.length === 0) &&
          normalizedChoices.length > 0
        ) {
          bucket.playerChoices = cloneChoiceList(normalizedChoices);
        }
      });
    });
  }

  // Ensure every speaker in targetTalkerNames has valid, non-empty dialogue payload metadata
  const startNodeId =
    dialogue?.startNodeId || (dialogue?.nodes ? Object.keys(dialogue.nodes)[0] : null);
  const defaultNode = startNodeId && dialogue?.nodes ? dialogue.nodes[startNodeId] : null;

  targetTalkerNames.forEach((speakerName) => {
    const trimmed = `${speakerName ?? ""}`.trim();
    if (!trimmed) return;

    const bucket = aggregated[trimmed];
    if (!bucket) return;

    if (Array.isArray(bucket.dialogues) && bucket.dialogues.length > 0) {
      const bestEntry =
        bucket.dialogues.find((d) => d && d.text && d.text.trim().length > 0) ||
        bucket.dialogues[0];

      if (bestEntry) {
        bucket.dialogue = bestEntry;
        bucket.dialogueText = bestEntry.text || bestEntry.dialogueText || "";
        if (!bucket.playerChoices || bucket.playerChoices.length === 0) {
          bucket.playerChoices = cloneChoiceList(bestEntry.choices || []);
        }
      }
    }

    if ((!bucket.dialogue || !bucket.dialogueText) && defaultNode) {
      const fallbackText =
        defaultNode.speakerData?.[trimmed]?.text || defaultNode.text || "";
      const fallbackChoices = Array.isArray(defaultNode.speakerData?.[trimmed]?.choices)
        ? defaultNode.speakerData[trimmed].choices
        : Array.isArray(defaultNode.choices)
          ? defaultNode.choices
          : [];
      const normalizedChoices = fallbackChoices.map(normalizeChoiceForSpeakerAggregation);

      const fallbackEntry = {
        id: startNodeId,
        nodeId: startNodeId,
        speakerName: trimmed,
        text: fallbackText,
        dialogueText: fallbackText,
        choices: normalizedChoices,
        playerChoices: cloneChoiceList(normalizedChoices),
        nextId: normalizedChoices[0]?.nextId ?? null,
        nextNodeId: normalizedChoices[0]?.nextNodeId ?? null,
        onEnter: Array.isArray(defaultNode.onEnter)
          ? defaultNode.onEnter.map(normalizeDialogueActionForRuntime)
          : [],
        onExit: Array.isArray(defaultNode.onExit)
          ? defaultNode.onExit.map(normalizeDialogueActionForRuntime)
          : [],
      };

      if (!bucket.dialogue) bucket.dialogue = fallbackEntry;
      if (!bucket.dialogueText) bucket.dialogueText = fallbackText;
      if (!bucket.dialogues || bucket.dialogues.length === 0) bucket.dialogues = [fallbackEntry];
      if (!bucket.playerChoices || bucket.playerChoices.length === 0) {
        bucket.playerChoices = cloneChoiceList(normalizedChoices);
      }
    }
  });

  return aggregated;
}
