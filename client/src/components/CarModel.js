//IT WAS A TEST MODEL TO IMPORT .GLTF FILE TO GAME

// src/components/CarModel.js
import React from "react";
import { useGLTF } from "@react-three/drei";

export default function CarModel(props) {
  const { scene } = useGLTF("/models/car/car.gltf"); // ✅ Correct path
  return <primitive object={scene} {...props} />;
}
