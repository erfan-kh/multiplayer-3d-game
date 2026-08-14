import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  executeDialogueActions,
  checkConditions,
} from "../EditorScene/npc/utils/dialogueActions";

function cloneChoice(choice) {
  if (!choice || typeof choice !== "object") {
    return {
      text: "",
      nextNodeId: null,
      actions: [],
      conditions: [],
    };
  }

  return {
    ...choice,
    actions: Array.isArray(choice.actions)
      ? choice.actions.map((action) => ({ ...action }))
      : [],
    conditions: Array.isArray(choice.conditions)
      ? choice.conditions.map((condition) => ({ ...condition }))
      : [],
  };
}

function cloneNode(nodeId, node) {
  return {
    ...node,
    id: node?.id ?? nodeId,
    text: typeof node?.text === "string" ? node.text : "",
    choices: Array.isArray(node?.choices) ? node.choices.map(cloneChoice) : [],
    onEnter: Array.isArray(node?.onEnter)
      ? node.onEnter.map((action) => ({ ...action }))
      : [],
    onExit: Array.isArray(node?.onExit)
      ? node.onExit.map((action) => ({ ...action }))
      : [],
  };
}

function buildStructuredDialogue(candidate) {
  if (
    !candidate ||
    typeof candidate !== "object" ||
    Array.isArray(candidate) ||
    !candidate.nodes ||
    typeof candidate.nodes !== "object" ||
    Array.isArray(candidate.nodes)
  ) {
    return null;
  }

  const nodeKeys = Object.keys(candidate.nodes);
  if (nodeKeys.length === 0) {
    return null;
  }

  const nodes = {};

  nodeKeys.forEach((nodeId) => {
    nodes[nodeId] = cloneNode(nodeId, candidate.nodes[nodeId]);
  });

  const startNodeId =
    candidate.startNodeId && nodes[candidate.startNodeId]
      ? candidate.startNodeId
      : nodes.root
      ? "root"
      : nodeKeys[0];

  return {
    startNodeId,
    nodes,
  };
}

function buildSimpleDialogue(text, rawChoices) {
  if (text == null && !Array.isArray(rawChoices)) {
    return null;
  }

  return {
    startNodeId: "root",
    nodes: {
      root: {
        id: "root",
        text: text ?? "",
        choices: Array.isArray(rawChoices) ? rawChoices.map(cloneChoice) : [],
        onEnter: [],
        onExit: [],
      },
    },
  };
}

function normalizeDialoguePayload(payload, npc) {
  const source = payload ?? npc ?? null;

  if (!source) {
    return null;
  }

  const structuredCandidates = [
    source,
    source.dialoguePayload,
    source.activeDialogue,
    source.priorityDialogue,
    source.temporaryDialogue,
    source.temporaryDialogueTree,
    source.dialogue,
    source.dialogueTree,
  ];

  for (const candidate of structuredCandidates) {
    const structured = buildStructuredDialogue(candidate);

    if (structured) {
      return structured;
    }
  }

  const text =
    source.temporaryDialogueText ??
    (typeof source.temporaryDialogue === "string"
      ? source.temporaryDialogue
      : null) ??
    source.dialogueText ??
    (typeof source.dialogue === "string" ? source.dialogue : null) ??
    source.text ??
    null;

  const rawChoices =
    source.temporaryPlayerChoices ??
    source.temporaryDialogueOptions ??
    source.playerChoices ??
    source.dialogueOptions ??
    source.choices ??
    null;

  return buildSimpleDialogue(text, rawChoices);
}

function getNodeById(dialogue, nodeId) {
  if (!dialogue?.nodes || !nodeId) {
    return null;
  }

  return dialogue.nodes[nodeId] ?? null;
}

function getValidStartNodeId(dialogue) {
  if (!dialogue?.nodes || typeof dialogue.nodes !== "object") {
    return null;
  }

  if (dialogue.startNodeId && dialogue.nodes[dialogue.startNodeId]) {
    return dialogue.startNodeId;
  }

  if (dialogue.nodes.root) {
    return "root";
  }

  const firstNodeId = Object.keys(dialogue.nodes)[0];

  return firstNodeId ?? null;
}

function hasTemporaryDialoguePayload(source) {
  if (!source || typeof source !== "object") {
    return false;
  }

  return !!(
    source.hasTemporaryDialogue ||
    source.priorityDialogue ||
    source.temporaryDialogue ||
    source.temporaryDialogueText ||
    source.temporaryDialogueTree ||
    source.temporaryDialogueOptions ||
    source.temporaryPlayerChoices
  );
}

function normalizeSpeakerName(value) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

/**
 * Reads one speaker entry from the different speakerData formats supported by
 * the sequence system:
 *
 * 1. speakerData[index]
 * 2. speakerData["0"]
 * 3. speakerData[speakerName]
 * 4. An object value containing speakerName/name/talkerName
 */
function getSpeakerEntry(collection, targetIndex, targetSpeakerName) {
  if (!collection || typeof collection !== "object") {
    return null;
  }

  if (Array.isArray(collection)) {
    return collection[targetIndex] ?? null;
  }

  if (Object.prototype.hasOwnProperty.call(collection, targetIndex)) {
    return collection[targetIndex] ?? null;
  }

  const indexKey = String(targetIndex);

  if (Object.prototype.hasOwnProperty.call(collection, indexKey)) {
    return collection[indexKey] ?? null;
  }

  if (
    targetSpeakerName &&
    Object.prototype.hasOwnProperty.call(collection, targetSpeakerName)
  ) {
    return collection[targetSpeakerName] ?? null;
  }

  const normalizedTargetName = normalizeSpeakerName(targetSpeakerName);

  if (normalizedTargetName) {
    const matchingKey = Object.keys(collection).find(
      (key) => normalizeSpeakerName(key) === normalizedTargetName
    );

    if (matchingKey) {
      return collection[matchingKey] ?? null;
    }

    const matchingValue = Object.values(collection).find((entry) => {
      if (!entry || typeof entry !== "object") {
        return false;
      }

      const entryName =
        entry.speakerName ??
        entry.talkerName ??
        entry.name ??
        entry.label ??
        "";

      return normalizeSpeakerName(entryName) === normalizedTargetName;
    });

    if (matchingValue) {
      return matchingValue;
    }
  }

  return null;
}

/**
 * If the selected speaker entry contains a raw node map rather than a complete
 * dialogue object, wrap it as a structured dialogue payload.
 */
function coerceSpeakerDialoguePayload(candidate) {
  if (!candidate || typeof candidate !== "object") {
    return candidate ?? null;
  }

  if (Array.isArray(candidate)) {
    return candidate;
  }

  if (
    candidate.nodes &&
    typeof candidate.nodes === "object" &&
    !Array.isArray(candidate.nodes)
  ) {
    return candidate;
  }

  const nestedCandidates = [
    candidate.dialoguePayload,
    candidate.activeDialogue,
    candidate.priorityDialogue,
    candidate.temporaryDialogue,
    candidate.temporaryDialogueTree,
    candidate.dialogue,
    candidate.dialogueTree,
  ];

  for (const nestedCandidate of nestedCandidates) {
    if (nestedCandidate != null) {
      return nestedCandidate;
    }
  }

  return candidate;
}

function getSequenceSpeakerDataCollections(source) {
  if (!source || typeof source !== "object") {
    return [];
  }

  return [
    source.speakerData,
    source.dialogueSpeakerData,
    source.sequenceSpeakerData,
    source.dialogueSequence?.speakerData,
    source.dialogueSequenceData?.speakerData,
  ].filter(Boolean);
}

function getSequenceNodeCollections(source) {
  if (!source || typeof source !== "object") {
    return [];
  }

  return [
    source.speakerNodes,
    source.sequenceNodes,
    source.dialogueSequence?.speakerNodes,
    source.dialogueSequence?.nodes,
    source.dialogueSequenceData?.speakerNodes,
    source.dialogueSequenceData?.nodes,
  ].filter(Boolean);
}

function resolveFromSpeakerCollections({
  sources,
  targetIndex,
  targetSpeakerName,
}) {
  for (const source of sources) {
    const speakerCollections = getSequenceSpeakerDataCollections(source);

    for (const collection of speakerCollections) {
      const entry = getSpeakerEntry(
        collection,
        targetIndex,
        targetSpeakerName
      );

      if (entry != null) {
        return coerceSpeakerDialoguePayload(entry);
      }
    }
  }

  for (const source of sources) {
    const nodeCollections = getSequenceNodeCollections(source);

    for (const collection of nodeCollections) {
      const entry = getSpeakerEntry(
        collection,
        targetIndex,
        targetSpeakerName
      );

      if (entry == null) {
        continue;
      }

      if (
        entry &&
        typeof entry === "object" &&
        !Array.isArray(entry) &&
        !entry.nodes &&
        !entry.text &&
        !entry.dialogueText
      ) {
        return {
          startNodeId: entry.startNodeId,
          nodes: entry,
        };
      }

      return coerceSpeakerDialoguePayload(entry);
    }
  }

  return null;
}

function getDirectDialoguePayload(detail) {
  if (!detail || typeof detail !== "object") {
    return null;
  }

  return (
    detail.dialoguePayload ??
    detail.activeDialogue ??
    detail.currentDialogue ??
    detail.speakerDialogue ??
    detail.priorityDialogue ??
    detail.temporaryDialogue ??
    detail.dialogue ??
    detail.dialogueTree ??
    null
  );
}

const EMPTY_SEQUENCE_DATA = {
  visible: false,
  npcId: null,
  talkerNames: [],
  currentSpeakerIndex: 0,
  activeSpeakerName: "",
  speakerData: null,
  speakerNodes: null,
  dialoguePayload: null,
  revision: 0,
};

export default function DialogueOverlay({
  activeDialogueNpcId,
  activeDialogue = null,
  npcs = [],
  setNpcs,
  gameFlags = {},
  setGameFlags,
  onClose,
  onCustomEvent,
  onDialogueClosed,
  onAdvanceSequence,
}) {
  const [sequenceData, setSequenceData] = useState(EMPTY_SEQUENCE_DATA);

  // Prevent repeated jump requests when a tab is clicked rapidly.
  const lastJumpRef = useRef({
    npcId: null,
    index: null,
    t: 0,
  });

  useEffect(() => {
    const handleSequenceUpdate = (event) => {
      const detail = event.detail || {};

      const {
        npcId,
        talkerNames,
        currentSpeakerIndex,
        activeSpeakerName,
      } = detail;

      setSequenceData((previous) => {
        const nextTalkerNames = Array.isArray(talkerNames)
          ? talkerNames
          : previous.talkerNames;

        const parsedSpeakerIndex = Number(currentSpeakerIndex);

        const nextSpeakerIndex =
          Number.isInteger(parsedSpeakerIndex) && parsedSpeakerIndex >= 0
            ? parsedSpeakerIndex
            : previous.currentSpeakerIndex;

        const fallbackSpeakerName =
          nextTalkerNames[nextSpeakerIndex] ?? "";

        return {
          visible: true,
          npcId: npcId ?? previous.npcId ?? activeDialogueNpcId ?? null,
          talkerNames: nextTalkerNames,
          currentSpeakerIndex: nextSpeakerIndex,
          activeSpeakerName:
            activeSpeakerName ??
            fallbackSpeakerName ??
            previous.activeSpeakerName ??
            "",

          // Preserve full sequence collections if a later banner update only
          // contains the current index/name.
          speakerData:
            detail.speakerData ??
            detail.dialogueSpeakerData ??
            detail.sequenceSpeakerData ??
            previous.speakerData ??
            null,

          speakerNodes:
            detail.speakerNodes ??
            detail.sequenceNodes ??
            detail.nodes ??
            previous.speakerNodes ??
            null,

          // A direct dialogue payload belongs only to this specific update.
          // Do not preserve it across another speaker update because doing so
          // could display the previous speaker's dialogue.
          dialoguePayload: getDirectDialoguePayload(detail),

          revision: previous.revision + 1,
        };
      });
    };

    const handleSequenceClose = () => {
      setSequenceData((previous) => ({
        ...EMPTY_SEQUENCE_DATA,
        revision: previous.revision + 1,
      }));

      lastJumpRef.current = {
        npcId: null,
        index: null,
        t: 0,
      };
    };

    window.addEventListener(
      "npcDialogueSequenceBannerUpdate",
      handleSequenceUpdate
    );

    window.addEventListener(
      "npcDialogueSequenceBannerClose",
      handleSequenceClose
    );

    return () => {
      window.removeEventListener(
        "npcDialogueSequenceBannerUpdate",
        handleSequenceUpdate
      );

      window.removeEventListener(
        "npcDialogueSequenceBannerClose",
        handleSequenceClose
      );
    };
  }, [activeDialogueNpcId]);

  const npc = useMemo(
    () => npcs.find((candidate) => candidate.id === activeDialogueNpcId) ?? null,
    [npcs, activeDialogueNpcId]
  );

  /**
   * The sequence banner's npcId is expected to be the authoritative authored
   * NPC ID. Use that authored host as the primary source of sequence metadata,
   * even if activeDialogueNpcId temporarily points somewhere else.
   */
  const sequenceHostNpc = useMemo(() => {
    if (!sequenceData.visible || !sequenceData.npcId) {
      return npc;
    }

    return (
      npcs.find((candidate) => candidate.id === sequenceData.npcId) ??
      npc ??
      null
    );
  }, [npcs, npc, sequenceData.visible, sequenceData.npcId]);

  const activeSequenceSpeakerName = useMemo(() => {
    if (!sequenceData.visible) {
      return "";
    }

    return (
      sequenceData.activeSpeakerName ||
      sequenceData.talkerNames[sequenceData.currentSpeakerIndex] ||
      ""
    );
  }, [
    sequenceData.visible,
    sequenceData.activeSpeakerName,
    sequenceData.talkerNames,
    sequenceData.currentSpeakerIndex,
  ]);

  /**
   * Resolve the selected speaker's dialogue data.
   *
   * This does not transfer sequence ownership into DialogueOverlay. The
   * authored host NPC and EditorScene remain authoritative. The overlay only
   * reads the active speaker entry for display.
   */
  const resolvedDialogueSource = useMemo(() => {
    if (!sequenceData.visible) {
      return activeDialogue ?? npc ?? null;
    }

    const sequenceEventSource = {
      speakerData: sequenceData.speakerData,
      speakerNodes: sequenceData.speakerNodes,
    };

    const speakerSpecificPayload = resolveFromSpeakerCollections({
      sources: [
        sequenceEventSource,
        sequenceHostNpc,
        activeDialogue,
        npc,
      ],
      targetIndex: sequenceData.currentSpeakerIndex,
      targetSpeakerName: activeSequenceSpeakerName,
    });

    if (speakerSpecificPayload != null) {
      return speakerSpecificPayload;
    }

    if (sequenceData.dialoguePayload != null) {
      return sequenceData.dialoguePayload;
    }

    return activeDialogue ?? sequenceHostNpc ?? npc ?? null;
  }, [
    sequenceData.visible,
    sequenceData.currentSpeakerIndex,
    sequenceData.speakerData,
    sequenceData.speakerNodes,
    sequenceData.dialoguePayload,
    sequenceData.revision,
    activeSequenceSpeakerName,
    sequenceHostNpc,
    activeDialogue,
    npc,
  ]);

  const normalizedDialogue = useMemo(() => {
    return normalizeDialoguePayload(
      resolvedDialogueSource,
      sequenceHostNpc ?? npc
    );
  }, [resolvedDialogueSource, sequenceHostNpc, npc]);

  const startNodeId = useMemo(() => {
    return getValidStartNodeId(normalizedDialogue);
  }, [normalizedDialogue]);

  const [currentNodeId, setCurrentNodeId] = useState(startNodeId);
  const enteredNodeKeyRef = useRef(null);
  const closingRef = useRef(false);
  const advanceInFlightRef = useRef(false);

  /**
   * Every speaker owns an independent local node cursor. When the
   * authoritative sequence index changes, start the selected speaker at that
   * speaker's start node.
   */
  useEffect(() => {
    setCurrentNodeId(startNodeId);
    enteredNodeKeyRef.current = null;
    closingRef.current = false;
    advanceInFlightRef.current = false;
  }, [
    activeDialogueNpcId,
    activeDialogue,
    startNodeId,
    sequenceData.npcId,
    sequenceData.currentSpeakerIndex,
    sequenceData.revision,
  ]);

  /**
   * If the old speaker was inside a node that does not exist in the newly
   * selected speaker's tree, immediately fall back to the new start node. This
   * avoids briefly unmounting the overlay between the event and state reset.
   */
  const effectiveCurrentNodeId = useMemo(() => {
    if (getNodeById(normalizedDialogue, currentNodeId)) {
      return currentNodeId;
    }

    return startNodeId;
  }, [normalizedDialogue, currentNodeId, startNodeId]);

  const currentNode = useMemo(() => {
    return getNodeById(normalizedDialogue, effectiveCurrentNodeId);
  }, [normalizedDialogue, effectiveCurrentNodeId]);

  const useTemporary = useMemo(() => {
    return (
      hasTemporaryDialoguePayload(resolvedDialogueSource) ||
      hasTemporaryDialoguePayload(activeDialogue) ||
      hasTemporaryDialoguePayload(sequenceHostNpc) ||
      hasTemporaryDialoguePayload(npc)
    );
  }, [resolvedDialogueSource, activeDialogue, sequenceHostNpc, npc]);

  const actionContext = useMemo(
    () => ({
      setNpcs,
      setGameFlags,
      triggerCustomEvent: onCustomEvent,
      closeDialogue: onClose,
      currentNpcId: sequenceData.visible
        ? sequenceData.npcId ?? activeDialogueNpcId
        : activeDialogueNpcId,
    }),
    [
      setNpcs,
      setGameFlags,
      onCustomEvent,
      onClose,
      activeDialogueNpcId,
      sequenceData.visible,
      sequenceData.npcId,
    ]
  );

  useEffect(() => {
    if (!currentNode || !activeDialogueNpcId) {
      return;
    }

    const speakerIdentity = sequenceData.visible
      ? `${sequenceData.npcId ?? activeDialogueNpcId}::${
          sequenceData.currentSpeakerIndex
        }::${activeSequenceSpeakerName}`
      : activeDialogueNpcId;

    const nodeEntryKey = `${speakerIdentity}::${effectiveCurrentNodeId}`;

    if (enteredNodeKeyRef.current === nodeEntryKey) {
      return;
    }

    enteredNodeKeyRef.current = nodeEntryKey;

    if (
      Array.isArray(currentNode.onEnter) &&
      currentNode.onEnter.length > 0
    ) {
      executeDialogueActions(currentNode.onEnter, actionContext);
    }
  }, [
    currentNode,
    effectiveCurrentNodeId,
    activeDialogueNpcId,
    actionContext,
    sequenceData.visible,
    sequenceData.npcId,
    sequenceData.currentSpeakerIndex,
    activeSequenceSpeakerName,
  ]);

  const runNodeExitActions = () => {
    if (
      Array.isArray(currentNode?.onExit) &&
      currentNode.onExit.length > 0
    ) {
      executeDialogueActions(currentNode.onExit, actionContext);
    }
  };

  const finalizeClose = (meta = {}) => {
    if (closingRef.current || advanceInFlightRef.current) {
      return;
    }

    const npcId = sequenceData.visible
      ? sequenceData.npcId ?? activeDialogueNpcId
      : activeDialogueNpcId;

    const authoritativeNpc = sequenceHostNpc ?? npc;

    const isSequence = !!(
      authoritativeNpc?.dialogueSequenceId || sequenceData.visible
    );

    const hasMoreSpeakers =
      sequenceData.visible &&
      sequenceData.currentSpeakerIndex <
        sequenceData.talkerNames.length - 1;

    const closeMeta = {
      npc: authoritativeNpc,
      npcId,
      activeDialogue,
      resolvedDialogueSource,
      normalizedDialogue,
      currentNodeId: effectiveCurrentNodeId,
      usedTemporaryDialogue: useTemporary,
      isSequenceMember: isSequence,
      currentSpeakerIndex: sequenceData.currentSpeakerIndex,
      activeSpeakerName: activeSequenceSpeakerName,
      ...meta,
    };

    let advanced = false;

    // Only Next / a completed node may ask the authoritative host to advance.
    // A speaker-tab click never reaches this method.
    if (
      isSequence &&
      hasMoreSpeakers &&
      typeof onAdvanceSequence === "function"
    ) {
      try {
        advanceInFlightRef.current = true;
        closingRef.current = true;

        const result = onAdvanceSequence(closeMeta);
        advanced = result === true;
      } catch (error) {
        advanced = false;
        advanceInFlightRef.current = false;
        closingRef.current = false;

        // eslint-disable-next-line no-console
        console.warn("onAdvanceSequence error:", error);
      }
    }

    if (advanced) {
      /**
       * IMPORTANT:
       * Do NOT call onDialogueClosed here.
       *
       * The sequence is still active. Calling onDialogueClosed makes the parent
       * and useNPCBrain treat this as a real completed close, which can trigger
       * an additional automatic speaker increment.
       *
       * The authoritative sequence host must reopen/update the next speaker
       * through its own controlled sequence hand-off.
       */
      return;
    }

    // No next speaker exists, or advancement was unavailable/failed:
    // this is the only genuine dialogue-close path.
    closingRef.current = true;
    advanceInFlightRef.current = false;

    executeDialogueActions(
      [{ type: "closeDialogue" }],
      actionContext
    );

    onDialogueClosed?.({
      ...closeMeta,
      sequenceAdvanceRequested: false,
    });

    onClose?.();
  };

  /**
   * Speaker-tab clicks must never close or advance the dialogue lifecycle.
   * They only ask the authoritative sequence host to change the active index.
   */
  const requestSequenceJump = (targetIndex) => {
    if (!sequenceData.visible) {
      return;
    }

    if (!Number.isInteger(targetIndex)) {
      return;
    }

    if (
      targetIndex < 0 ||
      targetIndex >= sequenceData.talkerNames.length
    ) {
      return;
    }

    if (targetIndex === sequenceData.currentSpeakerIndex) {
      return;
    }

    const authoritativeNpcId =
      sequenceData.npcId ?? activeDialogueNpcId;

    if (!authoritativeNpcId) {
      return;
    }

    const now =
      typeof performance !== "undefined"
        ? performance.now()
        : Date.now();

    const lastJump = lastJumpRef.current;

    if (
      lastJump.npcId === authoritativeNpcId &&
      lastJump.index === targetIndex &&
      now - lastJump.t < 200
    ) {
      return;
    }

    lastJumpRef.current = {
      npcId: authoritativeNpcId,
      index: targetIndex,
      t: now,
    };

    // Do not run exit actions here. A tab click is a non-closing viewer jump.
    // EditorScene updates the authored host's currentSpeakerIndex and emits
    // npcDialogueSequenceBannerUpdate with the new authoritative state.
    window.dispatchEvent(
      new CustomEvent("npcDialogueSequenceJumpRequest", {
        detail: {
          npcId: authoritativeNpcId,
          targetIndex,
          targetSpeakerName:
            sequenceData.talkerNames[targetIndex] ?? "",
          currentSpeakerIndex: sequenceData.currentSpeakerIndex,
          reason: "overlay-speaker-tab",
        },
      })
    );
  };

  const finishDialogue = () => {
    runNodeExitActions();
    finalizeClose({ reason: "finish" });
  };

  const handleChoiceClick = (choice) => {
    if (!choice) {
      return;
    }

    runNodeExitActions();

    if (
      Array.isArray(choice.actions) &&
      choice.actions.length > 0
    ) {
      executeDialogueActions(choice.actions, actionContext);
    }

    if (
      choice.nextNodeId &&
      normalizedDialogue?.nodes?.[choice.nextNodeId]
    ) {
      closingRef.current = false;
      setCurrentNodeId(choice.nextNodeId);
      return;
    }

    finalizeClose({
      reason: "choice-end",
      choice,
    });
  };

  const visibleChoices = useMemo(() => {
    if (!Array.isArray(currentNode?.choices)) {
      return [];
    }

    return currentNode.choices.filter((choice) =>
      checkConditions(choice?.conditions, gameFlags)
    );
  }, [currentNode, gameFlags]);

  useEffect(() => {
    if (
      !activeDialogueNpcId ||
      !normalizedDialogue ||
      !currentNode
    ) {
      return;
    }

    const onKeyDown = (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        finishDialogue();
        return;
      }

      if (
        event.key === "Enter" &&
        visibleChoices.length === 0
      ) {
        event.preventDefault();
        event.stopPropagation();
        finishDialogue();
      }
    };

    window.addEventListener("keydown", onKeyDown, {
      capture: true,
    });

    return () => {
      window.removeEventListener("keydown", onKeyDown, {
        capture: true,
      });
    };
  }, [
    activeDialogueNpcId,
    normalizedDialogue,
    currentNode,
    visibleChoices.length,
  ]);

  if (
    !activeDialogueNpcId ||
    !normalizedDialogue ||
    !currentNode
  ) {
    return null;
  }

  const resolvedSpeakerName = sequenceData.visible
    ? activeSequenceSpeakerName
    : activeDialogue?.speakerName ||
      npc?.name ||
      activeDialogueNpcId;

  const hasSequence =
    sequenceData.visible &&
    sequenceData.talkerNames.length > 0;

  return (
    <div
      className="dialogue-overlay-container"
      style={{
        position: "absolute",
        bottom: "40px",
        left: "50%",
        transform: "translateX(-50%)",
        width: "90%",
        maxWidth: "720px",
        background: "rgba(10, 15, 30, 0.98)",
        border: "1px solid rgba(168, 85, 247, 0.4)",
        borderRadius: "16px",
        padding: "24px",
        boxShadow:
          "0 20px 40px rgba(0, 0, 0, 0.6), inset 0 1px 0 rgba(255, 255, 255, 0.05)",
        zIndex: 2000,
        color: "#fff",
        fontFamily:
          "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
        display: "flex",
        flexDirection: "column",
        gap: "16px",
      }}
      onMouseDown={(event) => event.stopPropagation()}
      onPointerDown={(event) => event.stopPropagation()}
      onKeyDown={(event) => event.stopPropagation()}
    >
      {/* Dialogue Sequence Interactive Tab Header */}
      {hasSequence && (
        <div
          style={{
            display: "flex",
            gap: "8px",
            flexWrap: "wrap",
            background: "rgba(15, 23, 42, 0.6)",
            border: "1px solid rgba(255, 255, 255, 0.05)",
            padding: "8px 12px",
            borderRadius: "10px",
          }}
        >
          {sequenceData.talkerNames.map((speaker, index) => {
            const isActive =
              index === sequenceData.currentSpeakerIndex;

            return (
              <button
                key={`${speaker}-${index}`}
                type="button"
                disabled={isActive}
                aria-pressed={isActive}
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); requestSequenceJump(index); }}
                style={{
                  fontSize: "11px",
                  fontWeight: 600,
                  padding: "6px 12px",
                  borderRadius: "6px",
                  background: isActive
                    ? "#7e22ce"
                    : "rgba(30, 41, 59, 0.4)",
                  border: isActive
                    ? "1px solid #c084fc"
                    : "1px solid transparent",
                  color: isActive
                    ? "#fff"
                    : "rgba(255, 255, 255, 0.45)",
                  transition: "all 0.2s ease",
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                  cursor: isActive ? "default" : "pointer",
                  opacity: 1,
                  outline: "none",
                }}
                onMouseEnter={(event) => {
                  if (!isActive) {
                    event.currentTarget.style.background =
                      "rgba(126, 34, 206, 0.2)";
                  }
                }}
                onMouseLeave={(event) => {
                  if (!isActive) {
                    event.currentTarget.style.background =
                      "rgba(30, 41, 59, 0.4)";
                  }
                }}
              >
                {speaker}
              </button>
            );
          })}
        </div>
      )}

      {/* Speaker and Content Block */}
      <div
        style={{
          background: "rgba(30, 41, 59, 0.4)",
          border: "1px solid rgba(255, 255, 255, 0.08)",
          borderRadius: "12px",
          padding: "16px 20px",
          display: "flex",
          flexDirection: "column",
          gap: "8px",
        }}
      >
        <div
          style={{
            fontSize: "12px",
            fontWeight: 800,
            color: "#c084fc",
            textTransform: "uppercase",
            letterSpacing: "0.1em",
            display: "flex",
            alignItems: "center",
            gap: "6px",
          }}
        >
          <span
            style={{
              width: "6px",
              height: "6px",
              borderRadius: "50%",
              background: "#c084fc",
            }}
          />

          {resolvedSpeakerName}
        </div>

        <div
          style={{
            fontSize: "15px",
            lineHeight: 1.6,
            color: "#f1f5f9",
            whiteSpace: "pre-wrap",
          }}
        >
          {currentNode.text ?? ""}
        </div>
      </div>

      {/* Interaction Options / Action Button Block */}
      <div
        style={{
          background: "rgba(15, 23, 42, 0.5)",
          border: "1px solid rgba(255, 255, 255, 0.05)",
          borderRadius: "12px",
          padding: "12px",
          display: "flex",
          flexDirection: "column",
          gap: "8px",
        }}
      >
        {visibleChoices.length > 0 ? (
          visibleChoices.map((choice, index) => (
            <button
              key={
                choice.id ??
                `${effectiveCurrentNodeId}-choice-${index}`
              }
              type="button"
              onClick={() => handleChoiceClick(choice)}
              style={{
                width: "100%",
                textAlign: "left",
                padding: "12px 16px",
                borderRadius: "8px",
                border:
                  "1px solid rgba(168, 85, 247, 0.3)",
                background: "rgba(30, 41, 59, 0.6)",
                color: "#f8fafc",
                cursor: "pointer",
                fontSize: "14px",
                transition: "all 0.15s ease",
                outline: "none",
              }}
              onMouseEnter={(event) => {
                event.currentTarget.style.background =
                  "rgba(168, 85, 247, 0.15)";

                event.currentTarget.style.borderColor =
                  "rgba(168, 85, 247, 0.6)";
              }}
              onMouseLeave={(event) => {
                event.currentTarget.style.background =
                  "rgba(30, 41, 59, 0.6)";

                event.currentTarget.style.borderColor =
                  "rgba(168, 85, 247, 0.3)";
              }}
            >
              {choice.text ?? `Choice ${index + 1}`}
            </button>
          ))
        ) : (
          <button
            type="button"
            onClick={finishDialogue}
            style={{
              width: "100%",
              padding: "12px 16px",
              borderRadius: "8px",
              border: "1px solid #c084fc",
              background: "#7e22ce",
              color: "#fff",
              cursor: "pointer",
              fontSize: "14px",
              fontWeight: 600,
              transition: "background 0.15s ease",
              outline: "none",
            }}
            onMouseEnter={(event) => {
              event.currentTarget.style.background = "#6b21a8";
            }}
            onMouseLeave={(event) => {
              event.currentTarget.style.background = "#7e22ce";
            }}
          >
            {hasSequence &&
            sequenceData.currentSpeakerIndex <
              sequenceData.talkerNames.length - 1
              ? "Next"
              : "Close"}
          </button>
        )}
      </div>
    </div>
  );
}

