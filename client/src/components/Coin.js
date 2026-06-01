//HRE IS WE ARE IMPORTING COINS FOR EXP IN THE GAME, WE HAVE TO DEVELOP THIS PART IN NEXT UPDATES!

import React, { useRef } from "react";
import { useFrame } from "@react-three/fiber";

export default function Coin({ position, onCollect }) {
  const ref = useRef();
  useFrame(() => {
    ref.current.rotation.y += 0.05;
  });
  return (
    <mesh ref={ref} position={position} onClick={onCollect} onPointerDown={onCollect}>
      <torusGeometry args={[0.2, 0.05, 8, 16]} />
      <meshStandardMaterial color="gold" />
    </mesh>
  );
}
