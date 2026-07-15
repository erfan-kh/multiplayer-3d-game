import { useState, useRef, useCallback } from "react";

export function useNPCDialogue() {
  const [activeDialogue, setActiveDialogue] = useState(null);
  const cooldownsRef = useRef({}); // Stores timestamps to prevent spamming
  const timerRef = useRef(null);

  const triggerDialogue = useCallback((id, text, duration = 3000, cooldown = 5000) => {
    const now = Date.now();
    
    // Check if this specific dialogue is on cooldown
    if (cooldownsRef.current[id] && now < cooldownsRef.current[id]) return;

    // Show dialogue
    setActiveDialogue(text);
    cooldownsRef.current[id] = now + cooldown;

    // Clear old timer and start new one to hide the text
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      setActiveDialogue(null);
    }, duration);
  }, []);

  return { activeDialogue, triggerDialogue };
}
