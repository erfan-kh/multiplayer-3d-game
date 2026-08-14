// models/NpcModel.js
const mongoose = require("mongoose");

function createDefaultDialogue() {
  return {
    startNodeId: "root",
    nodes: {
      root: {
        id: "root",
        speakerName: "NPC",
        speakerData: {
          "NPC": {
            text: "Hello traveler!",
            choices: [],
          }
        },
        onEnter: [],
        onExit: [],
      },
    },
  };
}

const NpcSchema = new mongoose.Schema(
  {
    npcId: {
      type: String,
      required: true,
      index: true,
    },

    mapId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Map",
      required: true,
      index: true,
    },

    name: {
      type: String,
      default: "NPC",
    },

    position: {
      type: [Number],
      default: [0, 1, 0],
    },

    rotation: {
      type: [Number],
      default: [0, 0, 0],
    },

    scale: {
      type: [Number],
      default: [1, 1, 1],
    },

    modelPath: {
      type: String,
      default: null,
    },

    textureUrl: {
      type: String,
      default: "",
    },

    spriteSheet: {
      type: String,
      default: "",
    },

    movement: {
      mode: {
        type: String,
        enum: ["idle", "static", "wander", "patrol"],
        default: "idle",
      },
      speed: {
        type: Number,
        default: 2,
      },
      waitTime: {
        type: Number,
        default: 0,
      },
      wanderRadius: {
        type: Number,
        default: 5,
      },
    },

    detection: {
      radius: {
        type: Number,
        default: 6,
      },
      behavior: {
        type: String,
        enum: ["look", "chase", "flee", "attack", "ignore"],
        default: "look",
      },
      targetType: {
        type: String,
        enum: ["player", "npc", "both"],
        default: "both",
      },
      stopDistance: {
        type: Number,
        default: 0.8,
      },
      debug: {
        type: Boolean,
        default: false,
      },
      reactions: {
        type: mongoose.Schema.Types.Mixed,
        default: {},
      },
    },

    waypoints: {
      type: [mongoose.Schema.Types.Mixed],
      default: [],
    },

    currentWaypointIndex: {
      type: Number,
      default: 0,
    },

    patrolMode: {
      type: String,
      enum: ["loop", "pingpong"],
      default: "loop",
    },

    patrolDirection: {
      type: Number,
      default: 1,
    },

    isPatrolling: {
      type: Boolean,
      default: true,
    },

    dialogue: {
      type: mongoose.Schema.Types.Mixed,
      default: createDefaultDialogue,
    },

    actions: {
      type: [mongoose.Schema.Types.Mixed],
      default: [],
    },

    rules: {
      type: [mongoose.Schema.Types.Mixed],
      default: [],
    },
  },
  {
    timestamps: true,
  }
);

NpcSchema.index({ mapId: 1, npcId: 1 }, { unique: true });

module.exports = mongoose.model("NPC", NpcSchema);
