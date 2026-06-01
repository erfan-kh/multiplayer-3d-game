import React from "react";

export default function GameSettingsPanel({
  speed,
  setSpeed,
  gravity,
  setGravity,
  jumpForce,
  setJumpForce
}) {
  return (
    <div className="game-settings-panel">
      <h3>Game Settings</h3>

      <div className="setting">
        <label>Speed:</label>
        <input
          type="range"
          min="1"
          max="20"
          step="0.1"
          value={speed}
          onChange={(e) => setSpeed(Number(e.target.value))}
        />
        <input
          type="number"
          min="1"
          max="20"
          step="0.1"
          style={{ width: "60px", marginLeft: "8px" }}
          value={speed.toFixed(2)}
          onChange={(e) => setSpeed(Number(e.target.value))}
        />
      </div>

      <div className="setting">
        <label>Gravity:</label>
        <input
          type="range"
          min="0"
          max="50"
          step="0.1"
          value={gravity}
          onChange={(e) => setGravity(Number(e.target.value))}
        />
        <input
          type="number"
          min="0"
          max="50"
          step="0.1"
          style={{ width: "60px", marginLeft: "8px" }}
          value={gravity.toFixed(2)}
          onChange={(e) => setGravity(Number(e.target.value))}
        />
      </div>

      <div className="setting">
        <label>Jump Force:</label>
        <input
          type="range"
          min="1"
          max="30"
          step="0.1"
          value={jumpForce}
          onChange={(e) => setJumpForce(Number(e.target.value))}
        />
        <input
          type="number"
          min="1"
          max="30"
          step="0.1"
          style={{ width: "60px", marginLeft: "8px" }}
          value={jumpForce.toFixed(2)}
          onChange={(e) => setJumpForce(Number(e.target.value))}
        />
      </div>
    </div>
  );
}
