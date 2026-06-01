import { useFrame } from "@react-three/fiber";

export default function useSceneMetadata(placedObjects, objectRefs) {
  useFrame((state) => {
    state.scene.userData.placedObjects = [
      ...placedObjects.map(o => ({ collision: "solid", ...o })),
      {
        id: "__ground__",
        type: "box",
        size: [50, 1, 50],
        position: [0, -0.5, 0],
        rotation: [0, 0, 0],
        collision: "solid"
      }
    ];

    state.scene.userData.objectRefs = { current: objectRefs.current };
  });
}
