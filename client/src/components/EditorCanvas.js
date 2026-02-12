// components/EditorCanvas.js
import React from "react";
import { Canvas } from "@react-three/fiber";
import * as THREE from "three";
import { OrbitControls } from "@react-three/drei";

import EditorScene from "./EditorScene";
import CameraController from "./CameraController";

export default function EditorCanvas(props) {
  const {
    isDragging,
    cameraMode,
    zoom,
    handlePointerUp,
    girlRef, // explicitly destructure girlRef
  } = props;

  return (
    <Canvas
      camera={{ position: [0, 2, 5], fov: 60 }}
      onPointerMissed={(e) => e.stopPropagation()}
      onPointerUp={handlePointerUp}
    >
      <color attach="background" args={["#d0dcff"]} />
      <ambientLight intensity={0.7} />
      <directionalLight position={[5, 5, 5]} intensity={0.8} />

      <EditorScene {...props} />

      {cameraMode === "orbit" && (
        <OrbitControls
          enableZoom={false}
          enableRotate={!isDragging}
          enablePan={!isDragging}
        />
      )}

      <CameraController cameraMode={cameraMode} girlRef={girlRef} />
    </Canvas>
  );
}
