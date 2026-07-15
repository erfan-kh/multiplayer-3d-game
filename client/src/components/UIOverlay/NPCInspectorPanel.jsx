// components/UIOverlay/NPCInspectorPanel.jsx
import React, { useEffect, useRef, useState, useId } from "react";

const DEFAULT_DIALOGUE_TEXT = "Hello traveler!";

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

const normalizeDialogueAction = (action) => {
  if (typeof action === "string") {
    return {
      type: action,
      targetId: "",
      value: "",
    };
  }

  if (action && typeof action === "object" && !Array.isArray(action)) {
    const normalizedType =
      typeof action.type === "string" && action.type.trim()
        ? action.type
        : "custom";

    let normalizedValue =
      action.value === null || action.value === undefined
        ? ""
        : action.value;

    if (normalizedType === "summonNpc") {
      if (
        !normalizedValue ||
        typeof normalizedValue !== "object" ||
        Array.isArray(normalizedValue)
      ) {
        normalizedValue = {
          count: 1,
          offset: [1, 0, 1],
          behavior: "idle",
        };
      } else {
        normalizedValue = {
          count:
            typeof normalizedValue.count === "number"
              ? normalizedValue.count
              : 1,
          offset: Array.isArray(normalizedValue.offset)
            ? [
                normalizedValue.offset[0] ?? 1,
                normalizedValue.offset[1] ?? 0,
                normalizedValue.offset[2] ?? 1,
              ]
            : [1, 0, 1],
          behavior:
            typeof normalizedValue.behavior === "string"
              ? normalizedValue.behavior
              : "idle",
        };
      }
    }

    return {
      ...action,
      type: normalizedType,
      targetId:
        action.targetId === null || action.targetId === undefined
          ? ""
          : String(action.targetId),
      value: normalizedValue,
    };
  }

  return {
    type: "custom",
    targetId: "",
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
    };
  }

  return {
    id: createUniqueId(`choice_${index + 1}`),
    text: "",
    nextNodeId: null,
    actions: [],
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

  if (
    !dialogue ||
    typeof dialogue !== "object" ||
    Array.isArray(dialogue)
  ) {
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
    typeof dialogue.startNodeId === "string"
      ? dialogue.startNodeId
      : "root";

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
    onChange(
      normalizedActions.filter((_, actionIndex) => actionIndex !== index)
    );
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
        normalizedActions.map((action, index) => (
          <div
            key={`${title}_${index}`}
            className="dialogue-action-row"
          >
            <div className="dialogue-action-fields">
  <label>
  Action type
  <select
    value={action.type || "custom"}
    onChange={(event) =>
      updateAction(index, {
        type: event.target.value,
      })
    }
  >
    <option value="custom">Custom</option>
    <option value="startQuest">Start Quest</option>
    <option value="completeQuest">Complete Quest</option>
    <option value="setFlag">Set Flag</option>
    <option value="clearFlag">Clear Flag</option>
    <option value="giveItem">Give Item</option>
    <option value="removeItem">Remove Item</option>
    <option value="playSound">Play Sound</option>
    <option value="changeBehavior">Change Behavior</option>
    <option value="teleport">Teleport</option>
    <option value="closeDialogue">Close Dialogue</option>
    <option value="summonNpc">Summon NPC</option>
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
    <option value="">No target</option>
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



              {/* rest of fields stay the same */}
            </div>
          </div>
        ))
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
    selectedNpc?.npcId ||
    selectedNpc?.id ||
    selectedNpc?._id ||
    null;

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
    selectedDialogueNodeId &&
    dialogue.nodes[selectedDialogueNodeId]
      ? selectedDialogueNodeId
      : dialogue.startNodeId;

  const activeDialogueNode =
    dialogue.nodes[activeDialogueNodeId] ||
    dialogue.nodes[dialogueNodeIds[0]];

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
    }));

    updateDialogue({
      ...dialogue,
      nodes: {
        ...dialogue.nodes,
        [newNodeId]: {
          ...sourceNode,
          id: newNodeId,
          text: sourceNode.text
            ? `${sourceNode.text} (Copy)`
            : "",
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
            choice.nextNodeId === oldNodeId
              ? newNodeId
              : choice.nextNodeId,
        })),
      };
    });

    updateDialogue({
      ...dialogue,
      startNodeId:
        dialogue.startNodeId === oldNodeId
          ? newNodeId
          : dialogue.startNodeId,
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

    Object.entries(dialogue.nodes).forEach(
      ([existingNodeId, existingNode]) => {
        if (existingNodeId === nodeId) return;

        remainingNodes[existingNodeId] = {
          ...existingNode,
          choices: existingNode.choices.map((choice) => ({
            ...choice,
            nextNodeId:
              choice.nextNodeId === nodeId
                ? null
                : choice.nextNodeId,
          })),
        };
      }
    );

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
      choices: currentNode.choices.filter(
        (_, index) => index !== choiceIndex
      ),
    });
  };

  const moveDialogueChoice = (nodeId, choiceIndex, direction) => {
    const currentNode = dialogue.nodes[nodeId];

    if (!currentNode) return;

    const targetIndex =
      direction === "up"
        ? choiceIndex - 1
        : choiceIndex + 1;

    if (
      targetIndex < 0 ||
      targetIndex >= currentNode.choices.length
    ) {
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

    if (
      !file.type.match("image/jpeg") &&
      !file.type.match("image/png")
    ) {
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

  const handleNpcBaseStringChange = (
    section,
    field,
    value
  ) => {
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
    const currentReactions =
      selectedNpc.detection?.reactions || {};

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

  const handleWaypointChange = (
    index,
    coordinateIndex,
    value
  ) => {
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

    normalized.waitTime = Math.max(
      0,
      parseFloat(value) || 0
    );

    updatedWaypoints[index] = normalized;

    updateNpc(selectedNpc.id, {
      waypoints: updatedWaypoints,
    });
  };

  const deleteWaypoint = (index) => {
    const updatedWaypoints = waypoints.filter(
      (_, waypointIndex) => waypointIndex !== index
    );

    let newTargetIndex =
      selectedNpc.currentWaypointIndex ?? 0;

    if (updatedWaypoints.length === 0) {
      newTargetIndex = 0;
    } else if (newTargetIndex >= updatedWaypoints.length) {
      newTargetIndex = updatedWaypoints.length - 1;
    } else if (newTargetIndex === index) {
      newTargetIndex = Math.min(
        index,
        updatedWaypoints.length - 1
      );
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
      setSelectedWaypointIndex(
        selectedWaypointIndex - 1
      );
    }
  };

  const moveWaypoint = (index, direction) => {
    if (direction === "up" && index === 0) return;

    if (
      direction === "down" &&
      index === waypoints.length - 1
    ) {
      return;
    }

    const targetIndex =
      direction === "up" ? index - 1 : index + 1;

    const updatedWaypoints = [...waypoints];

    const temporaryWaypoint = updatedWaypoints[index];
    updatedWaypoints[index] = updatedWaypoints[targetIndex];
    updatedWaypoints[targetIndex] = temporaryWaypoint;

    let newTargetIndex =
      selectedNpc.currentWaypointIndex ?? 0;

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

    updatedWaypoints.splice(
      index + 1,
      0,
      newWaypoint
    );

    let newTargetIndex =
      selectedNpc.currentWaypointIndex ?? 0;

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

  const movementMode =
    selectedNpc.movement?.mode || "idle";

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
          <label>
            NPC Face/Sprite Texture (JPEG/PNG)
          </label>

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
              onClick={() =>
                fileInputRef.current?.click()
              }
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
              {selectedNpc.textureUrl
                ? "🔄 Change Texture"
                : "📤 Upload Texture"}
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

        <div
          className="section-title"
          style={{ marginTop: "5px" }}
        >
          Movement
        </div>

        <div className="settings-field">
          <label>Movement Mode</label>

          <select
            value={movementMode}
            onChange={(event) =>
              handleNpcBaseStringChange(
                "movement",
                "mode",
                event.target.value
              )
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
              handleNpcBaseChange(
                "movement",
                "speed",
                event.target.value
              )
            }
          />
        </div>

        <div className="settings-field">
          <label>
            Wait Time at Nodes / Wander Pause (sec)
          </label>

          <input
            type="number"
            step="0.5"
            min="0"
            value={selectedNpc.movement?.waitTime ?? 0}
            onChange={(event) =>
              handleNpcBaseChange(
                "movement",
                "waitTime",
                event.target.value
              )
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
              handleNpcBaseChange(
                "detection",
                "radius",
                event.target.value
              )
            }
          />
        </div>

        <div
          className="section-title"
          style={{ marginTop: "5px" }}
        >
          Detection & AI Reactions
        </div>

        <div className="settings-field">
          <label>Default Detection Target</label>

          <select
            value={
              selectedNpc.detection?.targetType || "both"
            }
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
            <option value="both">
              Player + NPCs (Closest)
            </option>
          </select>
        </div>

        <div className="settings-field">
          <label>Default Reaction Behavior</label>

          <select
            value={
              selectedNpc.detection?.behavior || "look"
            }
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
            <option value="flee">
              Flee From Target
            </option>
            <option value="ignore">
              Ignore (Keep Moving)
            </option>
          </select>
        </div>

        <div
          className="section-title"
          style={{ marginTop: "5px" }}
        >
          Relationship & Reaction Targets
        </div>

        <div className="settings-field">
          <label>Player Reaction</label>

          <select
            value={
              selectedNpc.detection?.reactions?.player ||
              "default"
            }
            onChange={(event) =>
              handleReactionChange(
                "player",
                event.target.value
              )
            }
          >
            <option value="default">
              Default (
              {selectedNpc.detection?.behavior || "look"})
            </option>
            <option value="look">Look</option>
            <option value="chase">Chase</option>
            <option value="flee">Flee</option>
            <option value="ignore">Ignore</option>
          </select>
        </div>

        {allNpcs
          .filter((npc) => {
            const npcId =
              npc.npcId || npc.id || npc._id;

            return npcId && npcId !== selectedNpcId;
          })
          .map((npc) => {
            const npcId =
              npc.npcId || npc.id || npc._id;

            return (
              <div
                key={npcId}
                className="settings-field"
              >
                <label>
                  vs {npc.name || `NPC ${npcId}`}
                </label>

                <select
                  value={
                    selectedNpc.detection?.reactions?.[
                      npcId
                    ] || "default"
                  }
                  onChange={(event) =>
                    handleReactionChange(
                      npcId,
                      event.target.value
                    )
                  }
                >
                  <option value="default">
                    Default (
                    {selectedNpc.detection?.behavior ||
                      "look"}
                    )
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
          selectedNpc.detection?.behavior ===
            "attack") && (
          <div className="settings-field">
            <label>Chase Stop Distance</label>

            <input
              type="number"
              step="0.1"
              min="0"
              value={
                selectedNpc.detection?.stopDistance ?? 0.8
              }
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
              checked={
                selectedNpc.detection?.debug ?? false
              }
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
            <option value="loop">
              Loop (0 - 1 - 2 - 0)
            </option>
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
                  isPatrolling: !(
                    selectedNpc.isPatrolling ?? true
                  ),
                })
              }
              style={{
                width: "100%",
                padding: "8px",
                backgroundColor:
                  selectedNpc.isPatrolling ?? true
                    ? "#f59e0b"
                    : "#3b82f6",
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
          <div className="section-title">
            Patrol Waypoints
          </div>

          <div className="waypoint-actions-header">
            <button
              type="button"
              className={`btn-action ${
                placingWaypointForNpcId === selectedNpc.id
                  ? "active"
                  : ""
              }`}
              onClick={() =>
                setPlacingWaypointForNpcId(
                  placingWaypointForNpcId ===
                    selectedNpc.id
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
                No waypoints defined. Click the map to
                place waypoints.
              </div>
            ) : (
              waypoints.map((waypoint, index) => {
                const isSelected =
                  selectedWaypointIndex === index;

                const isCurrentTarget =
                  selectedNpc.currentWaypointIndex ===
                  index;

                const waypointPosition =
                  getWaypointPos(waypoint);

                const xValue =
                  waypointPosition[0] ?? 0;

                const yValue =
                  waypointPosition[1] ?? 0;

                const zValue =
                  waypointPosition[2] ?? 0;

                const waitTimeValue =
                  getWaypointWaitTime(
                    waypoint,
                    selectedNpc.movement?.waitTime ?? 0
                  );

                return (
                  <div
                    key={index}
                    className={`waypoint-item ${
                      isSelected ? "selected" : ""
                    } ${
                      isCurrentTarget
                        ? "current-target"
                        : ""
                    }`}
                    onClick={() =>
                      setSelectedWaypointIndex(index)
                    }
                  >
                    <div className="waypoint-header">
                      <span className="waypoint-number">
                        #{index + 1}
                      </span>

                      {isCurrentTarget && (
                        <span className="target-badge">
                          Target
                        </span>
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
                          disabled={
                            index ===
                            waypoints.length - 1
                          }
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
                        onClick={(event) =>
                          event.stopPropagation()
                        }
                      >
                        <div className="waypoint-coordinates">
                          <div className="coord-input-group">
                            <label>X</label>

                            <input
                              type="number"
                              step="0.1"
                              value={Number(
                                xValue
                              ).toFixed(2)}
                              onChange={(event) =>
                                handleWaypointChange(
                                  index,
                                  0,
                                  event.target.value
                                )
                              }
                            />
                          </div>

                          <div className="coord-input-group">
                            <label>Y (Height)</label>

                            <input
                              type="number"
                              step="0.1"
                              value={Number(
                                yValue
                              ).toFixed(2)}
                              onChange={(event) =>
                                handleWaypointChange(
                                  index,
                                  1,
                                  event.target.value
                                )
                              }
                            />
                          </div>

                          <div className="coord-input-group">
                            <label>Z</label>

                            <input
                              type="number"
                              step="0.1"
                              value={Number(
                                zValue
                              ).toFixed(2)}
                              onChange={(event) =>
                                handleWaypointChange(
                                  index,
                                  2,
                                  event.target.value
                                )
                              }
                            />
                          </div>
                        </div>

                        <div className="settings-field waypoint-wait-field">
                          <label>
                            Wait Time at this Node (sec)
                          </label>

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

      <div className="section-title">
        Dialogue Tree
      </div>

      <div className="dialogue-editor">
        <div className="dialogue-toolbar">
          <div className="settings-field dialogue-node-selector">
            <label>Selected Node</label>

            <select
              value={activeDialogueNodeId}
              onChange={(event) =>
                setSelectedDialogueNodeId(
                  event.target.value
                )
              }
            >
              {dialogueNodeIds.map((nodeId) => (
                <option key={nodeId} value={nodeId}>
                  {nodeId}
                  {dialogue.startNodeId === nodeId
                    ? " (Start)"
                    : ""}
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
                Node:{" "}
                <strong>{activeDialogueNodeId}</strong>
              </span>

              {dialogue.startNodeId ===
                activeDialogueNodeId && (
                <span className="dialogue-start-badge">
                  Start Node
                </span>
              )}
            </div>

            <div className="dialogue-node-buttons">
              <button
                type="button"
                onClick={() =>
                  setDialogueStartNode(
                    activeDialogueNodeId
                  )
                }
                disabled={
                  dialogue.startNodeId ===
                  activeDialogueNodeId
                }
              >
                🏁 Set as Start
              </button>

              <button
                type="button"
                onClick={() =>
                  duplicateDialogueNode(
                    activeDialogueNodeId
                  )
                }
              >
                📋 Duplicate
              </button>

              <button
                type="button"
                className="dialogue-danger-button"
                onClick={() =>
                  deleteDialogueNode(
                    activeDialogueNodeId
                  )
                }
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
                  renameDialogueNode(
                    activeDialogueNodeId,
                    event.target.value
                  )
                }
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.currentTarget.blur();
                  }
                }}
              />

              <small className="dialogue-help-text">
                Node IDs must be unique. Press Enter or
                click outside to rename.
              </small>
            </div>

            <div className="settings-field">
              <label>NPC Dialogue Text</label>

              <textarea
                value={activeDialogueNode.text || ""}
                placeholder="What does this NPC say?"
                rows={4}
                onChange={(event) =>
                  updateDialogueNode(
                    activeDialogueNodeId,
                    {
                      text: event.target.value,
                    }
                  )
                }
              />
            </div>

            <DialogueActionList
  title="On Enter Actions"
  actions={activeDialogueNode.onEnter}
  allNpcs={allNpcs}
  selectedNpcId={selectedNpcId}
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
                onClick={() =>
                  addDialogueChoice(
                    activeDialogueNodeId
                  )
                }
              >
                + Choice
              </button>
            </div>

            {activeDialogueNode.choices.length === 0 ? (
              <div className="dialogue-empty">
                This node has no player choices. The
                dialogue will end after displaying the
                node unless your runtime provides a
                continue action.
              </div>
            ) : (
              <div className="dialogue-choice-list">
                {activeDialogueNode.choices.map(
                  (choice, choiceIndex) => (
                    <div
                      key={
                        choice.id ||
                        `${activeDialogueNodeId}_${choiceIndex}`
                      }
                      className="dialogue-choice-card"
                    >
                      <div className="dialogue-choice-header">
                        <span>
                          Choice #{choiceIndex + 1}
                        </span>

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
                              choiceIndex ===
                              activeDialogueNode.choices
                                .length -
                                1
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
                              deleteDialogueChoice(
                                activeDialogueNodeId,
                                choiceIndex
                              )
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
                            updateDialogueChoice(
                              activeDialogueNodeId,
                              choiceIndex,
                              {
                                text: event.target.value,
                              }
                            )
                          }
                        />
                      </div>

                      <div className="settings-field">
                        <label>
                          Continue to Node
                        </label>

                        <select
                          value={
                            choice.nextNodeId || ""
                          }
                          onChange={(event) =>
                            updateDialogueChoice(
                              activeDialogueNodeId,
                              choiceIndex,
                              {
                                nextNodeId:
                                  event.target.value ||
                                  null,
                              }
                            )
                          }
                        >
                          <option value="">
                            End Dialogue
                          </option>

                          {dialogueNodeIds.map(
                            (nodeId) => (
                              <option
                                key={nodeId}
                                value={nodeId}
                              >
                                {nodeId}
                                {nodeId ===
                                activeDialogueNodeId
                                  ? " (Current)"
                                  : ""}
                              </option>
                            )
                          )}
                        </select>
                      </div>

                     <DialogueActionList
  title="Choice Actions"
  actions={choice.actions}
  allNpcs={allNpcs}
  selectedNpcId={selectedNpcId}
  onChange={(actions) =>
    updateDialogueChoice(activeDialogueNodeId, choiceIndex, {
      actions,
    })
  }
/>

                    </div>
                  )
                )}
              </div>
            )}

            <DialogueActionList
  title="On Exit Actions"
  actions={activeDialogueNode.onExit}
  allNpcs={allNpcs}
  selectedNpcId={selectedNpcId}
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

