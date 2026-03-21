/**
 * Escapes unsafe characters in a string to prevent XSS (Cross-Site Scripting).
 * Converts &, <, >, ", and ' to their corresponding HTML entities.
 * Safe to be used inside innerHTML and Leaflet bindPopup strings.
 */
export const escapeHtml = (unsafe: string | null | undefined): string => {
  if (!unsafe) return '';
  return String(unsafe)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
};
