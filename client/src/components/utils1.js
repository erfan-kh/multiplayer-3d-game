import * as THREE from "three";

export function getWorldSnapPoints(obj) {
  const { mesh, id } = obj;
  if (!mesh || !mesh.geometry) {
    console.warn(`⚠️ No mesh or geometry for object ${id}`);
    return [];
  }

  const box = new THREE.Box3().setFromObject(mesh);
  const points = [];

  const min = box.min;
  const max = box.max;

  // 8 corners of the bounding box
  const corners = [
    [min.x, min.y, min.z],
    [min.x, min.y, max.z],
    [min.x, max.y, min.z],
    [min.x, max.y, max.z],
    [max.x, min.y, min.z],
    [max.x, min.y, max.z],
    [max.x, max.y, min.z],
    [max.x, max.y, max.z],
  ];

  for (let i = 0; i < corners.length; i++) {
    const [x, y, z] = corners[i];
    points.push({
      id: `${id}_corner${i}`,
      position: [x, y, z],
      rotatedOffset: [0, 0, 0],
      parentId: id,
    });
  }

  return points;
}


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

const MAX_SNAP_RADIUS = 2; // tighter bounding
const SNAP_THRESHOLD = 2;  // more precise snapping


export function findSnapTarget(draggedObj, snapCache) {
  const draggedPoints = getWorldSnapPoints(draggedObj);

  let bestSnap = null;
  let minDistance = Infinity;

  for (const [otherId, otherPoints] of Object.entries(snapCache)) {
    if (otherId === draggedObj.id) continue;

    for (const dp of draggedPoints) {
      for (const op of otherPoints) {
        if (
          Math.abs(dp.position[0] - op.position[0]) > MAX_SNAP_RADIUS ||
          Math.abs(dp.position[1] - op.position[1]) > MAX_SNAP_RADIUS ||
          Math.abs(dp.position[2] - op.position[2]) > MAX_SNAP_RADIUS
        ) {
          continue;
        }

        const dx = dp.position[0] - op.position[0];
        const dy = dp.position[1] - op.position[1];
        const dz = dp.position[2] - op.position[2];
        const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);

        if (dist < SNAP_THRESHOLD && dist < minDistance) {
          minDistance = dist;

          const direction = [
            Math.sign(op.position[0] - dp.position[0]),
            Math.sign(op.position[1] - dp.position[1]),
            Math.sign(op.position[2] - dp.position[2]),
          ];

          bestSnap = {
            snapTo: op.position,
            snapOffset: dp.offset,
            direction,
            size: op.size || [1, 1, 1],
            draggedSnapPoint: dp,
            targetSnapPoint: op,
          };
        }
      }
    }
  }

  return bestSnap;
}
