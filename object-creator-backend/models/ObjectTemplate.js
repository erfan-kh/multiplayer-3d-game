const mongoose = require("mongoose");

const ObjectTemplateSchema = new mongoose.Schema({
  name: { type: String, required: true },
  category: { type: String, required: true },
  type: { type: String, required: true },

  size: { type: [Number], required: true },
  color: { type: String },
  snapSize: { type: Number },

  modelPath: { type: String },
  collision: { type: String },

  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model("ObjectTemplate", ObjectTemplateSchema);
