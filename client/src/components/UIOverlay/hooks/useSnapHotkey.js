import { useEffect } from "react";

export default function useSnapHotkey(setSnappingEnabled) {

  useEffect(() => {

    const handleKeyDown = (e) => {

      // require SHIFT + S instead of just S
      if (e.key.toLowerCase() === "s" && e.shiftKey) {

        e.preventDefault();

        setSnappingEnabled(prev => !prev);

      }

    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };

  }, [setSnappingEnabled]);

}
