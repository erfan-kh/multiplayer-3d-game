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

  return {
    joystickDir,
    isJumping,
    jumpVelocity,
    handleJoystickMove,
    handleJoystickEnd,
  };
}
