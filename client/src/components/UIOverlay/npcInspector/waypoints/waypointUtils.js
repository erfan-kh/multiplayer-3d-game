export function getWaypointPos(waypoint) {
  if (Array.isArray(waypoint?.pos)) {
    return [
      Number(waypoint.pos[0]) || 0,
      Number(waypoint.pos[1]) || 0,
      Number(waypoint.pos[2]) || 0,
    ];
  }

  return [0, 0, 0];
}

export function getWaypointWaitTime(waypoint, fallbackWaitTime = 0) {
  if (typeof waypoint?.waitTime === "number") {
    return waypoint.waitTime;
  }

  return Math.max(0, Number(fallbackWaitTime) || 0);
}

export function normalizeWaypoint(waypoint, fallbackWaitTime = 0) {
  return {
    ...waypoint,
    pos: getWaypointPos(waypoint),
    waitTime: getWaypointWaitTime(waypoint, fallbackWaitTime),
    dialogueNodeId: waypoint?.dialogueNodeId || "",
    trigger: waypoint?.trigger || "onReach",
  };
}
