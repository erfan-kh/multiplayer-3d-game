export const getCollisionType = (category) => {
  switch (category) {
    case "walls":
    case "floors":
    case "furniture":
    case "car":
      return "solid";
    case "custom":
      return "none";
    default:
      return "solid";
  }
};
