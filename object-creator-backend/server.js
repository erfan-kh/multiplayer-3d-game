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
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
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
    res.status(500).json({ error: "Failed to fetch maps" });
  }
});

// Get objects for map
app.get("/api/maps/:mapId/objects", async (req, res) => {
  try {
    const objects = await Object3D.find({ mapId: req.params.mapId });

    const normalized = objects.map((obj) => ({
      ...obj.toObject(),
      id: obj._id.toString(),
    }));

    res.json(normalized);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch objects for map" });
  }
});

// Save all objects for a map
app.put("/api/maps/:mapId/objects", async (req, res) => {
  try {
    const { mapId } = req.params;
    const objects = req.body.objects || [];

    console.log("💾 Saving objects for map:", mapId);
    console.log("📦 Objects received:", objects.length);

    await Object3D.deleteMany({ mapId });

    const objectsWithMap = objects.map((obj) => ({
      ...obj,
      mapId,
    }));

    const savedObjects = await Object3D.insertMany(objectsWithMap);

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
    res.status(500).json({ error: "Failed to save map objects" });
  }
});

// ✅ RENAME MAP (FIXED)
app.put("/api/maps/:id", async (req, res) => {
  try {
    const { name } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ error: "Map name is required" });
    }

    const updatedMap = await Map.findByIdAndUpdate(
      req.params.id,
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
    console.error("Rename map error:", err);
    res.status(500).json({ error: "Failed to rename map" });
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
    const object = await Object3D.findById(req.params.id);

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

    await Object3D.deleteMany({ mapId });
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
    const deleted = await Object3D.findByIdAndDelete(req.params.id);

    if (!deleted) {
      return res.status(404).json({ error: "Object not found" });
    }

    io.emit("objectChange", {
      operationType: "delete",
      id: req.params.id,
    });

    res.json({
      message: "Object deleted",
      id: req.params.id,
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
