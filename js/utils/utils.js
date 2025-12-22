/**
 * Utility functions for the application
 */

/**
 * Escapes HTML characters to prevent XSS attacks
 * @param {string} text - The text to escape
 * @returns {string} - The escaped HTML string
 */
export function escapeHtml(text) {
	const div = document.createElement("div");
	div.textContent = text;
	return div.innerHTML;
}

/**
 * Formats a date string into a human-readable relative time
 * @param {string} dateString - The ISO date string to format
 * @returns {string} - Human-readable relative time (e.g., "2 days ago")
 */
export function formatDate(dateString, readable = false, format = null) {
	const date = new Date(dateString);

	if (isNaN(date.getTime())) return "";

	if (!readable) {
		const day = String(date.getDate()).padStart(2, "0");
		const month = String(date.getMonth() + 1).padStart(2, "0");
		const year = date.getFullYear();
		const hours = String(date.getHours()).padStart(2, "0");
		const minutes = String(date.getMinutes()).padStart(2, "0");

		// If an explicit format was provided, replace tokens:
		// 'dd' -> day, 'mm' -> month, 'yyyy' -> full year
		// 'HH' -> hours, 'MM' -> minutes (note: 'MM' is minutes to avoid colliding with 'mm' month)
		if (format && typeof format === "string") {
			let out = String(format);
			out = out.replace(/yyyy/g, year);
			out = out.replace(/dd/g, day);
			out = out.replace(/mm/g, month);
			out = out.replace(/HH/g, hours);
			out = out.replace(/MM/g, minutes);
			return out;
		}

		// Default (legacy) behaviour: include date and time
		return `${day}/${month}/${year} ${hours}:${minutes}`;
	}

	const now = new Date();
	const diffTime = Math.abs(now - date);
	const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

	if (diffDays === 0) return "today";
	if (diffDays === 1) return "yesterday";
	if (diffDays < 7) return `${diffDays} days ago`;
	if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
	if (diffDays < 365) return `${Math.floor(diffDays / 30)} months ago`;
	return `${Math.floor(diffDays / 365)} years ago`;
}
