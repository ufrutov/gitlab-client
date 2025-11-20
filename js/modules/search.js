/**
 * Search functionality module
 * Handles expandable search input toggling and interactions with GitLab API search
 */

import gitlabAPI from "../utils/gitlab.js";

// Store for filtering
let allTimeLogs = []; // Store all time logs for filtering

/**
 * Set the time logs data for search filtering
 * @param {Array} timeLogs - Array of time log objects
 */
export function setTimeLogsData(timeLogs) {
	allTimeLogs = timeLogs || [];
}

/**
 * Search projects using GitLab GraphQL API
 * @param {string} searchTerm - Search query
 * @returns {Promise<Array>} - Array of matching projects
 */
async function searchProjects(searchTerm) {
	if (!searchTerm || searchTerm.trim().length === 0) {
		return null; // Return null to indicate no search performed
	}

	try {
		const projects = await gitlabAPI.listProjects({
			search: searchTerm,
			first: 20,
			membership: true,
		});
		return projects?.nodes || [];
	} catch (error) {
		console.error("Error searching projects:", error);
		throw error;
	}
}

/**
 * Search issues in a specific project using GitLab GraphQL API
 * @param {string} projectFullPath - Full path of the project
 * @param {string} searchTerm - Search query
 * @returns {Promise<Array>} - Array of matching issues
 */
async function searchIssues(projectFullPath, searchTerm) {
	if (!searchTerm || searchTerm.trim().length === 0) {
		return null; // Return null to indicate no search performed
	}

	try {
		const issues = await gitlabAPI.listIssues(projectFullPath, {
			search: searchTerm,
			first: 50,
			state: "opened",
		});
		return issues?.nodes || [];
	} catch (error) {
		console.error("Error searching issues:", error);
		throw error;
	}
}

/**
 * Filter time logs locally by title, assignee, and description
 * @param {Array} timeLogs - Array of time log objects
 * @param {string} searchTerm - Search query
 * @returns {Array} - Filtered array of time logs
 */
function filterTimeLogs(timeLogs, searchTerm) {
	if (!searchTerm || searchTerm.trim().length === 0) {
		return timeLogs;
	}

	const lowerSearch = searchTerm.toLowerCase().trim();

	return timeLogs.filter((log) => {
		// Search in issue title
		const titleMatch = log.issue?.title?.toLowerCase().includes(lowerSearch);

		// Search in issue description
		const descriptionMatch = log.issue?.description?.toLowerCase().includes(lowerSearch);

		// Search in user/author name
		const authorMatch = log.user?.name?.toLowerCase().includes(lowerSearch);

		// Search in user username
		const usernameMatch = log.user?.username?.toLowerCase().includes(lowerSearch);

		// Search in summary/note
		const summaryMatch = log.summary?.toLowerCase().includes(lowerSearch);

		// Search in project name
		const projectMatch = log.issue?.project?.name?.toLowerCase().includes(lowerSearch);

		return (
			titleMatch || descriptionMatch || authorMatch || usernameMatch || summaryMatch || projectMatch
		);
	});
}

/**
 * Initialize search toggle functionality
 * @param {string} toggleId - ID of the toggle button
 * @param {string} inputId - ID of the search input
 * @param {string} containerId - ID of the container element
 * @param {Function} onSearch - Callback function when search is performed
 */
function initSearchToggle(toggleId, inputId, containerId, onSearch) {
	const toggle = document.getElementById(toggleId);
	const input = document.getElementById(inputId);
	const container = document.getElementById(containerId);

	if (!toggle || !input || !container) return;

	let isExpanded = false;
	let searchTimeout = null;

	const collapseSearch = () => {
		isExpanded = false;
		input.classList.remove("search-expanded");
		toggle.classList.remove("search-button-active");
		const icon = toggle.querySelector("i");
		if (icon) icon.className = "fas fa-search";
		input.value = "";
		// Trigger search clear
		if (onSearch) onSearch("");
	};

	toggle.addEventListener("click", () => {
		isExpanded = !isExpanded;

		if (isExpanded) {
			input.classList.add("search-expanded");
			toggle.classList.add("search-button-active");
			const icon = toggle.querySelector("i");
			if (icon) icon.className = "fas fa-times";
			setTimeout(() => input.focus(), 300);
		} else {
			collapseSearch();
		}
	});

	// Handle search input with debounce
	input.addEventListener("input", (e) => {
		const searchTerm = e.target.value;

		// Clear existing timeout
		if (searchTimeout) {
			clearTimeout(searchTimeout);
		}

		// Debounce search by 300ms
		searchTimeout = setTimeout(() => {
			if (onSearch) {
				onSearch(searchTerm);
			}
		}, 300);
	});

	// Close search when clicking outside
	document.addEventListener("click", (e) => {
		if (isExpanded && !container.contains(e.target)) {
			collapseSearch();
		}
	});

	// Close on Escape key
	input.addEventListener("keydown", (e) => {
		if (e.key === "Escape") {
			collapseSearch();
		}
	});
}

/**
 * Initialize all search inputs
 * @param {Object} callbacks - Object containing callback functions for each search type
 * @param {Function} callbacks.onProjectsSearch - Callback for projects search
 * @param {Function} callbacks.onIssuesSearch - Callback for issues search
 * @param {Function} callbacks.onTimeLogsSearch - Callback for time logs search
 */
export function initializeSearchInputs(callbacks = {}) {
	// Initialize all search toggles
	setTimeout(() => {
		initSearchToggle(
			"projectsSearchToggle",
			"projectsSearchInput",
			"projectsSearchContainer",
			callbacks.onProjectsSearch
		);
		initSearchToggle(
			"issuesSearchToggle",
			"issuesSearchInput",
			"issuesSearchContainer",
			callbacks.onIssuesSearch
		);
		initSearchToggle(
			"trackSearchToggle",
			"trackSearchInput",
			"trackSearchContainer",
			callbacks.onTimeLogsSearch
		);
	}, 100);
}

/**
 * Export search functions for use in other modules
 */
export { searchProjects, searchIssues, filterTimeLogs };

// ============================================================
// Search Event Handlers
// ============================================================

/**
 * Initialize search event listeners
 * @param {Object} dependencies - Object containing required functions and data
 * @param {Function} dependencies.loadProjects - Function to load all projects
 * @param {Function} dependencies.loadIssues - Function to load issues for a project
 * @param {Function} dependencies.loadTimeLogs - Function to load time logs
 * @param {Function} dependencies.createProjectCard - Function to create project card element
 * @param {Function} dependencies.createIssueCard - Function to create issue card element
 * @param {Function} dependencies.createTimeLogCard - Function to create time log card element
 * @param {Function} dependencies.formatDate - Function to format dates
 * @param {Object} dependencies.favorites - Favorites utility object
 * @param {Function} dependencies.getCurrentPeriod - Function to get current period
 * @param {Function} dependencies.getWeekKey - Function to get week key from date
 * @param {Function} dependencies.createWeekContainer - Function to create week container element
 * @param {Function} dependencies.createDayContainer - Function to create day container element
 * @param {Function} dependencies._attachTimeLogCardClick - Function to attach click handler to time log cards
 */
export function initializeSearchEventListeners(dependencies) {
	const {
		loadProjects,
		loadIssues,
		loadTimeLogs,
		createProjectCard,
		createIssueCard,
		createTimeLogCard,
		formatDate,
		favorites,
		getCurrentPeriod,
		getWeekKey,
		createWeekContainer,
		createDayContainer,
		_attachTimeLogCardClick,
	} = dependencies;

	// Listen to search events
	window.addEventListener("projectsSearch", async (event) => {
		await handleProjectsSearch(event.detail.searchTerm, loadProjects, createProjectCard, favorites);
	});

	window.addEventListener("issuesSearch", async (event) => {
		await handleIssuesSearch(event.detail.searchTerm, loadIssues, createIssueCard);
	});

	window.addEventListener("timeLogsSearch", async (event) => {
		await handleTimeLogsSearch(
			event.detail.searchTerm,
			loadTimeLogs,
			createTimeLogCard,
			formatDate,
			getCurrentPeriod,
			getWeekKey,
			createWeekContainer,
			createDayContainer,
			_attachTimeLogCardClick
		);
	});
}

/**
 * Handle projects search
 */
async function handleProjectsSearch(searchTerm, loadProjects, createProjectCard, favorites) {
	const projectsList = document.getElementById("projectsList");
	const projectsLoading = document.getElementById("projectsLoading");
	const projectsError = document.getElementById("projectsError");
	const projectsEmpty = document.getElementById("projectsEmpty");

	// If search is empty, reload all projects
	if (!searchTerm || searchTerm.trim().length === 0) {
		await loadProjects();
		return;
	}

	// Show loading state
	projectsList.classList.add("hidden");
	projectsError.classList.add("hidden");
	projectsEmpty.classList.add("hidden");
	projectsLoading.classList.remove("hidden");

	try {
		// Search projects via GitLab API
		const results = await searchProjects(searchTerm);

		projectsLoading.classList.add("hidden");

		if (!results || results.length === 0) {
			projectsEmpty.classList.remove("hidden");
			return;
		}

		// Display filtered projects
		const favoriteProjectIds = favorites.getFavoriteProjects();
		const sortedProjects = results.sort((a, b) => {
			const aIsFav = favoriteProjectIds.includes(a.id);
			const bIsFav = favoriteProjectIds.includes(b.id);
			if (aIsFav && !bIsFav) return -1;
			if (!aIsFav && bIsFav) return 1;
			return 0;
		});

		projectsList.innerHTML = "";
		sortedProjects.forEach((project) => {
			const projectCard = createProjectCard(project);
			projectsList.appendChild(projectCard);
		});

		projectsList.classList.remove("hidden");
	} catch (error) {
		console.error("Error searching projects:", error);
		projectsLoading.classList.add("hidden");
		projectsError.classList.remove("hidden");
		document.getElementById("projectsErrorMessage").textContent =
			error.message || "Failed to search projects. Please try again.";
	}
}

/**
 * Handle issues search
 */
async function handleIssuesSearch(searchTerm, loadIssues, createIssueCard) {
	const projectFullPath = sessionStorage.getItem("selectedProject");

	if (!projectFullPath) {
		console.warn("No project selected for issue search");
		return;
	}

	const issuesList = document.getElementById("issuesList");
	const issuesLoading = document.getElementById("issuesLoading");
	const issuesError = document.getElementById("issuesError");
	const issuesEmpty = document.getElementById("issuesEmpty");

	// If search is empty, reload all issues
	if (!searchTerm || searchTerm.trim().length === 0) {
		await loadIssues(projectFullPath, true);
		return;
	}

	// Show loading state
	issuesList.classList.add("hidden");
	issuesError.classList.add("hidden");
	issuesEmpty.classList.add("hidden");
	issuesLoading.classList.remove("hidden");

	try {
		// Search issues via GitLab API
		const results = await searchIssues(projectFullPath, searchTerm);

		issuesLoading.classList.add("hidden");

		if (!results || results.length === 0) {
			issuesEmpty.classList.remove("hidden");
			return;
		}

		// Display filtered issues
		issuesList.innerHTML = "";
		results.forEach((issue) => {
			const issueCard = createIssueCard(issue);
			issuesList.appendChild(issueCard);
		});

		issuesList.classList.remove("hidden");
	} catch (error) {
		console.error("Error searching issues:", error);
		issuesLoading.classList.add("hidden");
		issuesError.classList.remove("hidden");
		document.getElementById("issuesErrorMessage").textContent =
			error.message || "Failed to search issues. Please try again.";
	}
}

/**
 * Handle time logs search
 */
async function handleTimeLogsSearch(
	searchTerm,
	loadTimeLogs,
	createTimeLogCard,
	formatDate,
	getCurrentPeriod,
	getWeekKey,
	createWeekContainer,
	createDayContainer,
	_attachTimeLogCardClick
) {
	// If search is empty, reload all time logs
	if (!searchTerm || searchTerm.trim().length === 0) {
		const currentPeriod = getCurrentPeriod();
		await loadTimeLogs(currentPeriod);
		return;
	}

	// Filter current time logs locally
	if (allTimeLogs.length > 0) {
		const filtered = filterTimeLogs(allTimeLogs, searchTerm);
		displayFilteredTimeLogs(
			filtered,
			createTimeLogCard,
			formatDate,
			getWeekKey,
			createWeekContainer,
			createDayContainer,
			_attachTimeLogCardClick
		);
	}
}

/**
 * Display filtered time logs grouped by weeks
 */
function displayFilteredTimeLogs(
	timeLogs,
	createTimeLogCard,
	formatDate,
	getWeekKey,
	createWeekContainer,
	createDayContainer,
	_attachTimeLogCardClick
) {
	const timeLogsContainer = document.getElementById("timeLogsList");
	const timeLogsLoading = document.getElementById("timeLogsLoading");
	const timeLogsError = document.getElementById("timeLogsError");
	const timeLogsEmpty = document.getElementById("timeLogsEmpty");

	timeLogsLoading.classList.add("hidden");
	timeLogsError.classList.add("hidden");

	if (!timeLogs || timeLogs.length === 0) {
		timeLogsContainer.classList.add("hidden");
		timeLogsEmpty.classList.remove("hidden");
		return;
	}

	timeLogsEmpty.classList.add("hidden");

	// Group time logs by week
	const weeks = {};
	timeLogs.forEach((log) => {
		const weekKey = getWeekKey(log.spentAt);
		if (!weeks[weekKey]) {
			weeks[weekKey] = {
				weekStart: new Date(weekKey),
				logs: [],
				totalSeconds: 0,
			};
		}
		weeks[weekKey].logs.push(log);
		weeks[weekKey].totalSeconds += log.timeSpent;
	});

	// Convert to array and sort by week (most recent first)
	const sortedWeeks = Object.values(weeks).sort((a, b) => b.weekStart - a.weekStart);

	// Render grouped time logs by weeks
	timeLogsContainer.innerHTML = "";
	sortedWeeks.forEach((weekGroup) => {
		// Group logs by day within the week
		const logsByDay = {};
		weekGroup.logs.forEach((log) => {
			const dayKey = new Date(log.spentAt).toISOString().split("T")[0];
			if (!logsByDay[dayKey]) {
				logsByDay[dayKey] = {
					date: new Date(log.spentAt),
					logs: [],
					totalSeconds: 0,
				};
			}
			logsByDay[dayKey].logs.push(log);
			logsByDay[dayKey].totalSeconds += log.timeSpent;
		});

		// Sort days by date
		const sortedDays = Object.values(logsByDay).sort((a, b) => a.date - b.date);

		// Create week container with header and days
		const weekContainer = createWeekContainer(
			weekGroup,
			sortedDays,
			createTimeLogCard,
			_attachTimeLogCardClick
		);

		timeLogsContainer.appendChild(weekContainer);
	});

	timeLogsContainer.classList.remove("hidden");
}
