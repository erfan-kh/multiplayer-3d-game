/**
 * Utility functions for NPC actor movement and navigation.
 */

export const getWaypointPos = (waypoint) => {
  if (Array.isArray(waypoint)) return waypoint;
  if (waypoint && Array.isArray(waypoint.pos)) return waypoint.pos;
  if (waypoint && Array.isArray(waypoint.position)) return waypoint.position;
  return null;
};

export const getWaypointWaitTime = (waypoint, fallbackWaitTime = 0) => {
  if (waypoint && !Array.isArray(waypoint) && typeof waypoint === "object") {
    return waypoint.waitTime ?? fallbackWaitTime;
  }
  return fallbackWaitTime;
};

export const getNextPatrolWaypoint = (
  currentIndex,
  waypointCount,
  patrolMode,
  patrolDirection = 1
) => {
  if (waypointCount <= 1) {
    return {
      nextIndex: 0,
      nextDirection: patrolDirection
    };
  }

  let nextIndex = currentIndex;
  let nextDirection = patrolDirection;

  if (patrolMode === "pingpong") {
    if (currentIndex >= waypointCount - 1 && nextDirection === 1) {
      nextDirection = -1;
    } else if (currentIndex <= 0 && nextDirection === -1) {
      nextDirection = 1;
    }

    nextIndex = currentIndex + nextDirection;
    nextIndex = Math.max(0, Math.min(waypointCount - 1, nextIndex));
  } else {
    nextIndex = (currentIndex + 1) % waypointCount;
  }

  return {
    nextIndex,
    nextDirection
  };
};
