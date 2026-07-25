import api from "../api";

export async function getBanners() {
  try {
    const res = await api.get("/api/banners/");
    return res.data;
  } catch (err) {
    console.error("Failed to fetch banners:", err);
    return [];
  }
}
