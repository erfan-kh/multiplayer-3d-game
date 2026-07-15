const mongoose = require("mongoose");

const MapSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      unique: true,
      trim: true
    },
    description: {
      type: String,
      default: "",
      trim: true
    }
  },
  {
    timestamps: true
  }
);

// Cascade delete all objects and NPCs belonging to the map
MapSchema.pre("findOneAndDelete", async function () {
  const map = await this.model.findOne(this.getFilter());

  if (map) {
    await mongoose.model("Object3D").deleteMany({ mapId: map._id });
    await mongoose.model("NPC").deleteMany({ mapId: map._id });
  }
});

// Cascade delete when using deleteOne on a document instance
MapSchema.pre("deleteOne", { document: true, query: false }, async function () {
  await mongoose.model("Object3D").deleteMany({ mapId: this._id });
  await mongoose.model("NPC").deleteMany({ mapId: this._id });
});

module.exports = mongoose.model("Map", MapSchema);
