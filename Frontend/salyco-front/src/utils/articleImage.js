import { formatJalaliLong } from "./jalali";

const API_URL = import.meta.env.VITE_API_URL;

export function getArticleImageUrl(image) {
  if (!image) return "/matress.png";
  if (image.startsWith("http") || image.startsWith("/")) return image;
  return `${API_URL}/media/${image}`;
}

export function formatArticleDate(dateString) {
  return formatJalaliLong(dateString);
}
