// components/UIOverlay.js
import React from "react";
import MapEditorPanel from "./MapEditorPanel";
import Joystick from "./Joystick";

export default function UIOverlay({
  isPanelOpen,
  setIsPanelOpen,
  isCreatingObject,
  setIsCreatingObject,
  objectType,
  setObjectType,
  size,
  setSize,
  color,
  setColor,
  rotation,
  setRotation,
  position,
  setPosition,
  snapSize,
  setSnapSize,
  showTransformControls,
  setShowTransformControls,
  isDeleteMode,
  setIsDeleteMode,
  showOptions,
  setShowOptions,
  showGameSettings,
  setShowGameSettings,
  isDrawing,
  setIsDrawing,
  cameraMode,
  setCameraMode,
  showSnapPoints,
  setShowSnapPoints,
  handleJoystickMove,
  handleJoystickEnd,
  isJumping,
  jumpVelocity,
  radToDeg,
  degToRad,
  speed,
  setSpeed,
  gravity,
  setGravity,
  jumpForce,
  setJumpForce,
}) {
  return (
    <div className="ui">
      <MapEditorPanel />

      <div className="options-toggle">
        <button className="btn options" onClick={() => setShowOptions((prev) => !prev)}>
          {showOptions ? "✖️ Close Options" : "⚙️ Options"}
        </button>
      </div>

      {showOptions && (
        <>
          <div className="game-settings-toggle">
            <button
              className="btn settings"
              onClick={() => setShowGameSettings((prev) => !prev)}
            >
              {showGameSettings ? "❌ Close Settings" : "🎛️ Game Settings"}
            </button>
          </div>

          {showGameSettings && (
            <div className="game-settings-panel">
              <label>
                Speed:
                <input
                  type="range"
                  min="0.01"
                  max="0.2"
                  step="0.01"
                  value={speed}
                  onChange={(e) => setSpeed(parseFloat(e.target.value))}
                />
              </label>
              <label>
                Gravity:
                <input
                  type="range"
                  min="0.001"
                  max="0.02"
                  step="0.001"
                  value={gravity}
                  onChange={(e) => setGravity(parseFloat(e.target.value))}
                />
              </label>
              <label>
                Jump Force:
                <input
                  type="range"
                  min="0.05"
                  max="0.3"
                  step="0.01"
                  value={jumpForce}
                  onChange={(e) => setJumpForce(parseFloat(e.target.value))}
                />
              </label>
            </div>
          )}

          <div className="object-creator-toggle">
            <button
              className="btn create"
              onClick={() => setIsCreatingObject((prev) => !prev)}
            >
              {isCreatingObject ? "❌ Cancel" : "➕ Create Object"}
            </button>

            <button
              className="btn delete"
              onClick={() => setIsDeleteMode((prev) => !prev)}
              style={{ backgroundColor: isDeleteMode ? "#ff4d4d" : undefined }}
            >
              {isDeleteMode ? "🗑️ Cancel Delete" : "🗑️ Delete Mode"}
            </button>
          </div>

          {isCreatingObject && (
            <div className="object-creator-panel">
              <label>
                Object Type:
                <select value={objectType} onChange={(e) => setObjectType(e.target.value)}>
                  <option value="wall">Wall</option>
                  <option value="floor">Floor</option>
                  <option value="table">Table</option>
                  <option value="window">Window</option>
                  <option value="road">Road</option>
                </select>
              </label>

              <label>
                Width:
                <input
                  type="number"
                  step="0.1"
                  value={size[0]}
                  onChange={(e) => setSize([+e.target.value, size[1], size[2]])}
                />
              </label>
              <label>
                Height:
                <input
                  type="number"
                  step="0.1"
                  value={size[1]}
                  onChange={(e) => setSize([size[0], +e.target.value, size[2]])}
                />
              </label>
              <label>
                Depth:
                <input
                  type="number"
                  step="0.1"
                  value={size[2]}
                  onChange={(e) => setSize([size[0], size[1], +e.target.value])}
                />
              </label>

              <label>
                Position X:
                <input
                  type="number"
                  step="0.1"
                  value={position[0]}
                  onChange={(e) => setPosition([+e.target.value, position[1], position[2]])}
                />
              </label>
              <label>
                Position Y:
                <input
                  type="number"
                  step="0.1"
                  value={position[1]}
                  onChange={(e) => setPosition([position[0], +e.target.value, position[2]])}
                />
              </label>
              <label>
                Position Z:
                <input
                  type="number"
                  step="0.1"
                  value={position[2]}
                  onChange={(e) => setPosition([position[0], position[1], +e.target.value])}
                />
              </label>

              <label>
                Snap to Grid:
                <select value={snapSize} onChange={(e) => setSnapSize(+e.target.value)}>
                  <option value={1}>1</option>
                  <option value={0.5}>0.5</option>
                  <option value={0.25}>0.25</option>
                  <option value={0}>Off</option>
                </select>
              </label>

              <label>
                Color:
                <input
                  type="color"
                  value={color}
                  onChange={(e) => setColor(e.target.value)}
                />
              </label>

              <label>
                Rotate X (°):
                <input
                  type="range"
                  min={0}
                  max={360}
                  value={radToDeg(rotation[0])}
                  onChange={(e) =>
                    setRotation([degToRad(+e.target.value), rotation[1], rotation[2]])
                  }
                />
                <input
                  type="number"
                  min={0}
                  max={360}
                  value={radToDeg(rotation[0])}
                  onChange={(e) =>
                    setRotation([degToRad(+e.target.value), rotation[1], rotation[2]])
                  }
                />
              </label>

              <label>
                Rotate Y (°):
                <input
                  type="range"
                  min={0}
                  max={360}
                  value={radToDeg(rotation[1])}
                  onChange={(e) =>
                    setRotation([rotation[0], degToRad(+e.target.value), rotation[2]])
                  }
                />
                <input
                  type="number"
                  min={0}
                  max={360}
                  value={radToDeg(rotation[1])}
                  onChange={(e) =>
                    setRotation([rotation[0], degToRad(+e.target.value), rotation[2]])
                  }
                />
              </label>

              <label>
                Rotate Z (°):
                <input
                  type="range"
                  min={0}
                  max={360}
                  value={radToDeg(rotation[2])}
                  onChange={(e) =>
                    setRotation([rotation[0], rotation[1], degToRad(+e.target.value)])
                  }
                />
                <input
                  type="number"
                  min={0}
                  max={360}
                  value={radToDeg(rotation[2])}
                  onChange={(e) =>
                    setRotation([rotation[0], rotation[1], degToRad(+e.target.value)])
                  }
                />
              </label>

              <button
                className="btn draw"
                onClick={() => setIsDrawing((prev) => !prev)}
                style={{ backgroundColor: isDrawing ? "#4caf50" : undefined }}
              >
                {isDrawing ? "✅ Drawing (Tap to Cancel)" : "🎨 Start Drawing"}
              </button>
            </div>
          )}

          <div className="camera-toggle">
            <button
              className="btn camera"
              onClick={() =>
                setCameraMode((prev) =>
                  prev === "orbit" ? "third" : prev === "third" ? "top" : "orbit"
                )
              }
            >
              🎥 Camera: {cameraMode}
            </button>
          </div>

          <div className="snap-debug-toggle">
            <button
              className="btn debug"
              onClick={() => setShowSnapPoints((prev) => !prev)}
              style={{ backgroundColor: showSnapPoints ? "#ffa500" : undefined }}
            >
              {showSnapPoints ? "🟠 Hide Snap Points" : "🟠 Show Snap Points"}
            </button>

              </div>
    
              <div className="edit-map-toggle">
                <button
                  className="btn edit-map"
                  onClick={() => setIsPanelOpen((prev) => !prev)}
                >
                  {isPanelOpen ? "🧹 Hide Editor" : "🛠️ Edit Map"}
                </button>
          </div>
        </>
      )}

      <Joystick onMove={handleJoystickMove} onEnd={handleJoystickEnd} />

      <div className="jump-button">
        <button
          className="btn jump"
            onTouchStart={() => {
          if (!isJumping.current) {
            isJumping.current = true;
            jumpVelocity.current = jumpForce;
          }
        }}


        >
          ⬆️ Jump
        </button>
      </div>
    </div>
  );
}
