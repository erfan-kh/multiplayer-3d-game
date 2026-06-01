import React, { useMemo } from "react";
import * as THREE from "three";

/**
 * VerticalRuler
 * - Draws a vertical ruler at a given world position.
 * - 1 unit = 1 meter by default.
 *
 * Props:
 * - height: total height in meters (default 20)
 * - step: small tick spacing in meters (default 1)
 * - majorEvery: major tick frequency in meters (default 5)
 * - x, z: world position where the ruler stands (default left/back corner)
 * - yOffset: lift slightly above ground to avoid z-fighting (default 0.01)
 * - color: tick/line color (default '#666')
 * - labelColor: text color (default '#444')
 */
export default function VerticalRuler({
  height = 20,
  step = 1,
  majorEvery = 5,
  x = -25,        // default aligns with your 50x50 plane at the left edge
  z = -25,        // default aligns with back edge
  yOffset = 0.01,
  color = "#666",
  labelColor = "#444",
}) {
  const group = useMemo(() => {
    const g = new THREE.Group();

    // Main vertical line
    {
      const points = [
        new THREE.Vector3(x, yOffset, z),
        new THREE.Vector3(x, height, z),
      ];
      const geom = new THREE.BufferGeometry().setFromPoints(points);
      const mat = new THREE.LineBasicMaterial({ color });
      g.add(new THREE.Line(geom, mat));
    }

    // Tick marks + labels
    for (let y = 0; y <= height; y += step) {
      const isMajor = y % majorEvery === 0;
      const tickLen = isMajor ? 0.6 : 0.3;

      // Tick line extends along +X from the ruler
      const p1 = new THREE.Vector3(x, y, z);
      const p2 = new THREE.Vector3(x + tickLen, y, z);

      const geom = new THREE.BufferGeometry().setFromPoints([p1, p2]);
      const mat = new THREE.LineBasicMaterial({ color });
      g.add(new THREE.Line(geom, mat));

      if (isMajor) {
        // Label sprite
        const label = makeTextSprite(String(y), labelColor);
        // Position label slightly beyond the major tick
        label.position.set(x + tickLen + 0.35, y, z);
        // Keep labels from writing to depth so they remain visible
        label.renderOrder = 999;
        g.add(label);
      }
    }

    return g;
  }, [height, step, majorEvery, x, z, yOffset, color, labelColor]);

  return <primitive object={group} />;
}

function makeTextSprite(text, color = "#444") {
  const canvas = document.createElement("canvas");
  const size = 256;
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");

  // Background transparent, crisp text
  ctx.clearRect(0, 0, size, size);
  ctx.fillStyle = color;
  ctx.font = "bold 64px system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, size / 2, size / 2);

  const texture = new THREE.CanvasTexture(canvas);
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.anisotropy = 1;

  const material = new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
    depthWrite: false, // keep visible
  });

  const sprite = new THREE.Sprite(material);
  // Scale: tune to your scene — here ~0.8m tall text
  sprite.scale.set(0.8, 0.8, 0.8);
  return sprite;
}
