import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  createDefaultDialogueNode,
  createUniqueId,
  normalizeDialogue,
} from "./npcInspector/dialogue/dialogueUtils";
import { normalizeWaypoint } from "./npcInspector/waypoints/waypointUtils";
import NPCSettingsForm from "./npcInspector/settings/NPCSettingsForm";
import WaypointEditor from "./npcInspector/waypoints/WaypointEditor";
import DialogueNodeEditor from "./npcInspector/dialogue/DialogueNodeEditor";

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

function normalizeDialogueForEditorRuntimeBridge(dialogueData) {
  const normalized = normalizeDialogue(dialogueData);
  const nextNodes = {};

  const rawNodes =
    dialogueData && typeof dialogueData === "object" && dialogueData.nodes
      ? dialogueData.nodes
      : {};

  Object.entries(normalized.nodes).forEach(([nodeId, node]) => {
    const originalNode = rawNodes[nodeId] || {};
    const rawSpeakerName =
      node.speakerName !== undefined ? node.speakerName : originalNode.speakerName;

    nextNodes[nodeId] = {
      ...node,
      speakerName: typeof rawSpeakerName === "string" ? rawSpeakerName : "",
      speakerData: originalNode.speakerData || {},
      onEnter: Array.isArray(node.onEnter)
        ? node.onEnter.map(normalizeDialogueActionForRuntime)
        : [],
      onExit: Array.isArray(node.onExit)
        ? node.onExit.map(normalizeDialogueActionForRuntime)
        : [],
      choices: Array.isArray(node.choices)
        ? node.choices.map((choice) => ({
            ...choice,
            actions: Array.isArray(choice.actions)
              ? choice.actions.map(normalizeDialogueActionForRuntime)
              : [],
            conditions: Array.isArray(choice.conditions)
              ? choice.conditions.map((condition) => ({ ...condition }))
              : [],
          }))
        : [],
    };
  });

  return {
    ...normalized,
    nodes: nextNodes,
  };
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
      ? choice.actions.map(normalizeDialogueActionForRuntime)
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
function buildAggregatedSpeakerData(dialogue, targetTalkerNames = []) {
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

export default function NPCInspectorPanel({
  selectedNpc,
  updateNpc,
  selectedWaypointIndex,
  setSelectedWaypointIndex,
  setPlacingWaypointForNpcId,
  placingWaypointForNpcId,
  allNpcs = [],
}) {
  const fileInputRef = useRef(null);
  const [selectedDialogueNodeId, setSelectedDialogueNodeId] = useState("root");
  const [newSpeakerName, setNewSpeakerName] = useState("");

  const selectedNpcId =
    selectedNpc?.npcId || selectedNpc?.id || selectedNpc?._id || null;

  const dialogue = useMemo(
    () => normalizeDialogueForEditorRuntimeBridge(selectedNpc?.dialogue),
    [selectedNpc?.dialogue]
  );

  const handleInputKeyDown = (e) => {
    e.stopPropagation();
  };

  useEffect(() => {
    if (!selectedNpcId) {
      setSelectedDialogueNodeId("root");
      return;
    }

    const currentDialogue = normalizeDialogueForEditorRuntimeBridge(
      selectedNpc?.dialogue
    );

    setSelectedDialogueNodeId((currentNodeId) => {
      if (currentDialogue.nodes[currentNodeId]) {
        return currentNodeId;
      }
      return currentDialogue.startNodeId;
    });
  }, [selectedNpcId, selectedNpc?.dialogue]);

  const talkerNames = useMemo(() => {
    if (!selectedNpc) return [];

    const definedTalkerNames = Array.isArray(selectedNpc.talkerNames)
      ? selectedNpc.talkerNames
      : [];

    const discoveredSpeakers = new Set(definedTalkerNames);

    Object.values(dialogue.nodes).forEach((node) => {
      if (node?.speakerData && typeof node.speakerData === "object") {
        Object.keys(node.speakerData).forEach((key) => {
          if (key && key !== "default" && key !== "undefined") {
            discoveredSpeakers.add(key);
          }
        });
      }
      if (
        node?.speakerName &&
        node.speakerName !== "default" &&
        node.speakerName !== ""
      ) {
        discoveredSpeakers.add(node.speakerName);
      }
    });

    return Array.from(discoveredSpeakers)
      .map((name) => `${name ?? ""}`.trim())
      .filter(Boolean);
  }, [selectedNpc, dialogue.nodes]);

  const persistTalkerNames = (updatedTalkerNames) => {
    if (!selectedNpc?.id) return;

    const safeTalkerNames = Array.isArray(updatedTalkerNames)
      ? updatedTalkerNames
          .map((name) => `${name ?? ""}`.trim())
          .filter(Boolean)
      : [];

    const aggregatedSpeakerData = buildAggregatedSpeakerData(
      dialogue,
      safeTalkerNames
    );

    updateNpc(selectedNpc.id, {
      talkerNames: safeTalkerNames,
      speakerData: aggregatedSpeakerData,
      hasTalkersList: safeTalkerNames.length > 0,
      currentSpeakerIndex:
        typeof selectedNpc.currentSpeakerIndex === "number"
          ? Math.min(
              Math.max(selectedNpc.currentSpeakerIndex, 0),
              Math.max(safeTalkerNames.length - 1, 0)
            )
          : 0,
      dialogue: {
        ...(selectedNpc.dialogue || {}),
        ...(dialogue || {}),
        talkerNames: safeTalkerNames,
        speakerData: aggregatedSpeakerData,
      },
    });
  };

  useEffect(() => {
    if (!selectedNpc?.id) return;

    const currentTop = Array.isArray(selectedNpc.talkerNames)
      ? selectedNpc.talkerNames.map((v) => `${v ?? ""}`.trim()).filter(Boolean)
      : [];

    const derived = Array.isArray(talkerNames)
      ? talkerNames.map((v) => `${v ?? ""}`.trim()).filter(Boolean)
      : [];

    const same =
      currentTop.length === derived.length &&
      currentTop.every((v, i) => v === derived[i]);

    if (!same && derived.length > 0) {
      persistTalkerNames(derived);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedNpc?.id, talkerNames]);

  useEffect(() => {
    if (!selectedNpc) return;

    const speakerSequence = talkerNames.map((name) => {
      const data = selectedNpc.speakerData?.[name] || {
        dialogues: [],
        dialogue: null,
        dialogueText: "",
        playerChoices: [],
      };

      return {
        speaker: name,
        dialoguesCount: Array.isArray(data.dialogues) ? data.dialogues.length : 0,
        hasRuntimeDialoguePayload: Boolean(
          data.priorityDialogue != null ||
            data.temporaryDialogue != null ||
            data.temporaryDialogueText != null ||
            data.temporaryDialogueTree != null ||
            data.temporaryDialogueOptions != null ||
            data.temporaryPlayerChoices != null ||
            data.dialogue != null ||
            data.dialogueTree != null ||
            data.dialogueText != null ||
            data.dialogueOptions != null ||
            data.playerChoices != null
        ),
        dialogueText: data.dialogueText || data.dialogue?.text || "",
        playerChoicesCount: Array.isArray(data.playerChoices)
          ? data.playerChoices.length
          : Array.isArray(data.dialogue?.choices)
            ? data.dialogue.choices.length
            : 0,
        dialogues: data.dialogues || [],
      };
    });

    console.log(`[NPCInspectorPanel] Dialogue Speakers Sequence JSON Updated:`, {
      count: talkerNames.length,
      npcId: selectedNpcId,
      npcName: selectedNpc.name,
      hasTalkersList:
        Array.isArray(selectedNpc.talkerNames) &&
        selectedNpc.talkerNames.length > 0,
      sequenceJson: speakerSequence,
    });
  }, [selectedNpc, talkerNames, selectedNpcId]);

  if (!selectedNpc) {
    return null;
  }

  const waypoints = Array.isArray(selectedNpc.waypoints)
    ? selectedNpc.waypoints
    : [];
  const dialogueNodeIds = Object.keys(dialogue.nodes);

  const activeDialogueNodeId =
    selectedDialogueNodeId && dialogue.nodes[selectedDialogueNodeId]
      ? selectedDialogueNodeId
      : dialogue.startNodeId;

  const rawActiveDialogueNode =
    dialogue.nodes[activeDialogueNodeId] || dialogue.nodes[dialogueNodeIds[0]];

  let activeDialogueNode = null;
  if (rawActiveDialogueNode) {
    const speakerKey = rawActiveDialogueNode.speakerName || "default";
    const speakerScopedPayload =
      rawActiveDialogueNode.speakerData?.[speakerKey] || {
        text: rawActiveDialogueNode.text || "",
        choices: rawActiveDialogueNode.choices || [],
      };

    activeDialogueNode = {
      ...rawActiveDialogueNode,
      text: speakerScopedPayload.text,
      choices: speakerScopedPayload.choices,
    };
  }

  const updateDialogue = (nextDialogue) => {
    const normalized = normalizeDialogueForEditorRuntimeBridge(nextDialogue);
    const aggregatedSpeakerData = buildAggregatedSpeakerData(normalized, talkerNames);

    updateNpc(selectedNpc.id, {
      dialogue: {
        ...normalized,
        talkerNames,
        speakerData: aggregatedSpeakerData,
      },
      talkerNames,
      speakerData: aggregatedSpeakerData,
      hasTalkersList: talkerNames.length > 0,
      currentSpeakerIndex:
        typeof selectedNpc.currentSpeakerIndex === "number"
          ? Math.min(
              Math.max(selectedNpc.currentSpeakerIndex, 0),
              Math.max(talkerNames.length - 1, 0)
            )
          : 0,
    });
  };

  const updateDialogueNode = (nodeId, patch) => {
    const currentNode = dialogue.nodes[nodeId];
    if (!currentNode) {
      return;
    }

    const speakerKey =
      patch.speakerName !== undefined
        ? patch.speakerName
        : currentNode.speakerName || "default";

    let updatedSpeakerData = { ...(currentNode.speakerData || {}) };

    if (patch.text !== undefined || patch.choices !== undefined || patch.speakerName !== undefined) {
      updatedSpeakerData[speakerKey] = {
        text:
          patch.text !== undefined
            ? patch.text
            : updatedSpeakerData[speakerKey]?.text || currentNode.text || "",
        choices:
          patch.choices !== undefined
            ? patch.choices
            : updatedSpeakerData[speakerKey]?.choices || currentNode.choices || [],
      };
    }

    const activeText =
      patch.text !== undefined
        ? patch.text
        : updatedSpeakerData[speakerKey]?.text || currentNode.text || "";
    const activeChoices =
      patch.choices !== undefined
        ? patch.choices
        : updatedSpeakerData[speakerKey]?.choices || currentNode.choices || [];

    updateDialogue({
      ...dialogue,
      nodes: {
        ...dialogue.nodes,
        [nodeId]: {
          ...currentNode,
          ...patch,
          text: activeText,
          choices: activeChoices,
          speakerData: updatedSpeakerData,
          id: nodeId,
        },
      },
    });
  };

  const handleSpeakerChange = (newSpeaker) => {
    if (!rawActiveDialogueNode) return;
    const speakerKey = newSpeaker || "default";

    const savedData = rawActiveDialogueNode.speakerData?.[speakerKey] || {
      text: rawActiveDialogueNode.text || "",
      choices: rawActiveDialogueNode.choices || [],
    };

    updateDialogueNode(activeDialogueNodeId, {
      speakerName: newSpeaker,
      text: savedData.text,
      choices: savedData.choices,
    });
  };

  const addDialogueNode = () => {
    const newNodeId = createUniqueId("node");
    const defaultSpeakerName = talkerNames[0] || "";

    updateDialogue({
      ...dialogue,
      nodes: {
        ...dialogue.nodes,
        [newNodeId]: {
          ...createDefaultDialogueNode(newNodeId, ""),
          speakerName: defaultSpeakerName,
          speakerData: defaultSpeakerName
            ? {
                [defaultSpeakerName]: {
                  text: "",
                  choices: [],
                },
              }
            : {},
        },
      },
    });

    setSelectedDialogueNodeId(newNodeId);
  };

  const duplicateDialogueNode = (nodeId) => {
    const sourceNode = dialogue.nodes[nodeId];
    if (!sourceNode) {
      return;
    }

    const newNodeId = createUniqueId("node");

    const duplicatedChoices = sourceNode.choices.map((choice, index) => ({
      ...choice,
      id: createUniqueId(`choice_${index + 1}`),
      actions: Array.isArray(choice.actions)
        ? choice.actions.map((action) => ({ ...action }))
        : [],
      conditions: Array.isArray(choice.conditions)
        ? choice.conditions.map((condition) => ({ ...condition }))
        : [],
    }));

    updateDialogue({
      ...dialogue,
      nodes: {
        ...dialogue.nodes,
        [newNodeId]: {
          ...sourceNode,
          id: newNodeId,
          text: sourceNode.text ? `${sourceNode.text} (Copy)` : "",
          choices: duplicatedChoices,
          onEnter: sourceNode.onEnter.map((action) => ({ ...action })),
          onExit: sourceNode.onExit.map((action) => ({ ...action })),
          speakerName: sourceNode.speakerName || talkerNames[0] || "",
          speakerData: sourceNode.speakerData
            ? JSON.parse(JSON.stringify(sourceNode.speakerData))
            : {},
        },
      },
    });

    setSelectedDialogueNodeId(newNodeId);
  };

  const renameDialogueNode = (oldNodeId, requestedNodeId) => {
    const newNodeId = requestedNodeId.trim();

    if (!newNodeId || newNodeId === oldNodeId) {
      return;
    }

    if (dialogue.nodes[newNodeId]) {
      alert(`A dialogue node with ID "${newNodeId}" already exists.`);
      return;
    }

    const renamedNodes = {};

    Object.entries(dialogue.nodes).forEach(([nodeId, node]) => {
      const finalNodeId = nodeId === oldNodeId ? newNodeId : nodeId;

      renamedNodes[finalNodeId] = {
        ...node,
        id: finalNodeId,
        choices: node.choices.map((choice) => ({
          ...choice,
          nextNodeId:
            choice.nextNodeId === oldNodeId ? newNodeId : choice.nextNodeId,
        })),
      };
    });

    updateDialogue({
      ...dialogue,
      startNodeId:
        dialogue.startNodeId === oldNodeId ? newNodeId : dialogue.startNodeId,
      nodes: renamedNodes,
    });

    setSelectedDialogueNodeId(newNodeId);
  };

  const deleteDialogueNode = (nodeId) => {
    if (dialogueNodeIds.length <= 1) {
      alert("A dialogue must contain at least one node.");
      return;
    }

    if (
      !window.confirm(
        `Delete dialogue node "${nodeId}"? Choices pointing to it will be changed to End Dialogue.`
      )
    ) {
      return;
    }

    const remainingNodes = {};

    Object.entries(dialogue.nodes).forEach(([existingNodeId, existingNode]) => {
      if (existingNodeId === nodeId) {
        return;
      }

      remainingNodes[existingNodeId] = {
        ...existingNode,
        choices: existingNode.choices.map((choice) => ({
          ...choice,
          nextNodeId: choice.nextNodeId === nodeId ? null : choice.nextNodeId,
        })),
      };
    });

    const remainingNodeIds = Object.keys(remainingNodes);
    const nextStartNodeId =
      dialogue.startNodeId === nodeId ? remainingNodeIds[0] : dialogue.startNodeId;

    updateDialogue({
      ...dialogue,
      startNodeId: nextStartNodeId,
      nodes: remainingNodes,
    });

    setSelectedDialogueNodeId(nextStartNodeId);
  };

  const setDialogueStartNode = (nodeId) => {
    if (!dialogue.nodes[nodeId]) {
      return;
    }

    updateDialogue({
      ...dialogue,
      startNodeId: nodeId,
    });
  };

  const addDialogueChoice = (nodeId) => {
    const currentNode = dialogue.nodes[nodeId];
    if (!currentNode) {
      return;
    }

    updateDialogueNode(nodeId, {
      choices: [
        ...currentNode.choices,
        {
          id: createUniqueId("choice"),
          text: "New response",
          nextNodeId: null,
          actions: [],
          conditions: [],
        },
      ],
    });
  };

  const updateDialogueChoice = (nodeId, choiceIndex, patch) => {
    const currentNode = dialogue.nodes[nodeId];
    if (!currentNode) {
      return;
    }

    const updatedChoices = currentNode.choices.map((choice, index) =>
      index === choiceIndex ? { ...choice, ...patch } : choice
    );

    updateDialogueNode(nodeId, {
      choices: updatedChoices,
    });
  };

  const deleteDialogueChoice = (nodeId, choiceIndex) => {
    const currentNode = dialogue.nodes[nodeId];
    if (!currentNode) {
      return;
    }

    updateDialogueNode(nodeId, {
      choices: currentNode.choices.filter((_, index) => index !== choiceIndex),
    });
  };

  const moveDialogueChoice = (nodeId, choiceIndex, direction) => {
    const currentNode = dialogue.nodes[nodeId];
    if (!currentNode) {
      return;
    }

    const targetIndex = direction === "up" ? choiceIndex - 1 : choiceIndex + 1;
    if (targetIndex < 0 || targetIndex >= currentNode.choices.length) {
      return;
    }

    const updatedChoices = [...currentNode.choices];
    [updatedChoices[choiceIndex], updatedChoices[targetIndex]] = [
      updatedChoices[targetIndex],
      updatedChoices[choiceIndex],
    ];

    updateDialogueNode(nodeId, {
      choices: updatedChoices,
    });
  };

  const handleTextureUpload = (event) => {
    const file = event.target.files[0];
    if (!file) {
      return;
    }

    if (!file.type.match("image/jpeg") && !file.type.match("image/png")) {
      alert("Please upload a JPEG or PNG image.");
      return;
    }

    const reader = new FileReader();

    reader.onload = (readerEvent) => {
      updateNpc(selectedNpc.id, {
        textureUrl: readerEvent.target.result,
      });
    };

    reader.readAsDataURL(file);
  };

  const removeTexture = () => {
    updateNpc(selectedNpc.id, {
      textureUrl: null,
    });

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleNpcBaseChange = (section, field, value) => {
    const parsedValue = parseFloat(value) || 0;

    if (section) {
      updateNpc(selectedNpc.id, {
        [section]: {
          ...selectedNpc[section],
          [field]: parsedValue,
        },
      });
    } else {
      updateNpc(selectedNpc.id, {
        [field]: parsedValue,
      });
    }
  };

  const handleNpcBaseStringChange = (section, field, value) => {
    if (section) {
      updateNpc(selectedNpc.id, {
        [section]: {
          ...selectedNpc[section],
          [field]: value,
        },
      });
    } else {
      updateNpc(selectedNpc.id, {
        [field]: value,
      });
    }
  };

  const handleReactionChange = (targetId, behavior) => {
    const currentReactions = selectedNpc.detection?.reactions || {};
    const newReactions = { ...currentReactions };

    if (behavior === "default") {
      delete newReactions[targetId];
    } else {
      newReactions[targetId] = behavior;
    }

    updateNpc(selectedNpc.id, {
      detection: {
        ...selectedNpc.detection,
        reactions: newReactions,
      },
    });
  };

  const handleWaypointChange = (index, coordinateIndex, value) => {
    const updatedWaypoints = [...waypoints];

    const normalized = normalizeWaypoint(
      updatedWaypoints[index],
      selectedNpc.movement?.waitTime ?? 0
    );

    normalized.pos[coordinateIndex] = parseFloat(value) || 0;
    updatedWaypoints[index] = normalized;

    updateNpc(selectedNpc.id, {
      waypoints: updatedWaypoints,
    });
  };

  const handleWaypointWaitTimeChange = (index, value) => {
    const updatedWaypoints = [...waypoints];

    const normalized = normalizeWaypoint(
      updatedWaypoints[index],
      selectedNpc.movement?.waitTime ?? 0
    );

    normalized.waitTime = Math.max(0, parseFloat(value) || 0);
    updatedWaypoints[index] = normalized;

    updateNpc(selectedNpc.id, {
      waypoints: updatedWaypoints,
    });
  };

  const deleteWaypoint = (index) => {
    const updatedWaypoints = waypoints.filter(
      (_, waypointIndex) => waypointIndex !== index
    );

    let newTargetIndex = selectedNpc.currentWaypointIndex ?? 0;

    if (updatedWaypoints.length === 0) {
      newTargetIndex = 0;
    } else if (newTargetIndex >= updatedWaypoints.length) {
      newTargetIndex = updatedWaypoints.length - 1;
    } else if (newTargetIndex === index) {
      newTargetIndex = Math.min(index, updatedWaypoints.length - 1);
    } else if (newTargetIndex > index) {
      newTargetIndex -= 1;
    }

    updateNpc(selectedNpc.id, {
      waypoints: updatedWaypoints,
      currentWaypointIndex: newTargetIndex,
    });

    if (selectedWaypointIndex === index) {
      setSelectedWaypointIndex(null);
    } else if (selectedWaypointIndex > index) {
      setSelectedWaypointIndex(selectedWaypointIndex - 1);
    }
  };

  const moveWaypoint = (index, direction) => {
    if (direction === "up" && index === 0) {
      return;
    }

    if (direction === "down" && index === waypoints.length - 1) {
      return;
    }

    const targetIndex = direction === "up" ? index - 1 : index + 1;
    const updatedWaypoints = [...waypoints];

    const temporaryWaypoint = updatedWaypoints[index];
    updatedWaypoints[index] = updatedWaypoints[targetIndex];
    updatedWaypoints[targetIndex] = temporaryWaypoint;

    let newTargetIndex = selectedNpc.currentWaypointIndex ?? 0;
    if (newTargetIndex === index) {
      newTargetIndex = targetIndex;
    } else if (newTargetIndex === targetIndex) {
      newTargetIndex = index;
    }

    updateNpc(selectedNpc.id, {
      waypoints: updatedWaypoints,
      currentWaypointIndex: newTargetIndex,
    });

    setSelectedWaypointIndex(targetIndex);
  };

  const duplicateWaypoint = (index) => {
    const original = normalizeWaypoint(
      waypoints[index],
      selectedNpc.movement?.waitTime ?? 0
    );

    const newWaypoint = {
      ...original,
      pos: [
        (original.pos[0] ?? 0) + 0.5,
        original.pos[1] ?? 0,
        (original.pos[2] ?? 0) + 0.5,
      ],
      waitTime: original.waitTime ?? 0,
    };

    const updatedWaypoints = [...waypoints];
    updatedWaypoints.splice(index + 1, 0, newWaypoint);

    let newTargetIndex = selectedNpc.currentWaypointIndex ?? 0;
    if (newTargetIndex > index) {
      newTargetIndex += 1;
    }

    updateNpc(selectedNpc.id, {
      waypoints: updatedWaypoints,
      currentWaypointIndex: newTargetIndex,
    });

    setSelectedWaypointIndex(index + 1);
  };

  const setAsCurrentTarget = (index) => {
    updateNpc(selectedNpc.id, {
      currentWaypointIndex: index,
    });
  };

  const addSpeakerName = () => {
    const trimmed = newSpeakerName.trim();
    if (!trimmed) return;

    const updated = [...talkerNames, trimmed];
    persistTalkerNames(updated);
    setNewSpeakerName("");
  };

  const removeSpeakerName = (indexToRemove) => {
    const updated = talkerNames.filter((_, idx) => idx !== indexToRemove);
    persistTalkerNames(updated);
  };

  const updateSpeakerNameAt = (index, value) => {
    const updated = [...talkerNames];
    updated[index] = value;
    persistTalkerNames(updated);
  };

  const moveSpeakerName = (index, direction) => {
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= talkerNames.length) return;

    const updated = [...talkerNames];
    const temp = updated[index];
    updated[index] = updated[targetIndex];
    updated[targetIndex] = temp;

    persistTalkerNames(updated);
  };

  const movementMode = selectedNpc.movement?.mode || "idle";

  return (
    <div className="npc-inspector-panel" onKeyDown={handleInputKeyDown}>
      <NPCSettingsForm
        selectedNpc={selectedNpc}
        selectedNpcId={selectedNpcId}
        allNpcs={allNpcs}
        fileInputRef={fileInputRef}
        movementMode={movementMode}
        handleTextureUpload={handleTextureUpload}
        removeTexture={removeTexture}
        handleNpcBaseChange={handleNpcBaseChange}
        handleNpcBaseStringChange={handleNpcBaseStringChange}
        handleReactionChange={handleReactionChange}
        updateNpc={updateNpc}
      />

      <WaypointEditor
        selectedNpc={selectedNpc}
        movementMode={movementMode}
        waypoints={waypoints}
        selectedWaypointIndex={selectedWaypointIndex}
        setSelectedWaypointIndex={setSelectedWaypointIndex}
        setPlacingWaypointForNpcId={setPlacingWaypointForNpcId}
        placingWaypointForNpcId={placingWaypointForNpcId}
        handleWaypointChange={handleWaypointChange}
        handleWaypointWaitTimeChange={handleWaypointWaitTimeChange}
        moveWaypoint={moveWaypoint}
        duplicateWaypoint={duplicateWaypoint}
        setAsCurrentTarget={setAsCurrentTarget}
        deleteWaypoint={deleteWaypoint}
      />

      <div className="section-title">Dialogue Tree</div>

      <div className="dialogue-editor">
        <div className="dialogue-editor-header">
          <div className="settings-field talker-identity">
            <label>Dialogue Speakers Sequence</label>

            {talkerNames.length === 0 ? (
              <div className="dialogue-empty-small">
                No speakers defined. Add one below.
              </div>
            ) : (
              <div className="speaker-sequence-list">
                {talkerNames.map((speaker, index) => (
                  <div key={index} className="speaker-sequence-item">
                    <span className="speaker-index">#{index + 1}</span>
                    <input
                      type="text"
                      value={speaker}
                      placeholder={`Speaker ${index + 1}`}
                      onChange={(e) => updateSpeakerNameAt(index, e.target.value)}
                      onKeyDown={handleInputKeyDown}
                      className="talker-name-input speaker-sequence-input"
                    />
                    <div className="speaker-sequence-controls">
                      <button
                        type="button"
                        onClick={() => moveSpeakerName(index, "up")}
                        disabled={index === 0}
                        title="Move Up"
                      >
                        ▲
                      </button>
                      <button
                        type="button"
                        onClick={() => moveSpeakerName(index, "down")}
                        disabled={index === talkerNames.length - 1}
                        title="Move Down"
                      >
                        ▼
                      </button>
                      <button
                        type="button"
                        className="btn-delete"
                        onClick={() => removeSpeakerName(index)}
                        title="Remove"
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="add-speaker-row">
              <input
                type="text"
                value={newSpeakerName}
                placeholder="New talker identity..."
                onChange={(e) => setNewSpeakerName(e.target.value)}
                onKeyDown={(e) => {
                  e.stopPropagation();
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addSpeakerName();
                  }
                }}
              />
              <button
                type="button"
                className="dialogue-primary-button add-speaker-btn"
                onClick={addSpeakerName}
              >
                Add Speaker
              </button>
            </div>
          </div>
        </div>

        <div className="dialogue-editor-body">
          <div className="dialogue-toolbar">
            <div className="settings-field dialogue-node-selector">
              <label>Selected Node</label>
              <select
                value={activeDialogueNodeId}
                onChange={(event) => setSelectedDialogueNodeId(event.target.value)}
              >
                {dialogueNodeIds.map((nodeId) => (
                  <option key={nodeId} value={nodeId}>
                    {nodeId}
                    {dialogue.startNodeId === nodeId ? " (Start)" : ""}
                  </option>
                ))}
              </select>
            </div>

            <button
              type="button"
              className="dialogue-primary-button"
              onClick={addDialogueNode}
            >
              + New Node
            </button>
          </div>

          {rawActiveDialogueNode && (
            <div className="node-speaker-assignment">
              <label>Active Speaker for this Node:</label>
              <select
                value={rawActiveDialogueNode.speakerName || ""}
                onChange={(e) => handleSpeakerChange(e.target.value)}
              >
                <option value="">-- Use Default NPC --</option>
                {talkerNames.map((name, idx) => (
                  <option key={idx} value={name}>
                    {name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {activeDialogueNode && (
            <DialogueNodeEditor
              dialogue={dialogue}
              activeDialogueNode={activeDialogueNode}
              activeDialogueNodeId={activeDialogueNodeId}
              dialogueNodeIds={dialogueNodeIds}
              selectedNpcId={selectedNpcId}
              allNpcs={allNpcs}
              setDialogueStartNode={setDialogueStartNode}
              duplicateDialogueNode={duplicateDialogueNode}
              deleteDialogueNode={deleteDialogueNode}
              renameDialogueNode={renameDialogueNode}
              updateDialogueNode={updateDialogueNode}
              addDialogueChoice={addDialogueChoice}
              updateDialogueChoice={updateDialogueChoice}
              deleteDialogueChoice={deleteDialogueChoice}
              moveDialogueChoice={moveDialogueChoice}
            />
          )}
        </div>
      </div>

      <style jsx>{`
        .npc-inspector-panel {
          padding: 10px;
          color: #333;
        }

        .npc-settings-grid {
          display: grid;
          grid-template-columns: 1fr;
          gap: 10px;
          margin-bottom: 15px;
          background: #f8f9fa;
          padding: 10px;
          border-radius: 6px;
          border: 1px solid #e2e8f0;
        }

        .settings-field {
          display: flex;
          flex-direction: column;
        }

        .settings-field label {
          font-size: 11px;
          font-weight: 600;
          margin-bottom: 4px;
          color: #4a5568;
        }

        .settings-field input,
        .settings-field select,
        .settings-field textarea {
          box-sizing: border-box;
          width: 100%;
          padding: 5px 8px;
          font-size: 13px;
          border: 1px solid #cbd5e0;
          border-radius: 4px;
          background: #fff;
          color: #333;
          font-family: inherit;
        }

        .settings-field textarea {
          resize: vertical;
          min-height: 72px;
          line-height: 1.4;
        }

        .checkbox-label {
          display: flex;
          align-items: center;
          gap: 8px;
          cursor: pointer;
        }

        .checkbox-label input {
          width: 16px;
          height: 16px;
        }

        .compact-checkbox-label {
          margin-top: 2px;
          font-size: 10px;
          color: #475569;
        }

        .section-title {
          font-weight: bold;
          margin: 15px 0 8px;
          border-bottom: 1px solid #ddd;
          padding-bottom: 4px;
          font-size: 13px;
          color: #2d3748;
        }

        .waypoint-actions-header {
          margin-bottom: 10px;
        }

        .btn-action {
          width: 100%;
          padding: 8px;
          background: #28a745;
          color: white;
          border: none;
          border-radius: 4px;
          cursor: pointer;
          font-weight: bold;
        }

        .btn-action.active {
          background: #dc3545;
        }

        .waypoints-list {
          max-height: 250px;
          overflow-y: auto;
          border: 1px solid #ddd;
          background: #fcfcfc;
          border-radius: 4px;
        }

        .waypoint-item {
          padding: 8px;
          border-bottom: 1px solid #eee;
          cursor: pointer;
          transition: background 0.2s;
        }

        .waypoint-item:hover {
          background: #f1f5f9;
        }

        .waypoint-item.selected {
          background: #fef08a;
          border-left: 3px solid #eab308;
        }

        .waypoint-item.current-target {
          background: #dcfce7;
        }

        .waypoint-item.selected.current-target {
          background: #d9f99d;
        }

        .waypoint-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 5px;
        }

        .waypoint-number {
          font-weight: bold;
          color: #4a5568;
        }

        .target-badge {
          background: #22c55e;
          color: white;
          font-size: 9px;
          padding: 1px 5px;
          border-radius: 3px;
          font-weight: bold;
        }

        .waypoint-item-controls {
          display: flex;
          margin-left: auto;
        }

        .waypoint-item-controls button {
          background: #e2e8f0;
          color: #4a5568;
          border: 1px solid #cbd5e0;
          margin-left: 4px;
          padding: 3px 6px;
          border-radius: 3px;
          cursor: pointer;
          font-size: 10px;
        }

        .waypoint-item-controls button:hover:not(:disabled) {
          background: #cbd5e0;
        }

        .waypoint-item-controls button:disabled {
          opacity: 0.3;
          cursor: not-allowed;
        }

        .waypoint-item-controls button.btn-danger {
          background: #fee2e2;
          color: #ef4444;
          border: 1px solid #fecaca;
        }

        .waypoint-item-controls button.btn-danger:hover {
          background: #fca5a5;
        }

        .waypoint-details {
          margin-top: 8px;
        }

        .waypoint-coordinates {
          display: flex;
          gap: 5px;
          background: #f1f5f9;
          padding: 6px;
          border-radius: 4px;
          border: 1px solid #e2e8f0;
        }

        .coord-input-group {
          display: flex;
          flex-direction: column;
          flex: 1;
          min-width: 0;
        }

        .coord-input-group label {
          font-size: 9px;
          color: #4a5568;
          margin-bottom: 2px;
          font-weight: bold;
        }

        .coord-input-group input {
          box-sizing: border-box;
          width: 100%;
          background: #fff;
          border: 1px solid #cbd5e0;
          color: #333;
          padding: 2px 4px;
          font-size: 11px;
          border-radius: 3px;
        }

        .waypoint-wait-field {
          margin-top: 8px;
          background: #f8fafc;
          padding: 6px;
          border-radius: 4px;
          border: 1px solid #e2e8f0;
        }

        .no-waypoints {
          padding: 15px;
          text-align: center;
          color: #718096;
          font-size: 12px;
        }

        .dialogue-editor {
          padding: 10px;
          border: 1px solid #cbd5e0;
          border-radius: 6px;
          background: #f8fafc;
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .dialogue-editor-header {
          padding-bottom: 10px;
          border-bottom: 1px dashed #cbd5e0;
        }

        .talker-name-input {
          font-weight: bold;
          color: #2563eb !important;
          background: #eff6ff !important;
          border: 1px solid #bfdbfe !important;
        }

        .speaker-sequence-list {
          display: flex;
          flex-direction: column;
          gap: 6px;
          margin-bottom: 8px;
        }

        .speaker-sequence-item {
          display: flex;
          align-items: center;
          gap: 8px;
          background: #ffffff;
          padding: 4px 8px;
          border-radius: 4px;
          border: 1px solid #e2e8f0;
        }

        .speaker-index {
          font-size: 11px;
          color: #64748b;
          font-weight: bold;
          min-width: 20px;
        }

        .speaker-sequence-input {
          flex: 1;
          height: 28px;
          padding: 2px 6px !important;
          font-size: 12px !important;
        }

        .speaker-sequence-controls {
          display: flex;
          gap: 3px;
        }

        .speaker-sequence-controls button {
          height: 26px;
          padding: 0 6px;
          font-size: 9px;
          background: #f1f5f9;
          border: 1px solid #cbd5e0;
          border-radius: 3px;
          cursor: pointer;
          color: #475569;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .speaker-sequence-controls button:hover:not(:disabled) {
          background: #e2e8f0;
        }

        .speaker-sequence-controls button:disabled {
          opacity: 0.3;
          cursor: not-allowed;
        }

        .speaker-sequence-controls button.btn-delete {
          color: #ef4444;
          background: #fee2e2;
          border-color: #fecaca;
        }

        .speaker-sequence-controls button.btn-delete:hover {
          background: #fca5a5;
        }

        .add-speaker-row {
          display: flex;
          gap: 8px;
          margin-top: 6px;
        }

        .add-speaker-row input {
          flex: 1;
          height: 32px;
          font-size: 12px;
        }

        .add-speaker-btn {
          padding: 0 12px !important;
          height: 32px;
          font-size: 11px !important;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .node-speaker-assignment {
          display: flex;
          align-items: center;
          gap: 10px;
          background: #f1f5f9;
          padding: 8px 10px;
          border-radius: 5px;
          border: 1px solid #cbd5e0;
          margin-bottom: 10px;
        }

        .node-speaker-assignment label {
          font-size: 11px;
          font-weight: bold;
          color: #334155;
        }

        .node-speaker-assignment select {
          flex: 1;
          height: 28px;
          padding: 2px 6px;
          font-size: 12px;
          border-radius: 4px;
          border: 1px solid #cbd5e0;
          background: #fff;
        }

        .dialogue-editor-body {
          display: flex;
          flex-direction: column;
        }

        .dialogue-toolbar {
          display: flex;
          align-items: flex-end;
          gap: 8px;
          margin-bottom: 10px;
        }

        .dialogue-node-selector {
          flex: 1;
          min-width: 0;
        }

        .dialogue-primary-button,
        .dialogue-small-button,
        .dialogue-node-buttons button,
        .dialogue-choice-controls button {
          border: 1px solid #cbd5e0;
          border-radius: 4px;
          cursor: pointer;
          font-weight: 600;
        }

        .dialogue-primary-button {
          padding: 6px 9px;
          background: #2563eb;
          border-color: #2563eb;
          color: white;
          white-space: nowrap;
        }

        .dialogue-primary-button:hover {
          background: #1d4ed8;
        }

        .dialogue-node-card {
          padding: 10px;
          border: 1px solid #dbe3ee;
          border-radius: 6px;
          background: white;
        }

        .dialogue-node-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 8px;
          margin-bottom: 8px;
          font-size: 12px;
          color: #334155;
        }

        .dialogue-start-badge {
          padding: 2px 6px;
          border-radius: 999px;
          background: #dcfce7;
          color: #15803d;
          font-size: 9px;
          font-weight: bold;
        }

        .dialogue-node-buttons {
          display: flex;
          flex-wrap: wrap;
          gap: 5px;
          margin-bottom: 10px;
        }

        .dialogue-node-buttons button {
          padding: 5px 7px;
          background: #e2e8f0;
          color: #334155;
          font-size: 10px;
        }

        .dialogue-node-buttons button:hover:not(:disabled) {
          background: #cbd5e0;
        }

        .dialogue-node-buttons button:disabled,
        .dialogue-choice-controls button:disabled {
          cursor: not-allowed;
          opacity: 0.4;
        }

        .dialogue-node-buttons .dialogue-danger-button {
          background: #fee2e2;
          border-color: #fecaca;
          color: #dc2626;
        }

        .dialogue-node-buttons button.btn-danger {
          background: #fee2e2;
          color: #dc2626;
          border-color: #fecaca;
        }

        .dialogue-help-text {
          margin: 3px 0 8px;
          color: #64748b;
          font-size: 9px;
          line-height: 1.4;
        }

        .dialogue-inline-note {
          padding: 6px 7px;
          border: 1px dashed #cbd5e0;
          border-radius: 4px;
          background: #f8fafc;
          color: #64748b;
          font-size: 9px;
          line-height: 1.4;
        }

        .dialogue-choices-header,
        .dialogue-actions-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 8px;
          margin-top: 12px;
          margin-bottom: 6px;
          color: #334155;
          font-size: 11px;
          font-weight: bold;
        }

        .dialogue-choice-list {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .dialogue-choice-card {
          padding: 8px;
          border: 1px solid #dbeafe;
          border-left: 3px solid #3b82f6;
          border-radius: 5px;
          background: #eff6ff;
        }

        .dialogue-choice-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 7px;
          color: #1e3a8a;
          font-size: 10px;
          font-weight: bold;
        }

        .dialogue-choice-controls {
          display: flex;
          gap: 4px;
        }

        .dialogue-choice-controls button {
          padding: 2px 6px;
          background: white;
          color: #475569;
          font-size: 9px;
        }

        .dialogue-choice-controls button:hover:not(:disabled) {
          background: #dbeafe;
        }

        .dialogue-delete-button {
          padding: 3px 6px;
          border: 1px solid #fecaca;
          border-radius: 4px;
          background: #fee2e2;
          color: #dc2626;
          cursor: pointer;
          font-size: 10px;
        }

        .dialogue-delete-button:hover {
          background: #fecaca;
        }

        .dialogue-actions-editor {
          margin-top: 9px;
          padding: 7px;
          border: 1px solid #e2e8f0;
          border-radius: 5px;
          background: #f8fafc;
        }

        .dialogue-small-button {
          padding: 3px 7px;
          background: #475569;
          color: white;
          font-size: 9px;
        }

        .dialogue-small-button:hover {
          background: #334155;
        }

        .dialogue-action-row {
          display: flex;
          align-items: flex-end;
          gap: 5px;
          margin-top: 6px;
          padding-top: 6px;
          border-top: 1px solid #e2e8f0;
        }

        .dialogue-action-fields {
          display: grid;
          grid-template-columns: 1fr;
          gap: 5px;
          flex: 1;
          min-width: 0;
        }

        .dialogue-action-fields label {
          display: flex;
          flex-direction: column;
          gap: 2px;
          color: #64748b;
          font-size: 9px;
          font-weight: 600;
        }

        .dialogue-action-fields input,
        .dialogue-action-fields select {
          box-sizing: border-box;
          width: 100%;
          padding: 4px 6px;
          border: 1px solid #cbd5e0;
          border-radius: 3px;
          background: white;
          color: #334155;
          font-size: 10px;
        }

        .dialogue-waypoint-block {
          border: 1px solid #dbe3ee;
          border-radius: 5px;
          padding: 6px;
          background: #fff;
        }

        .dialogue-waypoint-block-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 8px;
          margin-bottom: 6px;
          color: #334155;
          font-size: 10px;
          font-weight: bold;
        }

        .dialogue-waypoint-editor {
          border-top: 1px solid #e2e8f0;
          padding-top: 6px;
          margin-top: 6px;
        }

        .dialogue-waypoint-editor:first-of-type {
          border-top: none;
          padding-top: 0;
          margin-top: 0;
        }

        .dialogue-waypoint-editor-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 8px;
          margin-bottom: 6px;
          color: #475569;
          font-size: 10px;
          font-weight: bold;
        }

        .dialogue-waypoint-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 6px;
          margin-bottom: 6px;
        }

        .dialogue-empty,
        .dialogue-empty-small {
          color: #64748b;
          font-style: italic;
          text-align: center;
        }

        .dialogue-empty {
          padding: 10px;
          border: 1px dashed #cbd5e0;
          border-radius: 4px;
          background: #f8fafc;
          font-size: 10px;
          line-height: 1.4;
        }

        .dialogue-empty-small {
          padding: 5px;
          font-size: 9px;
        }
      `}</style>
    </div>
  );
}
