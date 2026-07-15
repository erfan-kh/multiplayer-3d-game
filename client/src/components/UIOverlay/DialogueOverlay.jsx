import React, { useState, useEffect } from "react";
import { executeDialogueActions, checkConditions } from "../EditorScene/npc/utils/dialogueActions"; // Adjust import path as needed

export default function DialogueOverlay({
  activeDialogueNpcId,
  npcs = [],
  setNpcs,
  gameFlags = {},
  setGameFlags,
  onClose,
  onCustomEvent
}) {
  const [currentNodeId, setCurrentNodeId] = useState("root");

  // Find the active talking NPC
  const npc = npcs.find((n) => n.id === activeDialogueNpcId);
  const dialogue = npc?.dialogue;

  // Track the dialog structures
  const nodes = dialogue?.nodes || {};
  const currentNode = nodes[currentNodeId];

  // Run onEnter actions when the node changes
  useEffect(() => {
    if (!currentNode) return;
    
    const context = {
      setNpcs,
      setGameFlags,
      triggerCustomEvent: onCustomEvent,
      closeDialogue: onClose,
      currentNpcId: activeDialogueNpcId,
    };

    if (Array.isArray(currentNode.onEnter)) {
      executeDialogueActions(currentNode.onEnter, context);
    }
  }, [currentNodeId, activeDialogueNpcId, JSON.stringify(currentNode?.onEnter)]);

  // Handle exiting dialogue overlay if NPC or dialogue structure is missing
  if (!npc || !dialogue || !currentNode) {
    return null;
  }

  const handleChoiceClick = (choice) => {
    const context = {
      setNpcs,
      setGameFlags,
      triggerCustomEvent: onCustomEvent,
      closeDialogue: onClose,
      currentNpcId: activeDialogueNpcId,
    };

    // 1. Run Node Exit Actions
    if (Array.isArray(currentNode.onExit)) {
      executeDialogueActions(currentNode.onExit, context);
    }

    // 2. Run Choice-specific Actions
    if (Array.isArray(choice.actions)) {
      executeDialogueActions(choice.actions, context);
    }

    // 3. Move to the next dialogue node or close if none specified
    if (choice.nextNodeId) {
      setCurrentNodeId(choice.nextNodeId);
    } else {
      // Default to closing if nextNodeId is empty and no custom behavior took over
      onClose();
    }
  };

  // Filter choices: Only display choices where all condition checks pass
  const visibleChoices = Array.isArray(currentNode.choices)
    ? currentNode.choices.filter((choice) => checkConditions(choice.conditions, gameFlags))
    : [];

  return (
    <div
      className="dialogue-overlay-container"
      style={{
        position: "absolute",
        bottom: "40px",
        left: "50%",
        transform: "translateX(-50%)",
        width: "90%",
        maxWidth: "700px",
        background: "rgba(15, 23, 42, 0.95)",
        border: "2px solid #a855f7", // Dialogue thematic purple border
        borderRadius: "12px",
        padding: "20px",
        boxShadow: "0 10px 25px rgba(0, 0, 0, 0.5)",
        zIndex: 2000,
        fontFamily: "sans-serif",
        color: "#ffffff"
      }}
    >
      {/* Speaker Name */}
      <div
        style={{
          fontSize: "14px",
          fontWeight: "bold",
          color: "#a855f7",
          marginBottom: "8px",
          textTransform: "uppercase",
          letterSpacing: "1px"
        }}
      >
        {npc.name}
      </div>

      {/* Main Dialogue Text */}
      <div
        style={{
          fontSize: "16px",
          lineHeight: "1.6",
          marginBottom: "20px",
          color: "#f1f5f9"
        }}
      >
        {currentNode.text}
      </div>

      {/* Player Response Choices */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "8px"
        }}
      >
        {visibleChoices.length > 0 ? (
          visibleChoices.map((choice, index) => (
            <button
              key={choice.id || index}
              onClick={() => handleChoiceClick(choice)}
              style={{
                width: "100%",
                textAlign: "left",
                padding: "10px 15px",
                background: "rgba(255, 255, 255, 0.05)",
                border: "1px solid rgba(168, 85, 247, 0.3)",
                borderRadius: "6px",
                color: "#e2e8f0",
                cursor: "pointer",
                fontSize: "14px",
                transition: "all 0.2s ease",
                outline: "none"
              }}
              onMouseEnter={(e) => {
                e.target.style.background = "rgba(168, 85, 247, 0.15)";
                e.target.style.borderColor = "#a855f7";
                e.target.style.color = "#ffffff";
              }}
              onMouseLeave={(e) => {
                e.target.style.background = "rgba(255, 255, 255, 0.05)";
                e.target.style.borderColor = "rgba(168, 85, 247, 0.3)";
                e.target.style.color = "#e2e8f0";
              }}
            >
              {choice.text}
            </button>
          ))
        ) : (
          // Default Click-to-Continue button if no choices are configured or none are visible
          <button
            onClick={() => {
              if (Array.isArray(currentNode.onExit)) {
                executeDialogueActions(currentNode.onExit, {
                  setNpcs,
                  setGameFlags,
                  triggerCustomEvent: onCustomEvent,
                  closeDialogue: onClose,
                  currentNpcId: activeDialogueNpcId,
                });
              }
              onClose();
            }}
            style={{
              alignSelf: "flex-end",
              padding: "8px 20px",
              background: "#a855f7",
              border: "none",
              borderRadius: "6px",
              color: "#ffffff",
              fontWeight: "bold",
              cursor: "pointer",
              fontSize: "13px",
              transition: "background 0.2s"
            }}
            onMouseEnter={(e) => (e.target.style.background = "#9333ea")}
            onMouseLeave={(e) => (e.target.style.background = "#a855f7")}
          >
            [ Close ]
          </button>
        )}
      </div>
    </div>
  );
}
