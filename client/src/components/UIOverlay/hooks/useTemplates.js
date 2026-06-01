import { useState, useCallback } from "react";
import { fetchTemplates, deleteTemplate } from "../../services/templateService";

export default function useTemplates() {

  const [templates, setTemplates] = useState({
    walls: [],
    floors: [],
    furniture: [],
    car: [],
    custom: []
  });

  const loadTemplates = useCallback(async () => {
    try {
      const list = await fetchTemplates();

      const categorized = {
        walls: [],
        floors: [],
        furniture: [],
        car: [],
        custom: []
      };

      list.forEach(t => {
        const cat = t.category || "custom";
        if (!categorized[cat]) categorized[cat] = [];
        categorized[cat].push(t);
      });

      setTemplates(categorized);

    } catch (err) {
      console.error("Template loading error:", err);
      setTemplates({
        walls: [],
        floors: [],
        furniture: [],
        car: [],
        custom: []
      });
    }
  }, []);

  return { templates, loadTemplates };
}
