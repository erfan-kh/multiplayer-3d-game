import { useState, useCallback } from "react";
import API_BASE_URL from "../../../config";

export default function useMaps(setPlacedObjects) {
  const [maps, setMaps] = useState([]);
  const [currentMapId, setCurrentMapId] = useState(null);

  const fetchMaps = useCallback(async () => {
    const res = await fetch(`${API_BASE_URL}/api/maps`);
    if (!res.ok) {
      console.error("Failed to fetch maps");
      return;
    }
    const data = await res.json();
    setMaps(Array.isArray(data) ? data : []);
  }, []);

  const createMap = useCallback(async (name) => {
    const res = await fetch(`${API_BASE_URL}/api/maps`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name })
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Failed to create map: ${res.status} ${text}`);
    }

    const newMap = await res.json(); // should be {_id, name, ...}
    // Select the newly created map
    setCurrentMapId(newMap._id);
    // Refresh list
    await fetchMaps();
    // Return created map so UIOverlay can rely on it if needed
    return newMap;
  }, [fetchMaps]);

  const deleteMap = useCallback(async (id) => {
    const res = await fetch(`${API_BASE_URL}/api/maps/${id}`, {
      method: "DELETE"
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Failed to delete map: ${res.status} ${text}`);
    }

    // Clear selection and objects
    if (currentMapId === id) {
      setCurrentMapId(null);
      setPlacedObjects([]);
    }

    await fetchMaps();
  }, [currentMapId, fetchMaps, setPlacedObjects]);

  // Save objects for current/selected map
  const saveMapObjects = useCallback(async (mapId, objects) => {
    if (!mapId) throw new Error("No active map to save");
    const res = await fetch(`${API_BASE_URL}/api/maps/${mapId}/objects`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ objects })
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Failed to save map objects: ${res.status} ${text}`);
    }

    // Optionally return updated object count or server payload
    const payload = await res.json().catch(() => null);
    return payload;
  }, []);

  // Load all objects for a map and set them into the editor
  const loadMapObjects = useCallback(async (mapId) => {
    const res = await fetch(`${API_BASE_URL}/api/maps/${mapId}/objects`);
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Failed to load map objects: ${res.status} ${text}`);
    }
    const data = await res.json();
    // data should be an array of objects with the fields your editor expects
    setPlacedObjects(Array.isArray(data) ? data : []);
    setCurrentMapId(mapId);
    return data;
  }, [setPlacedObjects]);

  // Rename map
  const renameMap = useCallback(async (id, newName) => {
    const res = await fetch(`${API_BASE_URL}/api/maps/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newName })
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Failed to rename map: ${res.status} ${text}`);
    }

    const updated = await res.json();
    // Update local cache
    setMaps((prev) => prev.map((m) => (m._id === id ? { ...m, ...updated } : m)));
    return updated;
  }, []);

  return {
    maps,
    currentMapId,
    setCurrentMapId,
    fetchMaps,
    createMap,
    deleteMap,
    saveMapObjects,
    loadMapObjects,
    renameMap
  };
}
