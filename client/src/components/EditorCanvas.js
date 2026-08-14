// components/EditorCanvas.js
import React, { useRef, useEffect } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { OrbitControls, useGLTF, Environment } from "@react-three/drei";


import EditorScene from "./EditorScene/EditorScene";

import CameraController from "./CameraController";
import CarModel from "./CarModel";

/* ⭐ ADD THIS IMPORT — measurement tool MUST BE MOUNTED */
import MeasurementTool from "../editor/MeasurementTool";

function CameraLinkedLight() {
  const lightRef = useRef();
  const targetRef = useRef();
  const { camera } = useThree();

  useFrame(() => {
    if (!lightRef.current || !targetRef.current) return;

    const offset = new THREE.Vector3(5, 8, 5);
    const camPos = camera.position.clone();
    const direction = new THREE.Vector3();
    camera.getWorldDirection(direction);

    lightRef.current.position.copy(camPos.clone().add(offset));
    targetRef.current.position.copy(
      camPos.clone().add(direction.multiplyScalar(10))
    );
    lightRef.current.target = targetRef.current;
  });

  return (
    <>
      <directionalLight
        ref={lightRef}
        intensity={0.8}
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-far={50}
        shadow-camera-left={-20}
        shadow-camera-right={20}
        shadow-camera-top={20}
        shadow-camera-bottom={-20}
      />
      <object3D ref={targetRef} />
    </>
  );
}

export default function EditorCanvas(props) {
  const {
    isDragging,
    cameraMode,
    zoom,
    handlePointerUp,
    girlRef,
    isVerticalDrag,
    setIsVerticalDrag,
    recordHistory,
    setZoom,

    /** Measurement mode props */
    isMeasureMode,
    setIsMeasureMode,

    /** IMPORTANT: real registration callback */
    registerClearMeasurements,
    isCreatingObject,
    objectType,

    /** callback from App to receive object refs */
    onObjectRefsReady,
    cameraFocusTarget,

    pendingNpc,
    npcPreviewPos,

    placingWaypointForNpcId,
    waypointPreviewPos,

  } = props;

  /** ✅ This stores all Rapier RigidBody refs */
  const objectRefs = useRef({});

  /** ✅ Send refs back to App.js so pointer handlers can access them */
  useEffect(() => {
    if (onObjectRefsReady) {
      onObjectRefsReady(objectRefs.current);
    }
  }, [onObjectRefsReady]);

  function GLTFObject({ object }) {
    const { scene } = useGLTF(object.modelPath);
    return (
      <primitive
        object={scene}
        position={object.position}
        rotation={object.rotation}
        scale={object.size}
      />
    );
  }

  return (
    <Canvas
      shadows
      camera={{ position: [0, 2, 5], fov: 60 }}
      onPointerMissed={(e) => e.stopPropagation()}
      onPointerUp={handlePointerUp || (() => {})}
    >
      <color attach="background" args={["#d0dcff"]} />
      <ambientLight intensity={0.35} />
      <CameraLinkedLight />
      <Environment files="/hdri/potsdamer_platz_1k.hdr" environmentIntensity={1.5} />


      <EditorScene
        closeDialogue={props.closeDialogue}
        {...props}
        objectRefs={objectRefs}   /* ✅ pass rigidbody refs down */
        isVerticalDrag={isVerticalDrag}
        setIsVerticalDrag={setIsVerticalDrag}
        recordHistory={recordHistory}

        /** Measurement mode */
        isMeasureMode={isMeasureMode}
        setIsMeasureMode={setIsMeasureMode}

        /** register measurement clear fn */
        registerClearMeasurements={registerClearMeasurements}

        objectType={objectType}

        pendingNpc={pendingNpc}
        npcPreviewPos={npcPreviewPos}

        placingWaypointForNpcId={placingWaypointForNpcId}
        waypointPreviewPos={waypointPreviewPos}
        

      />

      {/* ⭐ Measurement Tool */}
      <MeasurementTool
        isActive={isMeasureMode}
        onClearRequest={registerClearMeasurements}
      />

      {cameraMode === "orbit" && (
        <OrbitControls
          enableZoom={false}
          enableRotate={!isDragging}
          enablePan={!isDragging}
        />
      )}

      <CameraController
        cameraMode={cameraMode}
        girlRef={girlRef}
        zoom={zoom}
        setZoom={setZoom}
        isDragging={isDragging}
        cameraFocusTarget={cameraFocusTarget}
        
      />
    </Canvas>
  );
}


