// hooks/useGameLoop.js
import { useEffect } from "react";
import { GAME_SETTINGS } from "../constants";

export default function useGameLoop({ speed, gravity, jumpForce }) {
  useEffect(() => {
    GAME_SETTINGS.SPEED = speed;
    GAME_SETTINGS.GRAVITY = gravity;
    GAME_SETTINGS.JUMP_FORCE = jumpForce;
  }, [speed, gravity, jumpForce]);
}
