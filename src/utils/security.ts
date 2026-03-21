/**
 * Security Utility for Sanitizing User Input
 * Prevents basic XSS attacks by escaping HTML tags.
 */
export const sanitizeInput = (input: string): string => {
    if (!input) return "";
    return input
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
};

/**
 * Validates Environment Variables
 * Ensures critical keys are present and not empty.
 */
export const validateEnv = () => {
    const required = [
        "VITE_SUPABASE_URL",
        "VITE_SUPABASE_ANON_KEY",
    ];

    const missing = required.filter(key => !import.meta.env[key]);

    if (missing.length > 0) {
        console.warn(`[Security] Missing critical environment variables: ${missing.join(", ")}`);
        return false;
    }
    return true;
};
