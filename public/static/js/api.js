async function request(path, options = {}) {
  let response;
  try {
    response = await fetch(path, {
      ...options,
      headers: { ...(options.body ? { "Content-Type": "application/json" } : {}), ...options.headers },
    });
  } catch {
    throw new Error("Couldn’t reach Daymark. Check your connection and try again.");
  }
  if (response.status === 204) return null;
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body?.error?.message || "Something went wrong. Please try again.");
  return body;
}

export const api = {
  list: () => request("/api/tasks"),
  create: (data) => request("/api/tasks", { method: "POST", body: JSON.stringify(data) }),
  update: (id, data) => request(`/api/tasks/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
  remove: (id) => request(`/api/tasks/${id}`, { method: "DELETE" }),
};
