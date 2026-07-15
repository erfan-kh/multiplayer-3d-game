const mongoose = require("mongoose");

const ObjectTemplateSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true
  },

  category: {
    type: String,
    required: true,
    default: "custom"
  },

  type: {
    type: String,
    required: true,
    default: "box"
  },

  size: {
    type: [Number],
    required: true,
    default: [1, 1, 1]
  },

  color: {
    type: String,
    default: "#cccccc"
  },

  material: {
    type: String,
    enum: ["standard", "glass"],
    default: "standard"
  },

  snapSize: {
    type: Number,
    default: 1
  },

  modelPath: {
    type: String,
    default: null
  },

  collision: {
    type: String,
    default: "box"
  },

  rotation: {
    type: [Number],
    default: [0, 0, 0]
  },

  createdAt: {
    type: Date,
    default: Date.now
  },

  updatedAt: {
    type: Date,
    default: Date.now
  }
});

ObjectTemplateSchema.pre("save", function () {
  this.updatedAt = Date.now();
});

module.exports = mongoose.model("ObjectTemplate", ObjectTemplateSchema);
