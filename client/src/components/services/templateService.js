import API_BASE_URL from "../../config";

export async function fetchTemplates() {
  const res = await fetch(`${API_BASE_URL}/api/templates`);
  if (!res.ok) throw new Error("Failed to fetch templates");
  return res.json();
}

export async function createTemplate(template) {
  const res = await fetch(`${API_BASE_URL}/api/templates`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(template),
  });

  if (!res.ok) throw new Error("Failed to save template");
  return res.json();
}

export async function deleteTemplate(id) {
  const res = await fetch(`${API_BASE_URL}/api/templates/${id}`, {
    method: "DELETE",
  });

  if (!res.ok) throw new Error("Failed to delete template");
}
