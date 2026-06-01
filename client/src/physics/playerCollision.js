import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";

export const PLAYER_RADIUS = 0.14;
export const PLAYER_HEIGHT = 1.0;

const HALF_CAPSULE_HEIGHT = (PLAYER_HEIGHT - 2 * PLAYER_RADIUS) / 2;
const CAPSULE_Y_OFFSET = PLAYER_HEIGHT / 2;

// Keep a single instance of the shape to avoid memory leaks/lag
let cachedCapsule = null;

export function resolvePlayerCollision(rigidbody, rapierWorld, velocity, onGroundRef) {
  if (!rigidbody || !rapierWorld) return velocity;

  // 1. Create the shape once and reuse it (Fixes the LAG)
  if (!cachedCapsule) {
    cachedCapsule = new RAPIER.Capsule(HALF_CAPSULE_HEIGHT, PLAYER_RADIUS);
  }

  const pos = rigidbody.translation();
  const rotation = { w: 1, x: 0, y: 0, z: 0 };

  /* ======================
       1. GROUND CHECK
  ====================== */
  const groundOrigin = { x: pos.x, y: pos.y + CAPSULE_Y_OFFSET, z: pos.z };
  const groundSweep = { x: 0, y: -0.2, z: 0 };
  
  const groundHit = rapierWorld.castShape(
    groundOrigin, rotation, groundSweep, cachedCapsule, 1.0, true, 
    null, null, rigidbody // Ignore the player themselves
  );

  onGroundRef.current = !!(groundHit && groundHit.toi < 0.15);
  if (onGroundRef.current && velocity.y < 0) velocity.y = 0;

  /* ======================
       2. WALL COLLISION (The Fix)
  ====================== */
  const horizontalSpeed = Math.hypot(velocity.x, velocity.z);
  if (horizontalSpeed < 0.001) return velocity;

  const dirX = velocity.x / horizontalSpeed;
  const dirZ = velocity.z / horizontalSpeed;

  // ❗ THE TRICK: Lift the sweep origin up by 0.1 units.
  // This prevents the "Wall Sweep" from accidentally hitting the floor.
  const wallOrigin = { 
    x: pos.x, 
    y: pos.y + CAPSULE_Y_OFFSET + 0.1, 
    z: pos.z 
  };

  const wallSweep = { x: dirX, y: 0, z: dirZ };

  const wallHit = rapierWorld.castShape(
    wallOrigin, rotation, wallSweep, cachedCapsule, horizontalSpeed, true,
    null, null, rigidbody // Ignore the player themselves
  );

  if (wallHit) {
    // If we hit something, we only move up to the impact point
    // We subtract a tiny 'buffer' (0.01) to prevent getting stuck inside the wall
    const allowedDist = Math.max(0, (horizontalSpeed * wallHit.toi) - 0.01);
    
    velocity.x = dirX * allowedDist;
    velocity.z = dirZ * allowedDist;
  }

  return velocity;
}
