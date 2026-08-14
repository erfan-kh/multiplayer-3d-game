import React from "react";

export default function NPCSettingsForm({
  selectedNpc,
  selectedNpcId,
  allNpcs,
  fileInputRef,
  movementMode,
  handleTextureUpload,
  removeTexture,
  handleNpcBaseChange,
  handleNpcBaseStringChange,
  handleReactionChange,
  updateNpc,
}) {
  return (
    <>
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
                handleNpcBaseChange("movement", "wanderRadius", event.target.value)
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
            <option value="pingpong">Ping-Pong (0 - 1 - 2 - 1 - 0)</option>
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
    </>
  );
}
