export const ACTION_TYPE_OPTIONS = [
  { value: "setFlag", label: "Set Flag" },
  { value: "clearFlag", label: "Clear Flag" },
  { value: "playSound", label: "Play Sound" },
  { value: "giveItem", label: "Give Item" },
  { value: "removeItem", label: "Remove Item" },
  { value: "teleport", label: "Teleport" },
  { value: "startQuest", label: "Start Quest" },
  { value: "completeQuest", label: "Complete Quest" },
  { value: "setNpcWaypointWaitTime", label: "Set NPC Waypoint Wait Time" },
  { value: "setNpcWaypointDialogue", label: "Set NPC Waypoint Dialogue" },
  { value: "setNpcWaypoints", label: "Set NPC Waypoints" },
  { value: "resetNpcEventSequence", label: "Reset NPC Event Sequence" },
  { value: "despawnOwnedClones", label: "Despawn Owned Clones" },
  { value: "summonNpc", label: "Summon NPC" },
  { value: "setTemporaryDialogue", label: "Set Temporary Dialogue" },
  { value: "setNpcTextureWhileInRadius", label: "Set NPC Texture While In Detection Radius" },
];

export const TARGET_SCOPE_OPTIONS = [
  { value: "main", label: "This NPC" },
  { value: "owner", label: "Owner NPC" },
  { value: "clones", label: "Owned Clones" },
  { value: "all", label: "Main + Owned Clones" },
];

export const FOLLOW_TARGET_OPTIONS = [
  { value: "player", label: "Player" },
  { value: "owner", label: "Owner NPC" },
  { value: "main", label: "This NPC" },
];

export const WAYPOINT_DIALOGUE_TRIGGER_OPTIONS = [
  { value: "onReach", label: "On Reach" },
  { value: "afterWait", label: "After Wait" },
];

export const TEMP_DIALOGUE_ENTITY_TARGET_OPTIONS = [
  { value: "owner", label: "Owner / Main NPC" },
  { value: "player", label: "Player" },
  { value: "specificNpc", label: "Specific NPC" },
  { value: "triggerNpc", label: "Triggered NPC" },
];

export const TEMP_DIALOGUE_ASSIGNMENT_OPTIONS = [
  { value: "main", label: "This NPC" },
  { value: "owner", label: "Owner NPC" },
  { value: "clones", label: "Owned Clones" },
  { value: "all", label: "Main + Owned Clones" },
];
