/**
 * Utility functions to execute structured dialogue events/actions and check conditionals.
 */

const createNpcCloneId = () => {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }

  return `npc_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
};

const toArray3 = (value, fallback = [0, 0, 0]) => {
  if (!Array.isArray(value)) return [...fallback];

  return [
    Number(value[0] ?? fallback[0]) || 0,
    Number(value[1] ?? fallback[1]) || 0,
    Number(value[2] ?? fallback[2]) || 0
  ];
};

const removeSummonedNpcsForCaller = (prevNpcs, callerNpcId) => {
  if (!callerNpcId) return prevNpcs;

  return prevNpcs.filter(
    (npc) => !(npc.isSummoned && npc.summonedByNpcId === callerNpcId)
  );
};

/**
 * Evaluates whether a list of conditions are satisfied by the current game flags.
 * Supports:
 * - flagEquals: flag value matches target value exactly
 * - flagNotEquals: flag value does not match target value
 * - flagExists: flag has any truthy value (or is true)
 * - flagMissing: flag is undefined, null, or false
 *
 * @param {Array} conditions - Array of condition objects
 * @param {Object} gameFlags - The current runtime game flags
 * @returns {boolean} - True if all conditions pass, false otherwise
 */
export const checkConditions = (conditions, gameFlags = {}) => {
  if (!Array.isArray(conditions) || conditions.length === 0) return true;

  return conditions.every((cond) => {
    if (!cond || !cond.key) return true;

    const { type, key, value } = cond;
    const flagValue = gameFlags[key];

    switch (type) {
      case "flagEquals":
        return flagValue === value;

      case "flagNotEquals":
        return flagValue !== value;

      case "flagExists":
        return flagValue !== undefined && flagValue !== null && flagValue !== false;

      case "flagMissing":
        return flagValue === undefined || flagValue === null || flagValue === false;

      default:
        console.warn(`Unhandled condition type: ${type}`);
        return true;
    }
  });
};

const parseActionValue = (value) => {
  if (value == null) return {};
  if (typeof value === "object") return value;

  if (typeof value === "string") {
    try {
      return JSON.parse(value);
    } catch (error) {
      console.warn("Failed to parse dialogue action value as JSON:", value);
      return {};
    }
  }

  return {};
};

export const executeDialogueAction = (action, context) => {
  if (!action || !action.type) return;

  const {
    type,
    targetId,
    targetNpcId: legacyTargetNpcId,
    value,
    key
  } = action;

  const resolvedTargetNpcId = targetId || legacyTargetNpcId || null;

  const {
    setNpcs,
    setGameFlags,
    triggerCustomEvent,
    closeDialogue,
    currentNpcId
  } = context;

  console.log(`Executing dialogue action: ${type}`, action);

  switch (type) {
    case "closeDialogue":
      if (setNpcs && currentNpcId) {
        setNpcs((prevNpcs) => removeSummonedNpcsForCaller(prevNpcs, currentNpcId));
      }

      if (closeDialogue) {
        closeDialogue();
      }
      break;

    case "setFlag":
      if (key && setGameFlags) {
        setGameFlags((prev) => ({
          ...prev,
          [key]: value ?? true
        }));
      }
      break;

    case "changeBehavior":
      if (setNpcs) {
        const targetNpcId = resolvedTargetNpcId || currentNpcId;

        if (targetNpcId) {
          setNpcs((prevNpcs) =>
            prevNpcs.map((npc) => {
              if (npc.id === targetNpcId) {
                const updatedMovement = {
                  ...(npc.movement || {}),
                  mode: value
                };

                return {
                  ...npc,
                  movement: updatedMovement
                };
              }

              return npc;
            })
          );
        }
      }
      break;

    case "summonNpc": {
      const summonPayload = parseActionValue(value);
      const count = Math.max(1, Number(summonPayload.count ?? 1) || 1);
      const offset = toArray3(summonPayload.offset, [1.5, 0, 0]);
      const behavior = summonPayload.behavior || "idle";

      if (setNpcs && resolvedTargetNpcId) {
        setNpcs((prevNpcs) => {
          const templateNpc = prevNpcs.find((npc) => npc.id === resolvedTargetNpcId);

          if (!templateNpc) {
            console.warn("summonNpc: target NPC template not found:", resolvedTargetNpcId);
            return prevNpcs;
          }

          const sourceNpc = prevNpcs.find((npc) => npc.id === currentNpcId);
          const basePosition = Array.isArray(sourceNpc?.position)
            ? sourceNpc.position
            : Array.isArray(templateNpc.position)
            ? templateNpc.position
            : [0, 0, 0];

          const nextNpcs = removeSummonedNpcsForCaller(prevNpcs, currentNpcId);

          const spawnedNpcs = Array.from({ length: count }, (_, index) => {
            const spreadX = index * 0.8;
            const spawnPosition = [
              (basePosition[0] ?? 0) + offset[0] + spreadX,
              (basePosition[1] ?? 0) + offset[1],
              (basePosition[2] ?? 0) + offset[2]
            ];

            const summonedId = createNpcCloneId();
            const templateMovement = templateNpc.movement || {};

            return {
              ...templateNpc,
              id: summonedId,
              npcId: summonedId,
              name: `${templateNpc.name || "NPC"} ${index + 1}`,
              position: spawnPosition,
              movement: {
                ...templateMovement,
                mode: behavior || templateMovement.mode || "idle"
              },
              isSummoned: true,
              summonedByNpcId: currentNpcId || null,
              summonedFromTemplateId: resolvedTargetNpcId
            };
          });

          return [...nextNpcs, ...spawnedNpcs];
        });
      } else if (triggerCustomEvent) {
        triggerCustomEvent("summonNpc", {
          sourceNpcId: currentNpcId || null,
          targetNpcId: resolvedTargetNpcId,
          value: {
            ...summonPayload,
            count,
            offset,
            behavior
          }
        });
      } else {
        const event = new CustomEvent("npcCustomDialogueEvent", {
          detail: {
            eventName: "summonNpc",
            sourceNpcId: currentNpcId || null,
            targetNpcId: resolvedTargetNpcId,
            value: {
              ...summonPayload,
              count,
              offset,
              behavior
            }
          }
        });

        window.dispatchEvent(event);
      }
      break;
    }

    case "custom":
      if (triggerCustomEvent) {
        triggerCustomEvent(value, {
          targetNpcId: resolvedTargetNpcId,
          key
        });
      } else {
        const event = new CustomEvent("npcCustomDialogueEvent", {
          detail: {
            eventName: value,
            targetNpcId: resolvedTargetNpcId,
            key
          }
        });
        window.dispatchEvent(event);
      }
      break;

    default:
      console.warn(`Unhandled dialogue action type: ${type}`);
  }
};

/**
 * Executes a list of dialogue actions sequentially
 */
export const executeDialogueActions = (actions, context) => {
  if (!Array.isArray(actions)) return;
  actions.forEach((action) => executeDialogueAction(action, context));
};
