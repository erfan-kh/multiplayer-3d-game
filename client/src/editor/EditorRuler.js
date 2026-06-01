import React, { useMemo } from "react";
import * as THREE from "three";
import { useThree } from "@react-three/fiber";

export default function EditorRuler({ size = 50 }) {

  const { scene } = useThree();

  const lines = useMemo(() => {
    const group = new THREE.Group();

    const material = new THREE.LineBasicMaterial({ color: "#888" });

    for (let i = -size / 2; i <= size / 2; i++) {

      const isMajor = i % 5 === 0;

      // X-axis ruler (parallel to Z)
      {
        const points = [
          new THREE.Vector3(i, 0.01, -size / 2),
          new THREE.Vector3(i, 0.01, -size / 2 + (isMajor ? 1 : 0.5))
        ];
        const geometry = new THREE.BufferGeometry().setFromPoints(points);
        group.add(new THREE.Line(geometry, material));

        if (isMajor) {
          const label = makeTextSprite(String(i));
          label.position.set(i, 0.01, -size / 2 - 0.5);
          group.add(label);
        }
      }

      // Z-axis ruler (parallel to X)
      {
        const points = [
          new THREE.Vector3(-size / 2, 0.01, i),
          new THREE.Vector3(-size / 2 + (isMajor ? 1 : 0.5), 0.01, i)
        ];
        const geometry = new THREE.BufferGeometry().setFromPoints(points);
        group.add(new THREE.Line(geometry, material));

        if (isMajor) {
          const label = makeTextSprite(String(i));
          label.position.set(-size / 2 - 0.5, 0.01, i);
          group.add(label);
        }
      }

    }

    return group;
  }, [size]);

  function makeTextSprite(text) {
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    canvas.width = canvas.height = 256;

    ctx.fillStyle = "#444";
    ctx.font = "48px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(text, 128, 128);

    const texture = new THREE.CanvasTexture(canvas);
    const material = new THREE.SpriteMaterial({ map: texture, depthWrite: false, transparent: true });
    const sprite = new THREE.Sprite(material);
    sprite.scale.set(1.5, 1.5, 1.5);

    return sprite;
  }

  return <primitive object={lines} />;

}
