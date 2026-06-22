const API_URL = import.meta.env.VITE_API_URL;

export function getProductImageUrl(image) {
  if (!image) return "/matress.png";
  if (image.startsWith("http") || image.startsWith("/")) return image;
  return `${API_URL}/media/${image}`;
}
