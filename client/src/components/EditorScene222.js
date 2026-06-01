import React, { useRef, useEffect, useMemo, useCallback } from "react";
import * as THREE from "three";
import { useGLTF } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";

import SpaceGirl from "./SpaceGirl";
import Coin from "./Coin";
import PlacedObjectsRenderer from "./PlacedObjectsRenderer";
import MapEditorInteraction from "./MapEditorInteraction";
import EditorGizmo from "./editor/EditorGizmo";
import useSnapping from "../hooks/useSnapping";
import EditorRuler from "../editor/EditorRuler";
import VerticalRuler from "../editor/VerticalRuler";
import MeasurementTool from "../editor/MeasurementTool";

const safeVec3 = (v) => {
  if (!v || !Array.isArray(v) || v.length !== 3) return [0, 0, 0];
  return v;
};

const GLTFObject = React.forwardRef(
  ({ modelPath, position, rotation, size, onPointerDown }, ref) => {
    const { scene } = useGLTF(modelPath);
    const model = useMemo(() => scene.clone(), [scene]);

    useEffect(() => {
      if (!model) return;
      model.traverse((child) => {
        if (child.isMesh) {
          child.castShadow = true;
          child.receiveShadow = true;
        }
      });
    }, [model]);

    const [rx, ry, rz] = rotation || [0, 0, 0];

    return (
      <primitive
        ref={ref}
        object={model}
        position={safeVec3(position)}
        rotation-x={rx}
        rotation-y={ry}
        rotation-z={rz}
        scale={size ? [...size] : size}
        onPointerDown={onPointerDown}
      />
    );
  }
);

export default function EditorScene(props) {
  const {
    placedObjects,
    setPlacedObjects,
    selectedObjectId,
    setSelectedObjectId,
    setPosition,
    size,
    color,
    rotation,
    isDrawing,
    isDeleteMode,
    snapSize,
    isDragging,
    setIsDragging,
    dragOffset,
    joystickDir,
    isJumping,
    jumpVelocity,
    cameraMode,
    coins,
    collectCoin,
    handleGroundClick,
    throttledPointerMove,
    previewPosition,
    setPreviewPosition,
    girlRef,
    objectType,
    modelPath,
    setIsVerticalDrag,
    recordHistory,
    snappingEnabled,
    objectRefs,
    isMeasureMode,
    registerClearMeasurements,
    setObjectType,
    setSize,
    setColor,
    setRotation,
    isCreatingObject
  } = props;

  // =========================================================
  // SAFE LIVE SYNC (LOOP PROTECTION)
  // =========================================================
  useEffect(() => {
    if (!selectedObjectId) return;
    if (previewPosition === null) return; // ✅ CRITICAL FIX
    if (isDrawing) return;
    if (isDragging) return;
    if (isCreatingObject) return;

    setPlacedObjects((prev) => {
      let updated = false;

      const next = prev.map((obj) => {
        if (obj.id !== selectedObjectId) return obj;

        const nextPos =
          previewPosition !== null
            ? [...previewPosition]
            : [...safeVec3(obj.position)];

        const nextSize = size ? [...size] : obj.size;
        const nextRot = rotation ? [...rotation] : obj.rotation;
        const nextColor = color ?? obj.color;

        const noChange =
          JSON.stringify(obj.position) === JSON.stringify(nextPos) &&
          JSON.stringify(obj.size) === JSON.stringify(nextSize) &&
          JSON.stringify(obj.rotation) === JSON.stringify(nextRot) &&
          obj.color === nextColor;

        if (noChange) return obj;

        updated = true;

        return {
          ...obj,
          position: nextPos,
          size: nextSize,
          rotation: nextRot,
          color: nextColor
        };
      });

      return updated ? next : prev;
    });
  }, [
    previewPosition,
    size,
    rotation,
    color,
    selectedObjectId,
    isDrawing,
    isDragging,
    isCreatingObject,
    setPlacedObjects
  ]);

  const rampGeometryBase = useMemo(() => {
    const shape = new THREE.Shape();
    shape.moveTo(0, 0);
    shape.lineTo(1, 0);
    shape.lineTo(1, 1);
    shape.lineTo(0, 0);

    return new THREE.ExtrudeGeometry(shape, {
      depth: 1,
      bevelEnabled: false
    });
  }, []);

  const setObjectRef = useCallback(
    (id, node) => {
      if (!objectRefs || !objectRefs.current) return;
      if (node) objectRefs.current[id] = node;
      else delete objectRefs.current[id];
    },
    [objectRefs]
  );

  const safePreviewPosition = previewPosition !== null ? previewPosition : null;

  const { snapPreview, handlePointerUp } = useSnapping({
    placedObjects,
    objectRefs,
    selectedObjectId,
    position: safePreviewPosition,
    setPlacedObjects,
    setPosition,
    isDragging,
    setIsDragging,
    snappingEnabled,
    recordHistory,

    getDraggedMesh: () =>
      selectedObjectId && objectRefs && objectRefs.current
        ? objectRefs.current[selectedObjectId] || null
        : null
  });

  useEffect(() => {
    window.__R3F_EDITOR_OBJECT_REFS__ = objectRefs;
  }, [objectRefs]);

  useFrame((state) => {
    state.scene.userData.placedObjects = [
      ...placedObjects.map((o) => ({ collision: "solid", ...o })),
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

  const loadObjectIntoEditorState = (obj) => {
    if (!obj) return;
    setObjectType(obj.type);
    setSize([...obj.size]);
    setColor(obj.color);
    setRotation([...obj.rotation]);
    setPosition([...obj.position]);
  };

  const computeSnap = (x, z) => [
    Math.round(x / snapSize) * snapSize,
    size ? size[1] / 2 : 0.5,
    Math.round(z / snapSize) * snapSize
  ];

  const handleGroundPointerMove = (e) => {
  // ❌ Do not allow ghost preview to resurrect
  if (!isDrawing && !isDragging) {
    setPreviewPosition(null);
    return;
  }

  if (isDrawing) {
    const snapped = computeSnap(e.point.x, e.point.z);
    setPreviewPosition(snapped);
    return;
  }

  // dragging case:
  throttledPointerMove(e);
};


  const startDragging = (e, obj) => {
    e.stopPropagation();

    if (isDeleteMode) {
      recordHistory();
      setPlacedObjects((prev) => prev.filter((o) => o.id !== obj.id));
      return;
    }

    loadObjectIntoEditorState(obj);
    setSelectedObjectId(obj.id);

    const vertical = e.shiftKey;
    setIsVerticalDrag(vertical);

    const objPos = new THREE.Vector3(...obj.position);
    const intersection = new THREE.Vector3();

    if (vertical) {
      const cameraDir = new THREE.Vector3();
      e.camera.getWorldDirection(cameraDir);
      cameraDir.y = 0;
      cameraDir.normalize();

      const verticalPlane = new THREE.Plane(
        cameraDir,
        -new THREE.Vector3(objPos.x, 0, objPos.z).dot(cameraDir)
      );

      if (e.ray.intersectPlane(verticalPlane, intersection)) {
        dragOffset.current = [0, intersection.y - objPos.y, 0];
      }
    } else {
      const groundPlane = new THREE.Plane(
        new THREE.Vector3(0, 1, 0),
        -objPos.y
      );

      if (e.ray.intersectPlane(groundPlane, intersection)) {
        dragOffset.current = [
          intersection.x - objPos.x,
          0,
          intersection.z - objPos.z
        ];
      }
    }

    setPosition([...obj.position]);
    setPreviewPosition([...obj.position]);

    requestAnimationFrame(() => {
      setIsDragging(true);
    });
  };

  const blockDragIfCreating = (e, obj) => {
    if (isDrawing) {
      e.stopPropagation();
      return;
    }
    startDragging(e, obj);
  };

  const renderBox = (obj) => {
    const isSelected = obj.id === selectedObjectId;
    const [rx, ry, rz] = obj.rotation || [0, 0, 0];

    return (
      <mesh
        key={obj.id}
        ref={(node) => setObjectRef(obj.id, node)}
        position={safeVec3(obj.position)}
        rotation-x={rx}
        rotation-y={ry}
        rotation-z={rz}
        castShadow
        receiveShadow
        onPointerDown={(e) => blockDragIfCreating(e, obj)}
      >
        <boxGeometry args={obj.size} />
        <meshStandardMaterial
          color={obj.color}
          emissive={isSelected ? "#ffff00" : "#000"}
          emissiveIntensity={isSelected ? 0.5 : 0}
        />
      </mesh>
    );
  };

  const renderObject = (obj) => renderBox(obj);

  const renderPreviewShape = () => {
    if (!previewPosition) return null;

    const [rx, ry, rz] = rotation;

    return (
      <mesh position={previewPosition} rotation-x={rx} rotation-y={ry} rotation-z={rz}>
        <boxGeometry args={size} />
        <meshStandardMaterial color={color} transparent opacity={0.5} />
      </mesh>
    );
  };

  const renderPreview = () => {
    if (!previewPosition) return null;
    return renderPreviewShape();
  };

  return (
    <>
      <mesh
        name="ground"
        rotation-x={-Math.PI / 2}
        receiveShadow
        onPointerUp={(e) => {
          handlePointerUp(e);
          setIsDragging(false);
        }}
        onClick={(e) => {
          if (!isDrawing && !isDragging) setSelectedObjectId(null);
          handleGroundClick(e);
        }}
        onPointerMove={handleGroundPointerMove}
      >
        <planeGeometry args={[50, 50]} />
        <meshStandardMaterial color="#eaf0ed" side={THREE.DoubleSide} />
      </mesh>

      <gridHelper args={[50, 50]} />
      <EditorRuler size={50} />

      <SpaceGirl
        ref={girlRef}
        joystickDir={joystickDir}
        cameraMode={cameraMode}
        isJumping={isJumping}
        jumpVelocity={jumpVelocity}
      />

      {coins.map((c) => (
        <Coin key={c.id} position={c.pos} onCollect={() => collectCoin(c.id)} />
      ))}

      <EditorGizmo
        selectedMesh={
          selectedObjectId && objectRefs && objectRefs.current
            ? objectRefs.current[selectedObjectId]
            : null
        }
        selectedObjectId={selectedObjectId}
        setPlacedObjects={setPlacedObjects}
      />

      {placedObjects.map(renderObject)}

      {previewPosition && renderPreview()}


      <MapEditorInteraction />
    </>
  );
}
