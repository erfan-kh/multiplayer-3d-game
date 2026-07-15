// obstacleUtils.js
export function collectObstacleMeshes(objectRefs) {
  if (!objectRefs?.current) return [];

  const meshSet = new Set();

  Object.values(objectRefs.current).forEach((ref) => {
    const root = ref?.mesh || ref?.current || ref;
    if (!root) return;

    if (root.isMesh && root.name !== "ground" && root.visible !== false) {
      meshSet.add(root);
      return;
    }

    if (root.traverse) {
      root.traverse((child) => {
        if (
          child?.isMesh &&
          child.name !== "ground" &&
          child.visible !== false
        ) {
          meshSet.add(child);
        }
      });
    }
  });

  return Array.from(meshSet);
}
