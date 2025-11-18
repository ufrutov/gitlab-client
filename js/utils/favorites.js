/**
 * Favorites Storage Management
 * Stores and retrieves favorite projects and issues from localStorage
 */

const FAVORITES_KEY = "appFavorites";

/**
 * Get all favorites from localStorage
 * @returns {Object} Object with projects and issues arrays
 */
function getFavorites() {
	try {
		const stored = localStorage.getItem(FAVORITES_KEY);
		if (stored) {
			const parsed = JSON.parse(stored);
			return {
				projects: Array.isArray(parsed.projects) ? parsed.projects : [],
				issues: Array.isArray(parsed.issues) ? parsed.issues : [],
			};
		}
	} catch (error) {
		console.error("Error reading favorites from localStorage:", error);
	}
	return { projects: [], issues: [] };
}

/**
 * Save favorites to localStorage
 * @param {Object} favorites Object with projects and issues arrays
 */
function saveFavorites(favorites) {
	try {
		localStorage.setItem(FAVORITES_KEY, JSON.stringify(favorites));
	} catch (error) {
		console.error("Error saving favorites to localStorage:", error);
	}
}

/**
 * Check if a project is favorited
 * @param {string} projectId Project ID
 * @returns {boolean}
 */
export function isProjectFavorite(projectId) {
	const favorites = getFavorites();
	return favorites.projects.includes(projectId);
}

/**
 * Check if an issue is favorited
 * @param {string} issueId Issue ID
 * @returns {boolean}
 */
export function isIssueFavorite(issueId) {
	const favorites = getFavorites();
	return favorites.issues.includes(issueId);
}

/**
 * Toggle project favorite status
 * @param {string} projectId Project ID
 * @returns {boolean} New favorite status (true if now favorited, false if unfavorited)
 */
export function toggleProjectFavorite(projectId) {
	const favorites = getFavorites();
	const index = favorites.projects.indexOf(projectId);

	if (index === -1) {
		// Add to favorites
		favorites.projects.push(projectId);
		saveFavorites(favorites);
		return true;
	} else {
		// Remove from favorites
		favorites.projects.splice(index, 1);
		saveFavorites(favorites);
		return false;
	}
}

/**
 * Toggle issue favorite status
 * @param {string} issueId Issue ID
 * @returns {boolean} New favorite status (true if now favorited, false if unfavorited)
 */
export function toggleIssueFavorite(issueId) {
	const favorites = getFavorites();
	const index = favorites.issues.indexOf(issueId);

	if (index === -1) {
		// Add to favorites
		favorites.issues.push(issueId);
		saveFavorites(favorites);
		return true;
	} else {
		// Remove from favorites
		favorites.issues.splice(index, 1);
		saveFavorites(favorites);
		return false;
	}
}

/**
 * Get all favorite project IDs
 * @returns {string[]}
 */
export function getFavoriteProjects() {
	return getFavorites().projects;
}

/**
 * Get all favorite issue IDs
 * @returns {string[]}
 */
export function getFavoriteIssues() {
	return getFavorites().issues;
}

/**
 * Clear all favorites
 */
export function clearAllFavorites() {
	try {
		localStorage.removeItem(FAVORITES_KEY);
	} catch (error) {
		console.error("Error clearing favorites:", error);
	}
}
