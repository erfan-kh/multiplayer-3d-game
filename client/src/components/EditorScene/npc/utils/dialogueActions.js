const TEMP_WAYPOINT_DUPLICATE_EPSILON = 0.08;
const DIALOGUE_SWITCH_LOCK_MS = 250;

// --- ID Generation Utilities ---
const createNpcCloneId = () =>
  typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : `npc_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;

const createDialogueSequenceId = () =>
  typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : `dlg_seq_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;

// --- Data Helpers ---
const toArray3 = (value, fallback = [0, 0, 0]) => {
  if (!Array.isArray(value)) return [...fallback];

  return [
    Number(value[0] ?? fallback[0]) || 0,
    Number(value[1] ?? fallback[1]) || 0,
    Number(value[2] ?? fallback[2]) || 0
  ];
};

const clonePlainData = (value, fallback = null) => {
  if (value === undefined || value === null) return fallback;

  try {
    return typeof structuredClone === "function"
      ? structuredClone(value)
      : JSON.parse(JSON.stringify(value));
  } catch (e) {
    console.warn("clonePlainData failed:", e);
    return fallback;
  }
};

const getNpcById = (npcs, npcId) => {
  if (!Array.isArray(npcs) || !npcId) return null;
  return npcs.find((npc) => npc.id === npcId) || null;
};

const getDialogueSequenceOwnerNpcId = (npc) => {
  if (!npc) return null;

  return (
    npc.dialogueSequenceOwnerNpcId ||
    npc.summonedByNpcId ||
    npc.id ||
    null
  );
};

const isSummonedSequenceClone = (npc) =>
  Boolean(npc?.isSummoned && npc?.summonedByNpcId);

const resolveSequenceOwnerNpc = (npcs, npc) => {
  if (!npc) return null;

  if (!isSummonedSequenceClone(npc)) {
    return npc;
  }

  return getNpcById(npcs, getDialogueSequenceOwnerNpcId(npc)) || null;
};

const resolveSequenceOwnerId = (npcs, npcId) => {
  const npc = getNpcById(npcs, npcId);
  if (!npc) return npcId || null;

  return getDialogueSequenceOwnerNpcId(npc);
};

const markOwnerSequenceState = (prevNpcs, ownerNpcId, state = {}) => {
  if (!ownerNpcId) return prevNpcs;

  return prevNpcs.map((npc) => {
    if (npc.id !== ownerNpcId) return npc;

    return {
      ...npc,
      activeOwnedDialogueSequenceId:
        state.dialogueSequenceId !== undefined
          ? state.dialogueSequenceId
          : npc.activeOwnedDialogueSequenceId,
      activeOwnedSummonBatchId:
        state.summonBatchId !== undefined
          ? state.summonBatchId
          : npc.activeOwnedSummonBatchId,
      ownedDialogueSequenceActive:
        state.active !== undefined
          ? state.active
          : npc.ownedDialogueSequenceActive,
      suppressAutoDialogueUntilPlayerExit:
        state.suppressAutoDialogueUntilPlayerExit !== undefined
          ? state.suppressAutoDialogueUntilPlayerExit
          : npc.suppressAutoDialogueUntilPlayerExit,
      forceRequireExitBeforeAutoDialogue:
        state.forceRequireExitBeforeAutoDialogue !== undefined
          ? state.forceRequireExitBeforeAutoDialogue
          : npc.forceRequireExitBeforeAutoDialogue
    };
  });
};

const removeAuthoredSequenceFieldsFromClone = (npc) => {
  if (!npc) return npc;

  const clone = { ...npc };

  // Authored dialogue payload and sequence metadata belong only to the owner.
  delete clone.dialogue;
  delete clone.dialogueTree;
  delete clone.talkerNames;
  delete clone.speakerData;
  delete clone.temporaryDialogue;
  delete clone.temporaryDialogueText;
  delete clone.temporaryDialogueTree;
  delete clone.temporaryDialogueOptions;
  delete clone.temporaryPlayerChoices;
  delete clone.priorityDialogue;

  delete clone.activeOwnedDialogueSequenceId;
  delete clone.activeOwnedSummonBatchId;
  delete clone.ownedDialogueSequenceActive;
  delete clone.suppressAutoDialogueUntilPlayerExit;
  delete clone.forceRequireExitBeforeAutoDialogue;

  // These are owner-level sequence fields. Clones receive only turn identity.
  delete clone.dialogueSequenceRootNpcId;
  delete clone.dialogueSequenceTemplateNpcId;

  clone.hasTemporaryDialogue = false;
  clone.temporaryDialogueDismissed = false;

  return clone;
};

const resolveTargetNpcId = (action, currentNpcId) => {
  return action.targetId || action.targetNpcId || currentNpcId || null;
};

const resolveEntityTargetId = ({
  targetType,
  targetNpcId,
  currentNpcId,
  resolvedTargetNpcId,
  templateNpc,
  sourceNpc,
  fallbackTargetId = "player"
}) => {
  if (
    targetType === "owner" ||
    targetType === "summoner" ||
    targetType === "mainNpc"
  ) {
    return currentNpcId || sourceNpc?.id || null;
  }

  if (targetType === "player") {
    return "player";
  }

  if (targetType === "template" || targetType === "targetNpc") {
    return resolvedTargetNpcId || templateNpc?.id || null;
  }

  if (targetType === "specificNpc") {
    return targetNpcId || null;
  }

  return fallbackTargetId;
};

const resolveSummonBehaviorTargetId = ({
  payload,
  currentNpcId,
  resolvedTargetNpcId,
  templateNpc,
  sourceNpc
}) => {
  const behaviorTargetType = payload.behaviorTargetType || "player";
  const behaviorTargetNpcId = payload.behaviorTargetNpcId || null;

  return resolveEntityTargetId({
    targetType: behaviorTargetType,
    targetNpcId: behaviorTargetNpcId,
    currentNpcId,
    resolvedTargetNpcId,
    templateNpc,
    sourceNpc,
    fallbackTargetId: "player"
  });
};

const resolveEntityPosition = ({
  entityTargetId,
  npcs,
  context,
  fallbackPosition
}) => {
  if (entityTargetId === "player") {
    return toArray3(context?.playerPosition || [0, 0, 0]);
  }

  const targetNpc = getNpcById(npcs, entityTargetId);

  if (targetNpc && targetNpc.position) {
    return toArray3(targetNpc.position);
  }

  return toArray3(fallbackPosition);
};

const normalizeWaypoint = (waypoint, { isTemporary = false } = {}) => {
  const pos = Array.isArray(waypoint)
    ? toArray3(waypoint)
    : toArray3(waypoint?.pos || waypoint?.position || [0, 0, 0]);

  const waitTime =
    waypoint && typeof waypoint === "object"
      ? Number(waypoint.waitTime ?? 0)
      : 0;

  return {
    ...waypoint,
    pos,
    waitTime,
    isTemporary
  };
};

const mergeUniqueWaypoints = (existing, incoming) => {
  const result = [...existing];

  incoming.forEach((newWp) => {
    const isDuplicate = existing.some((oldWp) => {
      const dx = oldWp.pos[0] - newWp.pos[0];
      const dz = oldWp.pos[2] - newWp.pos[2];

      return (
        Math.sqrt(dx * dx + dz * dz) <
        TEMP_WAYPOINT_DUPLICATE_EPSILON
      );
    });

    if (!isDuplicate) {
      result.push(newWp);
    }
  });

  return result;
};

// --- Dialogue Sequence Metadata ---
const resolveDialogueSequence = (npc, payload = {}) => {
  if (!npc || isSummonedSequenceClone(npc)) {
    return {
      talkerNames: [],
      speakerData: []
    };
  }

  const temporaryDialogueTree =
    payload.dialogueTree || npc.temporaryDialogueTree;
  const dialogueTree = npc.dialogueTree;

  let talkerNames =
    payload.talkerNames ||
    temporaryDialogueTree?.talkerNames ||
    dialogueTree?.talkerNames ||
    npc.talkerNames;

  let speakerData =
    payload.speakerData ||
    temporaryDialogueTree?.speakerData ||
    dialogueTree?.speakerData ||
    npc.speakerData;

  if (
    (!Array.isArray(talkerNames) || talkerNames.length === 0) &&
    (!Array.isArray(speakerData) || speakerData.length === 0)
  ) {
    const activeTree = temporaryDialogueTree || dialogueTree;

    if (activeTree && activeTree.nodes) {
      const uniqueNames = new Set();
      const uniqueSpeakerData = [];

      Object.values(activeTree.nodes).forEach((node) => {
        if (node?.speakerName) {
          uniqueNames.add(node.speakerName);
        }

        if (Array.isArray(node?.talkerNames)) {
          node.talkerNames.forEach((name) => {
            if (name) uniqueNames.add(name);
          });
        }

        if (node?.speakerData) {
          const dataList = Array.isArray(node.speakerData)
            ? node.speakerData
            : [node.speakerData];

          dataList.forEach((speaker) => {
            if (
              speaker &&
              speaker.name &&
              !uniqueSpeakerData.some(
                (existing) => existing.name === speaker.name
              )
            ) {
              uniqueSpeakerData.push(clonePlainData(speaker, {}));
              uniqueNames.add(speaker.name);
            }
          });
        }
      });

      if (uniqueNames.size > 0) {
        talkerNames = Array.from(uniqueNames);
        speakerData =
          uniqueSpeakerData.length > 0
            ? uniqueSpeakerData
            : talkerNames.map((name) => ({ name }));
      }
    }
  }

  return {
    talkerNames: Array.isArray(talkerNames)
      ? clonePlainData(talkerNames, [])
      : [],
    speakerData: Array.isArray(speakerData)
      ? clonePlainData(speakerData, [])
      : []
  };
};

const hasAnyTemporaryDialogueState = (targetNpc) => {
  if (!targetNpc) return false;

  return (
    targetNpc.hasTemporaryDialogue === true ||
    targetNpc.temporaryDialogue != null ||
    targetNpc.temporaryDialogueTree != null ||
    targetNpc.temporaryPlayerChoices != null
  );
};

const hasAnyBaseDialoguePayload = (targetNpc) => {
  if (!targetNpc) return false;

  return targetNpc.dialogue != null || targetNpc.dialogueTree != null;
};

const hasAnyDialoguePayload = (targetNpc) => {
  return (
    hasAnyTemporaryDialogueState(targetNpc) ||
    hasAnyBaseDialoguePayload(targetNpc)
  );
};

const isCloneProtectedByDialogueSequence = (npc, context = {}) => {
  if (!npc) return false;

  const now = Date.now();
  const sequenceActive = npc.dialogueSequenceActive === true;
  const sequenceNotCompleted = npc.dialogueSequenceCompleted !== true;
  const recentlySwitched = Number(npc.sequenceLockExpiresAt || 0) > now;
  const isInteracting =
    context.activeDialogueNpcId === npc.id || npc.isTalking === true;

  return (
    (sequenceActive && sequenceNotCompleted) ||
    recentlySwitched ||
    isInteracting
  );
};

const removeSummonedNpcsForCaller = (
  prevNpcs,
  callerNpcId,
  context = {}
) => {
  if (!callerNpcId) return prevNpcs;

  return prevNpcs.filter((npc) => {
    const isOwnedClone =
      npc.isSummoned &&
      npc.summonedByNpcId === callerNpcId;

    if (!isOwnedClone) {
      return true;
    }

    return isCloneProtectedByDialogueSequence(npc, context);
  });
};

const buildTemporaryDialogueFields = (payload, ownerNpc) => {
  if (!ownerNpc || isSummonedSequenceClone(ownerNpc)) {
    return {
      temporaryDialogue: null,
      temporaryDialogueText: null,
      temporaryDialogueTree: null,
      temporaryDialogueOptions: null,
      temporaryPlayerChoices: null,
      priorityDialogue: false,
      hasTemporaryDialogue: false,
      talkerNames: [],
      speakerData: []
    };
  }

  const dialogueTree = payload.dialogueTree || null;
  const dialogueText = payload.text || payload.dialogue || null;
  const { talkerNames, speakerData } = resolveDialogueSequence(
    ownerNpc,
    payload
  );

  return {
    temporaryDialogue: dialogueText,
    temporaryDialogueText: dialogueText,
    temporaryDialogueTree: clonePlainData(dialogueTree, null),
    temporaryDialogueOptions: payload.options
      ? clonePlainData(payload.options)
      : null,
    temporaryPlayerChoices: payload.choices
      ? clonePlainData(payload.choices)
      : null,
    priorityDialogue: payload.priority === true,
    hasTemporaryDialogue: Boolean(dialogueTree || dialogueText),
    talkerNames: clonePlainData(talkerNames, []),
    speakerData: clonePlainData(speakerData, [])
  };
};

const clearTemporaryDialogueFields = (npc) => {
  if (!npc) return npc;

  // A clone has no authoritative dialogue metadata to clear.
  if (isSummonedSequenceClone(npc)) {
    return {
      ...npc,
      temporaryDialogueDismissed: false,
      summonAutoOpenPending: false
    };
  }

  return {
    ...npc,
    temporaryDialogue: null,
    temporaryDialogueText: null,
    temporaryDialogueTree: null,
    temporaryDialogueOptions: null,
    temporaryPlayerChoices: null,
    priorityDialogue: false,
    hasTemporaryDialogue: false,
    talkerNames: [],
    speakerData: [],
    summonAutoOpenPending: false
  };
};

const cloneNpcRuntimeSafe = (templateNpc) => {
  const runtimeNpc = removeAuthoredSequenceFieldsFromClone({
    ...templateNpc
  });

  if (runtimeNpc.movement) {
    runtimeNpc.movement = clonePlainData(runtimeNpc.movement, {});
  }

  if (runtimeNpc.detection) {
    runtimeNpc.detection = {
      ...clonePlainData(runtimeNpc.detection, {}),
      _instanceId: createNpcCloneId()
    };
  }

  return runtimeNpc;
};

// --- Sequence Advancement ---
export const advanceDialogueSequenceForNpc = (
  prevNpcs,
  finishedNpcId,
  context = {}
) => {
  const finishedNpc = getNpcById(prevNpcs, finishedNpcId);

  if (!finishedNpc || !finishedNpc.dialogueSequenceId) {
    return prevNpcs;
  }

  const sequenceId = finishedNpc.dialogueSequenceId;
  const ownerNpcId = getDialogueSequenceOwnerNpcId(finishedNpc);
  const ownerNpc = getNpcById(prevNpcs, ownerNpcId);

  if (!ownerNpc || isSummonedSequenceClone(ownerNpc)) {
    return prevNpcs;
  }

  const sequenceClones = prevNpcs
    .filter(
      (npc) =>
        npc.isSummoned &&
        npc.summonedByNpcId === ownerNpc.id &&
        npc.dialogueSequenceId === sequenceId
    )
    .sort(
      (a, b) => (a.sequenceOrder ?? 0) - (b.sequenceOrder ?? 0)
    );

  const nextClone = sequenceClones.find(
    (npc) =>
      npc.id !== finishedNpcId &&
      npc.dialogueSequenceCompleted !== true
  );

  const lockExpiresAt = Date.now() + DIALOGUE_SWITCH_LOCK_MS;

  let updatedNpcs = prevNpcs.map((npc) => {
    if (npc.id === finishedNpcId) {
      return {
        ...npc,
        dialogueSequenceCompleted: true,
        dialogueSequenceActive: false,
        summonAutoOpenPending: false,
        dialogueHandoffPending: false
      };
    }

    if (nextClone && npc.id === nextClone.id) {
      return {
        ...npc,
        mustWaitForDialogueSequenceTurn: false,
        summonAutoOpenPending: true,
        dialogueSequenceActive: true,
        dialogueHandoffPending: false,
        sequenceLockExpiresAt: lockExpiresAt,
        dialogueLockExpiresAt: lockExpiresAt
      };
    }

    return npc;
  });

  updatedNpcs = markOwnerSequenceState(updatedNpcs, ownerNpc.id, {
    dialogueSequenceId: sequenceId,
    active: Boolean(nextClone),
    suppressAutoDialogueUntilPlayerExit: true
  });

  if (nextClone) {
    const sequenceMeta = resolveDialogueSequence(ownerNpc);
    const ownerTree =
      ownerNpc.temporaryDialogueTree || ownerNpc.dialogueTree;

    setTimeout(() => {
      if (typeof window === "undefined") return;

      window.dispatchEvent(
        new CustomEvent("npcSequenceHandoff", {
          detail: {
            fromNpcId: finishedNpcId,
            toNpcId: nextClone.id,
            ownerNpcId: ownerNpc.id,
            sequenceId,
            talkerNames: sequenceMeta.talkerNames,
            speakerData: sequenceMeta.speakerData,
            dialogueTree: clonePlainData(ownerTree, null),
            temporaryDialogue:
              ownerNpc.temporaryDialogue || ownerNpc.dialogue,
            temporaryDialogueText:
              ownerNpc.temporaryDialogueText || ownerNpc.dialogue,
            temporaryDialogueOptions: clonePlainData(
              ownerNpc.temporaryDialogueOptions,
              null
            ),
            temporaryPlayerChoices: clonePlainData(
              ownerNpc.temporaryPlayerChoices,
              null
            )
          }
        })
      );
    }, 50);
  }

  return updatedNpcs;
};

export const checkConditions = (conditions, context) => {
  if (
    !conditions ||
    !Array.isArray(conditions) ||
    conditions.length === 0
  ) {
    return true;
  }

  const { gameFlags = {} } = context;

  return conditions.every((cond) => {
    const flagValue = gameFlags[cond.flag] ?? false;
    const expected = cond.value ?? true;
    return flagValue === expected;
  });
};

const parseActionValue = (value) => {
  if (value && typeof value === "object") return value;

  try {
    return JSON.parse(value);
  } catch (e) {
    return value;
  }
};

export const executeDialogueAction = (action, context) => {
  const { type, value, key, conditions } = action;

  const {
    setNpcs,
    setGameFlags,
    triggerCustomEvent,
    closeDialogue,
    currentNpcId,
    activeDialogueNpcId
  } = context;

  if (!checkConditions(conditions, context)) return;

  const resolvedTargetNpcId = resolveTargetNpcId(
    action,
    currentNpcId
  );

  switch (type) {
    case "closeDialogue":
      if (setNpcs && currentNpcId) {
        setNpcs((prevNpcs) => {
          const withAdvancedSequence =
            advanceDialogueSequenceForNpc(
              prevNpcs,
              currentNpcId,
              context
            );

          const cleanedNpcs = removeSummonedNpcsForCaller(
            withAdvancedSequence,
            currentNpcId,
            context
          );

          const currentNpc = getNpcById(prevNpcs, currentNpcId);
          const ownerId = getDialogueSequenceOwnerNpcId(
            currentNpc || {}
          );


          // Reset speaker index to 0 when dialogue closes
          const resetNpcs = cleanedNpcs.map((npc) => {
            if (npc.id === currentNpcId && !npc.isSummoned) {
              return {
                ...npc,
                currentSpeakerIndex: 0,
                dialogueSequenceCompleted: true
              };
            }
            return npc;
          });

          if (ownerId && ownerId !== currentNpcId) {
              const hasRemainingSequenceClones =
                resetNpcs.some(
                (npc) =>
                  npc.isSummoned &&
                  npc.summonedByNpcId === ownerId &&
                  npc.dialogueSequenceActive === true &&
                  npc.dialogueSequenceCompleted !== true
              );

            return markOwnerSequenceState(resetNpcs, ownerId, {
              active: hasRemainingSequenceClones,
              suppressAutoDialogueUntilPlayerExit: true
            });
          }

          return resetNpcs;
        });
      }

      if (closeDialogue) {
        closeDialogue({ npcId: currentNpcId });
      }
      break;

    case "setFlag":
      if (setGameFlags) {
        setGameFlags((prev) => ({
          ...prev,
          [key]: value
        }));
      }
      break;

    case "setTemporaryDialogue": {
      if (!setNpcs) break;

      const targetNpcId = resolvedTargetNpcId;
      const payload = parseActionValue(value);

      if (!targetNpcId) break;

      setNpcs((prevNpcs) => {
        const requestedTarget = getNpcById(prevNpcs, targetNpcId);
        const ownerNpcId = resolveSequenceOwnerId(
          prevNpcs,
          targetNpcId
        );

        // Dialogue metadata is always written to the authored owner.
        const effectiveTargetNpcId =
          isSummonedSequenceClone(requestedTarget)
            ? ownerNpcId
            : targetNpcId;

        const ownerNpc = getNpcById(
          prevNpcs,
          effectiveTargetNpcId
        );

        if (!ownerNpc || isSummonedSequenceClone(ownerNpc)) {
          return prevNpcs;
        }

        const tempFields = buildTemporaryDialogueFields(
          payload,
          ownerNpc
        );

        return prevNpcs.map((npc) => {
          if (npc.id !== effectiveTargetNpcId) return npc;

          return {
            ...npc,
            ...tempFields,
            summonAutoOpenPending: payload.autoOpen !== false,
            summonAutoOpenConsumed: false,
            temporaryDialogueDismissed: false
          };
        });
      });

      break;
    }

    case "setNpcTexture":
      if (setNpcs) {
        const targetNpcId = resolvedTargetNpcId;

        if (!targetNpcId) {
          console.warn(
            "setNpcTexture: no target NPC id resolved."
          );
          break;
        }

        setNpcs((prevNpcs) =>
          prevNpcs.map((npc) => {
            if (npc.id !== targetNpcId) return npc;

            const hasStoredOriginalTexture =
              npc.hasStoredOriginalTextureUrl === true;

            return {
              ...npc,
              originalTextureUrl: hasStoredOriginalTexture
                ? npc.originalTextureUrl
                : npc.textureUrl ?? null,
              hasStoredOriginalTextureUrl: true,
              textureUrl:
                typeof value === "string" ? value : value ?? ""
            };
          })
        );
      }
      break;

    case "restoreNpcTexture":
      if (setNpcs) {
        const targetNpcId = resolvedTargetNpcId;

        if (!targetNpcId) {
          console.warn(
            "restoreNpcTexture: no target NPC id resolved."
          );
          break;
        }

        setNpcs((prevNpcs) =>
          prevNpcs.map((npc) => {
            if (npc.id !== targetNpcId) return npc;

            if (npc.hasStoredOriginalTextureUrl !== true) {
              return npc;
            }

            return {
              ...npc,
              textureUrl: npc.originalTextureUrl ?? "",
              originalTextureUrl: null,
              hasStoredOriginalTextureUrl: false
            };
          })
        );
      }
      break;

    case "setNpcTextureWhileInRadius": {
      // Unlike most actions, this one does not apply its effect the moment
      // it executes. It ARMS a persistent per-NPC flag; the actual texture
      // swap/revert is driven every frame by useNPCBrain purely based on
      // the player's distance to the NPC's detection radius. This action
      // simply marks the intent to do so as "armed" once it actually runs
      // (onEnter of the node it lives on, or the specific player choice it
      // was attached to) - it must NOT scan the whole dialogue tree ahead
      // of time and apply itself blindly regardless of trigger state.
      if (!setNpcs) break;

      const targetNpcId = resolvedTargetNpcId;

      if (!targetNpcId) {
        console.warn(
          "setNpcTextureWhileInRadius: no target NPC id resolved."
        );
        break;
      }

      const payload = parseActionValue(value);
      const configuredTextureUrl =
        payload && typeof payload === "object"
          ? payload.textureUrl
          : typeof payload === "string"
          ? payload
          : null;

      if (typeof configuredTextureUrl !== "string" || !configuredTextureUrl.trim()) {
        console.warn(
          "setNpcTextureWhileInRadius: no textureUrl configured on this action."
        );
        break;
      }

      setNpcs((prevNpcs) =>
        prevNpcs.map((npc) => {
          if (npc.id !== targetNpcId) return npc;
          if (npc.radiusTextureArmedUrl === configuredTextureUrl) return npc;

          return {
            ...npc,
            // Arm the pending texture. useNPCBrain reads this every frame
            // and only performs the actual swap once the player is inside
            // this NPC's detection radius; it reverts automatically once
            // the player leaves, independent of dialogue state.
            radiusTextureArmedUrl: configuredTextureUrl,
          };
        })
      );

      break;
    }

    case "changeBehavior":
      if (setNpcs) {
        const targetNpcId = resolvedTargetNpcId;

        if (targetNpcId) {
          setNpcs((prevNpcs) =>
            prevNpcs.map((npc) => {
              if (npc.id !== targetNpcId) return npc;

              return {
                ...npc,
                movement: {
                  ...(npc.movement || {}),
                  mode: value
                }
              };
            })
          );
        }
      }
      break;

    case "setNpcWaypointPatrol": {
      const payload = parseActionValue(value);
      const target = payload.target || "main";
      const waypointIndex =
        payload.waypointIndex !== undefined
          ? parseInt(payload.waypointIndex, 10)
          : 0;

      if (setNpcs) {
        setNpcs((prevNpcs) =>
          prevNpcs.map((npc) => {
            const isMainTarget =
              target === "main" &&
              npc.id === resolvedTargetNpcId;

            const isCloneTarget =
              target === "clones" &&
              npc.isSummoned &&
              npc.summonedByNpcId === currentNpcId;

            const isAllTarget =
              target === "all" &&
              (npc.id === resolvedTargetNpcId ||
                (npc.isSummoned &&
                  npc.summonedByNpcId === currentNpcId));

            if (isMainTarget || isCloneTarget || isAllTarget) {
              return {
                ...npc,
                currentWaypointIndex: waypointIndex,
                movement: {
                  ...(npc.movement || {}),
                  mode: "patrol"
                }
              };
            }

            return npc;
          })
        );
      }
      break;
    }

    case "summonNpc": {
      const summonPayload = parseActionValue(value);
      const count = Math.max(
        1,
        Number(summonPayload.count ?? 1) || 1
      );
      const offset = toArray3(
        summonPayload.offset,
        [1.5, 0, 0]
      );
      const behavior = summonPayload.behavior || "idle";
      const spawnNearOwner =
        summonPayload.spawnNearOwner !== false;
      const inheritOwnerWaypoints =
        summonPayload.inheritOwnerWaypoints !== false;
      const replaceExistingOwnedClones =
        summonPayload.replaceExistingOwnedClones !== false;

      if (setNpcs && resolvedTargetNpcId) {
        setNpcs((prevNpcs) => {
          if (!replaceExistingOwnedClones) {
            const cloneAlreadyExists = prevNpcs.some(
              (npc) =>
                npc.isSummoned &&
                npc.summonedByNpcId === currentNpcId &&
                npc.summonedFromTemplateId ===
                  resolvedTargetNpcId
            );

            if (cloneAlreadyExists) {
              return prevNpcs;
            }
          }

          const templateNpc = getNpcById(
            prevNpcs,
            resolvedTargetNpcId
          );

          if (!templateNpc) {
            console.warn(
              "summonNpc: target NPC template not found:",
              resolvedTargetNpcId
            );
            return prevNpcs;
          }

          const sourceNpc = getNpcById(
            prevNpcs,
            currentNpcId
          );

          const ownerNpc =
            resolveSequenceOwnerNpc(prevNpcs, sourceNpc) ||
            sourceNpc ||
            templateNpc;

          const ownerNpcId = ownerNpc.id;

          const spawnTargetType =
            summonPayload.spawnTargetType ||
            (spawnNearOwner ? "owner" : "player");

          const spawnTargetNpcId =
            summonPayload.spawnTargetNpcId ??
            summonPayload.spawnNpcId ??
            null;

          const spawnEntityTargetId = resolveEntityTargetId({
            targetType: spawnTargetType,
            targetNpcId: spawnTargetNpcId,
            currentNpcId: ownerNpcId,
            resolvedTargetNpcId,
            templateNpc,
            sourceNpc: ownerNpc,
            fallbackTargetId: spawnNearOwner
              ? ownerNpcId
              : "player"
          });

          const fallbackBasePosition = Array.isArray(
            templateNpc.position
          )
            ? templateNpc.position
            : Array.isArray(ownerNpc.position)
            ? ownerNpc.position
            : [0, 0, 0];

          const basePosition = resolveEntityPosition({
            entityTargetId: spawnEntityTargetId,
            npcs: prevNpcs,
            context,
            fallbackPosition: fallbackBasePosition
          });

          const filteredNpcs = replaceExistingOwnedClones
            ? removeSummonedNpcsForCaller(
                prevNpcs,
                ownerNpcId,
                context
              )
            : prevNpcs;

          if (replaceExistingOwnedClones) {
            const hasRemainingClone = filteredNpcs.some(
              (npc) =>
                npc.isSummoned &&
                npc.summonedByNpcId === ownerNpcId &&
                npc.summonedFromTemplateId ===
                  resolvedTargetNpcId
            );

            if (hasRemainingClone) {
              return prevNpcs;
            }
          }

          const summonBatchId = createNpcCloneId();
          const dialogueSequenceId =
            summonPayload.dialogueSequenceId ||
            createDialogueSequenceId();
          const batchTimestamp = Date.now();

          const temporaryDialogueFields =
            buildTemporaryDialogueFields(
              summonPayload,
              ownerNpc
            );

          const initialLockExpiresAt =
            Number(
              summonPayload.dialogueLockExpiresAt ??
                summonPayload.sequenceLockExpiresAt ??
                0
            ) || 0;

          const spawnedNpcs = Array.from(
            { length: count },
            (_, index) => {
              const spreadX = index * 0.8;
              const spawnPosition = [
                (basePosition[0] ?? 0) +
                  offset[0] +
                  spreadX,
                (basePosition[1] ?? 0) +
                  offset[1],
                (basePosition[2] ?? 0) +
                  offset[2]
              ];

              const summonedId = createNpcCloneId();
              const clonedTemplateNpc =
                cloneNpcRuntimeSafe(templateNpc);
              const templateMovement =
                clonedTemplateNpc.movement || {};

              const clonedWaypoints =
                inheritOwnerWaypoints &&
                ownerNpc &&
                Array.isArray(ownerNpc.waypoints)
                  ? clonePlainData(ownerNpc.waypoints, [])
                  : Array.isArray(
                      clonedTemplateNpc.waypoints
                    )
                  ? clonePlainData(
                      clonedTemplateNpc.waypoints,
                      []
                    )
                  : [];

              const followTargetNpcId =
                behavior === "chase" ||
                behavior === "follow"
                  ? resolveSummonBehaviorTargetId({
                      payload: summonPayload,
                      currentNpcId: ownerNpcId,
                      resolvedTargetNpcId,
                      templateNpc,
                      sourceNpc: ownerNpc
                    })
                  : null;

              const shouldAutoOpenFirstClone =
                summonPayload.disableSummonAutoOpenPending !==
                  true &&
                temporaryDialogueFields.hasTemporaryDialogue ===
                  true &&
                index === 0;

              return {
                ...clonedTemplateNpc,

                id: summonedId,
                npcId: summonedId,
                name: `${templateNpc.name || "NPC"} (Clone ${
                  index + 1
                })`,
                position: spawnPosition,
                waypoints: clonedWaypoints,
                temporaryWaypoints: [],
                temporaryWaypointRoute: null,
                currentWaypointIndex: 0,

                movement: {
                  ...templateMovement,
                  mode:
                    behavior ||
                    templateMovement.mode ||
                    "idle",
                  stopDistance:
                    summonPayload.stopDistance !==
                    undefined
                      ? Number(
                          summonPayload.stopDistance
                        )
                      : templateMovement.stopDistance
                },

                isSummoned: true,
                summonedByNpcId: ownerNpcId,
                summonedFromTemplateId: resolvedTargetNpcId,

                summonBatchId,
                summonQueueIndex: index,
                summonedAt: batchTimestamp + index,

                // Clones retain only sequence identity and turn state.
                dialogueSequenceId,
                dialogueSequenceOwnerNpcId: ownerNpcId,
                dialogueSequenceActive: index === 0,
                dialogueSequenceCompleted: false,
                dialogueHandoffPending: false,
                dialogueLockExpiresAt:
                  initialLockExpiresAt,
                sequenceLockExpiresAt:
                  initialLockExpiresAt,
                dialogueSwitchLockMs:
                  Number(
                    summonPayload.dialogueSwitchLockMs
                  ) || DIALOGUE_SWITCH_LOCK_MS,
                sequenceOrder:
                  Number(
                    summonPayload.sequenceOrderStart ?? 0
                  ) + index,

                spawnTargetType,
                spawnTargetNpcId:
                  spawnTargetType === "specificNpc"
                    ? spawnTargetNpcId
                    : null,
                spawnEntityTargetId,

                behaviorTargetType:
                  summonPayload.behaviorTargetType || null,
                behaviorTargetNpcId:
                  summonPayload.behaviorTargetType ===
                  "specificNpc"
                    ? summonPayload.behaviorTargetNpcId ??
                      null
                    : null,

                followTargetNpcId,
                summonedCloneInstanceId: summonedId,

                temporaryDialogueDismissed: false,

                summonAutoOpenPending:
                  summonPayload.forceSummonAutoOpenPending ===
                  true
                    ? index === 0
                    : shouldAutoOpenFirstClone,

                summonAutoOpenConsumed: false,

                clearTemporaryDialogueAfterFirstUse:
                  summonPayload.clearTemporaryDialogueAfterFirstUse ===
                    true ||
                  summonPayload.removeTemporaryDialogueAfterFirstUse ===
                    true,

                removeTemporaryDialogueAfterFirstUse:
                  summonPayload.removeTemporaryDialogueAfterFirstUse ===
                    true ||
                  summonPayload.clearTemporaryDialogueAfterFirstUse ===
                    true,

                clearTemporaryDialogueDistance:
                  summonPayload.clearTemporaryDialogueDistance ??
                  summonPayload.temporaryDialogueClearDistance ??
                  clonedTemplateNpc.clearTemporaryDialogueDistance ??
                  null,

                temporaryDialogueClearDistance:
                  summonPayload.temporaryDialogueClearDistance ??
                  summonPayload.clearTemporaryDialogueDistance ??
                  clonedTemplateNpc.clearTemporaryDialogueDistance ??
                  null,

                clearTemporaryDialogueDelay:
                  summonPayload.clearTemporaryDialogueDelay ??
                  summonPayload.temporaryDialogueClearDelay ??
                  clonedTemplateNpc.clearTemporaryDialogueDelay ??
                  null,

                temporaryDialogueClearDelay:
                  summonPayload.temporaryDialogueClearDelay ??
                  summonPayload.clearTemporaryDialogueDelay ??
                  clonedTemplateNpc.clearTemporaryDialogueDelay ??
                  null,

                requiresDialogueSequenceHandoff: true,
                allowIndependentAutoDialogueTrigger: false,
                mustWaitForDialogueSequenceTurn:
                  index !== 0,
                autoOpenOnlyWhenSequenceTurnActive: true
              };
            }
          );

          const updatedNpcsList = filteredNpcs.map(
            (npc) => {
              if (npc.id !== ownerNpcId) return npc;

              return {
                ...npc,
                ...temporaryDialogueFields
              };
            }
          );

          const withSpawns = [
            ...updatedNpcsList,
            ...spawnedNpcs
          ];

          return markOwnerSequenceState(
            withSpawns,
            ownerNpcId,
            {
              dialogueSequenceId,
              summonBatchId,
              active: spawnedNpcs.length > 0,
              suppressAutoDialogueUntilPlayerExit: true,
              forceRequireExitBeforeAutoDialogue: true
            }
          );
        });
      }

      break;
    }

    case "setNpcFollowTarget": {
      const payload = parseActionValue(value);
      const target = payload.target || "clones";
      const followTargetType =
        payload.followTarget || "owner";
      const stopDistance =
        payload.stopDistance !== undefined
          ? Number(payload.stopDistance)
          : 1.25;

      if (setNpcs) {
        setNpcs((prevNpcs) =>
          prevNpcs.map((npc) => {
            const isMainTarget =
              target === "main" &&
              npc.id === resolvedTargetNpcId;

            const isCloneTarget =
              target === "clones" &&
              npc.isSummoned &&
              npc.summonedByNpcId === currentNpcId;

            const isAllTarget =
              target === "all" &&
              (npc.id === resolvedTargetNpcId ||
                (npc.isSummoned &&
                  npc.summonedByNpcId === currentNpcId));

            if (
              !isMainTarget &&
              !isCloneTarget &&
              !isAllTarget
            ) {
              return npc;
            }

            let targetIdToFollow = null;

            if (
              followTargetType === "owner" ||
              followTargetType === "summoner" ||
              followTargetType === "mainNpc"
            ) {
              targetIdToFollow =
                npc.summonedByNpcId || currentNpcId;
            } else if (followTargetType === "player") {
              targetIdToFollow = "player";
            } else if (
              followTargetType === "targetNpc" ||
              followTargetType === "template"
            ) {
              targetIdToFollow =
                resolvedTargetNpcId !== npc.id
                  ? resolvedTargetNpcId
                  : null;
            } else if (followTargetType === "firstClone") {
              const firstClone = prevNpcs.find(
                (candidate) =>
                  candidate.isSummoned &&
                  candidate.summonedByNpcId ===
                    (npc.summonedByNpcId ||
                      currentNpcId)
              );

              targetIdToFollow = firstClone
                ? firstClone.id
                : null;
            } else if (
              typeof followTargetType === "string"
            ) {
              targetIdToFollow = followTargetType;
            }

            return {
              ...npc,
              followTargetNpcId: targetIdToFollow,
              movement: {
                ...(npc.movement || {}),
                mode: targetIdToFollow
                  ? "follow"
                  : "idle",
                stopDistance
              }
            };
          })
        );
      }

      break;
    }

    case "setNpcWaypoints":
    case "appendNpcWaypoint":
    case "replaceNpcWaypoints": {
      const payload = parseActionValue(value);
      const target = payload.target || "main";

      const legacyMode =
        type === "appendNpcWaypoint"
          ? "append"
          : type === "replaceNpcWaypoints"
          ? "replace"
          : null;

      const mode =
        payload.mode ||
        legacyMode ||
        (payload.replaceExisting === true
          ? "replace"
          : "append");

      const isAppendMode = mode === "append";
      const rawWaypoints = Array.isArray(
        payload.waypoints
      )
        ? payload.waypoints
        : [];

      const clearExistingFollowTarget =
        payload.clearExistingFollowTarget !== false;

      const routePriority =
        Number(payload.priority ?? 10) || 0;
      const clearOnComplete =
        payload.clearOnComplete !== false;
      const clearOnPlayerDistance =
        payload.clearOnPlayerDistance === true;
      const maxPlayerDistance =
        Number(payload.maxPlayerDistance ?? 20) || 20;
      const distanceTimeoutMs =
        Number(payload.distanceTimeoutMs ?? 0) || 0;

      const normalizedWaypoints = rawWaypoints.map(
        (wp) =>
          normalizeWaypoint(wp, {
            isTemporary: isAppendMode
          })
      );

      if (setNpcs) {
        setNpcs((prevNpcs) =>
          prevNpcs.map((npc) => {
            const isMainTarget =
              target === "main" &&
              npc.id === resolvedTargetNpcId;

            const isCloneTarget =
              target === "clones" &&
              npc.isSummoned &&
              npc.summonedByNpcId === currentNpcId;

            const isAllTarget =
              target === "all" &&
              (npc.id === resolvedTargetNpcId ||
                (npc.isSummoned &&
                  npc.summonedByNpcId === currentNpcId));

            if (
              !isMainTarget &&
              !isCloneTarget &&
              !isAllTarget
            ) {
              return npc;
            }

            const currentRoutePriority =
              Number(
                npc.temporaryWaypointRoute?.priority ??
                  -Infinity
              ) || -Infinity;

            if (
              isAppendMode &&
              npc.temporaryWaypointRoute &&
              currentRoutePriority > routePriority
            ) {
              return npc;
            }

            const existingWaypoints = Array.isArray(
              npc.waypoints
            )
              ? clonePlainData(npc.waypoints, [])
              : [];

            const existingTemporaryWaypoints =
              Array.isArray(npc.temporaryWaypoints)
                ? clonePlainData(
                    npc.temporaryWaypoints,
                    []
                  )
                : [];

            const originalWaypoints = Array.isArray(
              npc.temporaryWaypointRoute?.originalWaypoints
            )
              ? clonePlainData(
                  npc.temporaryWaypointRoute
                    .originalWaypoints,
                  []
                )
              : existingWaypoints;

            const originalWaypointIndex =
              npc.temporaryWaypointRoute
                ? npc.temporaryWaypointRoute
                    .originalWaypointIndex ??
                  npc.currentWaypointIndex ??
                  0
                : npc.currentWaypointIndex ?? 0;

            const updatedNpc = {
              ...npc,
              currentWaypointIndex: isAppendMode
                ? npc.currentWaypointIndex ?? 0
                : 0,
              temporaryWaypoints: isAppendMode
                ? mergeUniqueWaypoints(
                    existingTemporaryWaypoints,
                    normalizedWaypoints
                  )
                : [],
              temporaryWaypointRoute: {
                mode,
                priority: routePriority,
                waypoints: clonePlainData(
                  normalizedWaypoints,
                  []
                ),
                originalWaypoints,
                originalWaypointIndex,
                clearOnComplete,
                clearOnPlayerDistance,
                maxPlayerDistance,
                distanceTimeoutMs,
                startedAt: Date.now(),
                distanceExceededAt: null
              },
              movement: {
                ...(npc.movement || {}),
                mode: "patrol"
              }
            };

            updatedNpc.waypoints = isAppendMode
              ? existingWaypoints
              : clonePlainData(
                  normalizedWaypoints,
                  []
                );

            if (clearExistingFollowTarget) {
              updatedNpc.followTargetNpcId = null;
            }

            return updatedNpc;
          })
        );
      }

      break;
    }

    case "setNpcWaypointWaitTime": {
      const payload = parseActionValue(value);
      const target = payload.target || "main";
      const waypointIndex =
        payload.waypointIndex !== undefined
          ? parseInt(payload.waypointIndex, 10)
          : 0;
      const waitTime =
        payload.waitTime !== undefined
          ? Number(payload.waitTime)
          : 0;

      if (setNpcs) {
        setNpcs((prevNpcs) =>
          prevNpcs.map((npc) => {
            const isMainTarget =
              target === "main" &&
              npc.id === resolvedTargetNpcId;

            const isCloneTarget =
              target === "clones" &&
              npc.isSummoned &&
              npc.summonedByNpcId === currentNpcId;

            const isAllTarget =
              target === "all" &&
              (npc.id === resolvedTargetNpcId ||
                (npc.isSummoned &&
                  npc.summonedByNpcId === currentNpcId));

            if (
              !isMainTarget &&
              !isCloneTarget &&
              !isAllTarget
            ) {
              return npc;
            }

            const updatedWaypoints = Array.isArray(
              npc.waypoints
            )
              ? [...npc.waypoints]
              : [];

            if (!updatedWaypoints[waypointIndex]) {
              return npc;
            }

            const wp = updatedWaypoints[waypointIndex];

            updatedWaypoints[waypointIndex] = Array.isArray(
              wp
            )
              ? { pos: wp, waitTime }
              : { ...wp, waitTime };

            return {
              ...npc,
              waypoints: updatedWaypoints
            };
          })
        );
      }

      break;
    }

    case "setNpcWaypointDialogue": {
      const payload = parseActionValue(value);
      const target = payload.target || "main";
      const waypointIndex =
        payload.waypointIndex !== undefined
          ? parseInt(payload.waypointIndex, 10)
          : 0;
      const dialogueNodeId =
        payload.dialogueNodeId || "";
      const trigger = payload.trigger || "onReach";

      if (setNpcs) {
        setNpcs((prevNpcs) =>
          prevNpcs.map((npc) => {
            const isMainTarget =
              target === "main" &&
              npc.id === resolvedTargetNpcId;

            const isCloneTarget =
              target === "clones" &&
              npc.isSummoned &&
              npc.summonedByNpcId === currentNpcId;

            const isAllTarget =
              target === "all" &&
              (npc.id === resolvedTargetNpcId ||
                (npc.isSummoned &&
                  npc.summonedByNpcId === currentNpcId));

            if (
              !isMainTarget &&
              !isCloneTarget &&
              !isAllTarget
            ) {
              return npc;
            }

            const updatedWaypoints = Array.isArray(
              npc.waypoints
            )
              ? [...npc.waypoints]
              : [];

            if (!updatedWaypoints[waypointIndex]) {
              return npc;
            }

            const wp = updatedWaypoints[waypointIndex];
            const cleanWp = Array.isArray(wp)
              ? { pos: wp }
              : { ...wp };

            updatedWaypoints[waypointIndex] = {
              ...cleanWp,
              dialogueNodeId,
              dialogueTrigger: trigger
            };

            return {
              ...npc,
              waypoints: updatedWaypoints
            };
          })
        );
      }

      break;
    }

    case "resetNpcEventSequence": {
      const payload = parseActionValue(value);
      const target = payload.target || "all";
      const clearDialogueFlags =
        payload.clearDialogueFlags !== false;
      const despawnClones =
        payload.despawnClones !== false;
      const resumePatrol =
        payload.resumePatrol !== false;

      if (clearDialogueFlags && setGameFlags) {
        setGameFlags((prev) => {
          const updatedFlags = { ...prev };

          Object.keys(updatedFlags).forEach((flagKey) => {
            if (
              flagKey.startsWith("event_") ||
              flagKey.includes("Sequence") ||
              flagKey.includes("Follow")
            ) {
              updatedFlags[flagKey] = false;
            }
          });

          return updatedFlags;
        });
      }

      if (setNpcs) {
        setNpcs((prevNpcs) => {
          const ownerId = resolveSequenceOwnerId(
            prevNpcs,
            currentNpcId
          );

          let updated = prevNpcs;

          if (despawnClones) {
            updated = removeSummonedNpcsForCaller(
              updated,
              ownerId,
              context
            );
          }

          updated = updated.map((npc) => {
            const isMainTarget =
              target === "main" &&
              npc.id === resolvedTargetNpcId;

            const isCloneTarget =
              target === "clones" &&
              npc.isSummoned &&
              npc.summonedByNpcId === ownerId;

            const isAllTarget =
              target === "all" &&
              (npc.id === resolvedTargetNpcId ||
                (npc.isSummoned &&
                  npc.summonedByNpcId === ownerId));

            if (
              !isMainTarget &&
              !isCloneTarget &&
              !isAllTarget
            ) {
              return npc;
            }

            const restoredWaypoints = Array.isArray(
              npc.temporaryWaypointRoute
                ?.originalWaypoints
            )
              ? clonePlainData(
                  npc.temporaryWaypointRoute
                    .originalWaypoints,
                  []
                )
              : Array.isArray(npc.waypoints)
              ? clonePlainData(npc.waypoints, [])
              : [];

            const restoredWaypointIndex =
              npc.temporaryWaypointRoute
                ?.originalWaypointIndex ?? 0;

            let revertedNpc = {
              ...npc,
              followTargetNpcId: null,
              currentWaypointIndex:
                restoredWaypointIndex,
              waypoints: restoredWaypoints,
              temporaryWaypoints: [],
              temporaryWaypointRoute: null,
              dialogueSequenceActive: false,
              dialogueSequenceCompleted: false,
              dialogueHandoffPending: false,
              dialogueLockExpiresAt: 0,
              sequenceLockExpiresAt: 0,
              mustWaitForDialogueSequenceTurn: true
            };

            revertedNpc =
              clearTemporaryDialogueFields(revertedNpc);

            if (resumePatrol) {
              revertedNpc.movement = {
                ...(revertedNpc.movement || {}),
                mode: "patrol"
              };
            }

            return revertedNpc;
          });

          return markOwnerSequenceState(updated, ownerId, {
            dialogueSequenceId: null,
            summonBatchId: null,
            active: false,
            suppressAutoDialogueUntilPlayerExit: true,
            forceRequireExitBeforeAutoDialogue: true
          });
        });
      }

      break;
    }

    case "despawnOwnedClones": {
      const payload = parseActionValue(value);
      const target = payload.target || "all";

      if (setNpcs && currentNpcId) {
        setNpcs((prevNpcs) => {
          const ownerId = resolveSequenceOwnerId(
            prevNpcs,
            currentNpcId
          );

          const shouldPreserveClone = (npc) => {
            const preserveForDialogue =
              hasAnyTemporaryDialogueState(npc) ||
              hasAnyBaseDialoguePayload(npc) ||
              npc.summonAutoOpenPending === true ||
              activeDialogueNpcId === npc.id ||
              npc.isTalking ||
              isCloneProtectedByDialogueSequence(
                npc,
                context
              );

            return preserveForDialogue;
          };

          const updated = prevNpcs.filter((npc) => {
            const isOwnedClone =
              npc.isSummoned &&
              npc.summonedByNpcId === ownerId;

            if (target === "clones") {
              if (!isOwnedClone) return true;
              return shouldPreserveClone(npc);
            }

            const isOwnedDescendant =
              npc.summonedByNpcId === ownerId;

            if (!isOwnedClone && !isOwnedDescendant) {
              return true;
            }

            return shouldPreserveClone(npc);
          });

          const hasRemainingSequenceClones =
            updated.some(
              (npc) =>
                npc.isSummoned &&
                npc.summonedByNpcId === ownerId &&
                npc.dialogueSequenceActive === true &&
                npc.dialogueSequenceCompleted !== true
            );

          return markOwnerSequenceState(updated, ownerId, {
            dialogueSequenceId:
              hasRemainingSequenceClones
                ? undefined
                : null,
            summonBatchId:
              hasRemainingSequenceClones
                ? undefined
                : null,
            active: hasRemainingSequenceClones,
            suppressAutoDialogueUntilPlayerExit: true,
            forceRequireExitBeforeAutoDialogue: true
          });
        });
      }

      break;
    }

    case "custom":
      if (triggerCustomEvent) {
        triggerCustomEvent(value, {
          targetNpcId: resolvedTargetNpcId,
          key
        });
      } else if (typeof window !== "undefined") {
        window.dispatchEvent(
          new CustomEvent("npcCustomDialogueEvent", {
            detail: {
              eventName: value,
              targetNpcId: resolvedTargetNpcId,
              key
            }
          })
        );
      }

      break;

    default:
      console.warn(
        `Unhandled dialogue action type: ${type}`
      );
  }
};

export const executeDialogueActions = (actions, context) => {
  if (!Array.isArray(actions)) return;

  actions.forEach((action) =>
    executeDialogueAction(action, context)
  );
};
