export const ACCESS_TOKEN = "access";
export const REFRESH_TOKEN = "refresh";

// ── Idle session timeout ────────────────────────────────────────────────────
// Storage keys are shared across tabs on purpose: interacting in one tab keeps
// the session alive in all of them.
export const LAST_ACTIVITY = "salyco_last_activity";
export const LAST_KEEPALIVE = "salyco_last_keepalive";

// Every timing lives here and nothing is hard-coded elsewhere, so a 30-minute
// scenario can be compressed to about a minute for manual testing by editing
// this block alone (pair it with a shorter REFRESH_TOKEN_LIFETIME in
// Backend/core/settings.py).
//
// INVARIANTS, both checked by assertTimingInvariants() below:
//   IDLE_WARNING_MS       < IDLE_TIMEOUT_MS
//   KEEPALIVE_INTERVAL_MS < backend ACCESS_TOKEN_LIFETIME  (5 min)
//   IDLE_TIMEOUT_MS       < backend REFRESH_TOKEN_LIFETIME (31 min)
export const IDLE_TIMEOUT_MS = 30 * 60 * 1000; // hard logout after last interaction
export const IDLE_WARNING_MS = 28 * 60 * 1000; // countdown modal appears
export const KEEPALIVE_INTERVAL_MS = 60 * 1000; // slides the server-side window
export const ACTIVITY_THROTTLE_MS = 15 * 1000; // max one activity write per tick
export const IDLE_CHECK_INTERVAL_MS = 15 * 1000; // how often idleness is re-tested

// Mirrors of the backend SIMPLE_JWT lifetimes. Only used by the invariant check —
// the backend remains the single source of truth for actual token expiry.
const BACKEND_ACCESS_TOKEN_MS = 5 * 60 * 1000;
const BACKEND_REFRESH_TOKEN_MS = 31 * 60 * 1000;

// Called once from AuthProvider. A violation here is silent in production but
// produces user-visible bugs (a keep-alive that can't renew, or a "continue
// session" button that logs you out), so fail loudly in dev instead.
export function assertTimingInvariants() {
  const problems = [];
  if (IDLE_WARNING_MS >= IDLE_TIMEOUT_MS) {
    problems.push("IDLE_WARNING_MS must be < IDLE_TIMEOUT_MS");
  }
  if (KEEPALIVE_INTERVAL_MS >= BACKEND_ACCESS_TOKEN_MS) {
    problems.push(
      "KEEPALIVE_INTERVAL_MS must be < backend ACCESS_TOKEN_LIFETIME",
    );
  }
  if (IDLE_TIMEOUT_MS >= BACKEND_REFRESH_TOKEN_MS) {
    problems.push(
      "IDLE_TIMEOUT_MS must be < backend REFRESH_TOKEN_LIFETIME, or the " +
        "session-continue button fails just before the timeout",
    );
  }
  if (problems.length > 0 && import.meta.env.DEV) {
    console.error(`[auth] bad idle-timeout timings:\n- ${problems.join("\n- ")}`);
  }
  return problems;
}
