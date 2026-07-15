const mongoose = require("mongoose");

const ObjectSchema = new mongoose.Schema({
  mapId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Map",
    required: true,
    index: true
  },

  name: {
    type: String,
    required: true,
    default: "Object"
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

  position: {
    type: [Number],
    required: true,
    default: [0, 0, 0]
  },

  rotation: {
    type: [Number],
    required: true,
    default: [0, 0, 0]
  },

  color: {
    type: String,
    required: true,
    default: "#cccccc"
  },

  material: {
    type: String,
    enum: ["standard", "glass"],
    default: "standard"
  },

  snapSize: {
    type: Number,
    required: true,
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

  createdAt: {
    type: Date,
    default: Date.now
  },

  updatedAt: {
    type: Date,
    default: Date.now
  }
});

ObjectSchema.pre("save", function () {
  this.updatedAt = Date.now();
});

module.exports = mongoose.model("Object3D", ObjectSchema);
