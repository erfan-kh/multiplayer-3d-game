const mongoose = require("mongoose");

const ObjectSchema = new mongoose.Schema({
  mapId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: "Map", 
    required: true,
    index: true
  },

  name: { type: String, required: true },
  category: { type: String, required: true },
  type: { type: String, required: true },

  size: { type: [Number], required: true },
  position: { type: [Number], required: true },
  rotation: { type: [Number], required: true },

  color: { type: String, required: true },
  snapSize: { type: Number, required: true },

  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model("Object3D", ObjectSchema);
