const express = require("express");
const router = express.Router();
const ObjectTemplate = require("../models/ObjectTemplate");

// Get all templates
router.get("/", async (req, res) => {
  try {
    const templates = await ObjectTemplate.find().sort({ createdAt: -1 });
    res.json(templates);
  } catch {
    res.status(500).json({ error: "Failed to fetch templates" });
  }
});

// Create template
router.post("/", async (req, res) => {
  try {
    const template = new ObjectTemplate(req.body);
    await template.save();
    res.status(201).json(template);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete template
router.delete("/:id", async (req, res) => {
  try {
    await ObjectTemplate.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  } catch {
    res.status(500).json({ error: "Failed to delete template" });
  }
});

module.exports = router;
