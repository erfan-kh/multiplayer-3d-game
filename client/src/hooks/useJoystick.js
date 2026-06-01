import { useRef, useCallback } from "react";

export default function useJoystick() {

  const joystickDir = useRef({ x: 0, y: 0 });
  const isJumping = useRef(false);
  const jumpVelocity = useRef(0);

  const handleJoystickMove = useCallback((dir) => {
    joystickDir.current = dir;
  }, []);

  const handleJoystickEnd = useCallback(() => {
    joystickDir.current = { x: 0, y: 0 };
  }, []);

  // ✅ NEW: jump handler used by button and keyboard
  const handleJump = useCallback(() => {
    if (isJumping.current) return;

    isJumping.current = true;
    jumpVelocity.current = 0.15; // initial jump force
  }, []);

  return {
    joystickDir,
    isJumping,
    jumpVelocity,
    handleJoystickMove,
    handleJoystickEnd,
    handleJump
  };
}
