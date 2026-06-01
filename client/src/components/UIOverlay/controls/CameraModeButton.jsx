export default function CameraModeButton({ cameraMode, setCameraMode }) {

  const handleClick = () => {
    const modes = ["orbit", "third", "top"];
    const index = modes.indexOf(cameraMode);
    const next = modes[(index + 1) % modes.length];
    setCameraMode(next);
  };

  return (
    <button className="camera-mode-btn" onClick={handleClick}>
      🎥 Camera: {cameraMode}
    </button>
  );
}
