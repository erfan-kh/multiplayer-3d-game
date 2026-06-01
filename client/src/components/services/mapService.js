import API_BASE_URL from "../../config";

const JSON_HEADERS = {
  "Content-Type": "application/json",
};

/* MAP LIST */
export async function fetchMaps() {
  const res = await fetch(`${API_BASE_URL}/api/maps`);

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed to fetch maps: ${text}`);
  }

  return res.json();
}

/* CREATE MAP */
export async function createMap(name) {
  const res = await fetch(`${API_BASE_URL}/api/maps`, {
    method: "POST",
    headers: JSON_HEADERS,
    body: JSON.stringify({ name }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed to create map: ${text}`);
  }

  return res.json();
}

/* DELETE MAP */
export async function deleteMap(id) {
  const res = await fetch(`${API_BASE_URL}/api/maps/${id}`, {
    method: "DELETE",
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed to delete map: ${text}`);
  }

  return true;
}

/* RENAME MAP */
export async function renameMap(id, name) {
  const res = await fetch(`${API_BASE_URL}/api/maps/${id}`, {
    method: "PUT",
    headers: JSON_HEADERS,
    body: JSON.stringify({ name }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed to rename map: ${text}`);
  }

  return res.json();
}

/* SAVE MAP OBJECTS */
export async function saveMapObjects(mapId, objects) {
  const res = await fetch(`${API_BASE_URL}/api/maps/${mapId}/objects`, {
    method: "PUT",
    headers: JSON_HEADERS,
    body: JSON.stringify({ objects }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed to save map objects: ${text}`);
  }

  return res.json();
}

/* LOAD MAP OBJECTS */
export async function loadMapObjects(mapId) {
  const res = await fetch(`${API_BASE_URL}/api/maps/${mapId}/objects`);

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed to load map objects: ${text}`);
  }

  return res.json();
}
