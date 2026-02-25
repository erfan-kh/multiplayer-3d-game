import React from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { a, useSpring } from "@react-spring/three";

function PreviewObject({ size, color, rotation }) {
  const spring = useSpring({
    rotation,
    config: { mass: 1, tension: 170, friction: 26 },
  });

  return (
    <a.mesh scale={size} rotation={spring.rotation}>
      <boxGeometry args={[1, 1, 1]} />
      <meshStandardMaterial color={color} />
    </a.mesh>
  );
}

export default function LivePreview({ size, color, rotation }) {
  return (
    <div className="live-preview-container">
      <h4 style={{ marginBottom: "0.5rem" }}>Preview</h4>
      <Canvas
        camera={{ position: [3, 3, 3], fov: 50 }}
        style={{ width: "100%", height: "200px", borderRadius: "8px" }}
      >
        <ambientLight intensity={0.5} />
        <directionalLight position={[5, 5, 5]} />
        <PreviewObject size={size} color={color} rotation={rotation} />
        <OrbitControls enableZoom={false} enablePan={false} />
      </Canvas>
    </div>
  );
}
