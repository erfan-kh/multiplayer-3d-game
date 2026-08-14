import React from "react";
import { getWaypointPos, getWaypointWaitTime } from "./waypointUtils";

export default function WaypointEditor({
  selectedNpc,
  movementMode,
  waypoints,
  selectedWaypointIndex,
  setSelectedWaypointIndex,
  setPlacingWaypointForNpcId,
  placingWaypointForNpcId,
  handleWaypointChange,
  handleWaypointWaitTimeChange,
  moveWaypoint,
  duplicateWaypoint,
  setAsCurrentTarget,
  deleteWaypoint,
}) {
  if (movementMode !== "patrol") {
    return null;
  }

  return (
    <>
      <div className="section-title">Patrol Waypoints</div>

      <div className="waypoint-actions-header">
        <button
          type="button"
          className={`btn-action ${
            placingWaypointForNpcId === selectedNpc.id ? "active" : ""
          }`}
          onClick={() =>
            setPlacingWaypointForNpcId(
              placingWaypointForNpcId === selectedNpc.id ? null : selectedNpc.id
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
            No waypoints defined. Click the map to place waypoints.
          </div>
        ) : (
          waypoints.map((waypoint, index) => {
            const isSelected = selectedWaypointIndex === index;
            const isCurrentTarget = selectedNpc.currentWaypointIndex === index;
            const waypointPosition = getWaypointPos(waypoint);

            const xValue = waypointPosition[0] ?? 0;
            const yValue = waypointPosition[1] ?? 0;
            const zValue = waypointPosition[2] ?? 0;

            const waitTimeValue = getWaypointWaitTime(
              waypoint,
              selectedNpc.movement?.waitTime ?? 0
            );

            return (
              <div
                key={index}
                className={`waypoint-item ${isSelected ? "selected" : ""} ${
                  isCurrentTarget ? "current-target" : ""
                }`}
                onClick={() => setSelectedWaypointIndex(index)}
              >
                <div className="waypoint-header">
                  <span className="waypoint-number">#{index + 1}</span>

                  {isCurrentTarget && (
                    <span className="target-badge">Target</span>
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
                      disabled={index === waypoints.length - 1}
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
                    onClick={(event) => event.stopPropagation()}
                  >
                    <div className="waypoint-coordinates">
                      <div className="coord-input-group">
                        <label>X</label>

                        <input
                          type="number"
                          step="0.1"
                          value={Number(xValue).toFixed(2)}
                          onChange={(event) =>
                            handleWaypointChange(index, 0, event.target.value)
                          }
                        />
                      </div>

                      <div className="coord-input-group">
                        <label>Y (Height)</label>

                        <input
                          type="number"
                          step="0.1"
                          value={Number(yValue).toFixed(2)}
                          onChange={(event) =>
                            handleWaypointChange(index, 1, event.target.value)
                          }
                        />
                      </div>

                      <div className="coord-input-group">
                        <label>Z</label>

                        <input
                          type="number"
                          step="0.1"
                          value={Number(zValue).toFixed(2)}
                          onChange={(event) =>
                            handleWaypointChange(index, 2, event.target.value)
                          }
                        />
                      </div>
                    </div>

                    <div className="settings-field waypoint-wait-field">
                      <label>Wait Time at this Node (sec)</label>

                      <input
                        type="number"
                        step="0.5"
                        min="0"
                        value={waitTimeValue}
                        onChange={(event) =>
                          handleWaypointWaitTimeChange(index, event.target.value)
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
  );
}
