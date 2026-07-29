// The auth state lives in a context so a logout (manual, cross-tab, or from the
// idle timeout) reaches every consumer at once. Re-exported here so the existing
// import path used across the app stays valid.
export { useAuth } from "../auth/authContext";
