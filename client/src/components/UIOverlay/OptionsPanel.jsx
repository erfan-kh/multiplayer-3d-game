import React, { useMemo } from "react";



export default function OptionsPanel({
  showOptions,
  setShowOptions,
  setShowSettings,
  setShowCreator,
  setShowMaps,
  showGameSettings,
  isCreatingObject,
  showMaps
}) {

  const toggleOptions = () => {
    if (typeof setShowOptions === "function") {
      setShowOptions(prev => !prev);
    }
  };

  const activePanel = useMemo(() => {
    if (showGameSettings) return "settings";
    if (isCreatingObject) return "creator";
    if (showMaps) return "maps";
    return null;
  }, [showGameSettings, isCreatingObject, showMaps]);

  const baseStyle = {
    padding: "8px 12px",
    borderRadius: "6px",
    marginBottom: "6px",
    backgroundColor: "gray",
    color: "white",
    border: "none",
    fontSize: "14px",
    cursor: "pointer"
  };

  const getStyle = (name) => ({
    ...baseStyle,
    backgroundColor: activePanel === name ? "green" : "gray"
  });

  function handleSettings() {
    if (typeof setShowSettings === "function") setShowSettings(prev => !prev);
    if (typeof setShowCreator === "function") setShowCreator(false);
    if (typeof setShowMaps === "function") setShowMaps(false);
  }

  function handleCreator() {


    if (typeof setShowCreator !== "function") {
      console.error("ERROR: setShowCreator is NOT a function!", setShowCreator);
      return;
    }

    setShowCreator(!isCreatingObject);

    if (typeof setShowSettings === "function") setShowSettings(false);
    if (typeof setShowMaps === "function") setShowMaps(false);
  }

  function handleMaps() {
    if (typeof setShowMaps === "function") setShowMaps(prev => !prev);
    if (typeof setShowSettings === "function") setShowSettings(false);
    if (typeof setShowCreator === "function") setShowCreator(false);
  }

  return (
    <div className="options-panel">
      <button style={baseStyle} onClick={toggleOptions}>
        Options
      </button>

      {showOptions && (
        <div className="options-menu">
          <button style={getStyle("settings")} onClick={handleSettings}>
            Game Settings
          </button>

          <button style={getStyle("creator")} onClick={handleCreator}>
            Create Object
          </button>

          <button style={getStyle("maps")} onClick={handleMaps}>
            Map Manager
          </button>
        </div>
      )}
    </div>
  );
}
