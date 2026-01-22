import React, { useRef, useEffect, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls, Html } from "@react-three/drei";
import * as THREE from "three";
import "./App.css";

const SpaceGirl = React.forwardRef(({ moveInput }, ref) => {
  const localRef = useRef();
  const girlRef = ref || localRef;

  const speed = 0.08;
  const keys = useRef({});
  const velocity = useRef(new THREE.Vector3());

  useEffect(() => {
    const down = (e) => (keys.current[e.key.toLowerCase()] = true);
    const up = (e) => (keys.current[e.key.toLowerCase()] = false);
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, []);

  useFrame((state) => {
    const girl = girlRef.current;
    if (!girl) return;

    const inputDir = new THREE.Vector3();

    if (keys.current["w"] || keys.current["arrowup"]) inputDir.z -= 1;
    if (keys.current["s"] || keys.current["arrowdown"]) inputDir.z += 1;
    if (keys.current["a"] || keys.current["arrowleft"]) inputDir.x -= 1;
    if (keys.current["d"] || keys.current["arrowright"]) inputDir.x += 1;
    if (keys.current[" "]) inputDir.y += 1; // space up
    if (keys.current["shift"]) inputDir.y -= 1;

    if (inputDir.length() > 0) {
      inputDir.normalize();
      velocity.current.lerp(inputDir.multiplyScalar(speed), 0.2);
    } else {
      velocity.current.lerp(new THREE.Vector3(0, 0, 0), 0.1);
    }

    girl.position.add(velocity.current);

    if (velocity.current.length() > 0.01) {
      const angle = Math.atan2(velocity.current.x, velocity.current.z);
      girl.rotation.y = THREE.MathUtils.lerp(girl.rotation.y, angle, 0.15);
    }

    if (moveInput.current) {
      girl.position.x += moveInput.current.dx * 0.003;
      girl.position.z += moveInput.current.dy * 0.003;
    }

    // Floating animation
    const t = state.clock.getElapsedTime();
    girl.position.y = -0.21 + Math.sin(t * 2) * 0.01;

    // Limb animation
    const swing = Math.sin(t * 6) * 0.3;
    const leftArm = girl.getObjectByName("leftArm");
    const rightArm = girl.getObjectByName("rightArm");
    const leftLeg = girl.getObjectByName("leftLeg");
    const rightLeg = girl.getObjectByName("rightLeg");

    if (leftArm && rightArm && leftLeg && rightLeg) {
      leftArm.rotation.z = swing;
      rightArm.rotation.z = -swing;
      leftLeg.rotation.x = -swing;
      rightLeg.rotation.x = swing;
    }
  });

  return (
    <group ref={girlRef}>
      <mesh position={[0, 0.5, 0]}>
        <capsuleGeometry args={[0.25, 0.6, 8, 16]} />
        <meshStandardMaterial color="#a8d8ff" />
      </mesh>

      <mesh position={[0, 1.2, 0]}>
        <sphereGeometry args={[0.28, 32, 32]} />
        <meshStandardMaterial color="#f7d9ff" />
      </mesh>

      <mesh position={[0, 1.12, 0.29]} rotation={[-10, 0, 0]}>
        <torusGeometry args={[0.05, 0.01, 8, 16, Math.PI]} />
        <meshStandardMaterial color="#aa66cc" />
      </mesh>

      <mesh position={[-0.09, 1.22, 0.26]}>
        <sphereGeometry args={[0.035, 16, 16]} />
        <meshStandardMaterial
          color="#3a2a4f"
          emissive="#2b1f40"
          emissiveIntensity={0.3}
        />
      </mesh>
      <mesh position={[0.09, 1.22, 0.26]}>
        <sphereGeometry args={[0.035, 16, 16]} />
        <meshStandardMaterial
          color="#3a2a4f"
          emissive="#2b1f40"
          emissiveIntensity={0.3}
        />
      </mesh>

      <mesh position={[-0.25, 1.25, -0.05]}>
        <sphereGeometry args={[0.18, 24, 24]} />
        <meshStandardMaterial color="#c695ff" />
      </mesh>
      <mesh position={[0.25, 1.25, -0.05]}>
        <sphereGeometry args={[0.18, 24, 24]} />
        <meshStandardMaterial color="#c695ff" />
      </mesh>

      <mesh position={[0, 1.18, 0]}>
        <torusGeometry args={[0.3, 0.06, 16, 64]} />
        <meshStandardMaterial
          color="#9ed0ff"
          metalness={0.1}
          roughness={0.3}
        />
      </mesh>

      <group name="leftArm" position={[-0.35, 0.75, 0]}>
        <mesh>
          <cylinderGeometry args={[0.06, 0.06, 0.35, 12]} />
          <meshStandardMaterial color="#a8d8ff" />
        </mesh>
        <mesh position={[0, -0.22, 0]}>
          <sphereGeometry args={[0.08, 16, 16]} />
          <meshStandardMaterial color="#cfeaff" />
        </mesh>
      </group>

      <group name="rightArm" position={[0.35, 0.75, 0]}>
        <mesh>
          <cylinderGeometry args={[0.06, 0.06, 0.35, 12]} />
          <meshStandardMaterial color="#a8d8ff" />
        </mesh>
        <mesh position={[0, -0.22, 0]}>
          <sphereGeometry args={[0.08, 16, 16]} />
          <meshStandardMaterial color="#cfeaff" />
        </mesh>
      </group>

      <group name="leftLeg" position={[-0.14, 0.15, 0]}>
        <mesh>
          <cylinderGeometry args={[0.08, 0.08, 0.4, 12]} />
          <meshStandardMaterial color="#a8d8ff" />
        </mesh>
        <mesh position={[0, -0.25, 0]}>
          <capsuleGeometry args={[0.09, 0.18, 8, 12]} />
          <meshStandardMaterial color="#a8d8ff" />
        </mesh>
      </group>

      <group name="rightLeg" position={[0.14, 0.15, 0]}>
        <mesh>
          <cylinderGeometry args={[0.08, 0.08, 0.4, 12]} />
          <meshStandardMaterial color="#9ecbff" />
        </mesh>
        <mesh position={[0, -0.25, 0]}>
          <capsuleGeometry args={[0.09, 0.18, 8, 12]} />
          <meshStandardMaterial color="#9ecbff" />
        </mesh>
      </group>

      <mesh position={[0, 0.55, 0]}>
        <torusGeometry args={[0.22, 0.03, 12, 48]} />
        <meshStandardMaterial color="#7fa6d1" />
      </mesh>
    </group>
  );
});

function Coin({ position, onCollect }) {
  const ref = useRef();

  useFrame(() => {
    ref.current.rotation.y += 0.05;
  });

  return (
    <mesh
      ref={ref}
      position={position}
      onClick={onCollect}
      onPointerDown={onCollect}
    >
      <torusGeometry args={[0.2, 0.05, 8, 16]} />
      <meshStandardMaterial color="gold" />
    </mesh>
  );
}

function CameraController({ mode, targetRef }) {
  const { camera } = useThree();

  useFrame(() => {
    if (!targetRef.current) return;
    const target = targetRef.current.position;

    if (mode === "third") {
      camera.position.lerp(
        target.clone().add(new THREE.Vector3(0, 2, 5)),
        0.1
      );
      camera.lookAt(target);
    } else if (mode === "top") {
      camera.position.lerp(
        target.clone().add(new THREE.Vector3(0, 10, 0.01)),
        0.1
      );
      camera.lookAt(target);
    }
  });

  return null;
}

export default function App() {
  const moveInput = useRef(null);
  const girlRef = useRef();
  const [cameraMode, setCameraMode] = useState("orbit");
  const [score, setScore] = useState(0);
  const [coins, setCoins] = useState([
    { id: 1, pos: [2, 0.5, -2] },
    { id: 2, pos: [-3, 0.5, 1] },
    { id: 3, pos: [1, 0.5, 3] },
  ]);

  useEffect(() => {
    const handleKey = (e) => {
      if (e.key.toLowerCase() === "c") {
        setCameraMode((prev) =>
          prev === "orbit" ? "third" : prev === "third" ? "top" : "orbit"
        );
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, []);

  const handleTouchStart = (e) => {
    const touch = e.touches[0];
    moveInput.current = { x: touch.clientX, y: touch.clientY, dx: 0, dy: 0 };
  };

  const handleTouchMove = (e) => {
    const touch = e.touches[0];
    if (!moveInput.current) return;
    const dx = touch.clientX - moveInput.current.x;
    const dy = touch.clientY - moveInput.current.y;
    moveInput.current = { x: touch.clientX, y: touch.clientY, dx, dy };
  };

  const handleTouchEnd = () => {
    moveInput.current = null;
  };

  const collectCoin = (id) => {
    setCoins((c) => c.filter((coin) => coin.id !== id));
    setScore((s) => s + 1);
  };

  return (
    <div className="canvas-container">
      <Canvas camera={{ position: [0, 2, 5], fov: 60 }}>
        <color attach="background" args={["#d0dcff"]} />
        <ambientLight intensity={0.7} />
        <directionalLight position={[5, 5, 5]} intensity={0.8} />

        <mesh
          rotation={[-Math.PI / 2, 0, 0]}
          position={[0, -0.5, 0]}
          receiveShadow
        >
          <planeGeometry args={[50, 50]} />
          <meshStandardMaterial color="#e0e0e0" />
        </mesh>

        <gridHelper args={[50, 50]} position={[0, -0.49, 0]} />

        <SpaceGirl ref={girlRef} moveInput={moveInput} />

        {coins.map((coin) => (
          <Coin
            key={coin.id}
            position={coin.pos}
            onCollect={() => collectCoin(coin.id)}
          />
        ))}

        {cameraMode === "orbit" && <OrbitControls enableZoom={false} />}
        <CameraController mode={cameraMode} targetRef={girlRef} />
      </Canvas>

      <div
        className="touch-move-zone"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      />

      <div className="hud">
        <div>Score: {score}</div>
        <div>Camera: {cameraMode} (press C)</div>
      </div>
    </div>
  );
}
