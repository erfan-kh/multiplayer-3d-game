import { useState, useCallback } from "react";
import {
  fetchObjectsByMap,
  createObject,
  updateObject,
  deleteObject,
} from "../../services/objectService";

export default function useObjects(currentMapId, setPlacedObjects) {

  const [savedObjects, setSavedObjects] = useState({
    walls: [],
    floors: [],
    furniture: [],
    custom: [],
    car: [],
  });

  const fetchObjects = useCallback(async () => {

    if (!currentMapId) {
      setPlacedObjects([]);
      setSavedObjects({
        walls: [],
        floors: [],
        furniture: [],
        custom: [],
        car: [],
      });
      return;
    }

    try {

      const response = await fetchObjectsByMap(currentMapId);

      // ✅ Normalize response into an array
      let data = [];

      if (Array.isArray(response)) {
        data = response;
      } 
      else if (response && Array.isArray(response.objects)) {
        data = response.objects;
      } 
      else if (response && typeof response === "object") {
        data = [response];
      }

      // ✅ Format objects
      const formatted = data.map((o) => ({
        ...o,
        id: o._id || o.id,
      }));

      setPlacedObjects(formatted);

      // ✅ Categorize safely
      const categorized = {
        walls: [],
        floors: [],
        furniture: [],
        custom: [],
        car: [],
      };

      formatted.forEach((obj) => {

        const cat = obj.category || "custom";

        if (!categorized[cat]) {
          categorized[cat] = [];
        }

        categorized[cat].push(obj);
      });

      setSavedObjects(categorized);

    } catch (err) {

      console.error("Error fetching objects:", err);

      setPlacedObjects([]);

      setSavedObjects({
        walls: [],
        floors: [],
        furniture: [],
        custom: [],
        car: [],
      });

    }

  }, [currentMapId, setPlacedObjects]);

  return { savedObjects, fetchObjects, setSavedObjects };

}
