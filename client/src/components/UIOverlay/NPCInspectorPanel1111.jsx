// components/UIOverlay/NPCInspectorPanel.jsx
import React, { useEffect, useRef, useState } from "react";



const DEFAULT_DIALOGUE_TEXT = "Hello traveler!";

const ACTION_TYPE_OPTIONS = [
  { value: "custom", label: "Custom" },
  { value: "startQuest", label: "Start Quest" },
  { value: "completeQuest", label: "Complete Quest" },
  { value: "setFlag", label: "Set Flag" },
  { value: "clearFlag", label: "Clear Flag" },
  { value: "giveItem", label: "Give Item" },
  { value: "removeItem", label: "Remove Item" },
  { value: "playSound", label: "Play Sound" },
  { value: "changeBehavior", label: "Change Behavior" },
  { value: "teleport", label: "Teleport" },
  { value: "closeDialogue", label: "Close Dialogue" },
  { value: "summonNpc", label: "Summon NPC" },
  { value: "setNpcTexture", label: "Set NPC Texture" },
  { value: "restoreNpcTexture", label: "Restore NPC Texture" },
  { value: "setNpcWaypointPatrol", label: "Set NPC Waypoint Patrol" },
  { value: "setNpcFollowTarget", label: "Set NPC Follow Target" },
  { value: "appendNpcWaypoint", label: "Append NPC Waypoint" },
  { value: "replaceNpcWaypoints", label: "Replace NPC Waypoints" },
  { value: "setNpcWaypointWaitTime", label: "Set NPC Waypoint Wait Time" },
  { value: "setNpcWaypointDialogue", label: "Set NPC Waypoint Dialogue" },
  { value: "resetNpcEventSequence", label: "Reset NPC Event Sequence" },
  { value: "despawnOwnedClones", label: "Despawn Owned Clones" },
];

const TARGET_SCOPE_OPTIONS = [
  { value: "main", label: "Main NPC Only" },
  { value: "clones", label: "Clone/Summoned NPCs Only" },
  { value: "all", label: "Both Main & Clones" },
];

const FOLLOW_TARGET_OPTIONS = [
  { value: "owner", label: "Main NPC / Owner" },
  { value: "player", label: "Player" },
  { value: "targetNpc", label: "Selected Target NPC" },
  { value: "firstClone", label: "First Active Clone" },
  { value: "none", label: "Stop Following" },
];

const WAYPOINT_DIALOGUE_TRIGGER_OPTIONS = [
  { value: "onReach", label: "On Reach" },
  { value: "afterWait", label: "After Wait" },
];

const getWaypointPos = (waypoint) => {
  if (Array.isArray(waypoint)) return waypoint;
  if (waypoint && Array.isArray(waypoint.pos)) return waypoint.pos;
  return [0, 0, 0];
};

const getWaypointWaitTime = (waypoint, fallbackWaitTime = 0) => {
  if (waypoint && !Array.isArray(waypoint) && typeof waypoint === "object") {
    return waypoint.waitTime ?? fallbackWaitTime;
  }

  return fallbackWaitTime;
};

const normalizeWaypoint = (waypoint, fallbackWaitTime = 0) => {
  if (Array.isArray(waypoint)) {
    return {
      pos: [...waypoint],
      waitTime: fallbackWaitTime,
    };
  }

  if (waypoint && typeof waypoint === "object") {
    return {
      ...waypoint,
      pos: Array.isArray(waypoint.pos) ? [...waypoint.pos] : [0, 0, 0],
      waitTime: waypoint.waitTime ?? fallbackWaitTime,
    };
  }

  return {
    pos: [0, 0, 0],
    waitTime: fallbackWaitTime,
  };
};

const createUniqueId = (prefix = "item") => {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
};

const createDefaultDialogueNode = (
  id = "root",
  text = DEFAULT_DIALOGUE_TEXT
) => ({
  id,
  text,
  choices: [],
  onEnter: [],
  onExit: [],
});

const createDefaultDialogue = (text = DEFAULT_DIALOGUE_TEXT) => ({
  startNodeId: "root",
  nodes: {
    root: createDefaultDialogueNode("root", text),
  },
});

const createActionWaypoint = () => ({
  pos: [0, 0, 0],
  waitTime: 0,
  dialogueNodeId: "",
});

const normalizeActionWaypoint = (waypoint) => {
  const normalized = normalizeWaypoint(waypoint, 0);

  return {
    ...normalized,
    dialogueNodeId:
      waypoint && typeof waypoint === "object" && !Array.isArray(waypoint)
        ? typeof waypoint.dialogueNodeId === "string"
          ? waypoint.dialogueNodeId
          : ""
        : "",
  };
};

const getDefaultActionValue = (type) => {
  switch (type) {
    case "summonNpc":
      return {
        count: 1,
        offset: [1, 0, 1],
        behavior: "idle",
        spawnNearOwner: true,
        inheritOwnerWaypoints: true,
        replaceExistingOwnedClones: true,
      };

    case "setNpcWaypointPatrol":
      return {
        target: "main",
        waypointIndex: 0,
      };

    case "setNpcFollowTarget":
      return {
        target: "clones",
        followTarget: "owner",
        stopDistance: 1.25,
      };

    case "appendNpcWaypoint":
      return {
        target: "clones",
        clearExistingFollowTarget: true,
        waypoints: [createActionWaypoint()],
      };

    case "replaceNpcWaypoints":
      return {
        target: "clones",
        clearExistingFollowTarget: true,
        waypoints: [createActionWaypoint()],
      };

    case "setNpcWaypointWaitTime":
      return {
        target: "main",
        waypointIndex: 0,
        waitTime: 0,
      };

    case "setNpcWaypointDialogue":
      return {
        target: "main",
        waypointIndex: 0,
        dialogueNodeId: "",
        trigger: "onReach",
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
      return {
        target: "all",
      };

    case "restoreNpcTexture":
      return "";

    default:
      return "";
  }
};

const normalizeDialogueAction = (action) => {
  if (typeof action === "string") {
    return {
      type: action,
      targetId: "",
      key: "",
      value: getDefaultActionValue(action),
    };
  }

  if (action && typeof action === "object" && !Array.isArray(action)) {
    const normalizedType =
      typeof action.type === "string" && action.type.trim()
        ? action.type
        : "custom";

    let normalizedValue =
      action.value === null || action.value === undefined ? "" : action.value;

    if (normalizedType === "summonNpc") {
      const fallback = getDefaultActionValue("summonNpc");

      if (
        !normalizedValue ||
        typeof normalizedValue !== "object" ||
        Array.isArray(normalizedValue)
      ) {
        normalizedValue = fallback;
      } else {
        normalizedValue = {
          count:
            typeof normalizedValue.count === "number"
              ? normalizedValue.count
              : fallback.count,
          offset: Array.isArray(normalizedValue.offset)
            ? [
                normalizedValue.offset[0] ?? fallback.offset[0],
                normalizedValue.offset[1] ?? fallback.offset[1],
                normalizedValue.offset[2] ?? fallback.offset[2],
              ]
            : fallback.offset,
          behavior:
            typeof normalizedValue.behavior === "string"
              ? normalizedValue.behavior
              : fallback.behavior,
          spawnNearOwner:
            normalizedValue.spawnNearOwner ?? fallback.spawnNearOwner,
          inheritOwnerWaypoints:
            normalizedValue.inheritOwnerWaypoints ??
            fallback.inheritOwnerWaypoints,
          replaceExistingOwnedClones:
            normalizedValue.replaceExistingOwnedClones ??
            fallback.replaceExistingOwnedClones,
        };
      }
    }

    if (normalizedType === "setNpcWaypointPatrol") {
      const fallback = getDefaultActionValue("setNpcWaypointPatrol");

      if (
        !normalizedValue ||
        typeof normalizedValue !== "object" ||
        Array.isArray(normalizedValue)
      ) {
        normalizedValue = fallback;
      } else {
        normalizedValue = {
          target:
            typeof normalizedValue.target === "string"
              ? normalizedValue.target
              : fallback.target,
          waypointIndex:
            typeof normalizedValue.waypointIndex === "number"
              ? normalizedValue.waypointIndex
              : fallback.waypointIndex,
        };
      }
    }

    if (normalizedType === "setNpcFollowTarget") {
      const fallback = getDefaultActionValue("setNpcFollowTarget");

      if (
        !normalizedValue ||
        typeof normalizedValue !== "object" ||
        Array.isArray(normalizedValue)
      ) {
        normalizedValue = fallback;
      } else {
        normalizedValue = {
          target:
            typeof normalizedValue.target === "string"
              ? normalizedValue.target
              : fallback.target,
          followTarget:
            typeof normalizedValue.followTarget === "string"
              ? normalizedValue.followTarget
              : fallback.followTarget,
          stopDistance:
            typeof normalizedValue.stopDistance === "number"
              ? normalizedValue.stopDistance
              : fallback.stopDistance,
        };
      }
    }

    if (
      normalizedType === "appendNpcWaypoint" ||
      normalizedType === "replaceNpcWaypoints"
    ) {
      const fallback = getDefaultActionValue(normalizedType);

      if (
        !normalizedValue ||
        typeof normalizedValue !== "object" ||
        Array.isArray(normalizedValue)
      ) {
        normalizedValue = fallback;
      } else {
        normalizedValue = {
          target:
            typeof normalizedValue.target === "string"
              ? normalizedValue.target
              : fallback.target,
          clearExistingFollowTarget:
            normalizedValue.clearExistingFollowTarget ??
            fallback.clearExistingFollowTarget,
          waypoints: Array.isArray(normalizedValue.waypoints)
            ? normalizedValue.waypoints.map(normalizeActionWaypoint)
            : fallback.waypoints,
        };
      }
    }

    if (normalizedType === "setNpcWaypointWaitTime") {
      const fallback = getDefaultActionValue("setNpcWaypointWaitTime");

      if (
        !normalizedValue ||
        typeof normalizedValue !== "object" ||
        Array.isArray(normalizedValue)
      ) {
        normalizedValue = fallback;
      } else {
        normalizedValue = {
          target:
            typeof normalizedValue.target === "string"
              ? normalizedValue.target
              : fallback.target,
          waypointIndex:
            typeof normalizedValue.waypointIndex === "number"
              ? normalizedValue.waypointIndex
              : fallback.waypointIndex,
          waitTime:
            typeof normalizedValue.waitTime === "number"
              ? normalizedValue.waitTime
              : fallback.waitTime,
        };
      }
    }

    if (normalizedType === "setNpcWaypointDialogue") {
      const fallback = getDefaultActionValue("setNpcWaypointDialogue");

      if (
        !normalizedValue ||
        typeof normalizedValue !== "object" ||
        Array.isArray(normalizedValue)
      ) {
        normalizedValue = fallback;
      } else {
        normalizedValue = {
          target:
            typeof normalizedValue.target === "string"
              ? normalizedValue.target
              : fallback.target,
          waypointIndex:
            typeof normalizedValue.waypointIndex === "number"
              ? normalizedValue.waypointIndex
              : fallback.waypointIndex,
          dialogueNodeId:
            typeof normalizedValue.dialogueNodeId === "string"
              ? normalizedValue.dialogueNodeId
              : fallback.dialogueNodeId,
          trigger:
            typeof normalizedValue.trigger === "string"
              ? normalizedValue.trigger
              : fallback.trigger,
        };
      }
    }

    if (normalizedType === "resetNpcEventSequence") {
      const fallback = getDefaultActionValue("resetNpcEventSequence");

      if (
        !normalizedValue ||
        typeof normalizedValue !== "object" ||
        Array.isArray(normalizedValue)
      ) {
        normalizedValue = fallback;
      } else {
        normalizedValue = {
          target:
            typeof normalizedValue.target === "string"
              ? normalizedValue.target
              : fallback.target,
          maxPlayerDistance:
            typeof normalizedValue.maxPlayerDistance === "number"
              ? normalizedValue.maxPlayerDistance
              : fallback.maxPlayerDistance,
          timeoutMs:
            typeof normalizedValue.timeoutMs === "number"
              ? normalizedValue.timeoutMs
              : fallback.timeoutMs,
          clearDialogueFlags:
            normalizedValue.clearDialogueFlags ?? fallback.clearDialogueFlags,
          despawnClones: normalizedValue.despawnClones ?? fallback.despawnClones,
          resumePatrol: normalizedValue.resumePatrol ?? fallback.resumePatrol,
        };
      }
    }

    if (normalizedType === "despawnOwnedClones") {
      const fallback = getDefaultActionValue("despawnOwnedClones");

      if (
        !normalizedValue ||
        typeof normalizedValue !== "object" ||
        Array.isArray(normalizedValue)
      ) {
        normalizedValue = fallback;
      } else {
        normalizedValue = {
          target:
            typeof normalizedValue.target === "string"
              ? normalizedValue.target
              : fallback.target,
        };
      }
    }

    if (normalizedType === "restoreNpcTexture") {
      normalizedValue = "";
    }

    return {
      ...action,
      type: normalizedType,
      targetId:
        action.targetId === null || action.targetId === undefined
          ? action.targetNpcId === null || action.targetNpcId === undefined
            ? ""
            : String(action.targetNpcId)
          : String(action.targetId),
      key:
        action.key === null || action.key === undefined
          ? ""
          : String(action.key),
      value: normalizedValue,
    };
  }

  return {
    type: "custom",
    targetId: "",
    key: "",
    value: "",
  };
};

const normalizeDialogueChoice = (choice, index = 0) => {
  if (typeof choice === "string") {
    return {
      id: createUniqueId(`choice_${index + 1}`),
      text: choice,
      nextNodeId: null,
      actions: [],
      conditions: [],
    };
  }

  if (choice && typeof choice === "object" && !Array.isArray(choice)) {
    return {
      ...choice,
      id: choice.id || createUniqueId(`choice_${index + 1}`),
      text: typeof choice.text === "string" ? choice.text : "",
      nextNodeId:
        typeof choice.nextNodeId === "string" && choice.nextNodeId.trim()
          ? choice.nextNodeId
          : null,
      actions: Array.isArray(choice.actions)
        ? choice.actions.map(normalizeDialogueAction)
        : [],
      conditions: Array.isArray(choice.conditions) ? choice.conditions : [],
    };
  }

  return {
    id: createUniqueId(`choice_${index + 1}`),
    text: "",
    nextNodeId: null,
    actions: [],
    conditions: [],
  };
};

const normalizeDialogueNode = (node, nodeId) => {
  if (typeof node === "string") {
    return createDefaultDialogueNode(nodeId, node);
  }

  if (node && typeof node === "object" && !Array.isArray(node)) {
    return {
      ...node,
      id: nodeId,
      text: typeof node.text === "string" ? node.text : "",
      choices: Array.isArray(node.choices)
        ? node.choices.map(normalizeDialogueChoice)
        : [],
      onEnter: Array.isArray(node.onEnter)
        ? node.onEnter.map(normalizeDialogueAction)
        : [],
      onExit: Array.isArray(node.onExit)
        ? node.onExit.map(normalizeDialogueAction)
        : [],
    };
  }

  return createDefaultDialogueNode(nodeId, "");
};

const normalizeDialogue = (dialogue) => {
  if (typeof dialogue === "string") {
    return createDefaultDialogue(dialogue || DEFAULT_DIALOGUE_TEXT);
  }

  if (!dialogue || typeof dialogue !== "object" || Array.isArray(dialogue)) {
    return createDefaultDialogue();
  }

  const sourceNodes =
    dialogue.nodes &&
    typeof dialogue.nodes === "object" &&
    !Array.isArray(dialogue.nodes)
      ? dialogue.nodes
      : {};

  const normalizedNodes = {};

  Object.entries(sourceNodes).forEach(([nodeId, node]) => {
    if (!nodeId) return;
    normalizedNodes[nodeId] = normalizeDialogueNode(node, nodeId);
  });

  if (Object.keys(normalizedNodes).length === 0) {
    normalizedNodes.root = createDefaultDialogueNode();
  }

  const requestedStartNodeId =
    typeof dialogue.startNodeId === "string" ? dialogue.startNodeId : "root";

  const startNodeId = normalizedNodes[requestedStartNodeId]
    ? requestedStartNodeId
    : Object.keys(normalizedNodes)[0];

  return {
    ...dialogue,
    startNodeId,
    nodes: normalizedNodes,
  };
};

function DialogueActionList({
  title,
  actions,
  onChange,
  allNpcs = [],
  selectedNpcId = null,
  dialogueNodeIds = [],
}) {
  const normalizedActions = Array.isArray(actions)
    ? actions.map(normalizeDialogueAction)
    : [];

  const addAction = () => {
    onChange([
      ...normalizedActions,
      {
        type: "custom",
        targetId: "",
        key: "",
        value: "",
      },
    ]);
  };

  const updateAction = (index, patch) => {
    const updatedActions = normalizedActions.map((action, actionIndex) =>
      actionIndex === index
        ? {
            ...action,
            ...patch,
          }
        : action
    );

    onChange(updatedActions);
  };

  const removeAction = (index) => {
    onChange(normalizedActions.filter((_, actionIndex) => actionIndex !== index));
  };

  const updateActionValue = (index, patch, fallbackType = null) => {
    const action = normalizedActions[index];
    const defaultValue = getDefaultActionValue(fallbackType || action?.type);

    const currentValue =
      action &&
      action.value &&
      typeof action.value === "object" &&
      !Array.isArray(action.value)
        ? action.value
        : typeof defaultValue === "object" && !Array.isArray(defaultValue)
        ? defaultValue
        : {};

    updateAction(index, {
      value: {
        ...currentValue,
        ...patch,
      },
    });
  };

  const updateWaypointListValue = (index, updater) => {
    const action = normalizedActions[index];
    const defaultValue = getDefaultActionValue(action?.type);
    const currentValue =
      action &&
      action.value &&
      typeof action.value === "object" &&
      !Array.isArray(action.value)
        ? action.value
        : defaultValue;

    const currentWaypoints = Array.isArray(currentValue.waypoints)
      ? currentValue.waypoints.map(normalizeActionWaypoint)
      : [createActionWaypoint()];

    updateAction(index, {
      value: {
        ...currentValue,
        waypoints: updater(currentWaypoints),
      },
    });
  };

  const addActionWaypoint = (index) => {
    updateWaypointListValue(index, (waypoints) => [
      ...waypoints,
      createActionWaypoint(),
    ]);
  };

  const updateActionWaypoint = (index, waypointIndex, patch) => {
    updateWaypointListValue(index, (waypoints) =>
      waypoints.map((waypoint, currentIndex) =>
        currentIndex === waypointIndex
          ? {
              ...waypoint,
              ...patch,
            }
          : waypoint
      )
    );
  };

  const removeActionWaypoint = (index, waypointIndex) => {
    updateWaypointListValue(index, (waypoints) =>
      waypoints.filter((_, currentIndex) => currentIndex !== waypointIndex)
    );
  };

  const handleActionFileSelection = (index, event) => {
    const file = event.target.files?.[0];

    if (!file) return;

    if (!file.type.match("image/jpeg") && !file.type.match("image/png")) {
      alert("Please select a JPEG or PNG image.");
      event.target.value = "";
      return;
    }

    const reader = new FileReader();

    reader.onload = (readerEvent) => {
      updateAction(index, {
        value: readerEvent.target?.result || "",
      });
    };

    reader.readAsDataURL(file);
  };

  return (
    <div className="dialogue-actions-editor">
      <div className="dialogue-actions-header">
        <span>{title}</span>

        <button
          type="button"
          className="dialogue-small-button"
          onClick={addAction}
        >
          + Action
        </button>
      </div>

      {normalizedActions.length === 0 ? (
        <div className="dialogue-empty-small">No actions.</div>
      ) : (
        normalizedActions.map((action, index) => {
          const summonValue =
            action.type === "summonNpc" &&
            action.value &&
            typeof action.value === "object" &&
            !Array.isArray(action.value)
              ? action.value
              : getDefaultActionValue("summonNpc");

          const waypointPatrolValue =
            action.type === "setNpcWaypointPatrol" &&
            action.value &&
            typeof action.value === "object" &&
            !Array.isArray(action.value)
              ? action.value
              : getDefaultActionValue("setNpcWaypointPatrol");

          const followValue =
            action.type === "setNpcFollowTarget" &&
            action.value &&
            typeof action.value === "object" &&
            !Array.isArray(action.value)
              ? action.value
              : getDefaultActionValue("setNpcFollowTarget");

          const waypointRouteValue =
            (action.type === "appendNpcWaypoint" ||
              action.type === "replaceNpcWaypoints") &&
            action.value &&
            typeof action.value === "object" &&
            !Array.isArray(action.value)
              ? action.value
              : getDefaultActionValue(action.type);

          const waypointWaitValue =
            action.type === "setNpcWaypointWaitTime" &&
            action.value &&
            typeof action.value === "object" &&
            !Array.isArray(action.value)
              ? action.value
              : getDefaultActionValue("setNpcWaypointWaitTime");

          const waypointDialogueValue =
            action.type === "setNpcWaypointDialogue" &&
            action.value &&
            typeof action.value === "object" &&
            !Array.isArray(action.value)
              ? action.value
              : getDefaultActionValue("setNpcWaypointDialogue");

          const resetEventValue =
            action.type === "resetNpcEventSequence" &&
            action.value &&
            typeof action.value === "object" &&
            !Array.isArray(action.value)
              ? action.value
              : getDefaultActionValue("resetNpcEventSequence");

          const despawnValue =
            action.type === "despawnOwnedClones" &&
            action.value &&
            typeof action.value === "object" &&
            !Array.isArray(action.value)
              ? action.value
              : getDefaultActionValue("despawnOwnedClones");

          const targetTemplateNpc = allNpcs.find(
            (npc) => (npc.npcId || npc.id) === (action.targetId || selectedNpcId)
          );
          const targetWaypoints = targetTemplateNpc?.waypoints || [];

          return (
            <div key={`${title}_${index}`} className="dialogue-action-row">
              <div className="dialogue-action-fields">
                <label>
                  Action type
                  <select
                    value={action.type || "custom"}
                    onChange={(event) => {
                      const nextType = event.target.value;

                      updateAction(index, {
                        type: nextType,
                        key: "",
                        value: getDefaultActionValue(nextType),
                      });
                    }}
                  >
                    {ACTION_TYPE_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>

                <label>
                  Target NPC
                  <select
                    value={action.targetId || ""}
                    onChange={(event) =>
                      updateAction(index, {
                        targetId: event.target.value,
                      })
                    }
                  >
                    <option value="">This NPC</option>
                    <option value="player">Player</option>

                    {allNpcs
                      .filter((npc) => {
                        const npcId = npc.npcId || npc.id || npc._id;
                        return npcId && npcId !== selectedNpcId;
                      })
                      .map((npc) => {
                        const npcId = npc.npcId || npc.id || npc._id;

                        return (
                          <option key={npcId} value={npcId}>
                            {npc.name || `NPC ${npcId}`}
                          </option>
                        );
                      })}
                  </select>
                </label>

                {(action.type === "setFlag" || action.type === "clearFlag") && (
                  <label>
                    Flag Key
                    <input
                      type="text"
                      value={action.key || ""}
                      placeholder="questStarted"
                      onChange={(event) =>
                        updateAction(index, {
                          key: event.target.value,
                        })
                      }
                    />
                  </label>
                )}

                {action.type === "setFlag" && (
                  <label>
                    Flag Value
                    <input
                      type="text"
                      value={action.value ?? ""}
                      placeholder="true"
                      onChange={(event) =>
                        updateAction(index, {
                          value: event.target.value,
                        })
                      }
                    />
                  </label>
                )}

                {action.type === "custom" && (
                  <label>
                    Event Name
                    <input
                      type="text"
                      value={action.value || ""}
                      placeholder="myCustomEvent"
                      onChange={(event) =>
                        updateAction(index, {
                          value: event.target.value,
                        })
                      }
                    />
                  </label>
                )}

                {action.type === "changeBehavior" && (
                  <label>
                    Behavior
                    <select
                      value={action.value || "idle"}
                      onChange={(event) =>
                        updateAction(index, {
                          value: event.target.value,
                        })
                      }
                    >
                      <option value="idle">Idle</option>
                      <option value="static">Static</option>
                      <option value="wander">Wander</option>
                      <option value="patrol">Patrol</option>
                      <option value="follow">Follow</option>
                      <option value="chase">Chase</option>
                    </select>
                  </label>
                )}

                {action.type === "setNpcTexture" && (
                  <label>
                    Texture File
                    <input
                      type="file"
                      accept="image/png, image/jpeg"
                      onChange={(event) =>
                        handleActionFileSelection(index, event)
                      }
                    />
                    <small className="dialogue-help-text">
                      Select an image from your computer. Local Windows paths
                      like C:\... do not work in the browser, so the file is
                      converted to a browser-safe data URL automatically.
                    </small>
                    {action.value && (
                      <div className="dialogue-inline-note">
                        Texture file loaded successfully.
                      </div>
                    )}
                  </label>
                )}

                {action.type === "restoreNpcTexture" && (
                  <div className="dialogue-inline-note">
                    Restores the NPC&apos;s previously saved texture. No URL is
                    needed.
                  </div>
                )}

                {action.type === "setNpcWaypointPatrol" && (
                  <>
                    <label>
                      Target Scope
                      <select
                        value={waypointPatrolValue.target || "main"}
                        onChange={(event) =>
                          updateActionValue(index, {
                            target: event.target.value,
                          })
                        }
                      >
                        {TARGET_SCOPE_OPTIONS.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label>
                      Target Waypoint Index
                      <select
                        value={waypointPatrolValue.waypointIndex ?? 0}
                        onChange={(event) =>
                          updateActionValue(index, {
                            waypointIndex:
                              parseInt(event.target.value, 10) || 0,
                          })
                        }
                      >
                        {targetWaypoints.length > 0 ? (
                          targetWaypoints.map((_, idx) => (
                            <option key={idx} value={idx}>
                              Waypoint #{idx + 1}
                            </option>
                          ))
                        ) : (
                          <option value={0}>Waypoint #1 (Default)</option>
                        )}
                      </select>
                    </label>
                  </>
                )}

                {action.type === "setNpcFollowTarget" && (
                  <>
                    <label>
                      Followers
                      <select
                        value={followValue.target || "clones"}
                        onChange={(event) =>
                          updateActionValue(index, {
                            target: event.target.value,
                          })
                        }
                      >
                        {TARGET_SCOPE_OPTIONS.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label>
                      Follow Target
                      <select
                        value={followValue.followTarget || "owner"}
                        onChange={(event) =>
                          updateActionValue(index, {
                            followTarget: event.target.value,
                          })
                        }
                      >
                        {FOLLOW_TARGET_OPTIONS.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label>
                      Stop Distance
                      <input
                        type="number"
                        min="0"
                        step="0.1"
                        value={followValue.stopDistance ?? 1.25}
                        onChange={(event) =>
                          updateActionValue(index, {
                            stopDistance:
                              Math.max(
                                0,
                                parseFloat(event.target.value) || 0
                              ) || 0,
                          })
                        }
                      />
                    </label>

                    {(followValue.followTarget === "targetNpc" ||
                      action.targetId) && (
                      <div className="dialogue-inline-note">
                        Uses the selected Target NPC when Follow Target is set
                        to Target NPC.
                      </div>
                    )}
                  </>
                )}

                {(action.type === "appendNpcWaypoint" ||
                  action.type === "replaceNpcWaypoints") && (
                  <>
                    <label>
                      Route Target Scope
                      <select
                        value={waypointRouteValue.target || "clones"}
                        onChange={(event) =>
                          updateActionValue(index, {
                            target: event.target.value,
                          })
                        }
                      >
                        {TARGET_SCOPE_OPTIONS.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label className="checkbox-label compact-checkbox-label">
                      <input
                        type="checkbox"
                        checked={
                          waypointRouteValue.clearExistingFollowTarget ?? true
                        }
                        onChange={(event) =>
                          updateActionValue(index, {
                            clearExistingFollowTarget: event.target.checked,
                          })
                        }
                      />
                      Clear existing follow target first
                    </label>

                    <div className="dialogue-waypoint-block">
                      <div className="dialogue-waypoint-block-header">
                        <span>Event Waypoints</span>

                        <button
                          type="button"
                          className="dialogue-small-button"
                          onClick={() => addActionWaypoint(index)}
                        >
                          + Waypoint
                        </button>
                      </div>

                      {(waypointRouteValue.waypoints || []).length === 0 ? (
                        <div className="dialogue-empty-small">
                          No event waypoints configured.
                        </div>
                      ) : (
                        (waypointRouteValue.waypoints || []).map(
                          (waypoint, waypointIndex) => {
                            const normalizedWaypoint =
                              normalizeActionWaypoint(waypoint);
                            const waypointPos = normalizedWaypoint.pos || [
                              0, 0, 0,
                            ];

                            return (
                              <div
                                key={`${index}_waypoint_${waypointIndex}`}
                                className="dialogue-waypoint-editor"
                              >
                                <div className="dialogue-waypoint-editor-header">
                                  <span>Waypoint #{waypointIndex + 1}</span>

                                  <button
                                    type="button"
                                    className="dialogue-delete-button"
                                    onClick={() =>
                                      removeActionWaypoint(index, waypointIndex)
                                    }
                                  >
                                    🗑️
                                  </button>
                                </div>

                                <div className="dialogue-waypoint-grid">
                                  <label>
                                    X
                                    <input
                                      type="number"
                                      step="0.1"
                                      value={waypointPos[0] ?? 0}
                                      onChange={(event) =>
                                        updateActionWaypoint(
                                          index,
                                          waypointIndex,
                                          {
                                            pos: [
                                              parseFloat(event.target.value) ||
                                                0,
                                              waypointPos[1] ?? 0,
                                              waypointPos[2] ?? 0,
                                            ],
                                          }
                                        )
                                      }
                                    />
                                  </label>

                                  <label>
                                    Y
                                    <input
                                      type="number"
                                      step="0.1"
                                      value={waypointPos[1] ?? 0}
                                      onChange={(event) =>
                                        updateActionWaypoint(
                                          index,
                                          waypointIndex,
                                          {
                                            pos: [
                                              waypointPos[0] ?? 0,
                                              parseFloat(event.target.value) ||
                                                0,
                                              waypointPos[2] ?? 0,
                                            ],
                                          }
                                        )
                                      }
                                    />
                                  </label>

                                  <label>
                                    Z
                                    <input
                                      type="number"
                                      step="0.1"
                                      value={waypointPos[2] ?? 0}
                                      onChange={(event) =>
                                        updateActionWaypoint(
                                          index,
                                          waypointIndex,
                                          {
                                            pos: [
                                              waypointPos[0] ?? 0,
                                              waypointPos[1] ?? 0,
                                              parseFloat(event.target.value) ||
                                                0,
                                            ],
                                          }
                                        )
                                      }
                                    />
                                  </label>

                                  <label>
                                    Wait Time
                                    <input
                                      type="number"
                                      min="0"
                                      step="0.5"
                                      value={
                                        normalizedWaypoint.waitTime ?? 0
                                      }
                                      onChange={(event) =>
                                        updateActionWaypoint(
                                          index,
                                          waypointIndex,
                                          {
                                            waitTime: Math.max(
                                              0,
                                              parseFloat(event.target.value) || 0
                                            ),
                                          }
                                        )
                                      }
                                    />
                                  </label>
                                </div>

                                <label>
                                  Dialogue Node at Waypoint (optional)
                                  <select
                                    value={
                                      normalizedWaypoint.dialogueNodeId || ""
                                    }
                                    onChange={(event) =>
                                      updateActionWaypoint(
                                        index,
                                        waypointIndex,
                                        {
                                          dialogueNodeId: event.target.value,
                                        }
                                      )
                                    }
                                  >
                                    <option value="">None</option>
                                    {dialogueNodeIds.map((nodeId) => (
                                      <option key={nodeId} value={nodeId}>
                                        {nodeId}
                                      </option>
                                    ))}
                                  </select>
                                </label>
                              </div>
                            );
                          }
                        )
                      )}
                    </div>
                  </>
                )}

                {action.type === "setNpcWaypointWaitTime" && (
                  <>
                    <label>
                      Target Scope
                      <select
                        value={waypointWaitValue.target || "main"}
                        onChange={(event) =>
                          updateActionValue(index, {
                            target: event.target.value,
                          })
                        }
                      >
                        {TARGET_SCOPE_OPTIONS.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label>
                      Waypoint Index
                      <input
                        type="number"
                        min="0"
                        step="1"
                        value={waypointWaitValue.waypointIndex ?? 0}
                        onChange={(event) =>
                          updateActionValue(index, {
                            waypointIndex:
                              Math.max(
                                0,
                                parseInt(event.target.value, 10) || 0
                              ) || 0,
                          })
                        }
                      />
                    </label>

                    <label>
                      Wait Time (sec)
                      <input
                        type="number"
                        min="0"
                        step="0.5"
                        value={waypointWaitValue.waitTime ?? 0}
                        onChange={(event) =>
                          updateActionValue(index, {
                            waitTime: Math.max(
                              0,
                              parseFloat(event.target.value) || 0
                            ),
                          })
                        }
                      />
                    </label>
                  </>
                )}

                {action.type === "setNpcWaypointDialogue" && (
                  <>
                    <label>
                      Target Scope
                      <select
                        value={waypointDialogueValue.target || "main"}
                        onChange={(event) =>
                          updateActionValue(index, {
                            target: event.target.value,
                          })
                        }
                      >
                        {TARGET_SCOPE_OPTIONS.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label>
                      Waypoint Index
                      <input
                        type="number"
                        min="0"
                        step="1"
                        value={waypointDialogueValue.waypointIndex ?? 0}
                        onChange={(event) =>
                          updateActionValue(index, {
                            waypointIndex:
                              Math.max(
                                0,
                                parseInt(event.target.value, 10) || 0
                              ) || 0,
                          })
                        }
                      />
                    </label>

                    <label>
                      Dialogue Node
                      <select
                        value={waypointDialogueValue.dialogueNodeId || ""}
                        onChange={(event) =>
                          updateActionValue(index, {
                            dialogueNodeId: event.target.value,
                          })
                        }
                      >
                        <option value="">None</option>
                        {dialogueNodeIds.map((nodeId) => (
                          <option key={nodeId} value={nodeId}>
                            {nodeId}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label>
                      Trigger Timing
                      <select
                        value={waypointDialogueValue.trigger || "onReach"}
                        onChange={(event) =>
                          updateActionValue(index, {
                            trigger: event.target.value,
                          })
                        }
                      >
                        {WAYPOINT_DIALOGUE_TRIGGER_OPTIONS.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </label>
                  </>
                )}

                {action.type === "resetNpcEventSequence" && (
                  <>
                    <label>
                      Reset Target Scope
                      <select
                        value={resetEventValue.target || "all"}
                        onChange={(event) =>
                          updateActionValue(index, {
                            target: event.target.value,
                          })
                        }
                      >
                        {TARGET_SCOPE_OPTIONS.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label>
                      Max Player Distance
                      <input
                        type="number"
                        min="0"
                        step="0.5"
                        value={resetEventValue.maxPlayerDistance ?? 12}
                        onChange={(event) =>
                          updateActionValue(index, {
                            maxPlayerDistance: Math.max(
                              0,
                              parseFloat(event.target.value) || 0
                            ),
                          })
                        }
                      />
                    </label>

                    <label>
                      Timeout (ms)
                      <input
                        type="number"
                        min="0"
                        step="100"
                        value={resetEventValue.timeoutMs ?? 3000}
                        onChange={(event) =>
                          updateActionValue(index, {
                            timeoutMs: Math.max(
                              0,
                              parseInt(event.target.value, 10) || 0
                            ),
                          })
                        }
                      />
                    </label>

                    <label className="checkbox-label compact-checkbox-label">
                      <input
                        type="checkbox"
                        checked={resetEventValue.clearDialogueFlags ?? true}
                        onChange={(event) =>
                          updateActionValue(index, {
                            clearDialogueFlags: event.target.checked,
                          })
                        }
                      />
                      Clear dialogue/event flags
                    </label>

                    <label className="checkbox-label compact-checkbox-label">
                      <input
                        type="checkbox"
                        checked={resetEventValue.despawnClones ?? true}
                        onChange={(event) =>
                          updateActionValue(index, {
                            despawnClones: event.target.checked,
                          })
                        }
                      />
                      Despawn owned clones
                    </label>

                    <label className="checkbox-label compact-checkbox-label">
                      <input
                        type="checkbox"
                        checked={resetEventValue.resumePatrol ?? true}
                        onChange={(event) =>
                          updateActionValue(index, {
                            resumePatrol: event.target.checked,
                          })
                        }
                      />
                      Resume previous patrol/route
                    </label>
                  </>
                )}

                {action.type === "despawnOwnedClones" && (
                  <label>
                    Clone Cleanup Scope
                    <select
                      value={despawnValue.target || "all"}
                      onChange={(event) =>
                        updateActionValue(index, {
                          target: event.target.value,
                        })
                      }
                    >
                      <option value="all">All owned clones</option>
                      <option value="clones">Summoned clones only</option>
                    </select>
                  </label>
                )}

                {action.type === "summonNpc" && (
                  <>
                    <label>
                      Count
                      <input
                        type="number"
                        min="1"
                        step="1"
                        value={summonValue.count ?? 1}
                        onChange={(event) =>
                          updateActionValue(index, {
                            count: Math.max(
                              1,
                              parseInt(event.target.value, 10) || 1
                            ),
                          })
                        }
                      />
                    </label>

                    <label>
                      Behavior
                      <select
                        value={summonValue.behavior || "idle"}
                        onChange={(event) =>
                          updateActionValue(index, {
                            behavior: event.target.value,
                          })
                        }
                      >
                        <option value="idle">Idle</option>
                        <option value="static">Static</option>
                        <option value="wander">Wander</option>
                        <option value="patrol">Patrol</option>
                        <option value="follow">Follow</option>
                        <option value="chase">Chase</option>
                      </select>
                    </label>

                    <label>
                      Offset X
                      <input
                        type="number"
                        step="0.1"
                        value={summonValue.offset?.[0] ?? 1}
                        onChange={(event) =>
                          updateActionValue(index, {
                            offset: [
                              parseFloat(event.target.value) || 0,
                              summonValue.offset?.[1] ?? 0,
                              summonValue.offset?.[2] ?? 1,
                            ],
                          })
                        }
                      />
                    </label>

                    <label>
                      Offset Y
                      <input
                        type="number"
                        step="0.1"
                        value={summonValue.offset?.[1] ?? 0}
                        onChange={(event) =>
                          updateActionValue(index, {
                            offset: [
                              summonValue.offset?.[0] ?? 1,
                              parseFloat(event.target.value) || 0,
                              summonValue.offset?.[2] ?? 1,
                            ],
                          })
                        }
                      />
                    </label>

                    <label>
                      Offset Z
                      <input
                        type="number"
                        step="0.1"
                        value={summonValue.offset?.[2] ?? 1}
                        onChange={(event) =>
                          updateActionValue(index, {
                            offset: [
                              summonValue.offset?.[0] ?? 1,
                              summonValue.offset?.[1] ?? 0,
                              parseFloat(event.target.value) || 0,
                            ],
                          })
                        }
                      />
                    </label>

                    <label className="checkbox-label compact-checkbox-label">
                      <input
                        type="checkbox"
                        checked={summonValue.spawnNearOwner ?? true}
                        onChange={(event) =>
                          updateActionValue(index, {
                            spawnNearOwner: event.target.checked,
                          })
                        }
                      />
                      Spawn near owner/main NPC
                    </label>

                    <label className="checkbox-label compact-checkbox-label">
                      <input
                        type="checkbox"
                        checked={summonValue.inheritOwnerWaypoints ?? true}
                        onChange={(event) =>
                          updateActionValue(index, {
                            inheritOwnerWaypoints: event.target.checked,
                          })
                        }
                      />
                      Copy owner waypoint route
                    </label>

                    <label className="checkbox-label compact-checkbox-label">
                      <input
                        type="checkbox"
                        checked={
                          summonValue.replaceExistingOwnedClones ?? true
                        }
                        onChange={(event) =>
                          updateActionValue(index, {
                            replaceExistingOwnedClones: event.target.checked,
                          })
                        }
                      />
                      Replace existing owned clones first
                    </label>

                    <div className="dialogue-inline-note">
                      Use Target NPC to choose which NPC template gets summoned.
                      Leave it on This NPC if the action should duplicate the
                      current NPC template.
                    </div>
                  </>
                )}

                {(action.type === "playSound" ||
                  action.type === "giveItem" ||
                  action.type === "removeItem" ||
                  action.type === "teleport" ||
                  action.type === "startQuest" ||
                  action.type === "completeQuest") && (
                  <label>
                    Value
                    <input
                      type="text"
                      value={action.value ?? ""}
                      onChange={(event) =>
                        updateAction(index, {
                          value: event.target.value,
                        })
                      }
                    />
                  </label>
                )}
              </div>

              <button
                type="button"
                className="dialogue-delete-button"
                onClick={() => removeAction(index)}
                title="Remove action"
              >
                🗑️
              </button>
            </div>
          );
        })
      )}
    </div>
  );
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

  const [selectedDialogueNodeId, setSelectedDialogueNodeId] =
    useState("root");

  const selectedNpcId =
    selectedNpc?.npcId || selectedNpc?.id || selectedNpc?._id || null;

  const dialogue = normalizeDialogue(selectedNpc?.dialogue);

  useEffect(() => {
    if (!selectedNpcId) {
      setSelectedDialogueNodeId("root");
      return;
    }

    const currentDialogue = normalizeDialogue(selectedNpc?.dialogue);

    setSelectedDialogueNodeId((currentNodeId) => {
      if (currentDialogue.nodes[currentNodeId]) {
        return currentNodeId;
      }

      return currentDialogue.startNodeId;
    });
  }, [selectedNpcId, selectedNpc?.dialogue]);

  if (!selectedNpc) return null;

  const waypoints = Array.isArray(selectedNpc.waypoints)
    ? selectedNpc.waypoints
    : [];

  const dialogueNodeIds = Object.keys(dialogue.nodes);

  const activeDialogueNodeId =
    selectedDialogueNodeId && dialogue.nodes[selectedDialogueNodeId]
      ? selectedDialogueNodeId
      : dialogue.startNodeId;

  const activeDialogueNode =
    dialogue.nodes[activeDialogueNodeId] || dialogue.nodes[dialogueNodeIds[0]];

  const updateDialogue = (nextDialogue) => {
    updateNpc(selectedNpc.id, {
      dialogue: normalizeDialogue(nextDialogue),
    });
  };

  const updateDialogueNode = (nodeId, patch) => {
    const currentNode = dialogue.nodes[nodeId];

    if (!currentNode) return;

    updateDialogue({
      ...dialogue,
      nodes: {
        ...dialogue.nodes,
        [nodeId]: {
          ...currentNode,
          ...patch,
          id: nodeId,
        },
      },
    });
  };

  const addDialogueNode = () => {
    const newNodeId = createUniqueId("node");

    updateDialogue({
      ...dialogue,
      nodes: {
        ...dialogue.nodes,
        [newNodeId]: createDefaultDialogueNode(newNodeId, ""),
      },
    });

    setSelectedDialogueNodeId(newNodeId);
  };

  const duplicateDialogueNode = (nodeId) => {
    const sourceNode = dialogue.nodes[nodeId];

    if (!sourceNode) return;

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
        },
      },
    });

    setSelectedDialogueNodeId(newNodeId);
  };

  const renameDialogueNode = (oldNodeId, requestedNodeId) => {
    const newNodeId = requestedNodeId.trim();

    if (!newNodeId || newNodeId === oldNodeId) return;

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
      if (existingNodeId === nodeId) return;

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
      dialogue.startNodeId === nodeId
        ? remainingNodeIds[0]
        : dialogue.startNodeId;

    updateDialogue({
      ...dialogue,
      startNodeId: nextStartNodeId,
      nodes: remainingNodes,
    });

    setSelectedDialogueNodeId(nextStartNodeId);
  };

  const setDialogueStartNode = (nodeId) => {
    if (!dialogue.nodes[nodeId]) return;

    updateDialogue({
      ...dialogue,
      startNodeId: nodeId,
    });
  };

  const addDialogueChoice = (nodeId) => {
    const currentNode = dialogue.nodes[nodeId];

    if (!currentNode) return;

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

    if (!currentNode) return;

    const updatedChoices = currentNode.choices.map((choice, index) =>
      index === choiceIndex
        ? {
            ...choice,
            ...patch,
          }
        : choice
    );

    updateDialogueNode(nodeId, {
      choices: updatedChoices,
    });
  };

  const deleteDialogueChoice = (nodeId, choiceIndex) => {
    const currentNode = dialogue.nodes[nodeId];

    if (!currentNode) return;

    updateDialogueNode(nodeId, {
      choices: currentNode.choices.filter((_, index) => index !== choiceIndex),
    });
  };

  const moveDialogueChoice = (nodeId, choiceIndex, direction) => {
    const currentNode = dialogue.nodes[nodeId];

    if (!currentNode) return;

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

    if (!file) return;

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

    const newReactions = {
      ...currentReactions,
    };

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
    if (direction === "up" && index === 0) return;

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

  const movementMode = selectedNpc.movement?.mode || "idle";

  return (
    <div className="npc-inspector-panel">
      <div className="section-title">NPC Settings</div>

      <div className="npc-settings-grid">
        <div className="settings-field">
          <label>NPC Name</label>

          <input
            type="text"
            value={selectedNpc.name || ""}
            onChange={(event) =>
              updateNpc(selectedNpc.id, {
                name: event.target.value,
              })
            }
          />
        </div>

        <div className="settings-field">
          <label>NPC Face/Sprite Texture (JPEG/PNG)</label>

          <div
            style={{
              display: "flex",
              gap: "5px",
              alignItems: "center",
              marginTop: "4px",
            }}
          >
            <input
              type="file"
              ref={fileInputRef}
              accept="image/png, image/jpeg"
              onChange={handleTextureUpload}
              style={{ display: "none" }}
            />

            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              style={{
                flex: 1,
                padding: "6px",
                fontSize: "12px",
                cursor: "pointer",
                background: "#4b5563",
                color: "#fff",
                border: "none",
                borderRadius: "4px",
              }}
            >
              {selectedNpc.textureUrl ? "🔄 Change Texture" : "📤 Upload Texture"}
            </button>

            {selectedNpc.textureUrl && (
              <button
                type="button"
                onClick={removeTexture}
                style={{
                  padding: "6px 10px",
                  fontSize: "12px",
                  cursor: "pointer",
                  background: "#ef4444",
                  color: "#fff",
                  border: "none",
                  borderRadius: "4px",
                }}
                title="Remove texture"
              >
                🗑️
              </button>
            )}
          </div>

          {selectedNpc.textureUrl && (
            <div
              style={{
                marginTop: "8px",
                textAlign: "center",
              }}
            >
              <img
                src={selectedNpc.textureUrl}
                alt="NPC Preview"
                style={{
                  width: "50px",
                  height: "50px",
                  objectFit: "cover",
                  borderRadius: "4px",
                  border: "1px solid #ccc",
                }}
              />
            </div>
          )}
        </div>

        <div className="section-title" style={{ marginTop: "5px" }}>
          Movement
        </div>

        <div className="settings-field">
          <label>Movement Mode</label>

          <select
            value={movementMode}
            onChange={(event) =>
              handleNpcBaseStringChange("movement", "mode", event.target.value)
            }
          >
            <option value="idle">Idle</option>
            <option value="static">Static</option>
            <option value="wander">Wander</option>
            <option value="patrol">Patrol</option>
          </select>
        </div>

        <div className="settings-field">
          <label>Movement Speed</label>

          <input
            type="number"
            step="0.1"
            min="0"
            value={selectedNpc.movement?.speed ?? 2}
            onChange={(event) =>
              handleNpcBaseChange("movement", "speed", event.target.value)
            }
          />
        </div>

        <div className="settings-field">
          <label>Wait Time at Nodes / Wander Pause (sec)</label>

          <input
            type="number"
            step="0.5"
            min="0"
            value={selectedNpc.movement?.waitTime ?? 0}
            onChange={(event) =>
              handleNpcBaseChange("movement", "waitTime", event.target.value)
            }
          />
        </div>

        {movementMode === "wander" && (
          <div className="settings-field">
            <label>Wander Radius</label>

            <input
              type="number"
              step="0.5"
              min="0.5"
              value={
                selectedNpc.movement?.wanderRadius ??
                selectedNpc.wanderRadius ??
                5
              }
              onChange={(event) =>
                handleNpcBaseChange(
                  "movement",
                  "wanderRadius",
                  event.target.value
                )
              }
            />
          </div>
        )}

        <div className="settings-field">
          <label>Detection Radius</label>

          <input
            type="number"
            step="0.5"
            min="0"
            value={selectedNpc.detection?.radius ?? 6}
            onChange={(event) =>
              handleNpcBaseChange("detection", "radius", event.target.value)
            }
          />
        </div>

        <div className="section-title" style={{ marginTop: "5px" }}>
          Detection & AI Reactions
        </div>

        <div className="settings-field">
          <label>Default Detection Target</label>

          <select
            value={selectedNpc.detection?.targetType || "both"}
            onChange={(event) =>
              handleNpcBaseStringChange(
                "detection",
                "targetType",
                event.target.value
              )
            }
          >
            <option value="player">Player Only</option>
            <option value="npc">NPCs Only</option>
            <option value="both">Player + NPCs (Closest)</option>
          </select>
        </div>

        <div className="settings-field">
          <label>Default Reaction Behavior</label>

          <select
            value={selectedNpc.detection?.behavior || "look"}
            onChange={(event) =>
              handleNpcBaseStringChange(
                "detection",
                "behavior",
                event.target.value
              )
            }
          >
            <option value="look">Look At Target</option>
            <option value="chase">Chase Target</option>
            <option value="flee">Flee From Target</option>
            <option value="ignore">Ignore (Keep Moving)</option>
          </select>
        </div>

        <div className="section-title" style={{ marginTop: "5px" }}>
          Relationship & Reaction Targets
        </div>

        <div className="settings-field">
          <label>Player Reaction</label>

          <select
            value={selectedNpc.detection?.reactions?.player || "default"}
            onChange={(event) =>
              handleReactionChange("player", event.target.value)
            }
          >
            <option value="default">
              Default ({selectedNpc.detection?.behavior || "look"})
            </option>
            <option value="look">Look</option>
            <option value="chase">Chase</option>
            <option value="flee">Flee</option>
            <option value="ignore">Ignore</option>
          </select>
        </div>

        {allNpcs
          .filter((npc) => {
            const npcId = npc.npcId || npc.id || npc._id;
            return npcId && npcId !== selectedNpcId;
          })
          .map((npc) => {
            const npcId = npc.npcId || npc.id || npc._id;

            return (
              <div key={npcId} className="settings-field">
                <label>vs {npc.name || `NPC ${npcId}`}</label>

                <select
                  value={selectedNpc.detection?.reactions?.[npcId] || "default"}
                  onChange={(event) =>
                    handleReactionChange(npcId, event.target.value)
                  }
                >
                  <option value="default">
                    Default ({selectedNpc.detection?.behavior || "look"})
                  </option>
                  <option value="look">Look</option>
                  <option value="chase">Chase</option>
                  <option value="flee">Flee</option>
                  <option value="ignore">Ignore</option>
                </select>
              </div>
            );
          })}

        {(selectedNpc.detection?.behavior === "chase" ||
          selectedNpc.detection?.behavior === "attack") && (
          <div className="settings-field">
            <label>Chase Stop Distance</label>

            <input
              type="number"
              step="0.1"
              min="0"
              value={selectedNpc.detection?.stopDistance ?? 0.8}
              onChange={(event) =>
                handleNpcBaseChange(
                  "detection",
                  "stopDistance",
                  event.target.value
                )
              }
            />
          </div>
        )}

        <div className="settings-field">
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={selectedNpc.detection?.debug ?? false}
              onChange={(event) =>
                updateNpc(selectedNpc.id, {
                  detection: {
                    ...selectedNpc.detection,
                    debug: event.target.checked,
                  },
                })
              }
            />
            Debug Log Detection
          </label>
        </div>

        <div className="settings-field">
          <label>Patrol Mode</label>

          <select
            value={selectedNpc.patrolMode || "loop"}
            onChange={(event) =>
              updateNpc(selectedNpc.id, {
                patrolMode: event.target.value,
              })
            }
          >
            <option value="loop">Loop (0 - 1 - 2 - 0)</option>
            <option value="pingpong">
              Ping-Pong (0 - 1 - 2 - 1 - 0)
            </option>
          </select>
        </div>

        {movementMode === "patrol" && (
          <div style={{ marginTop: "10px" }}>
            <button
              type="button"
              onClick={() =>
                updateNpc(selectedNpc.id, {
                  isPatrolling: !(selectedNpc.isPatrolling ?? true),
                })
              }
              style={{
                width: "100%",
                padding: "8px",
                backgroundColor:
                  selectedNpc.isPatrolling ?? true ? "#f59e0b" : "#3b82f6",
                color: "white",
                fontWeight: "bold",
                border: "none",
                borderRadius: "4px",
                cursor: "pointer",
              }}
            >
              {selectedNpc.isPatrolling ?? true
                ? "⏸️ Pause Patrol"
                : "▶️ Start Patrol"}
            </button>
          </div>
        )}
      </div>

      {movementMode === "patrol" && (
        <>
          <div className="section-title">Patrol Waypoints</div>

          <div className="waypoint-actions-header">
            <button
              type="button"
              className={`btn-action ${
                placingWaypointForNpcId === selectedNpc.id ? "active" : ""
              }`}
              onClick={() =>
                setPlacingWaypointForNpcId(
                  placingWaypointForNpcId === selectedNpc.id
                    ? null
                    : selectedNpc.id
                )
              }
            >
              {placingWaypointForNpcId === selectedNpc.id
                ? "Cancel Placement"
                : "➕ Click Map to Add Waypoint"}
            </button>
          </div>

          <div className="waypoints-list">
            {waypoints.length === 0 ? (
              <div className="no-waypoints">
                No waypoints defined. Click the map to place waypoints.
              </div>
            ) : (
              waypoints.map((waypoint, index) => {
                const isSelected = selectedWaypointIndex === index;
                const isCurrentTarget = selectedNpc.currentWaypointIndex === index;
                const waypointPosition = getWaypointPos(waypoint);

                const xValue = waypointPosition[0] ?? 0;
                const yValue = waypointPosition[1] ?? 0;
                const zValue = waypointPosition[2] ?? 0;

                const waitTimeValue = getWaypointWaitTime(
                  waypoint,
                  selectedNpc.movement?.waitTime ?? 0
                );

                return (
                  <div
                    key={index}
                    className={`waypoint-item ${isSelected ? "selected" : ""} ${
                      isCurrentTarget ? "current-target" : ""
                    }`}
                    onClick={() => setSelectedWaypointIndex(index)}
                  >
                    <div className="waypoint-header">
                      <span className="waypoint-number">#{index + 1}</span>

                      {isCurrentTarget && (
                        <span className="target-badge">Target</span>
                      )}

                      <div className="waypoint-item-controls">
                        <button
                          type="button"
                          disabled={index === 0}
                          onClick={(event) => {
                            event.stopPropagation();
                            moveWaypoint(index, "up");
                          }}
                          title="Move Up"
                        >
                          ▲
                        </button>

                        <button
                          type="button"
                          disabled={index === waypoints.length - 1}
                          onClick={(event) => {
                            event.stopPropagation();
                            moveWaypoint(index, "down");
                          }}
                          title="Move Down"
                        >
                          ▼
                        </button>

                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            duplicateWaypoint(index);
                          }}
                          title="Duplicate"
                        >
                          📋
                        </button>

                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            setAsCurrentTarget(index);
                          }}
                          title="Set as Active Target"
                        >
                          🎯
                        </button>

                        <button
                          type="button"
                          className="btn-danger"
                          onClick={(event) => {
                            event.stopPropagation();
                            deleteWaypoint(index);
                          }}
                          title="Delete"
                        >
                          🗑️
                        </button>
                      </div>
                    </div>

                    {isSelected && (
                      <div
                        className="waypoint-details"
                        onClick={(event) => event.stopPropagation()}
                      >
                        <div className="waypoint-coordinates">
                          <div className="coord-input-group">
                            <label>X</label>

                            <input
                              type="number"
                              step="0.1"
                              value={Number(xValue).toFixed(2)}
                              onChange={(event) =>
                                handleWaypointChange(index, 0, event.target.value)
                              }
                            />
                          </div>

                          <div className="coord-input-group">
                            <label>Y (Height)</label>

                            <input
                              type="number"
                              step="0.1"
                              value={Number(yValue).toFixed(2)}
                              onChange={(event) =>
                                handleWaypointChange(index, 1, event.target.value)
                              }
                            />
                          </div>

                          <div className="coord-input-group">
                            <label>Z</label>

                            <input
                              type="number"
                              step="0.1"
                              value={Number(zValue).toFixed(2)}
                              onChange={(event) =>
                                handleWaypointChange(index, 2, event.target.value)
                              }
                            />
                          </div>
                        </div>

                        <div className="settings-field waypoint-wait-field">
                          <label>Wait Time at this Node (sec)</label>

                          <input
                            type="number"
                            step="0.5"
                            min="0"
                            value={waitTimeValue}
                            onChange={(event) =>
                              handleWaypointWaitTimeChange(
                                index,
                                event.target.value
                              )
                            }
                          />
                        </div>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </>
      )}

      <div className="section-title">Dialogue Tree</div>

      <div className="dialogue-editor">
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

        {activeDialogueNode && (
          <div className="dialogue-node-card">
            <div className="dialogue-node-header">
              <span>
                Node: <strong>{activeDialogueNodeId}</strong>
              </span>

              {dialogue.startNodeId === activeDialogueNodeId && (
                <span className="dialogue-start-badge">Start Node</span>
              )}
            </div>

            <div className="dialogue-node-buttons">
              <button
                type="button"
                onClick={() => setDialogueStartNode(activeDialogueNodeId)}
                disabled={dialogue.startNodeId === activeDialogueNodeId}
              >
                🏁 Set as Start
              </button>

              <button
                type="button"
                onClick={() => duplicateDialogueNode(activeDialogueNodeId)}
              >
                📋 Duplicate
              </button>

              <button
                type="button"
                className="dialogue-danger-button"
                onClick={() => deleteDialogueNode(activeDialogueNodeId)}
                disabled={dialogueNodeIds.length <= 1}
              >
                🗑️ Delete Node
              </button>
            </div>

            <div className="settings-field">
              <label>Node ID</label>

              <input
                key={activeDialogueNodeId}
                type="text"
                defaultValue={activeDialogueNodeId}
                onBlur={(event) =>
                  renameDialogueNode(activeDialogueNodeId, event.target.value)
                }
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.currentTarget.blur();
                  }
                }}
              />

              <small className="dialogue-help-text">
                Node IDs must be unique. Press Enter or click outside to rename.
              </small>
            </div>

            <div className="settings-field">
              <label>NPC Dialogue Text</label>

              <textarea
                value={activeDialogueNode.text || ""}
                placeholder="What does this NPC say?"
                rows={4}
                onChange={(event) =>
                  updateDialogueNode(activeDialogueNodeId, {
                    text: event.target.value,
                  })
                }
              />
            </div>

            <DialogueActionList
              title="On Enter Actions"
              actions={activeDialogueNode.onEnter}
              allNpcs={allNpcs}
              selectedNpcId={selectedNpcId}
              dialogueNodeIds={dialogueNodeIds}
              onChange={(actions) =>
                updateDialogueNode(activeDialogueNodeId, {
                  onEnter: actions,
                })
              }
            />

            <div className="dialogue-choices-header">
              <span>Player Choices</span>

              <button
                type="button"
                className="dialogue-primary-button"
                onClick={() => addDialogueChoice(activeDialogueNodeId)}
              >
                + Choice
              </button>
            </div>

            {activeDialogueNode.choices.length === 0 ? (
              <div className="dialogue-empty">
                This node has no player choices. The dialogue will end after
                displaying the node unless your runtime provides a continue
                action.
              </div>
            ) : (
              <div className="dialogue-choice-list">
                {activeDialogueNode.choices.map((choice, choiceIndex) => (
                  <div
                    key={choice.id || `${activeDialogueNodeId}_${choiceIndex}`}
                    className="dialogue-choice-card"
                  >
                    <div className="dialogue-choice-header">
                      <span>Choice #{choiceIndex + 1}</span>

                      <div className="dialogue-choice-controls">
                        <button
                          type="button"
                          disabled={choiceIndex === 0}
                          onClick={() =>
                            moveDialogueChoice(
                              activeDialogueNodeId,
                              choiceIndex,
                              "up"
                            )
                          }
                        >
                          ▲
                        </button>

                        <button
                          type="button"
                          disabled={
                            choiceIndex === activeDialogueNode.choices.length - 1
                          }
                          onClick={() =>
                            moveDialogueChoice(
                              activeDialogueNodeId,
                              choiceIndex,
                              "down"
                            )
                          }
                        >
                          ▼
                        </button>

                        <button
                          type="button"
                          className="dialogue-delete-button"
                          onClick={() =>
                            deleteDialogueChoice(activeDialogueNodeId, choiceIndex)
                          }
                        >
                          🗑️
                        </button>
                      </div>
                    </div>

                    <div className="settings-field">
                      <label>Player Response</label>

                      <input
                        type="text"
                        value={choice.text || ""}
                        placeholder="Player response text"
                        onChange={(event) =>
                          updateDialogueChoice(activeDialogueNodeId, choiceIndex, {
                            text: event.target.value,
                          })
                        }
                      />
                    </div>

                    <div className="settings-field">
                      <label>Continue to Node</label>

                      <select
                        value={choice.nextNodeId || ""}
                        onChange={(event) =>
                          updateDialogueChoice(activeDialogueNodeId, choiceIndex, {
                            nextNodeId: event.target.value || null,
                          })
                        }
                      >
                        <option value="">End Dialogue</option>

                        {dialogueNodeIds.map((nodeId) => (
                          <option key={nodeId} value={nodeId}>
                            {nodeId}
                            {nodeId === activeDialogueNodeId ? " (Current)" : ""}
                          </option>
                        ))}
                      </select>
                    </div>

                    <DialogueActionList
                      title="Choice Actions"
                      actions={choice.actions}
                      allNpcs={allNpcs}
                      selectedNpcId={selectedNpcId}
                      dialogueNodeIds={dialogueNodeIds}
                      onChange={(actions) =>
                        updateDialogueChoice(activeDialogueNodeId, choiceIndex, {
                          actions,
                        })
                      }
                    />
                  </div>
                ))}
              </div>
            )}

            <DialogueActionList
              title="On Exit Actions"
              actions={activeDialogueNode.onExit}
              allNpcs={allNpcs}
              selectedNpcId={selectedNpcId}
              dialogueNodeIds={dialogueNodeIds}
              onChange={(actions) =>
                updateDialogueNode(activeDialogueNodeId, {
                  onExit: actions,
                })
              }
            />
          </div>
        )}
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
