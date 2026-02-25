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

// Middleware
app.use(cors());
app.use(express.json());

// MongoDB connection
mongoose.connect(process.env.MONGO_URI);

const db = mongoose.connection;

db.once("open", () => {
  console.log("✅ Connected to MongoDB");
});

// Routes
app.get("/", (req, res) => {
  res.send("API is running...");
});

const Object3D = require("./models/ObjectModel");

app.post("/api/objects", async (req, res) => {
  try {
    const newObj = new Object3D(req.body);
    await newObj.save();

    // Emit real-time update
    io.emit("objectChange", { operationType: "insert", object: newObj });

    res.status(201).json({ message: "Object saved", object: newObj });
  } catch (err) {
    res.status(500).json({ error: "Failed to save object" });
  }
});

app.get("/api/objects", async (req, res) => {
  try {
    const objects = await Object3D.find().sort({ createdAt: -1 });
    res.json(objects);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch objects" });
  }
});

app.put("/api/objects/:id", async (req, res) => {
  try {
    const updated = await Object3D.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
    });
    if (!updated) {
      return res.status(404).json({ error: "Object not found" });
    }

    // Emit real-time update
    io.emit("objectChange", { operationType: "update", object: updated });

    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: "Failed to update object" });
  }
});

app.delete("/api/objects/:id", async (req, res) => {
  try {
    const deleted = await Object3D.findByIdAndDelete(req.params.id);
    if (!deleted) {
      return res.status(404).json({ error: "Object not found" });
    }

    // Emit real-time update
    io.emit("objectChange", { operationType: "delete", id: req.params.id });

    res.json({ message: "Object deleted", id: req.params.id });
  } catch (err) {
    res.status(500).json({ error: "Failed to delete object" });
  }
});

// Start server
server.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 Server running on http://0.0.0.0:${PORT}`);
});
