import React, { useState } from "react";
import { v4 as uuid } from "uuid";
import NPCInspectorPanel from "./NPCInspectorPanel";

export default function NPCManagerPanel({
  npcs,
  setNpcs,
  selectedNpcId,
  setSelectedNpcId,
  focusCameraOnNpc,
  updateNpc,
  setPendingNpc,
  placingWaypointForNpcId,
  setPlacingWaypointForNpcId,
  selectedWaypointIndex,
  setSelectedWaypointIndex
}) {
  const [name, setName] = useState("NPC");

  const createNpc = () => {
    if (!name.trim()) {
      alert("Please enter a name");
      return;
    }

    const newNpcId = uuid();

    const npc = {
      id: newNpcId,
      npcId: newNpcId,
      name: name.trim(),
      position: [0, 1, 0],
      rotation: [0, 0, 0],
      scale: [1, 1, 1],
      modelPath: null,
      textureUrl: null,
      movement: {
        mode: "patrol",
        speed: 2,
        waitTime: 0,
        wanderRadius: 5
      },
      detection: {
        radius: 6,
        behavior: "look",
        targetType: "both",
        stopDistance: 0.8,
        debug: false,
        reactions: {}
      },
      // Initialize with our structured dialogue system shape
      dialogue: {
        startNodeId: "root",
        nodes: {
          root: {
            id: "root",
            text: "Hello traveler!",
            choices: [],
            onEnter: [],
            onExit: []
          }
        }
      },
      actions: [],
      rules: [],
      waypoints: [],
      currentWaypointIndex: 0,
      patrolMode: "loop",
      patrolDirection: 1,
      isPatrolling: true
    };

    setPendingNpc(npc);
    setSelectedNpcId(null);
    alert("Click on the ground to place the NPC!");
  };

  function deleteNpc(id) {
    setNpcs((prev) => prev.filter((n) => n.id !== id));
    if (selectedNpcId === id) setSelectedNpcId(null);
    setPlacingWaypointForNpcId((prev) => (prev === id ? null : prev));
    if (selectedWaypointIndex != null) setSelectedWaypointIndex(null);
  }

  const selectedNpcData = npcs.find((n) => n.id === selectedNpcId);

  return (
    <div
      className="npc-manager-panel"
      style={{
        width: "300px",
        background: "#ffffff",
        color: "#333",
        padding: "15px",
        borderRadius: "8px",
        boxShadow: "0 4px 6px rgba(0,0,0,0.1)",
        position: "absolute",
        left: "20px",
        top: "80px",
        maxHeight: "80vh",
        overflowY: "auto",
        zIndex: 1000,
        border: "1px solid #ddd"
      }}
    >
      <h3 style={{ margin: "0 0 15px 0", fontSize: "16px" }}>NPC Manager</h3>

      <div style={{ display: "flex", gap: "5px", marginBottom: "20px" }}>
        <input
          style={{ flex: 1, padding: "5px", border: "1px solid #ccc", borderRadius: "4px" }}
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="NPC Name"
        />
        <button
          onClick={createNpc}
          style={{ padding: "5px 10px", cursor: "pointer" }}
        >
          Create
        </button>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
        {npcs.map((npc) => (
          <div
            key={npc.id}
            style={{
              border: npc.id === selectedNpcId ? "1px solid #007bff" : "1px solid #ddd",
              background: npc.id === selectedNpcId ? "#e7f3ff" : "#f9f9f9",
              padding: "8px",
              borderRadius: "4px",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center"
            }}
          >
            <span
              onClick={() => {
                setSelectedNpcId(npc.id);
                focusCameraOnNpc(npc.position);
              }}
              style={{ cursor: "pointer", fontWeight: "bold", fontSize: "14px" }}
            >
              {npc.name}
            </span>
            <div style={{ display: "flex", gap: "5px" }}>
              <button
                onClick={() => deleteNpc(npc.id)}
                style={{ fontSize: "12px", padding: "2px 6px" }}
              >
                Del
              </button>
              <button
                onClick={() => {
                  setSelectedNpcId(npc.id);
                  focusCameraOnNpc(npc.position);
                }}
                style={{ fontSize: "12px", padding: "2px 6px" }}
              >
                Find
              </button>
            </div>
          </div>
        ))}
      </div>

      {selectedNpcId && selectedNpcData && (
        <div style={{ marginTop: "20px", borderTop: "1px solid #eee", paddingTop: "15px" }}>
          <NPCInspectorPanel
            selectedNpc={selectedNpcData}
            updateNpc={updateNpc}
            setPlacingWaypointForNpcId={setPlacingWaypointForNpcId}
            placingWaypointForNpcId={placingWaypointForNpcId}
            selectedWaypointIndex={selectedWaypointIndex}
            setSelectedWaypointIndex={setSelectedWaypointIndex}
            allNpcs={npcs} // Forwarding all NPCs list down for relationships and logic options
          />
        </div>
      )}
    </div>
  );
}
