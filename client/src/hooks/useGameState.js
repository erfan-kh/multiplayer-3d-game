// AT THIS MOMENT WE HAVE NO IDEA WHAT WE ARE DOING HERE

// hooks/useGameState.js
import { useState } from "react";

export default function useGameState() {
  const [score, setScore] = useState(0);
  const [coins, setCoins] = useState([
    { id: 1, pos: [2, 0.5, -2] },
    { id: 2, pos: [-3, 0.5, 1] },
    { id: 3, pos: [1, 0.5, 3] },
  ]);

  const collectCoin = (id) => {
    setCoins((prev) => prev.filter((coin) => coin.id !== id));
    setScore((prev) => prev + 1);
  };

  return {
    score,
    setScore,
    coins,
    setCoins,
    collectCoin,
  };
}
