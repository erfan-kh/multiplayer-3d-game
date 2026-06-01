// MapEditorInteraction.jsx
// Central interaction layer for map editing (coin placement & deletion).
// ✅ Updated to use R3F pointer events instead of manual DOM math.
// ✅ Eliminates getBoundingClientRect-related TypeError.

import { useThree } from "@react-three/fiber";
import { useMapEditor, EditorModes } from "../contexts/MapEditorContext";
import * as THREE from "three";

export default function MapEditorInteraction() {
  const { scene } = useThree();
  const { mode, addObject, removeObjectAt } = useMapEditor();

  /**
   * Handles pointer clicks anywhere on the ground (through R3F's event system).
   */
  const handlePointerDown = (e) => {
    if (mode === EditorModes.NONE) return;

    // Stop event bubbling if needed
    e.stopPropagation?.();

    // R3F provides e.point automatically (world intersection point)
    const point = e.point;
    if (!point) return;

    // Use ground-level x,z coordinates
    const position = [point.x, 0, point.z];

    if (mode === EditorModes.PLACE_COIN) {
      addObject("coin", position);
    } else if (mode === EditorModes.DELETE) {
      removeObjectAt(position);
    }
  };

  /**
   * We attach this handler to a large invisible plane that covers the ground.
   * This removes all manual DOM math & ensures compatibility with R3F's event system.
   */
  return (
    <mesh
      name="editor-interaction-plane"
      visible={false}
      onPointerDown={handlePointerDown}
      // Large plane to cover the work area
      position={[0, 0, 0]}
      rotation={[-Math.PI / 2, 0, 0]}
    >
      <planeGeometry args={[5000, 5000]} />
      <meshBasicMaterial transparent opacity={0} depthWrite={false} />
    </mesh>
  );
}
