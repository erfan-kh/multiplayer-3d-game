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
    handleJump
  } = useJoystick();

  return {
    girlRef,
    joystickDir,
    isJumping,
    jumpVelocity,
    handleJoystickMove,
    handleJoystickEnd,
    handleJump
  };

}
