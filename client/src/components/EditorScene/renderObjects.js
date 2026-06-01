import React, { useMemo, useEffect } from "react";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";
import {
  RigidBody,
  CuboidCollider,
  CylinderCollider,
  TrimeshCollider,
  ConvexHullCollider,
} from "@react-three/rapier";

/** Safe vector helper */
export const safeVec3 = (v) =>
  !v || !Array.isArray(v) || v.length !== 3 ? [0, 0, 0] : v;

// =====================================================
// GLTF Object
// =====================================================

const GLTFObject = React.forwardRef(
  (
    { modelPath, position, rotation, size, onPointerDown, rigidRef, meshRef },
    ref
  ) => {
    const { scene } = useGLTF(modelPath);
    const model = useMemo(() => scene.clone(), [scene]);

    useEffect(() => {
      model.traverse((child) => {
        if (child.isMesh) {
          child.castShadow = true;
        }
      });
    }, [model]);

    const [rx = 0, ry = 0, rz = 0] = rotation || [];

    return (
      <RigidBody
        ref={rigidRef}
        type="kinematicPosition"
        colliders={false}
        position={safeVec3(position)}
        rotation={[rx, ry, rz]}
      >
        <TrimeshCollider mesh={model} />
        <primitive
          ref={meshRef}
          object={model}
          scale={size}
          onPointerDown={onPointerDown}
        />
      </RigidBody>
    );
  }
);

// =====================================================
// Ramp Geometry (Preview only)
// =====================================================

const RampGeometry = React.memo(function RampGeometry({ size }) {
  const geometry = useMemo(() => {
    if (!size || size.length !== 3) return new THREE.BoxGeometry(1, 1, 1);

    const [width, height, depth] = size;
    const shape = new THREE.Shape();
    shape.moveTo(0, 0);
    shape.lineTo(width, 0);
    shape.lineTo(width, height);
    shape.lineTo(0, 0);

    const extrudeSettings = { steps: 1, depth, bevelEnabled: false };
    const geo = new THREE.ExtrudeGeometry(shape, extrudeSettings);
    geo.rotateX(-Math.PI * 2);
    geo.translate(-width / 2, 0, -depth / 2);
    return geo;
  }, [size]);

  return <primitive object={geometry} attach="geometry" />;
});

// =====================================================
// Ramp Item (Collider + Rendered Mesh)
// =====================================================

const RampItem = React.memo(function RampItem({
  obj,
  rx,
  ry,
  rz,
  commonMeshProps,
  material,
  rigidRef,
}) {
  const geometry = useMemo(() => {
    if (!obj?.size || obj.size.length !== 3)
      return new THREE.BoxGeometry(1, 1, 1);

    const [width, height, depth] = obj.size;
    const shape = new THREE.Shape();
    shape.moveTo(0, 0);
    shape.lineTo(width, 0);
    shape.lineTo(width, height);
    shape.lineTo(0, 0);

    const extrudeSettings = { steps: 1, depth, bevelEnabled: false };
    const geo = new THREE.ExtrudeGeometry(shape, extrudeSettings);
    geo.rotateX(-Math.PI * 2);
    geo.translate(-width / 2, -0.5, -depth / 2);
    return geo;
  }, [obj.size]);

  const vertices = useMemo(() => {
    const pos = geometry.attributes.position.array;
    return Array.from(pos);
  }, [geometry]);

  return (
    <RigidBody
      ref={rigidRef}
      type="kinematicPosition"
      colliders={false}
      position={safeVec3(obj.position)}
      rotation={[rx, ry, rz]}
    >
      <ConvexHullCollider args={[vertices]} />
      <mesh {...commonMeshProps} geometry={geometry}>
        {material}
      </mesh>
    </RigidBody>
  );
});

// =====================================================
// Main Renderer
// =====================================================

export function renderObject(
  obj,
  selectedObjectId,
  handlePointerDown,
  objectRefs
) {
  const isSelected = obj.id === selectedObjectId;
  const [rx = 0, ry = 0, rz = 0] = obj.rotation || [];

  // --- Ref registration for both RigidBody and Mesh ---
  const registerRigidBodyRef = (rb) => {
    if (!objectRefs?.current) return;

    if (rb) {
      objectRefs.current[obj.id] = {
        ...(objectRefs.current[obj.id] || {}),
        rigidBody: rb,
      };
    } else {
      delete objectRefs.current[obj.id];
    }
  };

  const registerMeshRef = (mesh) => {
    if (!objectRefs?.current) return;
    if (!objectRefs.current[obj.id]) objectRefs.current[obj.id] = {};
    objectRefs.current[obj.id].mesh = mesh;
  };

  const commonMeshProps = {
    ref: registerMeshRef,
    castShadow: true,
    receiveShadow: true,
    onPointerDown: (e) => handlePointerDown(e, obj),
  };

  const material = (
    <meshStandardMaterial
      color={obj.color}
      emissive={isSelected ? "#ffff00" : "#000"}
      emissiveIntensity={isSelected ? 0.5 : 0}
    />
  );

  switch (obj.type) {
    case "cylinder":
      return (
        <RigidBody
          key={obj.id}
          ref={registerRigidBodyRef}
          type="kinematicPosition"
          colliders={false}
          position={safeVec3(obj.position)}
          rotation={[rx, ry, rz]}
        >
          <CylinderCollider args={[obj.size[1] / 2, obj.size[0] / 2]} />
          <mesh {...commonMeshProps}>
            <cylinderGeometry
              args={[obj.size[0] / 2, obj.size[0] / 2, obj.size[1], 32]}
            />
            {material}
          </mesh>
        </RigidBody>
      );

    case "pyramid":
      return (
        <RigidBody
          key={obj.id}
          ref={registerRigidBodyRef}
          type="kinematicPosition"
          colliders={false}
          position={safeVec3(obj.position)}
          rotation={[rx, ry, rz]}
        >
          <CuboidCollider
            args={[obj.size[0] / 2, obj.size[1] / 2, obj.size[0] / 2]}
          />
          <mesh {...commonMeshProps}>
            <coneGeometry args={[obj.size[0] / 2, obj.size[1], 4]} />
            {material}
          </mesh>
        </RigidBody>
      );

    case "ramp":
      return (
        <RampItem
          key={obj.id}
          obj={obj}
          rx={rx}
          ry={ry}
          rz={rz}
          commonMeshProps={commonMeshProps}
          material={material}
          rigidRef={registerRigidBodyRef}
        />
      );

    case "gltf":
      return (
        <GLTFObject
          key={obj.id}
          rigidRef={registerRigidBodyRef}
          meshRef={registerMeshRef}
          modelPath={obj.modelPath}
          size={obj.size}
          position={obj.position}
          rotation={obj.rotation}
          onPointerDown={(e) => handlePointerDown(e, obj)}
        />
      );

    case "box":
    default:
      return (
        <RigidBody
          key={obj.id}
          ref={registerRigidBodyRef}
          type="kinematicPosition"
          colliders={false}
          position={safeVec3(obj.position)}
          rotation={[rx, ry, rz]}
        >
          <CuboidCollider
            args={[
              obj.size[0] / 2,
              obj.size[1] / 2,
              obj.size[2] / 2,
            ]}
          />
          <mesh {...commonMeshProps}>
            <boxGeometry args={obj.size} />
            {material}
          </mesh>
        </RigidBody>
      );
  }
}

// =====================================================
// Preview Renderer (unchanged)
// =====================================================

export function renderPreview(previewPosition, size, rotation, color, type) {
  if (!previewPosition) return null;
  const [rx = 0, ry = 0, rz = 0] = rotation || [];

  switch (type) {
    case "cylinder":
      return (
        <mesh position={previewPosition} rotation={[rx, ry, rz]}>
          <cylinderGeometry args={[size[0] / 2, size[0] / 2, size[1], 32]} />
          <meshStandardMaterial color={color} transparent opacity={0.5} />
        </mesh>
      );

    case "pyramid":
      return (
        <mesh position={previewPosition} rotation={[rx, ry, rz]}>
          <coneGeometry args={[size[0] / 2, size[1], 4]} />
          <meshStandardMaterial color={color} transparent opacity={0.5} />
        </mesh>
      );

    case "ramp":
      return (
        <mesh position={previewPosition} rotation={[rx, ry, rz]}>
          <RampGeometry size={size} />
          <meshStandardMaterial color={color} transparent opacity={0.5} />
        </mesh>
      );

    case "box":
    default:
      return (
        <mesh position={previewPosition} rotation={[rx, ry, rz]}>
          <boxGeometry args={size} />
          <meshStandardMaterial color={color} transparent opacity={0.5} />
        </mesh>
      );
  }
}
