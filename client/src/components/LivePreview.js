// HERE WE ARE MAKING PREVIEW BOX AT OBJECT CREATOR PANNEL!

import React from "react";
import * as THREE from "three";
import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { a, useSpring } from "@react-spring/three";

// IMPORTANT: spring applies ONLY to a.group, not the mesh with geometry!
function PreviewObject({ objectType, size, color, rotation }) {

  const spring = useSpring({
    rotation,
    config: { mass: 1, tension: 170, friction: 26 }
  });

  const [sx, sy, sz] = size;

  const material = <meshStandardMaterial color={color} />;

  let geometry = null;

  // BOX
  if (objectType === "box") {
    geometry = <boxGeometry args={[1, 1, 1]} />;
  }

  // CYLINDER
  if (objectType === "cylinder") {
    geometry = <cylinderGeometry args={[sx / 2, sx / 2, sy, 32]} />;
  }

  // PYRAMID (cone with 4 faces)
  if (objectType === "pyramid") {
    geometry = <coneGeometry args={[sx / 2, sy, 4]} />;
  }

  // RAMP (extruded triangle)
  if (objectType === "ramp") {
    const shape = new THREE.Shape();
    shape.moveTo(0, 0);
    shape.lineTo(1, 0);
    shape.lineTo(1, 1);
    shape.lineTo(0, 0);

    const extrude = new THREE.ExtrudeGeometry(shape, {
      depth: 1,
      bevelEnabled: false
    });

    extrude.scale(sx, sy, sz);
    geometry = <primitive object={extrude} />;
  }

  // fallback
  if (!geometry) {
    geometry = <boxGeometry args={[1, 1, 1]} />;
  }

  return (
    <a.group rotation={spring.rotation} scale={size}>
      <mesh>
        {geometry}
        {material}
      </mesh>
    </a.group>
  );
}

export default function LivePreview({ objectType, size, color, rotation }) {
  return (
    <div className="live-preview-container">
      <h4 style={{ marginBottom: "0.5rem" }}>Preview</h4>

      <Canvas
        camera={{ position: [3, 3, 3], fov: 50 }}
        style={{ width: "100%", height: "200px", borderRadius: "8px" }}
      >
        <ambientLight intensity={0.5} />
        <directionalLight position={[5, 5, 5]} />

        <PreviewObject
          objectType={objectType}
          size={size}
          color={color}
          rotation={rotation}
        />

        <OrbitControls enableZoom={false} enablePan={false} />
      </Canvas>
    </div>
  );
}
