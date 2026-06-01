import React from "react";

export default function SavedObjectsList({ savedObjects = [], onDeleteObject }) {

  return (
    <div className="panel">

      <h3>Saved Objects</h3>

      {savedObjects.length === 0 && (
        <p>No saved objects</p>
      )}

      {savedObjects.map((obj) => (
        <div key={obj._id || obj.id} className="saved-object">

          <span>{obj.name || "Unnamed Object"}</span>

          <button
            onClick={() => onDeleteObject(obj._id || obj.id)}
          >
            Delete
          </button>

        </div>
      ))}

    </div>
  );
}
