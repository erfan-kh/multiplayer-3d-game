// components/CameraController.js
import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useRef } from "react";
import * as THREE from "three";

export default function CameraController({
  cameraMode,
  girlRef,
  zoom,
  setZoom,
  isDragging, // ✅ NEW: global dragging state from EditorCanvas
  cameraFocusTarget   // ✅ NEW
}) {
  const { camera, gl } = useThree();
  const smoothPosition = useRef(new THREE.Vector3());

  const userYawOffset = useRef(0);
  const userPitchOffset = useRef(0);
  const currentAngle = useRef(0);
  const lastRotation = useRef(0);
  const idleTimer = useRef(0);

  const isDraggingInternal = useRef(false); // renamed internally to avoid confusion with prop
  const dragButton = useRef(null);
  const lastTouchX = useRef(0);
  const lastTouchY = useRef(0);

  const activeTouchId = useRef(null);

  const topPosition = useRef(new THREE.Vector3(0, 15, 0));
  const lastPinchDistance = useRef(null);

  const orbitYaw = useRef(null);
  const orbitPitch = useRef(null);
  const orbitTarget = useRef(new THREE.Vector3(0, 0, 0));

  const CAMERA_SENSITIVITY = 0.02;
  const PITCH_MIN = -1.05;
  const PITCH_MAX = 0.3;

  const TOP_ZOOM_MIN = 10;
  const TOP_ZOOM_MAX = 120;

  const THIRD_ZOOM_MIN = 2;
  const THIRD_ZOOM_MAX = 10;

  const ORBIT_ZOOM_MIN = 2;
  const ORBIT_ZOOM_MAX = 20;
  const ORBIT_INITIAL_DISTANCE = 5;

  const ORBIT_ZOOM_SPEED = 0.01;
  const ORBIT_VERTICAL_SPEED = 0.05;

  const clampZoom = (z) => {
    if (cameraMode === "top")
      return THREE.MathUtils.clamp(z, TOP_ZOOM_MIN, TOP_ZOOM_MAX);
    if (cameraMode === "third")
      return THREE.MathUtils.clamp(z, THIRD_ZOOM_MIN, THIRD_ZOOM_MAX);
    if (cameraMode === "orbit")
      return THREE.MathUtils.clamp(z, ORBIT_ZOOM_MIN, ORBIT_ZOOM_MAX);
    return z;
  };

  useEffect(() => {
    const canvas = gl.domElement;

    const getDistance = (t1, t2) => {
      const dx = t1.clientX - t2.clientX;
      const dy = t1.clientY - t2.clientY;
      return Math.sqrt(dx * dx + dy * dy);
    };

    const handleTouchStart = (e) => {
      if (cameraMode === "third") {
        for (let touch of e.touches) {
          if (touch.clientX > window.innerWidth / 2) {
            isDraggingInternal.current = true;
            lastTouchX.current = touch.clientX;
            lastTouchY.current = touch.clientY;
            activeTouchId.current = touch.identifier;
            break;
          }
        }
      }

      if (cameraMode === "top") {
        if (e.touches.length === 1) {
          isDraggingInternal.current = true;
          lastTouchX.current = e.touches[0].clientX;
          lastTouchY.current = e.touches[0].clientY;
        }
        if (e.touches.length === 2) {
          lastPinchDistance.current = getDistance(e.touches[0], e.touches[1]);
        }
      }

      if (cameraMode === "orbit" && e.touches.length === 1) {
        isDraggingInternal.current = true;
        dragButton.current = 0;
        lastTouchX.current = e.touches[0].clientX;
        lastTouchY.current = e.touches[0].clientY;
      }
    };

    const handleTouchMove = (e) => {
      // ✅ Skip camera updates while dragging objects globally
      if (isDragging) return;

      if (cameraMode === "third") {
        if (!isDraggingInternal.current) return;
        for (let touch of e.touches) {
          if (touch.identifier === activeTouchId.current) {
            const deltaX = touch.clientX - lastTouchX.current;
            const deltaY = touch.clientY - lastTouchY.current;
            lastTouchX.current = touch.clientX;
            lastTouchY.current = touch.clientY;
            userYawOffset.current += deltaX * CAMERA_SENSITIVITY;
            userPitchOffset.current += deltaY * CAMERA_SENSITIVITY;
            userPitchOffset.current = THREE.MathUtils.clamp(
              userPitchOffset.current,
              PITCH_MIN,
              PITCH_MAX
            );
            break;
          }
        }
      }

      if (cameraMode === "top") {
        if (e.touches.length === 1 && isDraggingInternal.current) {
          const touch = e.touches[0];
          const dx = touch.clientX - lastTouchX.current;
          const dy = touch.clientY - lastTouchY.current;
          lastTouchX.current = touch.clientX;
          lastTouchY.current = touch.clientY;
          const panSpeed = 0.1 * (zoom / 20);
          topPosition.current.x -= dx * panSpeed;
          topPosition.current.z -= dy * panSpeed;
        }

        if (e.touches.length === 2) {
          const distance = getDistance(e.touches[0], e.touches[1]);
          if (lastPinchDistance.current !== null) {
            const delta = distance - lastPinchDistance.current;
            setZoom(clampZoom(zoom - delta * 0.05));
          }
          lastPinchDistance.current = distance;
        }
      }

      if (cameraMode === "orbit" && isDraggingInternal.current && e.touches.length === 1) {
        const touch = e.touches[0];
        const dx = touch.clientX - lastTouchX.current;
        const dy = touch.clientY - lastTouchY.current;
        lastTouchX.current = touch.clientX;
        lastTouchY.current = touch.clientY;
        orbitYaw.current -= dx * 0.005;
        orbitPitch.current -= dy * 0.005;
        orbitPitch.current = THREE.MathUtils.clamp(
          orbitPitch.current,
          0.01,
          Math.PI - 0.01
        );
      }
    };

    const handleTouchEnd = () => {
      isDraggingInternal.current = false;
      activeTouchId.current = null;
      lastPinchDistance.current = null;
      dragButton.current = null;
    };

    const handleMouseDown = (e) => {
      if (cameraMode === "orbit" || cameraMode === "top") {
        isDraggingInternal.current = true;
        dragButton.current = e.button;
        lastTouchX.current = e.clientX;
        lastTouchY.current = e.clientY;

        if (cameraMode === "orbit" && (e.button === 2 || e.button === 1)) {
          e.preventDefault();
        }
      }
    };

    const handleMouseMove = (e) => {
      // ✅ Skip camera movement during object drag
      if (isDragging) return;

      if (!isDraggingInternal.current) return;

      const dx = e.clientX - lastTouchX.current;
      const dy = e.clientY - lastTouchY.current;
      lastTouchX.current = e.clientX;
      lastTouchY.current = e.clientY;

      if (cameraMode === "orbit") {
        if (dragButton.current === 0) {
          orbitYaw.current -= dx * 0.005;
          orbitPitch.current -= dy * 0.005;
          orbitPitch.current = THREE.MathUtils.clamp(
            orbitPitch.current,
            0.01,
            Math.PI - 0.01
          );
        }
        if (dragButton.current === 2) {
          const panSpeed = 0.0025 * clampZoom(zoom);
          const yaw = orbitYaw.current ?? 0;

          const right = new THREE.Vector3(Math.cos(yaw), 0, -Math.sin(yaw));
          const forward = new THREE.Vector3(Math.sin(yaw), 0, Math.cos(yaw));

          const pan = new THREE.Vector3();
          pan.addScaledVector(right, -dx * panSpeed);
          pan.addScaledVector(forward, -dy * panSpeed);
          orbitTarget.current.add(pan);
        }

        if (dragButton.current === 1) {
          orbitTarget.current.y += dy * ORBIT_VERTICAL_SPEED;
        }
      }

      if (cameraMode === "top") {
        if (dragButton.current === 0) {
          const panSpeed = 0.1 * (zoom / 20);
          topPosition.current.x -= dx * panSpeed;
          topPosition.current.z -= dy * panSpeed;
        }

        if (dragButton.current === 1) {
          setZoom(clampZoom(zoom + dy * 0.1));
        }
      }
    };

    const handleMouseUp = () => {
      isDraggingInternal.current = false;
      dragButton.current = null;
    };

    const handleContextMenu = (e) => {
      if (cameraMode === "orbit") e.preventDefault();
    };

    const handleWheel = (e) => {
      if (cameraMode === "top") setZoom(clampZoom(zoom + e.deltaY * 0.05));
      else if (cameraMode === "third") setZoom(clampZoom(zoom + e.deltaY * 0.005));
      else if (cameraMode === "orbit") setZoom(clampZoom(zoom + e.deltaY * ORBIT_ZOOM_SPEED));
    };

    // Event binding (keep as before)
    canvas.addEventListener("touchstart", handleTouchStart, { passive: true });
    canvas.addEventListener("touchmove", handleTouchMove, { passive: true });
    canvas.addEventListener("touchend", handleTouchEnd, { passive: true });
    canvas.addEventListener("touchcancel", handleTouchEnd, { passive: true });
    canvas.addEventListener("mousedown", handleMouseDown);
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    canvas.addEventListener("wheel", handleWheel, { passive: true });
    canvas.addEventListener("contextmenu", handleContextMenu);

    return () => {
      canvas.removeEventListener("touchstart", handleTouchStart);
      canvas.removeEventListener("touchmove", handleTouchMove);
      canvas.removeEventListener("touchend", handleTouchEnd);
      canvas.removeEventListener("touchcancel", handleTouchEnd);
      canvas.removeEventListener("mousedown", handleMouseDown);
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
      canvas.removeEventListener("wheel", handleWheel);
      canvas.removeEventListener("contextmenu", handleContextMenu);
    };
  }, [gl, cameraMode, zoom, setZoom, isDragging]);

  useFrame(() => {
    if (cameraMode === "orbit") {
      if (orbitYaw.current === null || orbitPitch.current === null) {
        const target = new THREE.Vector3(0, 0, 0);
        const offset = camera.position.clone().sub(target);
        const spherical = new THREE.Spherical().setFromVector3(offset);
        orbitYaw.current = spherical.theta;
        orbitPitch.current = spherical.phi;
        orbitTarget.current = orbitTarget.current || new THREE.Vector3(0, 0, 0);
      }

      const target = orbitTarget.current;
      const spherical = new THREE.Spherical(clampZoom(zoom), orbitPitch.current, orbitYaw.current);
      camera.position.copy(target.clone().add(new THREE.Vector3().setFromSpherical(spherical)));
      camera.lookAt(target);
      return;
    }

    if (cameraMode === "top") {
      camera.position.set(topPosition.current.x, zoom, topPosition.current.z);
      camera.lookAt(topPosition.current.x, 0, topPosition.current.z);
      return;
    }

    if (!girlRef.current || cameraMode !== "third") return;

    const target = girlRef.current;
    const targetPos = new THREE.Vector3();
    target.getWorldPosition(targetPos);

    const targetDir = new THREE.Vector3();
    target.getWorldDirection(targetDir);

    const targetYaw = Math.atan2(targetDir.x, targetDir.z);
    const rotationDelta = Math.abs(targetYaw - lastRotation.current);
    idleTimer.current = rotationDelta > 0.01 || isDraggingInternal.current ? 0 : idleTimer.current + 0.016;
    lastRotation.current = targetYaw;

    if (idleTimer.current > 3) {
      userYawOffset.current = THREE.MathUtils.lerp(userYawOffset.current, 0, 0.05);
      userPitchOffset.current = THREE.MathUtils.lerp(userPitchOffset.current, 0, 0.05);
    }

    const cameraYaw = targetYaw + currentAngle.current + userYawOffset.current;
    const cameraPitch = userPitchOffset.current;
    const distance = clampZoom(zoom);
    const verticalOffset = -1;

    const offsetThird = new THREE.Vector3(
      Math.sin(cameraYaw) * distance * Math.cos(cameraPitch),
      Math.sin(cameraPitch) * distance + verticalOffset,
      Math.cos(cameraYaw) * distance * Math.cos(cameraPitch)
    );

    const desiredPos = targetPos.clone().sub(offsetThird);
    smoothPosition.current.lerp(desiredPos, 0.1);
    camera.position.copy(smoothPosition.current);
    camera.lookAt(targetPos.clone().add(new THREE.Vector3(0, verticalOffset, 0)));
  });

  useEffect(() => {
    if (cameraMode === "orbit") {
      camera.position.set(0, 2, ORBIT_INITIAL_DISTANCE);
      camera.lookAt(0, 0, 0);
      orbitYaw.current = null;
      orbitPitch.current = null;
      orbitTarget.current = new THREE.Vector3(20, 10, 40);
    }
  }, [cameraMode]);

  

  useEffect(() => {
  if (!cameraFocusTarget) return;

  const target = new THREE.Vector3(
    cameraFocusTarget[0],
    cameraFocusTarget[1],
    cameraFocusTarget[2]
  );

  // Orbit mode → move orbit center
  if (cameraMode === "orbit") {
    orbitTarget.current.copy(target);
  }

  // Top mode → move top camera center
  if (cameraMode === "top") {
    topPosition.current.x = target.x;
    topPosition.current.z = target.z;
  }

}, [cameraFocusTarget, cameraMode]);


  return null;
}
