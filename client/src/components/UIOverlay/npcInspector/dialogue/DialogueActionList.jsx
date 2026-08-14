import React from "react";
import { ACTION_TYPE_OPTIONS } from "./dialogueConstants";
import { getDefaultActionValue, normalizeDialogueAction } from "./dialogueUtils";
import DialogueActionFields from "./DialogueActionFields";

export default function DialogueActionList({
  title,
  actions,
  onChange,
  allNpcs = [],
  selectedNpcId,
  dialogueNodeIds = [],
}) {
  const normalizedActions = Array.isArray(actions) ? actions.map(normalizeDialogueAction) : [];

  const updateAction = (index, patch) => {
    const nextActions = normalizedActions.map((action, actionIndex) =>
      actionIndex === index ? { ...action, ...patch } : action
    );
    onChange(nextActions);
  };

  const updateActionValue = (index, valuePatch) => {
    const nextActions = normalizedActions.map((action, actionIndex) => {
      if (actionIndex !== index) return action;
      const baseValue = getDefaultActionValue(action.type);
      const nextValue =
        typeof baseValue === "object" && baseValue !== null && !Array.isArray(baseValue)
          ? {
              ...baseValue,
              ...(typeof action.value === "object" && action.value !== null && !Array.isArray(action.value)
                ? action.value
                : {}),
              ...valuePatch,
            }
          : valuePatch;
      return { ...action, value: nextValue };
    });
    onChange(nextActions);
  };

  const addAction = () => {
    const type = ACTION_TYPE_OPTIONS[0]?.value || "setFlag";
    onChange([
      ...normalizedActions,
      normalizeDialogueAction({
        type,
        targetNpcId: null,
        value: getDefaultActionValue(type),
      }),
    ]);
  };

  const removeAction = (index) => {
    onChange(normalizedActions.filter((_, idx) => idx !== index));
  };

  return (
    <div className="dialogue-actions-editor">
      <div className="dialogue-actions-header">
        <span>{title}</span>
        <button type="button" className="dialogue-small-button" onClick={addAction}>+ Action</button>
      </div>

      {normalizedActions.length === 0 ? (
        <div className="dialogue-empty-small">No actions configured.</div>
      ) : (
        normalizedActions.map((action, index) => (
          <div key={`${title}_${index}_${action.type}`} className="dialogue-action-row">
            <div className="dialogue-action-fields">
              <label>
                Action Type
                <select
                  value={action.type}
                  onChange={(e) => updateAction(index, { type: e.target.value, value: getDefaultActionValue(e.target.value) })}
                >
                  {ACTION_TYPE_OPTIONS.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                </select>
              </label>

              <label>
                Target NPC
                <select
                  value={action.targetNpcId || ""}
                  onChange={(e) => updateAction(index, { targetNpcId: e.target.value || null })}
                >
                  <option value="">This NPC</option>
                  {allNpcs
                    .filter((n) => (n.npcId || n.id) !== selectedNpcId)
                    .map((n) => {
                      const id = n.npcId || n.id;
                      return <option key={id} value={id}>{n.name || `NPC ${id}`}</option>;
                    })}
                </select>
              </label>

              <DialogueActionFields
                action={action}
                index={index}
                allNpcs={allNpcs}
                dialogueNodeIds={dialogueNodeIds}
                updateAction={updateAction}
                updateActionValue={updateActionValue}
              />
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
        ))
      )}
    </div>
  );
}
