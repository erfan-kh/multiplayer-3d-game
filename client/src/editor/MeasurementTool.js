import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";
import * as THREE from "three";
import { useThree } from "@react-three/fiber";

export default function MeasurementTool({ isActive, onClearRequest }) {
  const { camera, scene, gl } = useThree();

  // state + ref to avoid stale closures
  const [measurements, setMeasurements] = useState([]);
  const measurementsRef = useRef([]);

  const raycaster = useMemo(() => new THREE.Raycaster(), []);
  const mouse = useMemo(() => new THREE.Vector2(), []);

  const POST_LENGTH = 1.5;

  // ============================================================
  // CLEAR MEASUREMENTS (FINAL FIXED VERSION)
  // ============================================================

  const clearMeasurements = useCallback(() => {
    const list = measurementsRef.current;

    list.forEach((m) => {
      const { objects } = m;

      if (!objects) return;

      if (objects.postA) scene.remove(objects.postA);
      if (objects.postB) scene.remove(objects.postB);
      if (objects.markerA) scene.remove(objects.markerA);
      if (objects.markerB) scene.remove(objects.markerB);
      if (objects.line) scene.remove(objects.line);
      if (objects.label) scene.remove(objects.label);

      Object.values(objects).forEach((obj) => {
        if (!obj) return;
        if (obj.geometry) obj.geometry.dispose();
        if (obj.material) obj.material.dispose();
      });
    });

    measurementsRef.current = [];
    setMeasurements([]);

  }, [scene]);

  // register clear function (NO stale closure anymore)
  useEffect(() => {
    if (!onClearRequest) return;
    
    onClearRequest(clearMeasurements);
  }, [onClearRequest, clearMeasurements]);

  // ============================================================
  // HELPERS
  // ============================================================

  function createPost() {
    const geom = new THREE.CylinderGeometry(0.03, 0.03, POST_LENGTH, 12);
    const mat = new THREE.MeshBasicMaterial({
      color: 0x00ffff,
      depthTest: false,
      transparent: true,
      opacity: 1
    });

    const mesh = new THREE.Mesh(geom, mat);
    mesh.renderOrder = 9999;
    mesh.visible = false;
    mesh.userData.isMeasurementHelper = true;
    scene.add(mesh);
    return mesh;
  }

  function createMarker() {
    const geom = new THREE.CircleGeometry(0.15, 32);
    const mat = new THREE.MeshBasicMaterial({
      color: 0xff00ff,
      depthTest: false,
      transparent: true,
      opacity: 1,
      side: THREE.DoubleSide
    });

    const mesh = new THREE.Mesh(geom, mat);
    mesh.renderOrder = 9999;
    mesh.visible = false;
    mesh.userData.isMeasurementHelper = true;
    scene.add(mesh);
    return mesh;
  }

  function createLine() {
    const geom = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(),
      new THREE.Vector3()
    ]);

    const mat = new THREE.LineBasicMaterial({
      color: 0xff00ff,
      depthTest: false,
      transparent: true,
      opacity: 1
    });

    const line = new THREE.Line(geom, mat);
    line.renderOrder = 9999;
    line.visible = false;
    line.userData.isMeasurementHelper = true;
    scene.add(line);
    return line;
  }

  function createMeasurementObjects() {
    return {
      postA: createPost(),
      postB: createPost(),
      markerA: createMarker(),
      markerB: createMarker(),
      line: createLine(),
      label: null
    };
  }

  // ============================================================
  // CLICK LOGIC
  // ============================================================

  useEffect(() => {
    if (!isActive) return;

    const onClick = (e) => {
      mouse.x = (e.clientX / gl.domElement.clientWidth) * 2 - 1;
      mouse.y = -(e.clientY / gl.domElement.clientHeight) * 2 + 1;

      raycaster.setFromCamera(mouse, camera);

      const intersects = raycaster
        .intersectObjects(scene.children, true)
        .filter((hit) => {
          const obj = hit.object;
          if (obj.userData.isMeasurementHelper) return false;
          if (obj.type === "GridHelper") return false;
          if (obj.type === "AxesHelper") return false;
          return true;
        });

      if (!intersects.length) return;

      const hit = intersects[0];
      const point = hit.point.clone();
      const normal = hit.face
        ? hit.face.normal.clone().transformDirection(hit.object.matrixWorld)
        : new THREE.Vector3(0, 1, 0);

      const data = { point, normal };

      setMeasurements((prev) => {
        let next;

        if (prev.length === 0 || prev[prev.length - 1].end) {
          next = [
            ...prev,
            {
              start: data,
              end: null,
              objects: createMeasurementObjects()
            }
          ];
        } else {
          next = [...prev];
          next[next.length - 1].end = data;
        }

        // sync ref
        measurementsRef.current = next;
        return next;
      });
    };

    gl.domElement.addEventListener("pointerdown", onClick);
    return () => gl.domElement.removeEventListener("pointerdown", onClick);
  }, [isActive, camera, gl, scene, raycaster, mouse]);

  // ============================================================
  // UPDATE VISUALS
  // ============================================================

  useEffect(() => {
    measurementsRef.current = measurements; // keep ref synced always

    measurements.forEach((m) => {
      const { start, end, objects } = m;

      if (!objects) return;

      if (start) {
        placePostAndMarker(objects.postA, objects.markerA, start);
      }

      if (start && end) {
        placePostAndMarker(objects.postB, objects.markerB, end);
        updateLine(m);
        updateLabel(m);
      } else {
        objects.postB.visible = false;
        objects.markerB.visible = false;
        objects.line.visible = false;
        if (objects.label) objects.label.visible = false;
      }
    });
  }, [measurements]);

  // ============================================================
  // PLACEMENT
  // ============================================================

  function placePostAndMarker(post, marker, { point, normal }) {
    const top = point.clone().add(normal.clone().multiplyScalar(POST_LENGTH));
    const mid = point.clone().add(top).multiplyScalar(0.5);
    post.position.copy(mid);

    const up = new THREE.Vector3(0, 1, 0);
    post.quaternion.setFromUnitVectors(up, normal.clone().normalize());
    post.visible = true;

    marker.position.copy(top);
    marker.lookAt(top.clone().add(normal));
    marker.visible = true;
  }

  function updateLine(m) {
    const { start, end, objects } = m;
    const aTop = start.point.clone().add(start.normal.clone().multiplyScalar(POST_LENGTH));
    const bTop = end.point.clone().add(end.normal.clone().multiplyScalar(POST_LENGTH));

    objects.line.geometry.setFromPoints([aTop, bTop]);
    objects.line.visible = true;
  }

  function updateLabel(m) {
    const { start, end, objects } = m;
    const distance = start.point.distanceTo(end.point);
    const mid = start.point.clone().lerp(end.point, 0.5);
    mid.y += 1.0;

    const newLabel = getLabel(distance, start.point, end.point);

    if (!objects.label) {
      newLabel.userData.isMeasurementHelper = true;
      scene.add(newLabel);
      objects.label = newLabel;
    } else {
      objects.label.material.map = newLabel.material.map;
      objects.label.scale.copy(newLabel.scale);
    }

    objects.label.position.copy(mid);
    objects.label.visible = true;
  }

  return null;
}

// ============================================================
// LABEL CREATOR
// ============================================================

function getLabel(distance, a, b) {
  const dx = Math.abs(a.x - b.x);
  const dy = Math.abs(a.y - b.y);
  const dz = Math.abs(a.z - b.z);

  const canvas = document.createElement("canvas");
  canvas.width = 400;
  canvas.height = 160;
  const ctx = canvas.getContext("2d");

  const W = canvas.width;
  const H = canvas.height;
  const radius = 14;

  ctx.fillStyle = "rgba(20, 20, 20, 0.35)";
  ctx.beginPath();
  ctx.moveTo(radius, 0);
  ctx.lineTo(W - radius, 0);
  ctx.quadraticCurveTo(W, 0, W, radius);
  ctx.lineTo(W, H - radius);
  ctx.quadraticCurveTo(W, H, W - radius, H);
  ctx.lineTo(radius, H);
  ctx.quadraticCurveTo(0, H, 0, H - radius);
  ctx.lineTo(0, radius);
  ctx.quadraticCurveTo(0, 0, radius, 0);
  ctx.fill();

  ctx.fillStyle = "#B8F3F3";
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";

  ctx.font = "bold 44px Inter, sans-serif";
  ctx.fillText(`${distance.toFixed(2)} m`, 24, 54);

  ctx.font = "28px Inter, sans-serif";
  ctx.fillText(`ΔX ${dx.toFixed(2)}    ΔY ${dy.toFixed(2)}    ΔZ ${dz.toFixed(2)}`, 24, 110);

  const texture = new THREE.CanvasTexture(canvas);
  const material = new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
    depthTest: false,
    depthWrite: false
  });

  const sprite = new THREE.Sprite(material);
  sprite.renderOrder = 9999;
  sprite.scale.set(3.6, 1.6, 1);

  return sprite;
}
