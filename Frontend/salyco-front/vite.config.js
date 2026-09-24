import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    // In local dev there is no nginx, so proxy API/media calls to the Django
    // dev server (python manage.py runserver). Keeps VITE_API_URL="" working
    // both in Docker (nginx proxies) and locally (this proxy).
    //
    // This list mirrors the locations nginx routes to Django, and it has to:
    // the articles are server-rendered, so without /articles here Vite answers
    // the request itself with index.html — the SPA router dropped the article
    // routes deliberately, so the page comes up blank rather than erroring.
    // /static has to come along for the same reason, because the article
    // template links its stylesheet through STATIC_URL; without it Vite
    // returns index.html as text/html for a .css request.
    //
    // /tokens.css and /salyco-logo-navy.svg are deliberately absent. nginx
    // serves those from the SPA build root, so here they come from public/,
    // which is the same arrangement and keeps one palette in one file.
    proxy: Object.fromEntries(
      [
        "/api",
        "/media",
        "/articles",
        "/static",
        "/cms",
        "/documents",
        "/sitemap.xml",
        "/robots.txt",
      ].map((route) => [
        route,
        { target: "http://127.0.0.1:8000", changeOrigin: true },
      ]),
    ),
  },
});
