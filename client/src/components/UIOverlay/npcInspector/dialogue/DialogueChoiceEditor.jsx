import React from "react";
import DialogueActionList from "./DialogueActionList";

export default function DialogueChoiceEditor({
  activeDialogueNodeId,
  activeDialogueNode,
  dialogueNodeIds,
  selectedNpcId,
  allNpcs,
  updateDialogueChoice,
  deleteDialogueChoice,
  moveDialogueChoice,
}) {
  if (!activeDialogueNode) {
    return null;
  }

  if (!Array.isArray(activeDialogueNode.choices) || activeDialogueNode.choices.length === 0) {
    return (
      <div className="dialogue-empty">
        This node has no player choices. The dialogue will end after displaying
        the node unless your runtime provides a continue action.
      </div>
    );
  }

  return (
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
                  moveDialogueChoice(activeDialogueNodeId, choiceIndex, "up")
                }
              >
                ▲
              </button>

              <button
                type="button"
                disabled={choiceIndex === activeDialogueNode.choices.length - 1}
                onClick={() =>
                  moveDialogueChoice(activeDialogueNodeId, choiceIndex, "down")
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
  );
}
