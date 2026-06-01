// === FULL RAPiER PLAYER CONTROLLER VERSION ===
// Replaces all manual collision logic with true physics.

import React, { useRef } from "react";
import { useFrame, useLoader } from "@react-three/fiber";
import * as THREE from "three";
import { RigidBody, CapsuleCollider, useRapier } from "@react-three/rapier";
import { GAME_SETTINGS } from "../constants";
import {
  PLAYER_HEIGHT,
  PLAYER_RADIUS,
  resolvePlayerCollision
} from "../physics/playerCollision.js";

// Compute proper capsule numbers once
const HALF_CAPSULE_HEIGHT = (PLAYER_HEIGHT - 2 * PLAYER_RADIUS) / 2;

// ❗ FIXED: Capsule center must be at PLAYER_HEIGHT/2
const COLLIDER_Y_OFFSET = PLAYER_HEIGHT / 2;

const SpaceGirl = React.forwardRef(
  ({ joystickDir, cameraMode, isJumping, jumpVelocity }, ref) => {
    const rigidRef = useRef();

    // avoid conditional hook
    const innerGirlRef = useRef();
    const girlRef = ref || innerGirlRef;

    const materialRef = useRef();
    const isFacingRef = useRef(false);

    // === Rapier World Access ===
    const { world: rapierWorld } = useRapier();

    const frontTexture = useLoader(
      THREE.TextureLoader,
      "/stick-angel-front.png"
    );
    const backTexture = useLoader(
      THREE.TextureLoader,
      "/stick-angel-back.png"
    );

    // store vectors in refs (avoid allocations every render)
    const desiredVelocity = useRef(new THREE.Vector3());
    const outVelocity = useRef(new THREE.Vector3());
    const onGroundRef = useRef(false);

    useFrame((state) => {
      const body = rigidRef.current;
      const girl = girlRef.current;
      if (!body || !girl) return;

      const desired = desiredVelocity.current;
      const outVel = outVelocity.current;

      /* ===============================
         INPUT MOVEMENT
      =============================== */

      const input = joystickDir.current || { x: 0, y: 0 };
      const speed = GAME_SETTINGS.SPEED;

      desired.set(0, 0, 0);

      if (cameraMode === "third") {
        girl.rotation.y -= input.x * 0.05;

        const cameraForward = new THREE.Vector3();
        state.camera.getWorldDirection(cameraForward);
        cameraForward.y = 0;
        cameraForward.normalize();

        const cameraRight = new THREE.Vector3();
        cameraRight
          .crossVectors(cameraForward, new THREE.Vector3(0, 1, 0))
          .normalize();

        desired
          .addScaledVector(cameraForward, -input.y)
          .addScaledVector(cameraRight, input.x)
          .normalize()
          .multiplyScalar(speed);
      } else {
        const inputDir = new THREE.Vector3(input.x, 0, input.y);

        if (inputDir.length() > 0) {
          inputDir.normalize().multiplyScalar(speed);
          desired.copy(inputDir);
        } else {
          desired.set(0, 0, 0);
        }

        if (desired.length() > 0.01) {
          const angle = Math.atan2(desired.x, desired.z);
          girl.rotation.y = THREE.MathUtils.lerp(
            girl.rotation.y,
            angle,
            0.15
          );
        }
      }

      /* ===============================
         RAPiER COLLISION-BASED MOVEMENT
      =============================== */

      const currentVel = body.linvel();
      outVel.set(desired.x, currentVel.y, desired.z);

      resolvePlayerCollision(body, rapierWorld, outVel, onGroundRef);

      body.setLinvel(
        { x: outVel.x, y: outVel.y, z: outVel.z },
        true
      );

      /* ===============================
         JUMP
      =============================== */

      if (isJumping.current && onGroundRef.current) {
        body.applyImpulse(
          { x: 0, y: jumpVelocity.current, z: 0 },
          true
        );
      }

      isJumping.current = false;

      /* ===============================
         TEXTURE / VISUAL FACING
      =============================== */

      const forward = new THREE.Vector3(0, 0, 1).applyQuaternion(
        girl.quaternion
      );

      const toCamera = new THREE.Vector3()
        .subVectors(state.camera.position, girl.position)
        .normalize();

      const dot = forward.dot(toCamera);
      const isFacingCamera = dot > 0.5;

      isFacingRef.current = isFacingCamera;

      if (
        materialRef.current &&
        materialRef.current.map !==
          (isFacingCamera ? frontTexture : backTexture)
      ) {
        materialRef.current.map = isFacingCamera
          ? frontTexture
          : backTexture;

        materialRef.current.needsUpdate = true;
      }

      const targetScale = isFacingCamera
        ? GAME_SETTINGS.SCALE_WHEN_FACING_CAMERA
        : GAME_SETTINGS.SCALE_DEFAULT;

      girl.scale.lerp(
        new THREE.Vector3(targetScale, targetScale, targetScale),
        0.1
      );
    });

    return (
      <RigidBody
        ref={rigidRef}
        position={[0, 2, 0]}
        colliders={false}
        mass={1}
        friction={0}
        lockRotations={true}
        enabledRotations={[false, false, false]}
      >
        {/* === CORRECTED CAPSULE COLLIDER === */}
        <CapsuleCollider
          args={[HALF_CAPSULE_HEIGHT, PLAYER_RADIUS]}
          position={[0, COLLIDER_Y_OFFSET, 0]}
        />

        {/* ❗ FIXED: Move visual mesh UP so feet match physics */}
        <group ref={girlRef} position={[0, PLAYER_HEIGHT / 2, 0]}>
          <mesh
            position={[0, 0, -0.01]}
            visible={isFacingRef.current && cameraMode !== "top"}
          >
            <planeGeometry args={[1.2, 1.2]} />
            <meshBasicMaterial
              color="yellow"
              transparent
              opacity={0}
              depthTest={false}
            />
          </mesh>

          <mesh>
            <planeGeometry args={[1, 1]} />
            <meshBasicMaterial
              ref={materialRef}
              map={frontTexture}
              transparent
              side={THREE.DoubleSide}
            />
          </mesh>
        </group>
      </RigidBody>
    );
  }
);

export default SpaceGirl;
