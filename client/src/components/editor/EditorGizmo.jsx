import { useEffect, useRef } from "react";
import { TransformControls } from "@react-three/drei";
import * as THREE from "three";

/**
 * EditorGizmo
 * objectRefs.current[id] = { rigidBody, mesh }
 */
export default function EditorGizmo({
  selectedMesh,
  selectedObjectId,
  setPlacedObjects,
  objectRefs,
}) {
  const transformRef = useRef();

  useEffect(() => {
    if (!selectedMesh || !transformRef.current) return;

    const controls = transformRef.current;

    const handleObjectChange = () => {
      if (!controls.object || !selectedObjectId) return;

      const meshPos = controls.object.position;

      const entry = objectRefs?.current?.[selectedObjectId];
      const rb = entry?.rigidBody;

      if (rb?.setNextKinematicTranslation) {
        rb.setNextKinematicTranslation({
          x: meshPos.x,
          y: meshPos.y,
          z: meshPos.z,
        });
      }
    };

    const handleMouseUp = () => {
      if (!controls.object || !selectedObjectId) return;

      const meshPos = controls.object.position;

      const entry = objectRefs?.current?.[selectedObjectId];
      const rb = entry?.rigidBody;

      if (rb?.setTranslation) {
        rb.setTranslation(
          { x: meshPos.x, y: meshPos.y, z: meshPos.z },
          false
        );
      }

      setPlacedObjects((prev) =>
        prev.map((o) =>
          o.id === selectedObjectId
            ? { ...o, position: [meshPos.x, meshPos.y, meshPos.z] }
            : o
        )
      );
    };

    controls.addEventListener("objectChange", handleObjectChange);
    controls.addEventListener("mouseUp", handleMouseUp);

    return () => {
      controls.removeEventListener("objectChange", handleObjectChange);
      controls.removeEventListener("mouseUp", handleMouseUp);
    };
  }, [selectedMesh, selectedObjectId, setPlacedObjects, objectRefs]);

  //if (!selectedMesh) return null;
  return null;


  return (
    <TransformControls
      ref={transformRef}
      object={selectedMesh}
      mode="translate"
    />
  );
}
