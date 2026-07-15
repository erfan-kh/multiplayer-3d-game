// components/UIOverlay/hooks/useMaps.js
import { useState, useCallback } from "react";
import API_BASE_URL from "../../../config";

export default function useMaps(setPlacedObjects, currentMapId, setCurrentMapId, setNpcs) {
  const [maps, setMaps] = useState([]);

  const toFiniteNumber = (value, fallback = 0) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  };

  const normalizeWaypoint = (waypoint, fallbackWaitTime = 0) => {
    const rawPos = Array.isArray(waypoint)
      ? waypoint
      : Array.isArray(waypoint?.pos)
        ? waypoint.pos
        : [0, 0.2, 0];

    return {
      ...(waypoint && !Array.isArray(waypoint) && typeof waypoint === "object"
        ? waypoint
        : {}),
      pos: [
        toFiniteNumber(rawPos[0], 0),
        toFiniteNumber(rawPos[1], 0.2),
        toFiniteNumber(rawPos[2], 0),
      ],
      waitTime: Math.max(
        0,
        toFiniteNumber(
          !Array.isArray(waypoint) ? waypoint?.waitTime : fallbackWaitTime,
          fallbackWaitTime
        )
      ),
    };
  };

  const normalizeNpcFromApi = (npc) => {
    // Gracefully handle dialogue normalization from the API payload
    let normalizedDialogue = npc.dialogue;
    if (typeof normalizedDialogue === "string") {
      normalizedDialogue = {
        startNodeId: "root",
        nodes: {
          root: {
            id: "root",
            text: normalizedDialogue || "Hello traveler!",
            choices: [],
            onEnter: [],
            onExit: [],
          },
        },
      };
    } else if (!normalizedDialogue || typeof normalizedDialogue !== "object") {
      normalizedDialogue = {
        startNodeId: "root",
        nodes: {
          root: {
            id: "root",
            text: "Hello traveler!",
            choices: [],
            onEnter: [],
            onExit: [],
          },
        },
      };
    }

    return {
      ...npc,

      id: npc.npcId || npc.id || npc._id,
      npcId: npc.npcId || npc.id || npc._id,

      position:
        Array.isArray(npc.position) && npc.position.length === 3
          ? npc.position.map((value, index) => toFiniteNumber(value, index === 1 ? 1 : 0))
          : [0, 1, 0],

      rotation:
        Array.isArray(npc.rotation) && npc.rotation.length === 3
          ? npc.rotation.map((value) => toFiniteNumber(value, 0))
          : [0, 0, 0],

      scale:
        Array.isArray(npc.scale) && npc.scale.length === 3
          ? npc.scale.map((value) => toFiniteNumber(value, 1))
          : [1, 1, 1],

      movement: {
        ...npc.movement,
        mode: npc.movement?.mode || "idle",
        speed: toFiniteNumber(npc.movement?.speed, 2),
        waitTime: toFiniteNumber(npc.movement?.waitTime, 0),
        wanderRadius: toFiniteNumber(
          npc.movement?.wanderRadius ?? npc.wanderRadius,
          5
        ),
      },

      detection: {
        ...npc.detection,
        radius: toFiniteNumber(npc.detection?.radius, 6),
        behavior: npc.detection?.behavior || "look",
        targetType: npc.detection?.targetType || "both",
        stopDistance: toFiniteNumber(npc.detection?.stopDistance, 0.8),
        debug: Boolean(npc.detection?.debug),
        reactions:
          npc.detection?.reactions &&
          typeof npc.detection.reactions === "object"
            ? { ...npc.detection.reactions }
            : {},
      },

      patrolMode: npc.patrolMode || "loop",

      isPatrolling:
        typeof npc.isPatrolling === "boolean"
          ? npc.isPatrolling
          : true,

      currentWaypointIndex: Math.max(
        0,
        toFiniteNumber(npc.currentWaypointIndex, 0)
      ),

      waypoints: Array.isArray(npc.waypoints)
        ? npc.waypoints.map((waypoint) =>
            normalizeWaypoint(waypoint, toFiniteNumber(npc.movement?.waitTime, 0))
          )
        : [],

      dialogue: normalizedDialogue,
    };
  };

  // Load all objects and NPCs for a map and set them into the editor
  const loadMapObjects = useCallback(async (mapId) => {
    if (!mapId) return;

    setPlacedObjects([]);
    if (setNpcs) setNpcs([]);

    try {
      const [objectsRes, npcsRes] = await Promise.all([
        fetch(`${API_BASE_URL}/api/maps/${mapId}/objects`),
        fetch(`${API_BASE_URL}/api/maps/${mapId}/npcs`).catch(() => null)
      ]);

      if (objectsRes.ok) {
        const data = await objectsRes.json();
        const normalizedObjects = (Array.isArray(data) ? data : []).map((obj) => ({
          ...obj,
          id: obj.id || obj._id,
          material: obj.material || "standard"
        }));
        setPlacedObjects(normalizedObjects);
      }

      if (npcsRes && npcsRes.ok && setNpcs) {
        const npcData = await npcsRes.json();
        const normalizedNpcs = (
  Array.isArray(npcData) ? npcData : []
).map(normalizeNpcFromApi);

        setNpcs(normalizedNpcs);
      } else if (npcsRes) {
        const errorText = await npcsRes.text();
        console.error("Failed to load NPCs:", npcsRes.status, errorText);
      }

      setCurrentMapId(mapId);
    } catch (err) {
      console.error("Failed to load map objects or NPCs:", err);
    }
  }, [setPlacedObjects, setCurrentMapId, setNpcs]);

  const fetchMaps = useCallback(async () => {
    const res = await fetch(`${API_BASE_URL}/api/maps`);
    if (!res.ok) {
      console.error("Failed to fetch maps");
      return;
    }

    const data = await res.json();
    const mapsArray = Array.isArray(data) ? data : [];

    mapsArray.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));

    setMaps(mapsArray);

    if (!currentMapId && mapsArray.length > 0) {
      const firstMap = mapsArray[0];
      await loadMapObjects(firstMap._id);
    }
  }, [currentMapId, loadMapObjects]);

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

    const newMap = await res.json();

    setCurrentMapId(newMap._id);
    await fetchMaps();
    await loadMapObjects(newMap._id);

    return newMap;
  }, [fetchMaps, loadMapObjects, setCurrentMapId]);

  const deleteMap = useCallback(async (id) => {
    const res = await fetch(`${API_BASE_URL}/api/maps/${id}`, {
      method: "DELETE"
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Failed to delete map: ${res.status} ${text}`);
    }

    if (currentMapId === id) {
      setCurrentMapId(null);
      setPlacedObjects([]);
      if (setNpcs) setNpcs([]);
    }

    await fetchMaps();
  }, [currentMapId, fetchMaps, setPlacedObjects, setNpcs, setCurrentMapId]);

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

    setMaps((prev) =>
      prev.map((m) => (m._id === id ? { ...m, ...updated } : m))
    );

    return updated;
  }, []);

  return {
    maps,
    setMaps,
    fetchMaps,
    createMap,
    deleteMap,
    loadMapObjects,
    renameMap,
    normalizeNpcFromApi,
  };
}
