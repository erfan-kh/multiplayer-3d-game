const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const http = require("http");
const { Server } = require("socket.io");
require("dotenv").config();

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*" },
});

const PORT = process.env.PORT || 5000;
const templateRoutes = require("./routes/templates");

// Middleware
app.use(cors());
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));
app.use("/api/templates", templateRoutes);

// ===============================================
// MONGODB CONNECTION
// ===============================================
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log("✅ Connected to MongoDB"))
  .catch((err) => {
    console.error("❌ MongoDB connection error:", err);
    process.exit(1);
  });

// Models
const Object3D = require("./models/ObjectModel");
const Map = require("./models/MapModel");
const NPC = require("./models/NpcModel");

// ===============================================
// NPC NORMALIZATION HELPERS
// ===============================================
const toFiniteNumber = (value, fallback = 0) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
};

const normalizeVector3 = (value, fallback = [0, 0, 0]) => {
  if (!Array.isArray(value)) return fallback;

  return [
    toFiniteNumber(value[0], fallback[0]),
    toFiniteNumber(value[1], fallback[1]),
    toFiniteNumber(value[2], fallback[2]),
  ];
};

const normalizeBoolean = (value, fallback = false) => {
  if (typeof value === "boolean") return value;
  if (value === "true") return true;
  if (value === "false") return false;
  return fallback;
};

const normalizeEnum = (value, allowed, fallback, aliases = {}) => {
  const normalizedValue = aliases[value] || value;
  return allowed.includes(normalizedValue) ? normalizedValue : fallback;
};

const normalizeWaypoint = (waypoint, fallbackWaitTime = 0) => {
  if (Array.isArray(waypoint)) {
    return {
      pos: normalizeVector3(waypoint, [0, 0.2, 0]),
      waitTime: Math.max(0, toFiniteNumber(fallbackWaitTime, 0)),
    };
  }

  if (waypoint && typeof waypoint === "object") {
    return {
      ...waypoint,
      pos: normalizeVector3(waypoint.pos, [0, 0.2, 0]),
      waitTime: Math.max(0, toFiniteNumber(waypoint.waitTime, fallbackWaitTime)),
    };
  }

  return {
    pos: [0, 0.2, 0],
    waitTime: Math.max(0, toFiniteNumber(fallbackWaitTime, 0)),
  };
};

// Normalizes structured dialogue object
const normalizeNpcDialogue = (dialogue) => {
  const defaultDialogue = {
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

  if (!dialogue) {
    return defaultDialogue;
  }

  // Handle case where dialogue is sent as a string (legacy data or quick set)
  if (typeof dialogue === "string") {
    defaultDialogue.nodes.root.text = dialogue || "Hello traveler!";
    return defaultDialogue;
  }

  // Handle structured object validation
  const normalizedNodes = {};
  const nodes = dialogue.nodes || {};

  Object.keys(nodes).forEach((nodeId) => {
    const node = nodes[nodeId];
    if (node && typeof node === "object") {
      const choices = Array.isArray(node.choices)
        ? node.choices.map((choice) => ({
            text: typeof choice.text === "string" ? choice.text : "",
            nextNodeId: typeof choice.nextNodeId === "string" ? choice.nextNodeId : null,
            actions: Array.isArray(choice.actions) ? choice.actions : [],
          }))
        : [];

      normalizedNodes[nodeId] = {
        id: nodeId,
        text: typeof node.text === "string" ? node.text : "",
        choices,
        onEnter: Array.isArray(node.onEnter) ? node.onEnter : [],
        onExit: Array.isArray(node.onExit) ? node.onExit : [],
      };
    }
  });

  // Ensure root node exists even if parsed data didn't have one
  if (!normalizedNodes.root) {
    normalizedNodes.root = defaultDialogue.nodes.root;
  }

  return {
    startNodeId: typeof dialogue.startNodeId === "string" ? dialogue.startNodeId : "root",
    nodes: normalizedNodes,
  };
};

const normalizeNpc = (npc, mapId) => {
  const source =
    npc && typeof npc.toObject === "function" ? npc.toObject() : npc || {};

  const normalizedNpcId =
    typeof source.npcId === "string" && source.npcId.trim()
      ? source.npcId.trim()
      : typeof source.id === "string" && source.id.trim()
        ? source.id.trim()
        : source._id
          ? source._id.toString()
          : new mongoose.Types.ObjectId().toString();

  const movementMode = normalizeEnum(
    source.movement?.mode || source.movement?.type || source.movementType,
    ["idle", "static", "wander", "patrol"],
    "idle"
  );

  const detectionBehavior = normalizeEnum(
    source.detection?.behavior || source.detectionBehavior,
    ["look", "chase", "flee", "attack", "ignore"],
    "look",
    {
      alert: "look",
    }
  );

  const detectionTargetType = normalizeEnum(
    source.detection?.targetType,
    ["player", "npc", "both"],
    "both",
    {
      npcs: "npc",
      npcOnly: "npc",
      playerOnly: "player",
    }
  );

  const patrolMode = normalizeEnum(
    source.patrolMode,
    ["loop", "pingpong"],
    "loop"
  );

  const fallbackWaitTime = Math.max(
    0,
    toFiniteNumber(source.movement?.waitTime ?? source.waitTime, 0)
  );

  return {
    mapId,
    npcId: normalizedNpcId,

    name: source.name || "NPC",
    type: source.type || "guard",

    position: normalizeVector3(source.position, [0, 1, 0]),
    rotation: normalizeVector3(source.rotation, [0, 0, 0]),
    scale: normalizeVector3(source.scale, [1, 1, 1]),

    modelPath: source.modelPath || "",
    textureUrl: source.textureUrl || "",
    spriteSheet: source.spriteSheet || "",
    color: source.color || "#ff3333",

    movement: {
      mode: movementMode,
      speed: Math.max(
        0,
        toFiniteNumber(source.movement?.speed ?? source.speed, 2)
      ),
      waitTime: fallbackWaitTime,
      wanderRadius: Math.max(
        0,
        toFiniteNumber(source.movement?.wanderRadius ?? source.wanderRadius, 5)
      ),
    },

    detection: {
      radius: Math.max(
        0,
        toFiniteNumber(source.detection?.radius ?? source.detectionRadius, 6)
      ),
      behavior: detectionBehavior,
      targetType: detectionTargetType,
      stopDistance: Math.max(
        0,
        toFiniteNumber(source.detection?.stopDistance, 0.8)
      ),
      debug: normalizeBoolean(source.detection?.debug, false),
      reactions:
        source.detection?.reactions &&
        typeof source.detection.reactions === "object"
          ? source.detection.reactions
          : {},
    },

    waypoints: Array.isArray(source.waypoints)
      ? source.waypoints.map((waypoint) => normalizeWaypoint(waypoint, fallbackWaitTime))
      : [],

    currentWaypointIndex: Math.max(
      0,
      toFiniteNumber(source.currentWaypointIndex, 0)
    ),

    patrolMode,

    patrolDirection: toFiniteNumber(source.patrolDirection, 1),

    isPatrolling: normalizeBoolean(source.isPatrolling, true),

    dialogue: normalizeNpcDialogue(source.dialogue),

    behaviorScript: source.behaviorScript || "",
    actions: Array.isArray(source.actions) ? source.actions : [],
    rules: Array.isArray(source.rules) ? source.rules : [],
  };
};

app.get("/", (req, res) => {
  res.send("API is running...");
});

//
// ========================== MAP ROUTES ==========================
//

// Create map
app.post("/api/maps", async (req, res) => {
  try {
    const { name } = req.body;

    if (!name || typeof name !== "string" || name.trim() === "") {
      return res.status(400).json({ error: "Map name is required" });
    }

    const map = new Map({
      name: name.trim(),
    });

    await map.save();

    res.status(201).json(map);
  } catch (err) {
    console.error("❌ Map creation error:", err);

    if (err.code === 11000) {
      return res.status(400).json({ error: "Map name already exists" });
    }

    res.status(500).json({ error: "Failed to create map" });
  }
});

// Get maps
app.get("/api/maps", async (req, res) => {
  try {
    const maps = await Map.find().sort({ createdAt: -1 });
    res.json(maps);
  } catch (err) {
    console.error("❌ Failed to fetch maps:", err);
    res.status(500).json({ error: "Failed to fetch maps" });
  }
});

// Get objects for map
app.get("/api/maps/:mapId/objects", async (req, res) => {
  try {
    const { mapId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(mapId)) {
      return res.status(400).json({ error: "Invalid mapId" });
    }

    const objects = await Object3D.find({ mapId });

    const normalized = objects.map((obj) => ({
      ...obj.toObject(),
      id: obj._id.toString(),
    }));

    res.json(normalized);
  } catch (err) {
    console.error("❌ Failed to fetch objects for map:", err);
    res.status(500).json({ error: "Failed to fetch objects for map" });
  }
});

// Save all objects for a map
app.put("/api/maps/:mapId/objects", async (req, res) => {
  try {
    const { mapId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(mapId)) {
      return res.status(400).json({ error: "Invalid mapId" });
    }

    const objects = Array.isArray(req.body.objects) ? req.body.objects : [];

    console.log("💾 Saving objects for map:", mapId);
    console.log("📦 Objects received:", objects.length);

    const objectsWithMap = objects.map((obj) => {
      const preparedObj = {
        ...obj,
        mapId,
      };

      delete preparedObj._id;
      delete preparedObj.id;
      delete preparedObj.__v;
      delete preparedObj.createdAt;
      delete preparedObj.updatedAt;

      return preparedObj;
    });

    await Object3D.deleteMany({ mapId });

    const savedObjects =
      objectsWithMap.length > 0 ? await Object3D.insertMany(objectsWithMap) : [];

    console.log("✅ Objects saved:", savedObjects.length);

    const normalized = savedObjects.map((obj) => ({
      ...obj.toObject(),
      id: obj._id.toString(),
    }));

    res.json({
      success: true,
      saved: normalized.length,
      objects: normalized,
    });
  } catch (err) {
    console.error("❌ Failed saving map objects:", err);

    res.status(500).json({
      error: "Failed to save map objects",
      details: err.message,
    });
  }
});

// Rename map
app.put("/api/maps/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { name } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: "Invalid mapId" });
    }

    if (!name || typeof name !== "string" || !name.trim()) {
      return res.status(400).json({ error: "Map name is required" });
    }

    const updatedMap = await Map.findByIdAndUpdate(
      id,
      {
        name: name.trim(),
        updatedAt: Date.now(),
      },
      { new: true }
    );

    if (!updatedMap) {
      return res.status(404).json({ error: "Map not found" });
    }

    res.json({
      id: updatedMap._id.toString(),
      name: updatedMap.name,
    });
  } catch (err) {
    console.error("❌ Rename map error:", err);

    if (err.code === 11000) {
      return res.status(400).json({ error: "Map name already exists" });
    }

    res.status(500).json({ error: "Failed to rename map" });
  }
});

//
// ========================== NPC ROUTES ==========================
//

// Get NPCs for map
app.get("/api/maps/:mapId/npcs", async (req, res) => {
  try {
    const { mapId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(mapId)) {
      return res.status(400).json({ error: "Invalid mapId" });
    }

    const npcs = await NPC.find({ mapId });

    const normalized = npcs.map((npc) => {
      const normalizedNpc = normalizeNpc(npc, mapId);

      return {
        ...normalizedNpc,
        id: normalizedNpc.npcId,
        _id: npc._id.toString(),
      };
    });

    res.json(normalized);
  } catch (err) {
    console.error("❌ Failed fetching NPCs for map:", err);
    res.status(500).json({ error: "Failed to fetch NPCs for map" });
  }
});

// Save all NPCs for a map
app.put("/api/maps/:mapId/npcs", async (req, res) => {
  try {
    const { mapId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(mapId)) {
      return res.status(400).json({ error: "Invalid mapId" });
    }

    const npcs = Array.isArray(req.body.npcs) ? req.body.npcs : [];

    console.log("💾 Saving NPCs for map:", mapId);
    console.log("👤 NPCs received:", npcs.length);

    const npcsWithMap = npcs.map((npc) => {
      const preparedNpc = normalizeNpc(npc, mapId);

      delete preparedNpc._id;
      delete preparedNpc.id;
      delete preparedNpc.__v;
      delete preparedNpc.createdAt;
      delete preparedNpc.updatedAt;

      return preparedNpc;
    });

    for (let i = 0; i < npcsWithMap.length; i += 1) {
      try {
        await new NPC(npcsWithMap[i]).validate();
      } catch (validationErr) {
        console.error(`❌ NPC validation failed at index ${i}:`, validationErr);

        return res.status(400).json({
          error: "NPC validation failed",
          index: i,
          details: validationErr.message,
          npc: npcsWithMap[i],
        });
      }
    }

    const incomingNpcIds = npcsWithMap.map((npc) => npc.npcId);

    if (npcsWithMap.length > 0) {
      await NPC.bulkWrite(
        npcsWithMap.map((npc) => ({
          updateOne: {
            filter: {
              mapId,
              npcId: npc.npcId,
            },
            update: {
              $set: npc,
            },
            upsert: true,
          },
        }))
      );

      await NPC.deleteMany({
        mapId,
        npcId: { $nin: incomingNpcIds },
      });
    } else {
      await NPC.deleteMany({ mapId });
    }

    const savedNpcs = await NPC.find({ mapId });

    console.log("✅ NPCs saved successfully:", savedNpcs.length);

    const normalized = savedNpcs.map((npc) => {
      const normalizedNpc = normalizeNpc(npc, mapId);

      return {
        ...normalizedNpc,
        id: normalizedNpc.npcId,
        _id: npc._id.toString(),
      };
    });

    res.json({
      success: true,
      saved: normalized.length,
      npcs: normalized,
    });
  } catch (err) {
    console.error("❌ Failed saving map NPCs:", err);

    res.status(500).json({
      error: "Failed to save map NPCs",
      details: err.message,
    });
  }
});

//
// ========================= OBJECT ROUTES =========================
//

// Create object
app.post("/api/objects", async (req, res) => {
  try {
    const {
      mapId,
      name,
      category,
      type,
      size,
      position,
      rotation,
      color,
      snapSize,
      modelPath,
    } = req.body;

    if (!mapId) {
      return res.status(400).json({ error: "mapId is required" });
    }

    if (!mongoose.Types.ObjectId.isValid(mapId)) {
      return res.status(400).json({ error: "Invalid mapId" });
    }

    const object = new Object3D({
      mapId,
      name,
      category,
      type,
      size,
      position,
      rotation,
      color,
      snapSize,
      modelPath,
    });

    await object.save();

    const normalized = {
      ...object.toObject(),
      id: object._id.toString(),
    };

    res.status(201).json(normalized);
  } catch (err) {
    console.error("❌ Object creation error:", err);
    res.status(500).json({ error: err.message });
  }
});

// Update object
app.put("/api/objects/:id", async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: "Invalid object id" });
    }

    const object = await Object3D.findById(id);

    if (!object) {
      return res.status(404).json({ error: "Object not found" });
    }

    if (req.body.mapId && req.body.mapId !== object.mapId.toString()) {
      return res.status(400).json({ error: "Cannot change object's mapId" });
    }

    Object.assign(object, req.body);

    await object.save();

    const normalized = {
      ...object.toObject(),
      id: object._id.toString(),
    };

    res.json(normalized);
  } catch (err) {
    console.error("❌ Object update error:", err);
    res.status(500).json({ error: err.message });
  }
});

// Delete map
app.delete("/api/maps/:mapId", async (req, res) => {
  try {
    const { mapId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(mapId)) {
      return res.status(400).json({ error: "Invalid mapId" });
    }

    await Object3D.deleteMany({ mapId });
    await NPC.deleteMany({ mapId });
    await Map.findByIdAndDelete(mapId);

    res.json({ success: true });
  } catch (err) {
    console.error("❌ Map deletion error:", err);
    res.status(500).json({ error: err.message });
  }
});

// Delete object
app.delete("/api/objects/:id", async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: "Invalid object id" });
    }

    const deleted = await Object3D.findByIdAndDelete(id);

    if (!deleted) {
      return res.status(404).json({ error: "Object not found" });
    }

    io.emit("objectChange", {
      operationType: "delete",
      id,
    });

    res.json({
  message: "Object deleted",
      id,
    });
  } catch (err) {
    console.error("❌ Object deletion error:", err);
    res.status(500).json({ error: "Failed to delete object" });
  }
});

// Start server
server.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 Server running on http://0.0.0.0:${PORT}`);
});
