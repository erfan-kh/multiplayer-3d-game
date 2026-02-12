// hooks/useCameraMode.js
import { useState, useEffect } from "react";

export default function useCameraMode() {
  const [cameraMode, setCameraMode] = useState("orbit");

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key.toLowerCase() === "c") {
        setCameraMode((prev) =>
          prev === "orbit" ? "third" : prev === "third" ? "top" : "orbit"
        );
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  return [cameraMode, setCameraMode];
}
