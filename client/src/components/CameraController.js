// components/CameraController.js
import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useRef } from "react";
import * as THREE from "three";

export default function CameraController({ cameraMode, girlRef }) {
  const { camera, gl } = useThree();
  const smoothPosition = useRef(new THREE.Vector3());

  const userYawOffset = useRef(0);
  const userPitchOffset = useRef(0);
  const currentAngle = useRef(0);
  const lastRotation = useRef(0);
  const idleTimer = useRef(0);

  const isDragging = useRef(false);
  const lastTouchX = useRef(0);
  const lastTouchY = useRef(0);
  const activeTouchId = useRef(null);

  const CAMERA_SENSITIVITY = 0.02;
  const PITCH_MIN = -1.05;
  const PITCH_MAX = 0.3;

  useEffect(() => {
    const handleTouchStart = (e) => {
      if (cameraMode !== "third") return;

      for (let touch of e.touches) {
        if (touch.clientX > window.innerWidth / 2) {
          isDragging.current = true;
          lastTouchX.current = touch.clientX;
          lastTouchY.current = touch.clientY;
          activeTouchId.current = touch.identifier;
          break;
        }
      }
    };

    const handleTouchMove = (e) => {
      if (!isDragging.current || cameraMode !== "third") return;

      for (let touch of e.touches) {
        if (touch.identifier === activeTouchId.current) {
          const deltaX = touch.clientX - lastTouchX.current;
          const deltaY = touch.clientY - lastTouchY.current;
          lastTouchX.current = touch.clientX;
          lastTouchY.current = touch.clientY;

          userYawOffset.current += deltaX * CAMERA_SENSITIVITY;
          userPitchOffset.current += deltaY * CAMERA_SENSITIVITY;
          userPitchOffset.current = THREE.MathUtils.clamp(userPitchOffset.current, PITCH_MIN, PITCH_MAX);
          break;
        }
      }
    };

    const handleTouchEnd = (e) => {
      for (let touch of e.changedTouches) {
        if (touch.identifier === activeTouchId.current) {
          isDragging.current = false;
          activeTouchId.current = null;
          break;
        }
      }
    };

    const canvas = gl.domElement;
    canvas.addEventListener("touchstart", handleTouchStart, { passive: true });
    canvas.addEventListener("touchmove", handleTouchMove, { passive: true });
    canvas.addEventListener("touchend", handleTouchEnd, { passive: true });
    canvas.addEventListener("touchcancel", handleTouchEnd, { passive: true });

    return () => {
      canvas.removeEventListener("touchstart", handleTouchStart);
      canvas.removeEventListener("touchmove", handleTouchMove);
      canvas.removeEventListener("touchend", handleTouchEnd);
      canvas.removeEventListener("touchcancel", handleTouchEnd);
    };
  }, [gl, cameraMode]);

  useFrame((_, delta) => {
    if (!girlRef.current || cameraMode !== "third") return;

    const target = girlRef.current;

    const targetPos = new THREE.Vector3();
    target.getWorldPosition(targetPos);

    const targetDir = new THREE.Vector3();
    target.getWorldDirection(targetDir);

    const targetYaw = Math.atan2(targetDir.x, targetDir.z);

    const joystick = target.userData.joystickDir;
    const isJoystickActive = joystick && (Math.abs(joystick.x) > 0.01 || Math.abs(joystick.y) > 0.01);

    const rotationDelta = Math.abs(targetYaw - lastRotation.current);
    if (rotationDelta > 0.01 || isDragging.current || isJoystickActive) {
      idleTimer.current = 0;
    } else {
      idleTimer.current += delta;
    }
    lastRotation.current = targetYaw;

    if (idleTimer.current > 3) {
      userYawOffset.current = THREE.MathUtils.lerp(userYawOffset.current, 0, delta * 3);
      userPitchOffset.current = THREE.MathUtils.lerp(userPitchOffset.current, 0, delta * 3);
    }

    const maxLag = 0.26;
    const desiredAngle = idleTimer.current > 3
      ? 0
      : THREE.MathUtils.clamp(currentAngle.current + (targetYaw - currentAngle.current), -maxLag, maxLag);
    currentAngle.current = THREE.MathUtils.lerp(currentAngle.current, desiredAngle, 0.1);

    const cameraYaw = targetYaw + currentAngle.current + userYawOffset.current;
    const cameraPitch = userPitchOffset.current;

    const distance = 4.5;
    const verticalOffset = -1;

    const offset = new THREE.Vector3(
      Math.sin(cameraYaw) * distance * Math.cos(cameraPitch),
      Math.sin(cameraPitch) * distance + verticalOffset,
      Math.cos(cameraYaw) * distance * Math.cos(cameraPitch)
    );

    const desiredPos = targetPos.clone().sub(offset);
    smoothPosition.current.lerp(desiredPos, 0.1);
    camera.position.copy(smoothPosition.current);

    camera.lookAt(targetPos.clone().add(new THREE.Vector3(0, verticalOffset, 0)));
  });

  useEffect(() => {
    if (cameraMode === "orbit") {
      camera.position.set(0, 2, 5);
      camera.lookAt(0, 0, 0);
    }
  }, [cameraMode, camera]);

  return null;
}
