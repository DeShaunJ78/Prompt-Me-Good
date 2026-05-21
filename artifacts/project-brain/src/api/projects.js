const BASE = "/api/projects";

async function request(path, options = {}) {
  const res = await fetch(BASE + path, {
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    ...options,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? `Server returned ${res.status}`);
  }
  return res.json();
}

export const listProjects   = ()         => request("/");
export const getProject     = (id)       => request(`/${id}`);
export const deleteProject  = (id)       => request(`/${id}`, { method: "DELETE" });

export const createProject = (data) =>
  request("/", { method: "POST", body: JSON.stringify(data) });

export const updateProject = (id, data) =>
  request(`/${id}`, { method: "PUT", body: JSON.stringify(data) });
