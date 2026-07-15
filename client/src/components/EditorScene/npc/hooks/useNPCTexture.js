import { useState, useEffect } from "react";
import * as THREE from "three";

/**
 * Custom hook to handle async texture loading and automatic aspect ratio calculations.
 */
export function useNPCTexture(textureUrl) {
  const [texture, setTexture] = useState(null);
  const [spriteAspect, setSpriteAspect] = useState(1);
  const [spriteReady, setSpriteReady] = useState(false);

  useEffect(() => {
    if (textureUrl) {
      const loader = new THREE.TextureLoader();
      setSpriteReady(false);

      loader.load(
        textureUrl,
        (loadedTex) => {
          loadedTex.minFilter = THREE.LinearFilter;
          loadedTex.magFilter = THREE.LinearFilter;
          loadedTex.generateMipmaps = false;
          loadedTex.colorSpace = THREE.SRGBColorSpace;

          const imageWidth = loadedTex.image?.width || 1;
          const imageHeight = loadedTex.image?.height || 1;
          const aspect = imageWidth / imageHeight;

          setTexture(loadedTex);
          setSpriteAspect(aspect > 0 ? aspect : 1);
          setSpriteReady(true);
        },
        undefined,
        (err) => {
          console.error("Failed to load NPC texture:", err);
          setTexture(null);
          setSpriteAspect(1);
          setSpriteReady(false);
        }
      );
    } else {
      setTexture(null);
      setSpriteAspect(1);
      setSpriteReady(false);
    }
  }, [textureUrl]);

  return { texture, spriteAspect, spriteReady };
}
