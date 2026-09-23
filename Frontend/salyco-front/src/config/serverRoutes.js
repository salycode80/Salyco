/**
 * Routes served by Django, not by the SPA.
 *
 * A React Router <Link to="/articles/…"> would client-render a route that no
 * longer exists and leave the visitor on a blank page instead of fetching the
 * server-rendered article. Every one of these therefore has to be a real anchor,
 * which also means the browser does a full page load and gets the article's
 * title, metadata and body from the server — the entire point of moving the
 * pages to Wagtail.
 */
export const SERVER_ROUTES = ["/articles"];

/** True when `path` is served by Django rather than by React Router. */
export const isServerRoute = (path) =>
  typeof path === "string" &&
  SERVER_ROUTES.some((root) => path === root || path.startsWith(`${root}/`));
