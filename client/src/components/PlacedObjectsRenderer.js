import React from "react";
import { useMapEditor, EditorModes } from "../contexts/MapEditorContext";

export default function PlacedObjectsRenderer() {
  const { placedObjects, removeObjectAt, mode } = useMapEditor();

  return (
    <>
      {placedObjects.map((obj) => {
        if (obj.type === "coin") {
          return (
            <mesh
              key={obj.id}
              position={obj.position}
              onClick={(e) => {
                e.stopPropagation(); // prevent click from reaching ground
                if (mode === EditorModes.DELETE) {
                  removeObjectAt(obj.position);
                }
              }}
            >
              <cylinderGeometry args={[0.2, 0.2, 0.05, 32]} />
              <meshStandardMaterial color="gold" />
            </mesh>
          );
        }
        return null;
      })}
    </>
  );
}
