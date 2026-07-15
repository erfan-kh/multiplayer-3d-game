// === FULL RAPiER PLAYER CONTROLLER VERSION ===
// Optimized: no per-frame allocations, delta-safe motion, less visual churn

import React, { useRef } from "react";
import { useFrame, useLoader } from "@react-three/fiber";
import * as THREE from "three";
import { RigidBody, CapsuleCollider } from "@react-three/rapier";
import { GAME_SETTINGS } from "../constants";
import {
  PLAYER_HEIGHT,
  PLAYER_RADIUS
} from "../physics/playerCollision.js";

const HALF_CAPSULE_HEIGHT = (PLAYER_HEIGHT - 2 * PLAYER_RADIUS) / 2;
const COLLIDER_Y_OFFSET = PLAYER_HEIGHT / 2;

const SpaceGirl = React.forwardRef(
  ({ joystickDir, cameraMode, isJumping, jumpVelocity }, ref) => {
    const rigidRef = useRef();

    const innerGirlRef = useRef();
    const girlRef = ref || innerGirlRef;

    const materialRef = useRef();
    const isFacingRef = useRef(false);

    const frontTexture = useLoader(
      THREE.TextureLoader,
      "/stick-angel-front.png"
    );
    const backTexture = useLoader(
      THREE.TextureLoader,
      "/stick-angel-back.png"
    );

    const desiredVelocity = useRef(new THREE.Vector3());

    // reusable vectors
    const cameraForward = useRef(new THREE.Vector3());
    const cameraRight = useRef(new THREE.Vector3());
    const inputDir = useRef(new THREE.Vector3());
    const forward = useRef(new THREE.Vector3());
    const toCamera = useRef(new THREE.Vector3());
    const scaleVec = useRef(new THREE.Vector3());
    const up = useRef(new THREE.Vector3(0, 1, 0));

    useFrame((state, delta) => {
      const body = rigidRef.current;
      const girl = girlRef.current;
      if (!body || !girl) return;

      const desired = desiredVelocity.current;
      const input = joystickDir.current || { x: 0, y: 0 };
      const speed = GAME_SETTINGS.SPEED;

      desired.set(0, 0, 0);

      /* ===============================
         INPUT MOVEMENT
      =============================== */

      if (cameraMode === "third") {
        if (Math.abs(input.x) > 0.001) {
          girl.rotation.y -= input.x * 2.5 * delta;
        }

        state.camera.getWorldDirection(cameraForward.current);
        cameraForward.current.y = 0;

        if (cameraForward.current.lengthSq() > 0.000001) {
          cameraForward.current.normalize();
        }

        cameraRight.current
          .crossVectors(cameraForward.current, up.current);

        if (cameraRight.current.lengthSq() > 0.000001) {
          cameraRight.current.normalize();
        }

        if (Math.abs(input.x) > 0.001 || Math.abs(input.y) > 0.001) {
          desired
            .addScaledVector(cameraForward.current, -input.y)
            .addScaledVector(cameraRight.current, input.x);

          if (desired.lengthSq() > 0.000001) {
            desired.normalize().multiplyScalar(speed);
          }
        }
      } else {
        inputDir.current.set(input.x, 0, input.y);

        if (inputDir.current.lengthSq() > 0.000001) {
          inputDir.current.normalize().multiplyScalar(speed);
          desired.copy(inputDir.current);

          const angle = Math.atan2(desired.x, desired.z);
          girl.rotation.y = THREE.MathUtils.lerp(
            girl.rotation.y,
            angle,
            Math.min(1, delta * 10)
          );
        }
      }

      /* ===============================
         MOVEMENT
      =============================== */

      const currentVel = body.linvel();

      if (
        Math.abs(currentVel.x - desired.x) > 0.0001 ||
        Math.abs(currentVel.z - desired.z) > 0.0001
      ) {
        body.setLinvel(
          {
            x: desired.x,
            y: currentVel.y,
            z: desired.z
          },
          true
        );
      }

      /* ===============================
         JUMP
      =============================== */

      if (isJumping.current) {
        body.applyImpulse(
          { x: 0, y: jumpVelocity.current, z: 0 },
          true
        );
        isJumping.current = false;
      }

      /* ===============================
         TEXTURE / VISUAL FACING
      =============================== */

      if (state.camera && materialRef.current) {
        forward.current.set(0, 0, 1).applyQuaternion(girl.quaternion);

        toCamera.current
          .subVectors(state.camera.position, girl.position);

        if (toCamera.current.lengthSq() > 0.000001) {
          toCamera.current.normalize();
        }

        const dot = forward.current.dot(toCamera.current);
        const isFacingCamera = dot > 0.5;

        if (isFacingRef.current !== isFacingCamera) {
          isFacingRef.current = isFacingCamera;

          const nextTexture = isFacingCamera ? frontTexture : backTexture;
          if (materialRef.current.map !== nextTexture) {
            materialRef.current.map = nextTexture;
            materialRef.current.needsUpdate = true;
          }
        }

        const targetScale = isFacingCamera
          ? GAME_SETTINGS.SCALE_WHEN_FACING_CAMERA
          : GAME_SETTINGS.SCALE_DEFAULT;

        scaleVec.current.set(targetScale, targetScale, targetScale);
        girl.scale.lerp(scaleVec.current, Math.min(1, delta * 10));
      }
    });

    return (
      <RigidBody
        ref={rigidRef}
        position={[27, 2, 68]}
        colliders={false}
        mass={1}
        friction={0}
        linearDamping={8}
        lockRotations
      >
        <CapsuleCollider
          args={[HALF_CAPSULE_HEIGHT, PLAYER_RADIUS]}
          position={[0, COLLIDER_Y_OFFSET, 0]}
        />

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
