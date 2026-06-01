// HERE WE ARE MAKING SNAP FUNCTIONALITY TO DECLEAR MINIMUM DISTANCE OF SNAPPING AND HOW OBJECTS DETECT EACH OTHERS!

import * as THREE from "three";

// Extracts world-space snap points from bounding box corners
export function getWorldSnapPoints(obj) {
  const { mesh, id } = obj;
  if (!mesh || !mesh.geometry || !mesh.position) {
    console.warn(`⚠️ No mesh, geometry, or position for object ${id}`);
    return [];
  }

  const box = new THREE.Box3().setFromObject(mesh);
  const center = box.getCenter(new THREE.Vector3());
  const points = [];

  const min = box.min;
  const max = box.max;

  const corners = [
    { pos: new THREE.Vector3(min.x, min.y, min.z), type: "bottom" },
    { pos: new THREE.Vector3(min.x, min.y, max.z), type: "bottom" },
    { pos: new THREE.Vector3(min.x, max.y, min.z), type: "top" },
    { pos: new THREE.Vector3(min.x, max.y, max.z), type: "top" },
    { pos: new THREE.Vector3(max.x, min.y, min.z), type: "bottom" },
    { pos: new THREE.Vector3(max.x, min.y, max.z), type: "bottom" },
    { pos: new THREE.Vector3(max.x, max.y, min.z), type: "top" },
    { pos: new THREE.Vector3(max.x, max.y, max.z), type: "top" },
  ];

  for (let i = 0; i < corners.length; i++) {
    const { pos, type } = corners[i];
    const offset = pos.clone().sub(mesh.position);

    points.push({
      id: `${id}_corner${i}`,
      position: [pos.x, pos.y, pos.z],
      rotatedOffset: [offset.x, offset.y, offset.z],
      parentId: id,
      type,
    });
  }

  points.push({
    id: `${id}_center`,
    position: [center.x, center.y, center.z],
    rotatedOffset: [
      center.x - mesh.position.x,
      center.y - mesh.position.y,
      center.z - mesh.position.z,
    ],
    parentId: id,
    type: "center",
  });

  return points;
}

// Recursively collects snap points from an object and its attachment chain
export function buildCompositeSnapPoints(obj, placedObjects) {
  const visited = new Set();
  const stack = [obj];
  const allPoints = [];

  while (stack.length > 0) {
    const current = stack.pop();
    if (!current || visited.has(current.id)) continue;
    visited.add(current.id);

    allPoints.push(...getWorldSnapPoints(current));

    const attached = placedObjects.find((o) => o.id === current.attachedTo);
    if (attached) stack.push(attached);
  }

  return allPoints;
}

const MAX_SNAP_RADIUS = 2;
const SNAP_THRESHOLD = 2;

const compatibleTypes = {
  top: ["bottom"],
  bottom: ["top"],
  center: ["center"],
};

export function findSnapTarget(draggedObj, snapCache) {
  const draggedPoints = getWorldSnapPoints(draggedObj);
  if (!Array.isArray(draggedPoints) || draggedPoints.length === 0) return null;

  let bestSnap = null;
  let minDistance = Infinity;

  for (const [otherId, otherPoints] of Object.entries(snapCache)) {
    if (otherId === draggedObj.id || !Array.isArray(otherPoints)) continue;

    for (const dp of draggedPoints) {
      if (
        !dp ||
        !Array.isArray(dp.position) ||
        dp.position.length < 3 ||
        !Array.isArray(dp.rotatedOffset) ||
        dp.rotatedOffset.length < 3
      ) continue;

      for (const op of otherPoints) {
        if (
          !op ||
          !Array.isArray(op.position) ||
          op.position.length < 3 ||
          !Array.isArray(op.rotatedOffset) ||
          op.rotatedOffset.length < 3 ||
          !compatibleTypes[dp.type]?.includes(op.type)
        ) continue;

        const dx = dp.position[0] - op.position[0];
        const dy = dp.position[1] - op.position[1];
        const dz = dp.position[2] - op.position[2];
        const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);

        if (dist > MAX_SNAP_RADIUS) continue;

        if (dist < SNAP_THRESHOLD && dist < minDistance) {
          minDistance = dist;

          bestSnap = {
            snapTo: [
              op.position[0] - dp.rotatedOffset[0],
              op.position[1] - dp.rotatedOffset[1],
              op.position[2] - dp.rotatedOffset[2],
            ],
            snapOffset: [
              op.rotatedOffset[0] - dp.rotatedOffset[0],
              op.rotatedOffset[1] - dp.rotatedOffset[1],
              op.rotatedOffset[2] - dp.rotatedOffset[2],
            ],
            direction: [
              Math.sign(op.position[0] - dp.position[0]),
              Math.sign(op.position[1] - dp.position[1]),
              Math.sign(op.position[2] - dp.position[2]),
            ],
            draggedSnapPoint: dp,
            targetSnapPoint: op,
          };
        }
      }
    }
  }

  return bestSnap;
}
