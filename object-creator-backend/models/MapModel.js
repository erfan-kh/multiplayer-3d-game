const mongoose = require("mongoose");

const MapSchema = new mongoose.Schema({
  name: { 
    type: String, 
    required: true,
    unique: true
  },

  description: {
    type: String,
    default: ""
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

// Update timestamp when saving
MapSchema.pre("save", function () {
  this.updatedAt = Date.now();
});

// Cascade delete all objects belonging to the map
MapSchema.pre("findOneAndDelete", async function () {

  const map = await this.model.findOne(this.getFilter());

  if (map) {
    await mongoose.model("Object3D").deleteMany({ mapId: map._id });
  }

});

module.exports = mongoose.model("Map", MapSchema);
