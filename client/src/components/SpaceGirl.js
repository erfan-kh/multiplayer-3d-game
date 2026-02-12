import React, { useRef } from "react";
import { useFrame, useLoader } from "@react-three/fiber";
import * as THREE from "three";
import { GAME_SETTINGS } from "../constants";

const SpaceGirl = React.forwardRef(
  ({ joystickDir, cameraMode, isJumping, jumpVelocity }, ref) => {
    const localRef = useRef();
    const girlRef = ref || localRef;

    const frontTexture = useLoader(THREE.TextureLoader, "/stick-angel-front.png");
    const backTexture = useLoader(THREE.TextureLoader, "/stick-angel-back.png");

    const velocity = useRef(new THREE.Vector3());
    const isFacingRef = useRef(false);
    const materialRef = useRef();

    useFrame((state) => {
      const girl = girlRef.current;
      if (!girl) return;

      // ✅ Expose joystick input to camera controller
      girl.userData.joystickDir = joystickDir.current;

      const input = joystickDir.current || { x: 0, y: 0 };
      const speed = GAME_SETTINGS.SPEED;

      if (cameraMode === "third") {
        // Rotate character left/right
        girl.rotation.y -= input.x * 0.05;

        // Move forward/backward relative to camera view
        const cameraForward = new THREE.Vector3();
        state.camera.getWorldDirection(cameraForward);
        cameraForward.y = 0;
        cameraForward.normalize();

        const cameraRight = new THREE.Vector3();
        cameraRight.crossVectors(cameraForward, new THREE.Vector3(0, 1, 0)).normalize();

        const move = new THREE.Vector3()
          .addScaledVector(cameraForward, -input.y)
          .addScaledVector(cameraRight, input.x)
          .normalize()
          .multiplyScalar(speed);

        girl.position.add(move);

        // Smooth velocity for animation purposes
        velocity.current.lerp(move, 0.2);
      } else {
        // World-relative movement
        const inputDir = new THREE.Vector3(input.x, 0, input.y);
        if (inputDir.length() > 0) {
          inputDir.normalize();
          velocity.current.lerp(inputDir.multiplyScalar(speed), 0.2);
        } else {
          velocity.current.lerp(new THREE.Vector3(0, 0, 0), 0.1);
        }
        girl.position.add(velocity.current);

        // Face movement direction
        if (velocity.current.length() > 0.01) {
          const angle = Math.atan2(velocity.current.x, velocity.current.z);
          girl.rotation.y = THREE.MathUtils.lerp(girl.rotation.y, angle, 0.15);
        }
      }

      // Jumping logic
      if (isJumping.current) {
        jumpVelocity.current -= GAME_SETTINGS.GRAVITY;
        girl.position.y += jumpVelocity.current;

        if (girl.position.y <= GAME_SETTINGS.GROUND_Y) {
          girl.position.y = GAME_SETTINGS.GROUND_Y;
          isJumping.current = false;
          jumpVelocity.current = 0;
        }
      }

      // Texture switching based on camera angle
      const forward = new THREE.Vector3(0, 0, 1).applyQuaternion(girl.quaternion);
      const toCamera = new THREE.Vector3()
        .subVectors(state.camera.position, girl.position)
        .normalize();
      const dot = forward.dot(toCamera);
      const isFacingCamera = dot > 0.5;
      isFacingRef.current = isFacingCamera;

      if (
        materialRef.current &&
        materialRef.current.map !== (isFacingCamera ? frontTexture : backTexture)
      ) {
        materialRef.current.map = isFacingCamera ? frontTexture : backTexture;
        materialRef.current.needsUpdate = true;
      }

      const targetScale = isFacingCamera
        ? GAME_SETTINGS.SCALE_WHEN_FACING_CAMERA
        : GAME_SETTINGS.SCALE_DEFAULT;

      girl.scale.lerp(new THREE.Vector3(targetScale, targetScale, targetScale), 0.1);
    });

    return (
      <group ref={girlRef} position={[0, 0.042, 0]}>
        <mesh position={[0, 0, -0.01]} visible={isFacingRef.current && cameraMode !== "top"}>
          <planeGeometry args={[1.2, 1.2]} />
          <meshBasicMaterial color="yellow" transparent opacity={0} depthTest={false} />
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
    );
  }
);

export default SpaceGirl;
