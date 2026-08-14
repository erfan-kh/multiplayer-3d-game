import { useState, useRef, useCallback, useEffect } from "react";

export function useNPCDialogue() {
  const [activeDialogue, setActiveDialogue] = useState(null);
  const cooldownsRef = useRef({});
  const timerRef = useRef(null);

  const clearDialogue = useCallback(() => {
    setActiveDialogue(null);
  }, []);

  const triggerDialogue = useCallback(
    (id, text, duration = 3000, cooldown = 5000) => {
      const now = Date.now();

      // Prevent the same dialogue from firing repeatedly too quickly.
      if (cooldownsRef.current[id] && now < cooldownsRef.current[id]) return;

      setActiveDialogue(text);
      cooldownsRef.current[id] = now + cooldown;

      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        setActiveDialogue(null);
        timerRef.current = null;
      }, duration);
    },
    []
  );

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  return { activeDialogue, triggerDialogue, clearDialogue };
}
