import { useThree, useFrame } from "@react-three/fiber";
import { useMapEditor, EditorModes } from "../contexts/MapEditorContext";
import * as THREE from "three";
import { useEffect } from "react";

export default function MapEditorInteraction() {
  const { camera, gl, scene } = useThree();
  const raycaster = new THREE.Raycaster();
  const mouse = new THREE.Vector2();

  const { mode, addObject, removeObjectAt } = useMapEditor();

  useEffect(() => {
    const handleClick = (event) => {
      if (mode === EditorModes.NONE) return;

      const rect = gl.domElement.getBoundingClientRect();
      mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

      raycaster.setFromCamera(mouse, camera);

      const intersects = raycaster.intersectObjects(scene.children, true);
      const groundHit = intersects.find((i) => i.object.name === "ground");

      if (!groundHit) return;

      const point = groundHit.point;
      const position = [point.x, 0, point.z];

      if (mode === EditorModes.PLACE_COIN) {
        addObject("coin", position);
      } else if (mode === EditorModes.DELETE) {
        removeObjectAt(position);
      }
    };

    gl.domElement.addEventListener("pointerdown", handleClick);
    return () => gl.domElement.removeEventListener("pointerdown", handleClick);
  }, [camera, gl, scene, mode, addObject, removeObjectAt]);

  return null;
}
