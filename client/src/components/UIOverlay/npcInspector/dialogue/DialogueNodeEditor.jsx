import React from "react";
import DialogueActionList from "./DialogueActionList";
import DialogueChoiceEditor from "./DialogueChoiceEditor";

export default function DialogueNodeEditor({
  dialogue,
  activeDialogueNode,
  activeDialogueNodeId,
  dialogueNodeIds,
  selectedNpcId,
  allNpcs,
  setDialogueStartNode,
  duplicateDialogueNode,
  deleteDialogueNode,
  renameDialogueNode,
  updateDialogueNode,
  addDialogueChoice,
  updateDialogueChoice,
  deleteDialogueChoice,
  moveDialogueChoice,
}) {
  if (!activeDialogueNode) {
    return null;
  }

  return (
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

      <DialogueChoiceEditor
        activeDialogueNodeId={activeDialogueNodeId}
        activeDialogueNode={activeDialogueNode}
        dialogueNodeIds={dialogueNodeIds}
        selectedNpcId={selectedNpcId}
        allNpcs={allNpcs}
        updateDialogueChoice={updateDialogueChoice}
        deleteDialogueChoice={deleteDialogueChoice}
        moveDialogueChoice={moveDialogueChoice}
      />

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
  );
}
