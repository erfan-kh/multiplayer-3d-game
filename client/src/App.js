// Import core React hooks and libraries
import React, { useRef, useEffect, useState } from 'react';

// Import core rendering and animation hooks from React Three Fiber
import { Canvas, useFrame, useThree } from '@react-three/fiber';

// Import OrbitControls for interactive camera movement (optional)
import { OrbitControls } from '@react-three/drei';

// Import global styles for the app
import './App.css';

// Import the full Three.js library for 3D math and objects
import * as THREE from 'three';

// Define the SpaceGirl component
function SpaceGirl({ moveInput }, ref) {
  // Create a local reference to the character group if no ref is passed from parent
  const localRef = useRef();

  // Use the forwarded ref if provided, otherwise fall back to localRef
  const girlRef = ref || localRef;

  // Define movement speed
  const speed = 0.05;

  // Store the state of pressed keys (e.g., W, A, S, D)
  const keys = useRef({});

  // Set up keyboard event listeners once when the component mounts
  useEffect(() => {
    // When a key is pressed, mark it as active in the keys object
    const handleKeyDown = (e) => (keys.current[e.key.toLowerCase()] = true);

    // When a key is released, mark it as inactive
    const handleKeyUp = (e) => (keys.current[e.key.toLowerCase()] = false);

    // Attach event listeners to the window
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    // Clean up the event listeners when the component unmounts
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);


  // useFrame runs on every rendered frame (~60 times per second)
useFrame((state) => {
  // Get the current reference to the SpaceGirl model
  const girl = girlRef.current;
  if (!girl) return; // If the model isn't loaded yet, skip this frame

  // Create a vector to represent movement direction
  const direction = new THREE.Vector3();

  // Check which keys are pressed and update the direction vector accordingly
  if (keys.current['w'] || keys.current['arrowup']) direction.z -= 1; // move forward
  if (keys.current['s'] || keys.current['arrowdown']) direction.z += 1; // move backward
  if (keys.current['a'] || keys.current['arrowleft']) direction.x -= 1; // move left
  if (keys.current['d'] || keys.current['arrowright']) direction.x += 1; // move right

  // If there's any directional input...
  if (direction.length() > 0) {
    direction.normalize(); // Normalize to keep consistent speed in all directions
    direction.applyEuler(girl.rotation); // Rotate movement to match character's orientation
    girl.position.addScaledVector(direction, speed); // Move the character
  }

  // If touch input is active (mobile), apply movement based on swipe delta
  if (moveInput.current) {
    girl.position.x += moveInput.current.dx * 0.01; // horizontal swipe
    girl.position.z += moveInput.current.dy * 0.01; // vertical swipe
  }



    // Floating animation
const t = state.clock.getElapsedTime(); 
// Get the total time (in seconds) since the scene started running

girl.position.y = 0.05 + Math.sin(t * 2) * 0.03;
// Make the character float up and down smoothly using a sine wave
// 0.05 is the base height, and the sine wave adds a gentle bounce effect
// t * 2 controls the speed of the bounce, and 0.03 controls the height

// Limb animation
const swing = Math.sin(t * 6) * 0.3;
// Create a faster sine wave to simulate a swinging motion for arms and legs
// t * 6 makes the swing faster than the floating motion
// 0.3 controls how far the limbs swing

// Get references to the limb groups by their names (defined in the JSX structure)
const leftArm = girl.getObjectByName('leftArm');
const rightArm = girl.getObjectByName('rightArm');
const leftLeg = girl.getObjectByName('leftLeg');
const rightLeg = girl.getObjectByName('rightLeg');

if (leftArm && rightArm && leftLeg && rightLeg) {
  // If all limb parts are found in the model, apply the swing animation

  leftArm.rotation.z = swing;       // Swing left arm forward
  rightArm.rotation.z = -swing;     // Swing right arm backward (opposite direction)
  leftLeg.rotation.x = -swing;      // Swing left leg backward
  rightLeg.rotation.x = swing;      // Swing right leg forward

  // This creates a walking-like motion, even when the character is idle
}

  });

  return (
  // The entire character is grouped together so it can be moved and animated as one unit
  <group ref={girlRef}>

    {/* Body: a capsule shape for the torso */}
    <mesh position={[0, 0.5, 0]}>
      <capsuleGeometry args={[0.25, 0.6, 8, 16]} />
      <meshStandardMaterial color="#a8d8ff" />
    </mesh>

    {/* Head: a sphere placed above the body */}
    <mesh position={[0, 1.2, 0]}>
      <sphereGeometry args={[0.28, 32, 32]} />
      <meshStandardMaterial color="#f7d9ff" />
    </mesh>

    {/* Smile: a half torus to form a curved mouth */}
    <mesh position={[0, 1.12, 0.26]} rotation={[0, 0, 0]}>
      <torusGeometry args={[0.05, 0.01, 8, 16, Math.PI]} />
      <meshStandardMaterial color="#aa66cc" />
    </mesh>

    {/* Eyes: two small spheres with emissive glow for a shiny look */}
    <mesh position={[-0.09, 1.22, 0.26]}>
      <sphereGeometry args={[0.035, 16, 16]} />
      <meshStandardMaterial color="#3a2a4f" emissive="#2b1f40" emissiveIntensity={0.3} />
    </mesh>
    <mesh position={[0.09, 1.22, 0.26]}>
      <sphereGeometry args={[0.035, 16, 16]} />
      <meshStandardMaterial color="#3a2a4f" emissive="#2b1f40" emissiveIntensity={0.3} />
    </mesh>

    {/* Pigtails: two spheres on the sides of the head */}
    <mesh position={[-0.25, 1.25, -0.05]}>
      <sphereGeometry args={[0.18, 24, 24]} />
      <meshStandardMaterial color="#c695ff" />
    </mesh>
    <mesh position={[0.25, 1.25, -0.05]}>
      <sphereGeometry args={[0.18, 24, 24]} />
      <meshStandardMaterial color="#c695ff" />
    </mesh>

    {/* Helmet ring: a torus around the head to simulate a space helmet ring */}
    <mesh position={[0, 1.18, 0]}>
      <torusGeometry args={[0.3, 0.06, 16, 64]} />
      <meshStandardMaterial color="#9ed0ff" metalness={0.1} roughness={0.3} />
    </mesh>

    {/* Arms: each arm is a group with a cylinder (arm) and a sphere (hand) */}
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

    {/* Legs: each leg is a group with a cylinder (thigh) and a capsule (boot) */}
    <group name="leftLeg" position={[-0.14, 0.15, 0]}>
      <mesh>
        <cylinderGeometry args={[0.08, 0.08, 0.4, 12]} />
        <meshStandardMaterial color="#a8d8ff" />
      </mesh>
      <mesh position={[0, -0.25, 0]}>
        <capsuleGeometry args={[0.09, 0.18, 8, 12]} />
        <meshStandardMaterial color="#9ecbff" />
      </mesh>
    </group>
    <group name="rightLeg" position={[0.14, 0.15, 0]}>
      <mesh>
        <cylinderGeometry args={[0.08, 0.08, 0.4, 12]} />
        <meshStandardMaterial color="#a8d8ff" />
      </mesh>
      <mesh position={[0, -0.25, 0]}>
        <capsuleGeometry args={[0.09, 0.18, 8, 12]} />
        <meshStandardMaterial color="#9ecbff" />
      </mesh>
    </group>

    {/* Belt: a torus around the waist */}
    <mesh position={[0, 0.55, 0]}>
      <torusGeometry args={[0.22, 0.03, 12, 48]} />
      <meshStandardMaterial color="#7fa6d1" />
    </mesh>
  </group>
);
}
const ForwardedSpaceGirl = React.forwardRef(SpaceGirl);

function CameraController({ mode, targetRef }) {
  const { camera } = useThree();
  useFrame(() => {
    if (!targetRef.current) return;
    const target = targetRef.current.position;
    if (mode === 'third') {
      camera.position.lerp(target.clone().add(new THREE.Vector3(0, 2, 5)), 0.1);
      camera.lookAt(target);
    } else if (mode === 'top') {
      camera.position.lerp(target.clone().add(new THREE.Vector3(0, 10, 0.01)), 0.1);
      camera.lookAt(target);
    }
  });
  return null;
}

function App() {
  const moveInput = useRef(null);
  const girlRef = useRef();
  const [cameraMode, setCameraMode] = useState('orbit');

  useEffect(() => {
    const handleKey = (e) => {
      if (e.key.toLowerCase() === 'c') {
        setCameraMode((prev) =>
          prev === 'orbit' ? 'third' : prev === 'third' ? 'top' : 'orbit'
        );
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
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

  return (
    <div className="canvas-container">
      <Canvas camera={{ position: [0, 2, 5], fov: 60 }}>
        <color attach="background" args={['#d0eaff']} />
        <ambientLight intensity={0.7} />
        <directionalLight position={[5, 5, 5]} intensity={0.8} />
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.5, 0]} receiveShadow>
          <planeGeometry args={[100, 100]} />
          <meshStandardMaterial color="#e0e0e0" />
        </mesh>
        <gridHelper args={[100, 100]} position={[0, -0.49, 0]} />
        <ForwardedSpaceGirl ref={girlRef} moveInput={moveInput} />
        {cameraMode === 'orbit' && <OrbitControls enableZoom={false} />}
        <CameraController mode={cameraMode} targetRef={girlRef} />
      </Canvas>
      <div
        className="touch-move-zone"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      />
    </div>
  );
}

export default App;
