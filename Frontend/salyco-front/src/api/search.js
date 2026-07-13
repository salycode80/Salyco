import api from "../api";

// Unified search across all backend providers (products, articles, …).
// Returns { query, count, groups: [{ key, label, results: [...] }] }.
// Each result has: { type, type_label, id, title, subtitle, url, image }.
export async function search(query, { limit, type, signal } = {}) {
  const params = { q: query };
  if (limit) params.limit = limit;
  if (type) params.type = type;

  const res = await api.get("/api/search/", { params, signal });
  return res.data;
}
