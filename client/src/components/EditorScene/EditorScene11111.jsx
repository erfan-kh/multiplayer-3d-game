import React, { useEffect } from "react";
import * as THREE from "three";
import { Physics, RigidBody, CuboidCollider } from "@react-three/rapier";

import SpaceGirl from "../SpaceGirl";
import Coin from "../Coin";
import MapEditorInteraction from "../MapEditorInteraction";
import EditorGizmo from "../editor/EditorGizmo";
import EditorRuler from "../../editor/EditorRuler";

import useSceneMetadata from "./useSceneMetadata";
import useEditorDragging from "./useEditorDragging";
import useEditorPreview from "./useEditorPreview";
import { renderObject, renderPreview } from "./renderObjects";

export default function EditorScene(props) {
  const {
    gravity,

    placedObjects,
    setPlacedObjects,

    selectedObjectId,
    setSelectedObjectId,
    setPosition,

    size,
    color,
    rotation,
    objectType,

    isDrawing,
    isDeleteMode,
    isDragging,
    isCreatingObject,

    snapSize,
    snappingEnabled,

    setIsDragging,
    dragOffset,
    previewPosition,
    setPreviewPosition,

    setIsVerticalDrag,

    objectRefs,
    positionRef,

    recordHistory,

    joystickDir,
    isJumping,
    jumpVelocity,
    cameraMode,

    coins,
    collectCoin,

    handleGroundClick,
    girlRef,

    setObjectType,
    setSize,
    setColor,
    setRotation,

    material,
    setMaterial,
  } = props;

  // ============================
  // Scene metadata
  // ============================
  useSceneMetadata(placedObjects, objectRefs);

  // ============================
  // Dragging logic
  // ============================
  const { handleBoxPointerDown, handleBoxPointerMove } = useEditorDragging({
    isDrawing,
    isDeleteMode,
    setPlacedObjects,
    setSelectedObjectId,
    setIsVerticalDrag,
    dragOffset,

    recordHistory,
    setPosition,
    setPreviewPosition,

    setIsDragging,
    objectRefs,
    snappingEnabled,
    snapSize,

    placedObjects,   // ✅ THIS WAS MISSING
    
    loadObjectIntoEditorState: (obj) => {
  setObjectType(obj.type);
  setSize([...obj.size]);
  setColor(obj.color || "#cccccc");
  setMaterial?.(obj.material || "standard");

  setRotation([...(obj.rotation || [0, 0, 0])]);
  setPosition([...obj.position]);
  setPreviewPosition([...obj.position]);
}

  });

  // ============================
  // Ground preview + drag bridge
  // ============================
  const { handleGroundPointerMove } = useEditorPreview({
    isDrawing,
    isDragging,
    previewPosition,
    setPreviewPosition,
    snapSize,
    size,
    rotation,
    color,
    handleBoxPointerMove
  });

  // =========================================================
  // Commit drag result when drag ends
  // =========================================================
 // useEffect(() => {
 //   if (isDragging) return;
 //   if (!selectedObjectId) return;
 //   if (isDrawing) return;
 //   if (isCreatingObject) return;
//
 //   const finalPos = positionRef?.current;
 //   if (!finalPos) return;
//
 //   setPlacedObjects((prev) => {
 //     let changed = false;
//
 //     const next = prev.map((obj) => {
 //       if (obj.id !== selectedObjectId) return obj;
//
 //       const noChange =
 //         JSON.stringify(obj.position) === JSON.stringify(finalPos) &&
 //         JSON.stringify(obj.size) === JSON.stringify(size || obj.size) &&
 //         JSON.stringify(obj.rotation) === JSON.stringify(rotation || obj.rotation) &&
 //         (color ?? obj.color) === obj.color;
//
 //       if (noChange) return obj;
//
 //       changed = true;
//
 //       return {
 //         ...obj,
 //         position: finalPos,
 //         size: size ? [...size] : obj.size,
 //         rotation: rotation ? [...rotation] : obj.rotation,
 //         color: color ?? obj.color
 //       };
 //     });
//
 //     return changed ? next : prev;
 //   });
 // }, [
 //   isDragging,
 //   selectedObjectId,
 //   size,
 //   rotation,
 //   color,
 //   isDrawing,
 //   isCreatingObject,
 //   positionRef,
 //   setPlacedObjects
 // ]);
//
  // =========================================================
  // Render
  // =========================================================
  return (
    <Physics gravity={[0, -Math.abs(gravity || 50.00), 0]}>


      <RigidBody type="fixed" colliders={false}>
        <CuboidCollider
          args={[25, 0.5, 25]}
          position={[0, -0.5, 0]}
          friction={0}
          restitution={0}
        />

        <mesh
          name="ground"
          position={[0, -0.5, 0]}
          receiveShadow
          onPointerUp={(e) => {
            if (props.handlePointerUp) props.handlePointerUp(e);
            if (!isDrawing) setIsDragging(false);
          }}
          onPointerMissed={() => {
            if (!isDragging) setSelectedObjectId(null);
          }}
          onClick={(e) => {
            if (!isDrawing && !isDragging) setSelectedObjectId(null);
            handleGroundClick(e);
          }}
          onPointerMove={handleGroundPointerMove}
        >
          <boxGeometry args={[50, 1, 50]} />
          <meshStandardMaterial color="#eaf0ed" side={THREE.DoubleSide} />
        </mesh>
      </RigidBody>

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

      {/* ✅ FIXED: Pass the actual mesh to TransformControls */}
      <EditorGizmo
        selectedMesh={
          selectedObjectId && objectRefs?.current
            ? objectRefs.current[selectedObjectId]?.mesh || null
            : null
        }
        selectedObjectId={selectedObjectId}
        setPlacedObjects={setPlacedObjects}
        objectRefs={objectRefs}
      />

      {placedObjects.map((obj) => (
        <React.Fragment key={obj.id}>
          {renderObject(
            obj,
            selectedObjectId,
            handleBoxPointerDown,
            objectRefs
          )}
        </React.Fragment>
      ))}

      {previewPosition &&
      renderPreview(
        previewPosition,
        size,
        rotation,
        color,
        objectType,
        material
      )}


      <MapEditorInteraction />
    </Physics>
  );
}
