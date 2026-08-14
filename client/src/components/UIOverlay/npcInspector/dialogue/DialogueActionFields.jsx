import React, { useState, useRef } from "react";

import {
  TARGET_SCOPE_OPTIONS,
  WAYPOINT_DIALOGUE_TRIGGER_OPTIONS,
  TEMP_DIALOGUE_ENTITY_TARGET_OPTIONS
} from "./dialogueConstants";

import { getDefaultActionValue, getObjectActionValue } from "./dialogueUtils";
import { normalizeWaypoint } from "../waypoints/waypointUtils";

const ENTITY_TARGET_TYPE_OPTIONS = [
  { value: "owner", label: "Owner / Main NPC" },
  { value: "player", label: "Player" },
  { value: "specificNpc", label: "Specific NPC" },
];

const DEFAULT_DIALOGUE_SEQUENCE_ENTRY = () => ({
  id: `sequence_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
  talkerName: "",
  dialogueNodeId: "",
});

export default function DialogueActionFields({
  action,
  index,
  dialogueNodeIds,
  updateAction,
  updateActionValue,
  allNpcs,
}) {
  const [showSummonTempDialogue, setShowSummonTempDialogue] = useState(false);
  const [showDialogueSequence, setShowDialogueSequence] = useState(true);
  const textureWhileInRadiusFileInputRef = useRef(null);

  // Helper to isolate key events from propagating to player controls
  const handleInputKeyDown = (e) => {
    e.stopPropagation();
  };

  const defaultValue = getDefaultActionValue(action.type);
  const objectValue =
    typeof defaultValue === "object" &&
    defaultValue !== null &&
    !Array.isArray(defaultValue)
      ? getObjectActionValue(action, defaultValue)
      : null;

  const rawSetNpcWaypointsValue =
    action.type === "setNpcWaypoints"
      ? objectValue
      : getObjectActionValue(action, {
          target: "main",
          mode: "append",
          priority: true,
          resumePatrol: true,
          clearOnComplete: true,
          clearOnPlayerDistance: false,
          maxPlayerDistance: 12,
          distanceTimeoutMs: 3000,
          waypoints: [],
        });

  const setNpcWaypointsValue = {
    ...rawSetNpcWaypointsValue,
    mode:
      rawSetNpcWaypointsValue?.mode ||
      (rawSetNpcWaypointsValue?.replaceExisting === false
        ? "append"
        : "replace"),
    priority: rawSetNpcWaypointsValue?.priority ?? true,
    resumePatrol: rawSetNpcWaypointsValue?.resumePatrol ?? true,
    clearOnComplete: rawSetNpcWaypointsValue?.clearOnComplete ?? true,
    clearOnPlayerDistance:
      rawSetNpcWaypointsValue?.clearOnPlayerDistance ?? false,
    maxPlayerDistance: rawSetNpcWaypointsValue?.maxPlayerDistance ?? 12,
    distanceTimeoutMs: rawSetNpcWaypointsValue?.distanceTimeoutMs ?? 3000,
    waypoints: Array.isArray(rawSetNpcWaypointsValue?.waypoints)
      ? rawSetNpcWaypointsValue.waypoints
      : [],
  };

  const waypointWaitValue =
    action.type === "setNpcWaypointWaitTime"
      ? objectValue
      : getObjectActionValue(action, {
          target: "main",
          waypointIndex: 0,
          waitTime: 0,
        });

  const waypointDialogueValue =
    action.type === "setNpcWaypointDialogue"
      ? objectValue
      : getObjectActionValue(action, {
          target: "main",
          waypointIndex: 0,
          dialogueNodeId: "",
          trigger: "onReach",
        });

  const resetEventValue =
    action.type === "resetNpcEventSequence"
      ? objectValue
      : getObjectActionValue(action, {
          target: "all",
          maxPlayerDistance: 12,
          timeoutMs: 3000,
          clearDialogueFlags: true,
          despawnClones: true,
          resumePatrol: true,
        });

  const despawnValue =
    action.type === "despawnOwnedClones"
      ? objectValue
      : getObjectActionValue(action, { target: "all" });

  const rawSummonValue =
    action.type === "summonNpc"
      ? objectValue
      : getObjectActionValue(action, {
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
          temporaryDialogue: "",
          priorityDialogue: false,
          clearTemporaryDialogueAfterFirstUse: true,
          playerChoices: [],
          temporaryPlayerChoices: [],
        });

  const normalizedSummonChoices = Array.isArray(rawSummonValue?.playerChoices)
    ? rawSummonValue.playerChoices
    : Array.isArray(rawSummonValue?.temporaryPlayerChoices)
      ? rawSummonValue.temporaryPlayerChoices
      : [];

  const summonValue = {
    ...rawSummonValue,
    count: rawSummonValue?.count ?? 1,
    behavior: rawSummonValue?.behavior || "idle",
    offset: Array.isArray(rawSummonValue?.offset)
      ? rawSummonValue.offset
      : [1, 0, 1],
    spawnTargetType:
      rawSummonValue?.spawnTargetType ||
      (rawSummonValue?.spawnNearOwner === false ? "player" : "owner"),
    spawnTargetNpcId: rawSummonValue?.spawnTargetNpcId ?? null,
    behaviorTargetType: rawSummonValue?.behaviorTargetType || "owner",
    behaviorTargetNpcId: rawSummonValue?.behaviorTargetNpcId ?? null,
    inheritOwnerWaypoints: rawSummonValue?.inheritOwnerWaypoints ?? true,
    replaceExistingOwnedClones:
      rawSummonValue?.replaceExistingOwnedClones ?? true,
    hasTemporaryDialogue: rawSummonValue?.hasTemporaryDialogue ?? false,
    temporaryDialogueText:
      rawSummonValue?.temporaryDialogueText ??
      rawSummonValue?.temporaryDialogue ??
      "",
    temporaryDialogue:
      rawSummonValue?.temporaryDialogue ??
      rawSummonValue?.temporaryDialogueText ??
      "",
    priorityDialogue: rawSummonValue?.priorityDialogue ?? false,
    clearTemporaryDialogueAfterFirstUse:
      rawSummonValue?.clearTemporaryDialogueAfterFirstUse ?? true,
    playerChoices: normalizedSummonChoices,
    temporaryPlayerChoices: normalizedSummonChoices,
  };

  const rawTempDialogueValue =
    action.type === "setTemporaryDialogue"
      ? objectValue
      : getObjectActionValue(action, {
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
        });

  const tempDialogueValue = {
    ...rawTempDialogueValue,
    target: rawTempDialogueValue?.target || "main",
    temporaryDialogue: rawTempDialogueValue?.temporaryDialogue || "",
    priorityDialogue: rawTempDialogueValue?.priorityDialogue ?? true,
    clearDistance: rawTempDialogueValue?.clearDistance ?? 12,
    clearDelay: rawTempDialogueValue?.clearDelay ?? 3000,
    clearTemporaryDialogueAfterFirstUse:
      rawTempDialogueValue?.clearTemporaryDialogueAfterFirstUse ?? false,
    speakerTargetType: rawTempDialogueValue?.speakerTargetType || "owner",
    speakerTargetNpcId: rawTempDialogueValue?.speakerTargetNpcId ?? null,
    responseTargetType: rawTempDialogueValue?.responseTargetType || "owner",
    responseTargetNpcId: rawTempDialogueValue?.responseTargetNpcId ?? null,
  };


  const rawTextureWhileInRadiusValue =
    action.type === "setNpcTextureWhileInRadius"
      ? objectValue
      : getObjectActionValue(action, {
          textureUrl: "",
        });

  const textureWhileInRadiusValue = {
    ...rawTextureWhileInRadiusValue,
    textureUrl: rawTextureWhileInRadiusValue?.textureUrl || "",
  };
  const rawDialogueSequenceValue =
    action.type === "setDialogueSequence"
      ? objectValue
      : getObjectActionValue(action, {
          target: "main",
          sequence: [],
          talkerNames: [],
          speakerData: [],
          nodes: [],
          clearExistingSequence: false,
          useMainNpcOnly: true,
        });

  const dialogueSequenceValue = {
    ...rawDialogueSequenceValue,
    target: rawDialogueSequenceValue?.target || "main",
    sequence: Array.isArray(rawDialogueSequenceValue?.sequence)
      ? rawDialogueSequenceValue.sequence
      : [],
    talkerNames: Array.isArray(rawDialogueSequenceValue?.talkerNames)
      ? rawDialogueSequenceValue.talkerNames
      : [],
    speakerData: Array.isArray(rawDialogueSequenceValue?.speakerData)
      ? rawDialogueSequenceValue.speakerData
      : [],
    nodes: Array.isArray(rawDialogueSequenceValue?.nodes)
      ? rawDialogueSequenceValue.nodes
      : [],
    clearExistingSequence:
      rawDialogueSequenceValue?.clearExistingSequence ?? false,
    useMainNpcOnly: rawDialogueSequenceValue?.useMainNpcOnly ?? true,
  };

  const npcOptions = Array.isArray(allNpcs)
    ? allNpcs
        .map((npc) => ({
          id: npc?.npcId || npc?.id || npc?._id,
          label: npc?.name || `NPC ${npc?.npcId || npc?.id}`,
        }))
        .filter((n) => n.id)
    : [];

  const updateActionWaypoint = (actionIndex, waypointIndex, patch) => {
    const currentWaypoints = Array.isArray(setNpcWaypointsValue.waypoints)
      ? setNpcWaypointsValue.waypoints
      : [];

    const updatedWaypoints = currentWaypoints.map((waypoint, idx) =>
      idx === waypointIndex
        ? {
            ...normalizeWaypoint(waypoint, 0),
            ...patch,
          }
        : normalizeWaypoint(waypoint, 0)
    );

    updateActionValue(actionIndex, {
      waypoints: updatedWaypoints,
    });
  };

  const addActionWaypoint = () => {
    const currentWaypoints = Array.isArray(setNpcWaypointsValue.waypoints)
      ? setNpcWaypointsValue.waypoints
      : [];

    updateActionValue(index, {
      waypoints: [
        ...currentWaypoints,
        normalizeWaypoint(
          {
            pos: [0, 0, 0],
            waitTime: 0,
            dialogueNodeId: "",
            trigger: "onReach",
          },
          0
        ),
      ],
    });
  };

  const removeActionWaypoint = (waypointIndex) => {
    const currentWaypoints = Array.isArray(setNpcWaypointsValue.waypoints)
      ? setNpcWaypointsValue.waypoints
      : [];

    updateActionValue(index, {
      waypoints: currentWaypoints.filter((_, idx) => idx !== waypointIndex),
    });
  };

  const updateSummonDialogueText = (value) => {
    updateActionValue(index, {
      temporaryDialogueText: value,
      temporaryDialogue: value,
    });
  };

  const updateSummonPlayerChoices = (choices) => {
    updateActionValue(index, {
      playerChoices: choices,
      temporaryPlayerChoices: choices,
    });
  };

  const updateSummonPlayerChoice = (choiceIndex, key, val) => {
    const updatedChoices = summonValue.playerChoices.map((choice, idx) => {
      if (idx === choiceIndex) {
        return { ...choice, [key]: val };
      }
      return choice;
    });

    updateSummonPlayerChoices(updatedChoices);
  };

  const addSummonPlayerChoice = () => {
    const nextChoices = [
      ...summonValue.playerChoices,
      {
        id: `choice_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
        text: "Next choice option",
        nextNodeId: "",
        actions: [],
      },
    ];

    updateSummonPlayerChoices(nextChoices);
  };

  const removeSummonPlayerChoice = (choiceIndex) => {
    const nextChoices = summonValue.playerChoices.filter(
      (_, idx) => idx !== choiceIndex
    );

    updateSummonPlayerChoices(nextChoices);
  };

  const updateDialogueSequence = (sequence) => {
    const normalizedSequence = Array.isArray(sequence)
      ? sequence.map((entry) => ({
          id:
            entry?.id ||
            `sequence_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
          talkerName: entry?.talkerName || "",
          dialogueNodeId: entry?.dialogueNodeId || "",
        }))
      : [];

    updateActionValue(index, {
      sequence: normalizedSequence,
      talkerNames: normalizedSequence.map((entry) => entry.talkerName),
      speakerData: normalizedSequence.map((entry, seqIdx) => ({
        id: entry.id,
        talkerName: entry.talkerName,
        dialogueNodeId: entry.dialogueNodeId,
        sequenceIndex: seqIdx,
        isMainNpcOnly: true,
      })),
      nodes: normalizedSequence.map((entry) => entry.dialogueNodeId),
      target: "main",
      useMainNpcOnly: true,
    });
  };

  const addDialogueSequenceEntry = () => {
    updateDialogueSequence([
      ...dialogueSequenceValue.sequence,
      DEFAULT_DIALOGUE_SEQUENCE_ENTRY(),
    ]);
  };

  const updateDialogueSequenceEntry = (entryIndex, key, value) => {
    const nextSequence = dialogueSequenceValue.sequence.map((entry, idx) =>
      idx === entryIndex ? { ...entry, [key]: value } : entry
    );
    updateDialogueSequence(nextSequence);
  };

  const removeDialogueSequenceEntry = (entryIndex) => {
    const nextSequence = dialogueSequenceValue.sequence.filter(
      (_, idx) => idx !== entryIndex
    );
    updateDialogueSequence(nextSequence);
  };

  if (action.type === "setFlag" || action.type === "clearFlag") {
    return (
      <label>
        Flag Key
        <input
          type="text"
          value={action.value ?? ""}
          onChange={(event) =>
            updateAction(index, {
              value: event.target.value,
            })
          }
          onKeyDown={handleInputKeyDown}
        />
      </label>
    );
  }

  if (action.type === "setDialogueSequence") {
    return (
      <>
        <label>
          Assignment Target
          <select
            value={dialogueSequenceValue.target || "main"}
            onChange={(event) =>
              updateActionValue(index, {
                target: event.target.value,
                useMainNpcOnly: event.target.value === "main",
              })
            }
            onKeyDown={handleInputKeyDown}
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
            checked={dialogueSequenceValue.useMainNpcOnly ?? true}
            onChange={(event) =>
              updateActionValue(index, {
                useMainNpcOnly: event.target.checked,
                target: event.target.checked ? "main" : dialogueSequenceValue.target || "main",
              })
            }
            onKeyDown={handleInputKeyDown}
          />
          Main NPC only - sequence data stays on the authored NPC
        </label>

        <label className="checkbox-label compact-checkbox-label">
          <input
            type="checkbox"
            checked={dialogueSequenceValue.clearExistingSequence ?? false}
            onChange={(event) =>
              updateActionValue(index, {
                clearExistingSequence: event.target.checked,
              })
            }
            onKeyDown={handleInputKeyDown}
          />
          Clear existing sequence before applying this one
        </label>

        <div className="dialogue-waypoint-block">
          <div className="dialogue-waypoint-block-header">
            <span>Dialogue Speakers Sequence</span>

            <button
              type="button"
              className="dialogue-small-button"
              onClick={addDialogueSequenceEntry}
            >
              + Speaker
            </button>
          </div>

          {dialogueSequenceValue.sequence.length === 0 ? (
            <div className="dialogue-empty-small">
              No speakers configured. Add talker #1, talker #2, talker #3, and so on.
            </div>
          ) : (
            dialogueSequenceValue.sequence.map((entry, entryIndex) => (
              <div
                key={entry.id || `sequence_${entryIndex}`}
                className="dialogue-waypoint-editor"
              >
                <div className="dialogue-waypoint-editor-header">
                  <span>Talker #{entryIndex + 1}</span>

                  <button
                    type="button"
                    className="dialogue-delete-button"
                    onClick={() => removeDialogueSequenceEntry(entryIndex)}
                  >
                    ًں—‘ï¸ڈ
                  </button>
                </div>

                <label>
                  Talker Name
                  <input
                    type="text"
                    value={entry.talkerName || ""}
                    onChange={(event) =>
                      updateDialogueSequenceEntry(
                        entryIndex,
                        "talkerName",
                        event.target.value
                      )
                    }
                    onKeyDown={handleInputKeyDown}
                    placeholder={`Talker #${entryIndex + 1}`}
                  />
                </label>

                <label>
                  Dialogue Node
                  <select
                    value={entry.dialogueNodeId || ""}
                    onChange={(event) =>
                      updateDialogueSequenceEntry(
                        entryIndex,
                        "dialogueNodeId",
                        event.target.value
                      )
                    }
                    onKeyDown={handleInputKeyDown}
                  >
                    <option value="">Select dialogue node</option>
                    {dialogueNodeIds.map((nodeId) => (
                      <option key={nodeId} value={nodeId}>
                        {nodeId}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            ))
          )}
        </div>

        <div className="dialogue-inline-note" style={{ marginTop: "8px" }}>
          This sequence is authored on the main NPC only and should not be owned or propagated by summoned/clone NPCs.
        </div>
      </>
    );
  }

  if (action.type === "setNpcWaypoints") {
    const waypoints = Array.isArray(setNpcWaypointsValue.waypoints)
      ? setNpcWaypointsValue.waypoints
      : [];

    return (
      <>
        <label>
          Target Scope
          <select
            value={setNpcWaypointsValue.target || "main"}
            onChange={(event) =>
              updateActionValue(index, {
                target: event.target.value,
              })
            }
            onKeyDown={handleInputKeyDown}
          >
            {TARGET_SCOPE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <label>
          Route Mode
          <select
            value={setNpcWaypointsValue.mode || "append"}
            onChange={(event) =>
              updateActionValue(index, {
                mode: event.target.value,
                replaceExisting: event.target.value === "replace",
              })
            }
            onKeyDown={handleInputKeyDown}
          >
            <option value="append">Append temporary route</option>
            <option value="replace">Replace current route</option>
          </select>
        </label>

        <label className="checkbox-label compact-checkbox-label">
          <input
            type="checkbox"
            checked={setNpcWaypointsValue.priority ?? true}
            onChange={(event) =>
              updateActionValue(index, {
                priority: event.target.checked,
              })
            }
            onKeyDown={handleInputKeyDown}
          />
          Use temporary route as priority immediately
        </label>

        <label className="checkbox-label compact-checkbox-label">
          <input
            type="checkbox"
            checked={setNpcWaypointsValue.clearOnComplete ?? true}
            onChange={(event) =>
              updateActionValue(index, {
                clearOnComplete: event.target.checked,
              })
            }
            onKeyDown={handleInputKeyDown}
          />
          Remove temporary route after final waypoint is reached
        </label>

        <label className="checkbox-label compact-checkbox-label">
          <input
            type="checkbox"
            checked={setNpcWaypointsValue.clearOnPlayerDistance ?? false}
            onChange={(event) =>
              updateActionValue(index, {
                clearOnPlayerDistance: event.target.checked,
              })
            }
            onKeyDown={handleInputKeyDown}
          />
          Remove temporary route if player gets too far away
        </label>

        <label>
          Max Player Distance
          <input
            type="number"
            min="0"
            step="0.5"
            value={setNpcWaypointsValue.maxPlayerDistance ?? 12}
            onChange={(event) =>
              updateActionValue(index, {
                maxPlayerDistance: Math.max(
                  0,
                  parseFloat(event.target.value) || 0
                ),
              })
            }
            onKeyDown={handleInputKeyDown}
          />
        </label>

        <label>
          Distance Timeout (ms)
          <input
            type="number"
            min="0"
            step="100"
            value={setNpcWaypointsValue.distanceTimeoutMs ?? 3000}
            onChange={(event) =>
              updateActionValue(index, {
                distanceTimeoutMs: Math.max(
                  0,
                  parseInt(event.target.value, 10) || 0
                ),
              })
            }
            onKeyDown={handleInputKeyDown}
          />
        </label>

        <label className="checkbox-label compact-checkbox-label">
          <input
            type="checkbox"
            checked={setNpcWaypointsValue.resumePatrol ?? true}
            onChange={(event) =>
              updateActionValue(index, {
                resumePatrol: event.target.checked,
              })
            }
            onKeyDown={handleInputKeyDown}
          />
          Resume base patrol after temporary route is cleared
        </label>

        <div className="dialogue-waypoint-block">
          <div className="dialogue-waypoint-block-header">
            <span>Waypoints</span>

            <button
              type="button"
              className="dialogue-small-button"
              onClick={addActionWaypoint}
            >
              + Waypoint
            </button>
          </div>

          {waypoints.length === 0 ? (
            <div className="dialogue-empty-small">
              No waypoints configured for this action.
            </div>
          ) : (
            waypoints.map((waypoint, waypointIndex) => {
              const normalizedWaypoint = normalizeWaypoint(waypoint, 0);
              const x = normalizedWaypoint.pos[0] ?? 0;
              const y = normalizedWaypoint.pos[1] ?? 0;
              const z = normalizedWaypoint.pos[2] ?? 0;

              return (
                <div
                  key={`action_waypoint_${waypointIndex}`}
                  className="dialogue-waypoint-editor"
                >
                  <div className="dialogue-waypoint-editor-header">
                    <span>Waypoint #{waypointIndex + 1}</span>

                    <button
                      type="button"
                      className="dialogue-delete-button"
                      onClick={() => removeActionWaypoint(waypointIndex)}
                    >
                      ًں—‘ï¸ڈ
                    </button>
                  </div>

                  <div className="dialogue-waypoint-grid">
                    <label>
                      X
                      <input
                        type="number"
                        step="0.1"
                        value={x}
                        onChange={(event) =>
                          updateActionWaypoint(index, waypointIndex, {
                            pos: [
                              parseFloat(event.target.value) || 0,
                              normalizedWaypoint.pos[1] ?? 0,
                              normalizedWaypoint.pos[2] ?? 0,
                            ],
                          })
                        }
                        onKeyDown={handleInputKeyDown}
                      />
                    </label>

                    <label>
                      Y
                      <input
                        type="number"
                        step="0.1"
                        value={y}
                        onChange={(event) =>
                          updateActionWaypoint(index, waypointIndex, {
                            pos: [
                              normalizedWaypoint.pos[0] ?? 0,
                              parseFloat(event.target.value) || 0,
                              normalizedWaypoint.pos[2] ?? 0,
                            ],
                          })
                        }
                        onKeyDown={handleInputKeyDown}
                      />
                    </label>

                    <label>
                      Z
                      <input
                        type="number"
                        step="0.1"
                        value={z}
                        onChange={(event) =>
                          updateActionWaypoint(index, waypointIndex, {
                            pos: [
                              normalizedWaypoint.pos[0] ?? 0,
                              normalizedWaypoint.pos[1] ?? 0,
                              parseFloat(event.target.value) || 0,
                            ],
                          })
                        }
                        onKeyDown={handleInputKeyDown}
                      />
                    </label>

                    <label>
                      Wait Time
                      <input
                        type="number"
                        min="0"
                        step="0.5"
                        value={normalizedWaypoint.waitTime ?? 0}
                        onChange={(event) =>
                          updateActionWaypoint(index, waypointIndex, {
                            waitTime: Math.max(
                              0,
                              parseFloat(event.target.value) || 0
                            ),
                          })
                        }
                        onKeyDown={handleInputKeyDown}
                      />
                    </label>
                  </div>

                  <label>
                    Dialogue Node at Waypoint (optional)
                    <select
                      value={normalizedWaypoint.dialogueNodeId || ""}
                      onChange={(event) =>
                        updateActionWaypoint(index, waypointIndex, {
                          dialogueNodeId: event.target.value,
                        })
                      }
                      onKeyDown={handleInputKeyDown}
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
                      value={normalizedWaypoint.trigger || "onReach"}
                      onChange={(event) =>
                        updateActionWaypoint(index, waypointIndex, {
                          trigger: event.target.value,
                        })
                      }
                      onKeyDown={handleInputKeyDown}
                    >
                      {WAYPOINT_DIALOGUE_TRIGGER_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
              );
            })
          )}
        </div>
      </>
    );
  }

  if (action.type === "setNpcWaypointWaitTime") {
    return (
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
            onKeyDown={handleInputKeyDown}
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
                  Math.max(0, parseInt(event.target.value, 10) || 0) || 0,
              })
            }
            onKeyDown={handleInputKeyDown}
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
                waitTime: Math.max(0, parseFloat(event.target.value) || 0),
              })
            }
            onKeyDown={handleInputKeyDown}
          />
        </label>
      </>
    );
  }

  if (action.type === "setNpcWaypointDialogue") {
    return (
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
            onKeyDown={handleInputKeyDown}
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
                  Math.max(0, parseInt(event.target.value, 10) || 0) || 0,
              })
            }
            onKeyDown={handleInputKeyDown}
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
            onKeyDown={handleInputKeyDown}
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
            onKeyDown={handleInputKeyDown}
          >
            {WAYPOINT_DIALOGUE_TRIGGER_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      </>
    );
  }

  if (action.type === "resetNpcEventSequence") {
    return (
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
            onKeyDown={handleInputKeyDown}
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
            onKeyDown={handleInputKeyDown}
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
                timeoutMs: Math.max(0, parseInt(event.target.value, 10) || 0),
              })
            }
            onKeyDown={handleInputKeyDown}
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
            onKeyDown={handleInputKeyDown}
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
            onKeyDown={handleInputKeyDown}
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
            onKeyDown={handleInputKeyDown}
          />
          Resume previous patrol/route
        </label>
      </>
    );
  }

  if (action.type === "despawnOwnedClones") {
    return (
      <label>
        Clone Cleanup Scope
        <select
          value={despawnValue.target || "all"}
          onChange={(event) =>
            updateActionValue(index, {
              target: event.target.value,
            })
          }
          onKeyDown={handleInputKeyDown}
        >
          <option value="all">All owned clones</option>
          <option value="clones">Summoned clones only</option>
        </select>
      </label>
    );
  }

  if (action.type === "summonNpc") {
    const showBehaviorTarget =
      summonValue.behavior === "follow" || summonValue.behavior === "chase";

    return (
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
                count: Math.max(1, parseInt(event.target.value, 10) || 1),
              })
            }
            onKeyDown={handleInputKeyDown}
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
            onKeyDown={handleInputKeyDown}
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
          Spawn Target
          <select
            value={summonValue.spawnTargetType || "owner"}
            onChange={(event) =>
              updateActionValue(index, {
                spawnTargetType: event.target.value,
                spawnTargetNpcId:
                  event.target.value === "specificNpc"
                    ? summonValue.spawnTargetNpcId
                    : null,
                spawnNearOwner: event.target.value === "owner",
              })
            }
            onKeyDown={handleInputKeyDown}
          >
            {ENTITY_TARGET_TYPE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        {summonValue.spawnTargetType === "specificNpc" && (
          <label>
            Spawn Near NPC
            <select
              value={summonValue.spawnTargetNpcId || ""}
              onChange={(event) =>
                updateActionValue(index, {
                  spawnTargetNpcId: event.target.value || null,
                })
              }
              onKeyDown={handleInputKeyDown}
            >
              <option value="">Select NPC</option>
              {npcOptions.map((npc) => (
                <option key={npc.id} value={npc.id}>
                  {npc.label}
                </option>
              ))}
            </select>
          </label>
        )}

        {showBehaviorTarget && (
          <>
            <label>
              Behavior Target
              <select
                value={summonValue.behaviorTargetType || "owner"}
                onChange={(event) =>
                  updateActionValue(index, {
                    behaviorTargetType: event.target.value,
                    behaviorTargetNpcId:
                      event.target.value === "specificNpc"
                        ? summonValue.behaviorTargetNpcId
                        : null,
                  })
                }
                onKeyDown={handleInputKeyDown}
              >
                {ENTITY_TARGET_TYPE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            {summonValue.behaviorTargetType === "specificNpc" && (
              <label>
                Target NPC
                <select
                  value={summonValue.behaviorTargetNpcId || ""}
                  onChange={(event) =>
                    updateActionValue(index, {
                      behaviorTargetNpcId: event.target.value || null,
                    })
                  }
                  onKeyDown={handleInputKeyDown}
                >
                  <option value="">Select NPC</option>
                  {npcOptions.map((npc) => (
                    <option key={npc.id} value={npc.id}>
                      {npc.label}
                    </option>
                  ))}
                </select>
              </label>
            )}
          </>
        )}

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
            onKeyDown={handleInputKeyDown}
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
            onKeyDown={handleInputKeyDown}
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
            onKeyDown={handleInputKeyDown}
          />
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
            onKeyDown={handleInputKeyDown}
          />
          Copy owner waypoint route
        </label>

        <label className="checkbox-label compact-checkbox-label">
          <input
            type="checkbox"
            checked={summonValue.replaceExistingOwnedClones ?? true}
            onChange={(event) =>
              updateActionValue(index, {
                replaceExistingOwnedClones: event.target.checked,
              })
            }
            onKeyDown={handleInputKeyDown}
          />
          Replace existing owned clones first
        </label>

        <div
          style={{
            marginTop: "12px",
            border: "1px solid rgba(168, 85, 247, 0.4)",
            borderRadius: "6px",
            padding: "8px",
          }}
        >
          <button
            type="button"
            className="dialogue-small-button"
            style={{
              width: "100%",
              textAlign: "left",
              display: "flex",
              justifyContent: "space-between",
            }}
            onClick={() => setShowSummonTempDialogue(!showSummonTempDialogue)}
          >
            <span>
              ًں’¬ Temporary Dialogue Setup{" "}
              {summonValue.hasTemporaryDialogue ? "(Active)" : "(Inactive)"}
            </span>
            <span>{showSummonTempDialogue ? "â–²" : "â–¼"}</span>
          </button>

          {showSummonTempDialogue && (
            <div style={{ marginTop: "8px", paddingLeft: "4px" }}>
              <label className="checkbox-label compact-checkbox-label">
                <input
                  type="checkbox"
                  checked={summonValue.hasTemporaryDialogue}
                  onChange={(e) =>
                    updateActionValue(index, {
                      hasTemporaryDialogue: e.target.checked,
                    })
                  }
                  onKeyDown={handleInputKeyDown}
                />
                Enable Temp Dialogue for Summoned NPC
              </label>

              {summonValue.hasTemporaryDialogue && (
                <>
                  <label className="checkbox-label compact-checkbox-label" style={{ marginTop: "8px" }}>
                    <input
                      type="checkbox"
                      checked={summonValue.priorityDialogue ?? false}
                      onChange={(e) =>
                        updateActionValue(index, {
                          priorityDialogue: e.target.checked,
                        })
                      }
                      onKeyDown={handleInputKeyDown}
                    />
                    Mark as priority dialogue
                  </label>

                  <label style={{ marginTop: "8px", display: "block" }}>
                    Dialogue Text
                    <textarea
                      style={{
                        width: "100%",
                        minHeight: "60px",
                        background: "#1e293b",
                        border: "1px solid #475569",
                        color: "#f8fafc",
                        padding: "6px",
                        borderRadius: "4px",
                        marginTop: "4px",
                      }}
                      value={summonValue.temporaryDialogueText}
                      onChange={(e) => updateSummonDialogueText(e.target.value)}
                      onKeyDown={handleInputKeyDown}
                      placeholder="Write what the summoned NPC says when spoken to..."
                    />
                  </label>

                  <label className="checkbox-label compact-checkbox-label" style={{ marginTop: "6px" }}>
                    <input
                      type="checkbox"
                      checked={summonValue.clearTemporaryDialogueAfterFirstUse}
                      onChange={(e) =>
                        updateActionValue(index, {
                          clearTemporaryDialogueAfterFirstUse: e.target.checked,
                        })
                      }
                      onKeyDown={handleInputKeyDown}
                    />
                    Clear after first use
                  </label>

                  <div
                    style={{
                      marginTop: "10px",
                      borderTop: "1px dashed rgba(255,255,255,0.15)",
                      paddingTop: "8px",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        marginBottom: "6px",
                      }}
                    >
                      <span style={{ fontSize: "12px", fontWeight: "bold" }}>
                        Player Choice Options
                      </span>
                      <button
                        type="button"
                        className="dialogue-small-button"
                        onClick={addSummonPlayerChoice}
                      >
                        + Choice
                      </button>
                    </div>

                    {summonValue.playerChoices.length === 0 ? (
                      <div
                        style={{
                          fontSize: "11px",
                          color: "#94a3b8",
                          fontStyle: "italic",
                        }}
                      >
                        No choices added. Dialogue will just show close button.
                      </div>
                    ) : (
                      summonValue.playerChoices.map((choice, choiceIdx) => (
                        <div
                          key={choice.id || choiceIdx}
                          style={{
                            background: "rgba(255, 255, 255, 0.03)",
                            border: "1px solid rgba(255, 255, 255, 0.1)",
                            padding: "8px",
                            borderRadius: "4px",
                            marginBottom: "6px",
                          }}
                        >
                          <div
                            style={{
                              display: "flex",
                              justifyContent: "space-between",
                              marginBottom: "4px",
                            }}
                          >
                            <span style={{ fontSize: "11px", color: "#a855f7" }}>
                              Choice #{choiceIdx + 1}
                            </span>
                            <button
                              type="button"
                              style={{
                                background: "transparent",
                                border: "none",
                                color: "#ef4444",
                                cursor: "pointer",
                                fontSize: "11px",
                              }}
                              onClick={() => removeSummonPlayerChoice(choiceIdx)}
                            >
                              Remove
                            </button>
                          </div>

                          <label style={{ display: "block", marginBottom: "4px" }}>
                            Choice Text
                            <input
                              type="text"
                              value={choice.text}
                              onChange={(e) =>
                                updateSummonPlayerChoice(
                                  choiceIdx,
                                  "text",
                                  e.target.value
                                )
                              }
                              onKeyDown={handleInputKeyDown}
                              style={{
                                width: "100%",
                                padding: "4px",
                                fontSize: "12px",
                                background: "#0f172a",
                                border: "1px solid #334155",
                                color: "#f1f5f9",
                              }}
                            />
                          </label>

                          <label style={{ display: "block" }}>
                            Next Dialogue Node (Optional)
                            <select
                              value={choice.nextNodeId || ""}
                              onChange={(e) =>
                                updateSummonPlayerChoice(
                                  choiceIdx,
                                  "nextNodeId",
                                  e.target.value
                                )
                              }
                              onKeyDown={handleInputKeyDown}
                              style={{
                                width: "100%",
                                padding: "4px",
                                fontSize: "12px",
                                background: "#0f172a",
                                border: "1px solid #334155",
                                color: "#f1f5f9",
                              }}
                            >
                              <option value="">Close Dialogue</option>
                              {dialogueNodeIds.map((nodeId) => (
                                <option key={nodeId} value={nodeId}>
                                  {nodeId}
                                </option>
                              ))}
                            </select>
                          </label>
                        </div>
                      ))
                    )}
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        <div className="dialogue-inline-note" style={{ marginTop: "8px" }}>
          Summon dialogue now saves both editor fields and runtime-compatible
          fields so `useNPCBrain` can read the summoned NPC temporary dialogue.
        </div>
      </>
    );
  }

  if (action.type === "setTemporaryDialogue") {
    return (
      <>
        <label>
          Assignment Target (Scope)
          <select
            value={tempDialogueValue.target}
            onChange={(e) => updateActionValue(index, { target: e.target.value })}
            onKeyDown={handleInputKeyDown}
          >
            {TARGET_SCOPE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </label>

        <label>
          Temporary Dialogue Node
          <select
            value={tempDialogueValue.temporaryDialogue}
            onChange={(e) => updateActionValue(index, { temporaryDialogue: e.target.value })}
            onKeyDown={handleInputKeyDown}
          >
            <option value="">None (Clear)</option>
            {dialogueNodeIds.map((id) => <option key={id} value={id}>{id}</option>)}
          </select>
        </label>

        <label className="checkbox-label compact-checkbox-label">
          <input
            type="checkbox"
            checked={tempDialogueValue.priorityDialogue}
            onChange={(e) => updateActionValue(index, { priorityDialogue: e.target.checked })}
            onKeyDown={handleInputKeyDown}
          />
          Priority Dialogue (override main node)
        </label>

        <hr className="dialogue-field-divider" />

        <label>
          Speaker Target
          <select
            value={tempDialogueValue.speakerTargetType}
            onChange={(e) => updateActionValue(index, { speakerTargetType: e.target.value })}
            onKeyDown={handleInputKeyDown}
          >
            {TEMP_DIALOGUE_ENTITY_TARGET_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </label>

        {tempDialogueValue.speakerTargetType === "specificNpc" && (
          <label>
            Specific Speaker NPC
            <select
              value={tempDialogueValue.speakerTargetNpcId || ""}
              onChange={(e) => updateActionValue(index, { speakerTargetNpcId: e.target.value })}
              onKeyDown={handleInputKeyDown}
            >
              <option value="">Select NPC</option>
              {npcOptions.map((n) => <option key={n.id} value={n.id}>{n.label}</option>)}
            </select>
          </label>
        )}

        <label>
          Response Target
          <select
            value={tempDialogueValue.responseTargetType}
            onChange={(e) => updateActionValue(index, { responseTargetType: e.target.value })}
            onKeyDown={handleInputKeyDown}
          >
            {TEMP_DIALOGUE_ENTITY_TARGET_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </label>

        {tempDialogueValue.responseTargetType === "specificNpc" && (
          <label>
            Specific Response NPC
            <select
              value={tempDialogueValue.responseTargetNpcId || ""}
              onChange={(e) => updateActionValue(index, { responseTargetNpcId: e.target.value })}
              onKeyDown={handleInputKeyDown}
            >
              <option value="">Select NPC</option>
              {npcOptions.map((n) => <option key={n.id} value={n.id}>{n.label}</option>)}
            </select>
          </label>
        )}

        <hr className="dialogue-field-divider" />

        <label className="checkbox-label compact-checkbox-label">
          <input
            type="checkbox"
            checked={tempDialogueValue.clearTemporaryDialogueAfterFirstUse}
            onChange={(e) => updateActionValue(index, { clearTemporaryDialogueAfterFirstUse: e.target.checked })}
            onKeyDown={handleInputKeyDown}
          />
          Clear after first use
        </label>

        <label>
          Clear Distance (meters)
          <input
            type="number"
            value={tempDialogueValue.clearDistance}
            onChange={(e) => updateActionValue(index, { clearDistance: parseFloat(e.target.value) || 0 })}
            onKeyDown={handleInputKeyDown}
          />
        </label>

        <label>
          Clear Timeout Delay (ms)
          <input
            type="number"
            value={tempDialogueValue.clearDelay}
            onChange={(e) => updateActionValue(index, { clearDelay: parseInt(e.target.value, 10) || 0 })}
            onKeyDown={handleInputKeyDown}
          />
        </label>
      </>
    );
  }

  if (action.type === "setNpcTextureWhileInRadius") {
    const handleTextureWhileInRadiusUpload = (event) => {
      const file = event.target.files && event.target.files[0];
      if (!file) return;

      if (!file.type.match("image/jpeg") && !file.type.match("image/png")) {
        alert("Please upload a JPEG or PNG image.");
        return;
      }

      const reader = new FileReader();

      reader.onload = (readerEvent) => {
        updateActionValue(index, {
          textureUrl: readerEvent.target.result,
        });
      };

      reader.readAsDataURL(file);
    };

    const removeTextureWhileInRadius = () => {
      updateActionValue(index, { textureUrl: "" });
      if (textureWhileInRadiusFileInputRef.current) {
        textureWhileInRadiusFileInputRef.current.value = "";
      }
    };

    return (
      <>
        <label>
          Temporary Texture (JPEG/PNG)
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
              ref={textureWhileInRadiusFileInputRef}
              accept="image/png, image/jpeg"
              onChange={handleTextureWhileInRadiusUpload}
              onKeyDown={handleInputKeyDown}
              style={{ display: "none" }}
            />

            <button
              type="button"
              onClick={() => textureWhileInRadiusFileInputRef.current?.click()}
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
              {textureWhileInRadiusValue.textureUrl
                ? "Change Temporary Texture"
                : "Upload Temporary Texture"}
            </button>

            {textureWhileInRadiusValue.textureUrl && (
              <button
                type="button"
                onClick={removeTextureWhileInRadius}
                style={{
                  padding: "6px 10px",
                  fontSize: "12px",
                  cursor: "pointer",
                  background: "#ef4444",
                  color: "#fff",
                  border: "none",
                  borderRadius: "4px",
                }}
                title="Remove temporary texture"
              >
                Remove
              </button>
            )}
          </div>

          {textureWhileInRadiusValue.textureUrl && (
            <div style={{ marginTop: "8px", textAlign: "center" }}>
              <img
                src={textureWhileInRadiusValue.textureUrl}
                alt="Temporary Texture Preview"
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
        </label>

        <div className="dialogue-inline-note" style={{ marginTop: "8px" }}>
          While the player stays inside this NPC detection radius, its sprite
          texture switches to the uploaded image above. The moment the player
          exits the detection radius, the NPC texture automatically reverts
          to its original texture. This is tracked purely by detection radius,
          independent of whether the dialogue box is open or closed.
        </div>
      </>
    );
  }

  if (
    action.type === "playSound" ||
    action.type === "giveItem" ||
    action.type === "removeItem" ||
    action.type === "teleport" ||
    action.type === "startQuest" ||
    action.type === "completeQuest"
  ) {
    return (
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
          onKeyDown={handleInputKeyDown}
        />
      </label>
    );
  }

  return (
    <label>
      Value
      <input
        type="text"
        value={typeof action.value === "string" ? action.value : ""}
        onChange={(event) =>
          updateAction(index, {
            value: event.target.value,
          })
        }
        onKeyDown={handleInputKeyDown}
      />
    </label>
  );
}
