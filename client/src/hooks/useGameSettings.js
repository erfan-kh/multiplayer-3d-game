// AT THIS MOMENT WE HAVE NO IDEA WHAT WE ARE DOING HERE, IT IS SOMTHING ABOUT GAMME SETTING PANNEL!

// hooks/useGameSettings.js
import { useState } from "react";
import { GAME_SETTINGS } from "../constants";

export default function useGameSettings() {
  const [speed, setSpeed] = useState(GAME_SETTINGS.SPEED);
  const [gravity, setGravity] = useState(GAME_SETTINGS.GRAVITY);
  const [jumpForce, setJumpForce] = useState(GAME_SETTINGS.JUMP_FORCE);

  return {
    speed,
    setSpeed,
    gravity,
    setGravity,
    jumpForce,
    setJumpForce,
  };
}
