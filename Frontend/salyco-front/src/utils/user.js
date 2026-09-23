/**
 * Display helpers for the signed-in user.
 *
 * Shared by the desktop navbar's avatar menu and the mobile account sheet so the
 * same account reads identically in both.
 */

/**
 * First + last name when available, else the username, else a placeholder.
 * For phone-registered accounts the username *is* the phone number, which is a
 * poor display choice — first_name + last_name is filled in at signup or on the
 * profile page, so prefer it.
 */
export const getDisplayName = (u) =>
  [u?.first_name, u?.last_name].filter(Boolean).join(" ") ||
  u?.username ||
  "کاربر";

/**
 * The account's phone number, or "" when there is nothing to show.
 *
 * Kept separate from getDisplayName because for a phone-registered account the
 * two are the same string, and every surface that renders both needs to know
 * that before printing it twice.
 */
export const getPhoneNumber = (u) => u?.phone_number || u?.username || "";
