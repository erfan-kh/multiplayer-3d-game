import * as THREE from 'three';


// utils.js
export function getWorldSnapPoints(obj) {
  const { position, size, snapPoints = [] } = obj;

  return snapPoints.map((sp) => {
    const offset = sp.offset || [0, 0, 0];
        const localOffset = new THREE.Vector3(
      size[0] * offset[0],
      size[1] * offset[1],
      size[2] * offset[2]
    );
    
    const euler = new THREE.Euler(...(obj.rotation || [0, 0, 0]));
    localOffset.applyEuler(euler);
    
    const worldPos = [
      position[0] + localOffset.x,
      position[1] + localOffset.y,
      position[2] + localOffset.z,
    ];

        return {
      id: sp.id,
      offset,
      position: worldPos,
      size: obj.size,
      rotatedOffset: [localOffset.x, localOffset.y, localOffset.z], // ✅ Add this
    };

  });
}

// utils.js

const MAX_SNAP_RADIUS = 2;
const SNAP_THRESHOLD = 2;

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
          draggedSnapPoint: dp, // ✅ add this
          targetSnapPoint: op,  // ✅ add this
        };

        }
      }
    }
  }

  return bestSnap;
}
