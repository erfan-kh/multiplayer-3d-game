import API_BASE_URL from "../../config";

export async function fetchObjectsByMap(mapId) {
  const res = await fetch(`${API_BASE_URL}/api/maps/${mapId}/objects`);
  if (!res.ok) throw new Error("Failed to fetch objects");
  return res.json();
}

export async function createObject(data) {
  const res = await fetch(`${API_BASE_URL}/api/objects`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });

  if (!res.ok) throw new Error("Failed to save object");
  return res.json();
}

export async function updateObject(id, data) {
  const res = await fetch(`${API_BASE_URL}/api/objects/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });

  if (!res.ok) throw new Error("Failed to update object");
  return res.json();
}

export async function deleteObject(id) {
  const res = await fetch(`${API_BASE_URL}/api/objects/${id}`, {
    method: "DELETE",
  });

  if (!res.ok) throw new Error("Failed to delete object");
}
