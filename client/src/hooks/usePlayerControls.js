// hooks/usePlayerControls.js
import { useRef } from "react";
import useJoystick from "./useJoystick";

export default function usePlayerControls() {
  const girlRef = useRef();

  const {
    joystickDir,
    isJumping,
    jumpVelocity,
    handleJoystickMove,
    handleJoystickEnd,
  } = useJoystick();

  return {
    girlRef,
    joystickDir,
    isJumping,
    jumpVelocity,
    handleJoystickMove,
    handleJoystickEnd,
  };
}
