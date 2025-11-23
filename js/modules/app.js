import gitlabAPI from "../utils/gitlab.js";
import * as store from "../utils/store.js";
import * as favorites from "../utils/favorites.js";
import { escapeHtml, formatDate } from "../utils/utils.js";
import {
	showNewLogModal,
	hideNewLogModal,
	populateNewLogIssues,
	handleNewLogSubmit,
	openDeleteTimelogModal,
	handleDeleteTimelog,
} from "./log-crud.js";

import { initializeEventHandlers as setupEventHandlers } from "./events.js";
import {
	getStoredAuth,
	saveCredentials,
	clearCredentials,
	showDashboard,
	showLoginForm,
	showError,
	hideError,
} from "./auth.js";
import {
	initializeSearchInputs,
	initializeSearchEventListeners,
	setTimeLogsData,
} from "./search.js";

// Re-export auth helpers so external modules (and index.html) can import them
export {
	getStoredAuth,
	saveCredentials,
	clearCredentials,
	showDashboard,
	showLoginForm,
	showError,
	hideError,
};

// Current period (used for calendar / time logs). Represented as the first day
// of the month for the selected period. Defaults to current month.
let currentPeriod = new Date();
currentPeriod = new Date(currentPeriod.getFullYear(), currentPeriod.getMonth(), 1);

// Helper to get current period (for search module)
export function getCurrentPeriod() {
	return currentPeriod;
}

// Helper to get week key from date (for search module)
export function getWeekKey(date) {
	// Get the start of the week (Monday)
	const d = new Date(date);
	d.setHours(0, 0, 0, 0);
	const day = d.getDay();
	// Calculate days to subtract to get to Monday
	// Sunday = 0, Monday = 1, Tuesday = 2, ..., Saturday = 6
	// Days to go back: Sunday = 6, Monday = 0, Tuesday = 1, ..., Saturday = 5
	const daysToSubtract = day === 0 ? 6 : day - 1;
	const monday = new Date(d);
	monday.setDate(d.getDate() - daysToSubtract);
	return monday.toISOString().split("T")[0];
}

// Pagination state for issues
let issuesPagination = {
	endCursor: null,
	hasNextPage: false,
	projectFullPath: null,
	allIssues: [],
};

// ============================================================
// Auth Management
// ============================================================

// Check authentication and initialize dashboard if auth exists.
// We delegate storage parsing to `getStoredAuth` (in `auth.js`) to avoid circular imports.
export function checkAuth() {
	const auth = getStoredAuth();
	if (auth) {
		showDashboard(auth.username);
		// loadTimeLogs is defined later in this file; call it to populate the dashboard.
		try {
			loadTimeLogs();
		} catch (e) {
			// In case loadTimeLogs isn't available yet, ignore — it'll be called elsewhere.
			console.warn("loadTimeLogs not available at checkAuth time:", e);
		}
		return true;
	}
	return false;
}

// New Log modal helpers have been moved to ./log-crud.js

// Auth-related helpers (storage + UI) were moved to `js/modules/auth.js` and are
// imported at the top of this file. They are still available to other modules via
// the initializeEventHandlers wiring below.

// ============================================================
// Tab Management
// ============================================================

export function switchTab(tabName) {
	// Hide all tab contents
	document.querySelectorAll(".tab-content").forEach((content) => {
		content.classList.add("hidden");
	});

	// Remove active state from all tab buttons
	document.querySelectorAll(".tab-button").forEach((button) => {
		button.classList.remove("bg-primary", "text-primary-foreground");
		button.classList.add("text-foreground", "hover:bg-accent", "hover:text-accent-foreground");
	});

	// Show selected tab content
	const contentId = tabName + "Content";
	document.getElementById(contentId).classList.remove("hidden");

	// Add active state to selected tab button
	const activeButton = document.querySelector(`[data-tab="${tabName}"]`);
	activeButton.classList.add("bg-primary", "text-primary-foreground");
	activeButton.classList.remove(
		"text-foreground",
		"hover:bg-accent",
		"hover:text-accent-foreground"
	);
}

// ============================================================
// Projects Management
// ============================================================

export async function loadProjects(force = false) {
	const projectsList = document.getElementById("projectsList");
	const projectsLoading = document.getElementById("projectsLoading");
	const projectsError = document.getElementById("projectsError");
	const projectsEmpty = document.getElementById("projectsEmpty");

	// Show loading state
	projectsList.classList.add("hidden");
	projectsError.classList.add("hidden");
	projectsEmpty.classList.add("hidden");
	projectsLoading.classList.remove("hidden");

	try {
		// Try cached projects unless force is true
		const cached = !force && store.getProjects();
		let nodes = null;
		if (cached && Array.isArray(cached) && cached.length > 0) {
			nodes = cached;
		} else {
			// Fetch projects from GitLab
			const result = await gitlabAPI.listProjects({ first: 50, membership: true });
			nodes = result.nodes || [];
			// Cache them
			store.storeProjects(nodes);
		}

		projectsLoading.classList.add("hidden");

		if (!nodes || nodes.length === 0) {
			projectsEmpty.classList.remove("hidden");
			return;
		}

		// Sort projects: favorites first
		const favoriteProjectIds = favorites.getFavoriteProjects();
		const sortedProjects = nodes.sort((a, b) => {
			const aIsFav = favoriteProjectIds.includes(a.id);
			const bIsFav = favoriteProjectIds.includes(b.id);
			if (aIsFav && !bIsFav) return -1;
			if (!aIsFav && bIsFav) return 1;
			return 0;
		});

		// Display projects
		projectsList.innerHTML = "";
		sortedProjects.forEach((project) => {
			const projectCard = createProjectCard(project);
			projectsList.appendChild(projectCard);
		});

		projectsList.classList.remove("hidden");
	} catch (error) {
		console.error("Error loading projects:", error);
		projectsLoading.classList.add("hidden");
		projectsError.classList.remove("hidden");
		document.getElementById("projectsErrorMessage").textContent =
			error.message || "Failed to load projects. Please check your connection and try again.";
	}
}

function createProjectCard(project) {
	const card = document.createElement("div");
	card.className =
		"bg-card border rounded-lg p-3 xl:p-4 hover:shadow-md transition-shadow cursor-pointer";
	card.onclick = () => {
		sessionStorage.setItem("selectedProject", project.fullPath);
		sessionStorage.setItem("selectedProjectName", project.name);
		showProjectIssues(project.fullPath, project.name);
	};

	const visibility = project.visibility || "private";
	const visibilityColors = {
		public: "bg-green-100 text-green-800",
		internal: "bg-blue-100 text-blue-800",
		private: "bg-gray-100 text-gray-800",
	};

	card.innerHTML = `
		<div class="flex items-start justify-between">
			<div class="flex-1">
				<a href="${project.webUrl}" target="_blank" class="float-right text-blue-600 hover:text-blue-700">
					<i class="fas fa-external-link-alt text-xs"></i>
				</a>
				<div class="flex flex-wrap items-center gap-1 mb-2">
					<h3 class="font-medium text-lg">${escapeHtml(project.name)}</h3>
					<span class="inline-flex items-center rounded-full ${
						visibilityColors[visibility]
					} px-2 py-0.5 text-xs font-medium">
						<i class="fas fa-${
							visibility === "public" ? "globe" : visibility === "internal" ? "building" : "lock"
						} mr-0.5"></i>
						${visibility}
					</span>
					<i class="fas fa-star project-star-icon text-xs cursor-pointer ${
						favorites.isProjectFavorite(project.id) ? "text-amber-400" : "text-muted-foreground"
					} hover:text-amber-300" data-project-id="${project.id}"></i>
				</div>
				<p class="text-sm text-muted-foreground mb-2">${project.fullPath}</p>
				${
					project.description
						? `<p class="text-sm text-muted-foreground mb-3">${escapeHtml(project.description)}</p>`
						: ""
				}
				<div class="flex items-center gap-4 text-xs text-muted-foreground">
					${
						project.star
							? `<span class="flex items-center gap-1">
						<i class="fas fa-star text-yellow-500"></i>
						Starred
					</span>`
							: ""
					}
					<div class="flex flex-col gap-1">
						${
							project.lastActivityAt
								? `<span class="flex items-center gap-1">
							<i class="far fa-clock"></i>
							Updated ${formatDate(project.lastActivityAt)}
						</span>`
								: ""
						}
						${
							project.namespace
								? `<span class="flex items-center gap-1">
							<i class="fas fa-folder"></i>
							${escapeHtml(project.namespace.name)}
						</span>`
								: ""
						}
					</div>
				</div>
			</div>
		</div>
	`;

	// Add click handler for favorite star icon
	const starIcon = card.querySelector(".project-star-icon");
	if (starIcon) {
		starIcon.addEventListener("click", (e) => {
			e.stopPropagation(); // Prevent card click event
			const projectId = starIcon.getAttribute("data-project-id");
			const isFavorite = favorites.toggleProjectFavorite(projectId);
			// Update icon appearance
			if (isFavorite) {
				starIcon.classList.remove("text-muted-foreground");
				starIcon.classList.add("text-amber-400");
			} else {
				starIcon.classList.remove("text-amber-400");
				starIcon.classList.add("text-muted-foreground");
			}
			// Reload projects to re-sort
			loadProjects();
		});
	}

	return card;
}

// Make time log cards open delete-confirm modal when clicked
// (placed after createTimeLogCard to keep file order)
function _attachTimeLogCardClick(card, log) {
	card.style.cursor = "pointer";
	card.addEventListener("click", (e) => {
		// If the user clicked a link inside the card, don't open modal
		if (e.target.closest("a")) return;
		openDeleteTimelogModal(log);
	});
}

// ============================================================
// Issues Management
// ============================================================

export async function showProjectIssues(projectFullPath, projectName) {
	// Hide projects list, show issues list
	document.getElementById("projectsListView").classList.add("hidden");
	document.getElementById("issuesListView").classList.remove("hidden");

	// Hide projects search, show issues search
	document.getElementById("projectsSearchContainer").classList.add("hidden");
	document.getElementById("issuesSearchContainer").classList.remove("hidden");

	// Update header
	document.getElementById("projectsTitle").classList.add("hidden");
	document.getElementById("projectsBreadcrumb").classList.remove("hidden");
	document.getElementById("breadcrumbProjectName").textContent = projectName;

	// Load issues
	await loadIssues(projectFullPath, false, true);
}

export function showProjectsList() {
	// Show projects list, hide issues list
	document.getElementById("projectsListView").classList.remove("hidden");
	document.getElementById("issuesListView").classList.add("hidden");
	document.getElementById("issueBreadcrumb").classList.add("hidden");

	// Show projects search, hide issues search
	document.getElementById("projectsSearchContainer").classList.remove("hidden");
	document.getElementById("issuesSearchContainer").classList.add("hidden");

	// Update header
	document.getElementById("projectsTitle").classList.remove("hidden");
	document.getElementById("projectsBreadcrumb").classList.add("hidden");

	// Clear selected project
	sessionStorage.removeItem("selectedProject");
	sessionStorage.removeItem("selectedProjectName");
}

export async function loadIssues(projectFullPath, force = false, append = false) {
	const issuesList = document.getElementById("issuesList");
	const issuesLoading = document.getElementById("issuesLoading");
	const issuesError = document.getElementById("issuesError");
	const issuesEmpty = document.getElementById("issuesEmpty");

	// If loading a new project, reset pagination
	if (projectFullPath !== issuesPagination.projectFullPath) {
		issuesPagination = {
			endCursor: null,
			hasNextPage: false,
			projectFullPath: projectFullPath,
			allIssues: [],
		};
	}

	// Show loading state (but don't hide list if appending)
	if (!append) {
		issuesList.classList.add("hidden");
	}
	issuesError.classList.add("hidden");
	issuesEmpty.classList.add("hidden");
	issuesLoading.classList.remove("hidden");

	try {
		let nodes = null;
		let pageInfo = null;

		// If not appending and not forcing, try cache
		if (!append && !force) {
			const cached = store.getIssues(projectFullPath);
			if (cached && Array.isArray(cached) && cached.length > 0) {
				nodes = cached;
				// For cached data, we don't have pageInfo, so assume no next page
				pageInfo = { hasNextPage: false, endCursor: null };
			}
		}

		// If no cached data or appending, fetch from API
		if (!nodes || append) {
			const result = await gitlabAPI.listIssues(projectFullPath, {
				first: 50,
				after: append ? issuesPagination.endCursor : null,
			});
			nodes = result.nodes || [];
			pageInfo = result.pageInfo || { hasNextPage: false, endCursor: null };

			// If not appending, cache the first page
			if (!append) {
				store.storeIssues(projectFullPath, nodes);
			}
		}

		issuesLoading.classList.add("hidden");

		// Update pagination state
		if (append) {
			issuesPagination.allIssues = [...issuesPagination.allIssues, ...nodes];
		} else {
			issuesPagination.allIssues = nodes;
		}
		issuesPagination.endCursor = pageInfo.endCursor;
		issuesPagination.hasNextPage = pageInfo.hasNextPage;

		if (issuesPagination.allIssues.length === 0) {
			issuesEmpty.classList.remove("hidden");
			return;
		}

		// Sort issues: favorites first
		const favoriteIssueIds = favorites.getFavoriteIssues();
		const sortedIssues = issuesPagination.allIssues.sort((a, b) => {
			const aIsFav = favoriteIssueIds.includes(a.id);
			const bIsFav = favoriteIssueIds.includes(b.id);
			if (aIsFav && !bIsFav) return -1;
			if (!aIsFav && bIsFav) return 1;
			return 0;
		});

		// Display issues (clear and re-render all)
		issuesList.innerHTML = "";
		sortedIssues.forEach((issue) => {
			const issueCard = createIssueCard(issue);
			issuesList.appendChild(issueCard);
		});

		// Add "Load more" button if there are more pages
		if (issuesPagination.hasNextPage) {
			const loadMore = document.createElement("div");
			loadMore.id = "loadMoreIssues";
			loadMore.className =
				"bg-card border rounded-lg p-4 hover:shadow-md hover:border-blue-300 transition-shadow cursor-pointer";
			loadMore.innerHTML = `
				<div class="h-full flex flex-1 flex-col items-center justify-center gap-2 group">
					<i class="fas fa-list-check text-muted-foreground group-hover:text-blue-500"></i>
					<span class="text-sm text-muted-foreground group-hover:text-blue-500">Load more</span>
				</div>
			`;
			loadMore.addEventListener("click", async () => {
				await loadIssues(projectFullPath, false, true);
			});
			issuesList.appendChild(loadMore);
		}

		issuesList.classList.remove("hidden");
	} catch (error) {
		console.error("Error loading issues:", error);
		issuesLoading.classList.add("hidden");
		issuesError.classList.remove("hidden");
		document.getElementById("issuesErrorMessage").textContent =
			error.message || "Failed to load issues. Please check your connection and try again.";
	}
}

function createIssueCard(issue) {
	const card = document.createElement("div");
	card.className = "bg-card border rounded-lg p-4 hover:shadow-md transition-shadow cursor-pointer";

	// Add click handler to open issue detail view
	card.onclick = (e) => {
		// Don't trigger if clicking on star icon or external link
		if (e.target.closest(".issue-star-icon") || e.target.closest("a")) {
			return;
		}
		const projectFullPath = sessionStorage.getItem("selectedProject");
		const projectName = sessionStorage.getItem("selectedProjectName");
		if (projectFullPath) {
			showIssueDetail(projectFullPath, projectName, issue.iid);
		}
	};

	// Determine state color
	const stateColors = {
		opened: "bg-green-100 text-green-800",
		closed: "bg-purple-100 text-purple-800",
	};
	const stateColor = stateColors[issue.state] || "bg-gray-100 text-gray-800";

	// Get labels
	const labels = issue.labels?.nodes || [];

	card.innerHTML = `
		<div class="flex items-start justify-between gap-3 relative">
			<div class="flex-1 min-w-0">
				<div>
					<a class="float-right text-blue-500 hover:text-blue-600" href="${issue.webUrl}" target="_blank">
						<span class="text-sm font-semibold">#${issue.iid}</span>
						<i class="fas fa-external-link-alt text-xs"></i>
					</a>
					<h3 class="font-medium mb-1 break-words">
						${escapeHtml(issue.title)}
						<i class="fas fa-star issue-star-icon text-xs cursor-pointer ${
							favorites.isIssueFavorite(issue.id) ? "text-amber-400" : "text-muted-foreground"
						} hover:text-amber-300" data-issue-id="${issue.id}"></i>
					</h3>
				</div>
				${
					issue.description
						? `<p class="text-sm text-muted-foreground line-clamp-2 break-words">${escapeHtml(
								issue.description.substring(0, 150)
						  )}${issue.description.length > 150 ? "..." : ""}</p>`
						: ""
				}
				<div class="mt-2 flex-1 flex items-center justify-start flex-wrap gap-1">
					<span class="inline-flex items-center rounded-full ${stateColor} px-2 py-0.5 text-xs font-medium">
						<i class="fas fa-${issue.state === "opened" ? "circle-dot" : "circle-check"} mr-1"></i>
						${issue.state}
					</span>
					${labels
						.map(
							(label) =>
								`<span class="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium" style="background-color: ${
									label.color
								}22; color: ${label.color};">
							${escapeHtml(label.title)}
						</span>`
						)
						.join("")}
				</div>

				<div class="flex flex-col gap-2 mt-2 text-xs text-muted-foreground flex-wrap">
					<div class="flex flex-col items-start gap-1">
						${
							issue.author
								? `<span class="flex items-center gap-1 font-medium" title="Author: ${
										issue.author.name
								  }">
										<i class="fas fa-user"></i>
										<span class="font-normal">Author:</span>
										${escapeHtml(issue.author.name)}
									</span>`
								: ""
						}
							${
								issue.assignees.nodes.length > 0
									? `<span class="flex items-center gap-1 font-medium">
											<i class="fas fa-user"></i>
											<span class="font-normal">Assignee:</span>
											${issue.assignees.nodes.map(({ name }) => `<span>${name}</span>`).join(", ")}
										</span>`
									: ""
							}
						</div>
						<div class="flex-1 flex flex-col xl:flex-row items-start justify-between gap-1">
							${
								issue.createdAt
									? `<span class="flex items-center gap-1">
								<i class="far fa-clock"></i>
								Created ${formatDate(issue.createdAt)}
							</span>`
									: ""
							}
							${
								issue.updatedAt
									? `<span class="flex items-center gap-1">
								<i class="fas fa-sync-alt"></i>
								Updated ${formatDate(issue.updatedAt)}
							</span>`
									: ""
							}
						</div>
				</div>
			</div>
		</div>
	`;

	// Add click handler for favorite star icon
	const starIcon = card.querySelector(".issue-star-icon");
	if (starIcon) {
		starIcon.addEventListener("click", (e) => {
			e.stopPropagation(); // Prevent card click event
			const issueId = starIcon.getAttribute("data-issue-id");
			const isFavorite = favorites.toggleIssueFavorite(issueId);
			// Update icon appearance
			if (isFavorite) {
				starIcon.classList.remove("text-muted-foreground");
				starIcon.classList.add("text-amber-400");
			} else {
				starIcon.classList.remove("text-amber-400");
				starIcon.classList.add("text-muted-foreground");
			}
			// Reload issues to re-sort
			const projectFullPath = sessionStorage.getItem("selectedProject");
			if (projectFullPath) {
				loadIssues(projectFullPath);
			}
		});
	}

	return card;
}

// ============================================================
// Issue Detail Management
// ============================================================

export async function showIssueDetail(projectFullPath, projectName, issueIid) {
	// Hide issues list, show issue detail
	document.getElementById("issuesListView").classList.add("hidden");
	document.getElementById("issueDetailView").classList.remove("hidden");

	// Update breadcrumb
	document.getElementById("projectsTitle").classList.add("hidden");
	document.getElementById("projectsBreadcrumb").classList.add("hidden");
	document.getElementById("issueBreadcrumb").classList.remove("hidden");
	document.getElementById("issueBreadcrumbProjectName").textContent = projectName;
	document.getElementById("issueBreadcrumbIssueNumber").textContent = `#${issueIid}`;

	// Store current issue for back navigation
	sessionStorage.setItem("selectedIssue", issueIid);

	// Load issue details
	await loadIssueDetail(projectFullPath, issueIid);
}

export function showIssuesList() {
	// Show issues list, hide issue detail
	document.getElementById("issuesListView").classList.remove("hidden");
	document.getElementById("issueDetailView").classList.add("hidden");

	// Update breadcrumb
	document.getElementById("issueBreadcrumb").classList.add("hidden");
	document.getElementById("projectsBreadcrumb").classList.remove("hidden");

	// Clear selected issue
	sessionStorage.removeItem("selectedIssue");
}

// Helper function to fix relative avatar URLs
function getFullAvatarUrl(avatarUrl) {
	if (!avatarUrl) return null;
	if (avatarUrl.startsWith("/uploads")) {
		const auth = getStoredAuth();
		const repository = auth?.repository || "";
		return repository + avatarUrl;
	}
	return avatarUrl;
}

async function loadIssueDetail(projectFullPath, issueIid) {
	const issueDetailContent = document.getElementById("issueDetailContent");
	const issueDetailLoading = document.getElementById("issueDetailLoading");
	const issueDetailError = document.getElementById("issueDetailError");

	// Show loading state
	issueDetailContent.classList.add("hidden");
	issueDetailError.classList.add("hidden");
	issueDetailLoading.classList.remove("hidden");

	try {
		// Fetch issue details
		const issue = await gitlabAPI.getIssue(projectFullPath, issueIid);

		const issueTimeLogs = issue.timelogs.nodes;

		issueDetailLoading.classList.add("hidden");

		// Display issue details
		issueDetailContent.innerHTML = "";

		// Issue header card
		const issueCard = createIssueDetailCard(issue, issueTimeLogs);
		issueDetailContent.appendChild(issueCard);

		// Time logs section
		if (issueTimeLogs.length > 0) {
			const timeLogsSection = createTimeLogsSection(issueTimeLogs, issue);
			issueDetailContent.appendChild(timeLogsSection);
		}

		issueDetailContent.classList.remove("hidden");
	} catch (error) {
		console.error("Error loading issue detail:", error);
		issueDetailLoading.classList.add("hidden");
		issueDetailError.classList.remove("hidden");
		document.getElementById("issueDetailErrorMessage").textContent =
			error.message || "Failed to load issue details. Please check your connection and try again.";
	}
}

function createIssueDetailCard(issue, timeLogs) {
	const card = document.createElement("div");
	card.className = "bg-card border rounded-lg p-4";

	// Determine state color
	const stateColors = {
		opened: "bg-green-100 text-green-800",
		closed: "bg-purple-100 text-purple-800",
	};
	const stateColor = stateColors[issue.state] || "bg-gray-100 text-gray-800";

	// Calculate total time spent
	const totalSeconds = timeLogs.reduce((sum, log) => sum + log.timeSpent, 0);
	const totalHours = (totalSeconds / 3600).toFixed(1);

	// Get labels
	const labels = issue.labels?.nodes || [];

	card.innerHTML = `
		<div class="space-y-4">
			<div class="flex items-start justify-between gap-4">
				<div class="flex-1">
					<div class="flex items-center gap-2 mb-2">
						<span class="inline-flex items-center rounded-full ${stateColor} px-3 py-1 text-sm font-medium">
							<i class="fas fa-${issue.state === "opened" ? "circle-dot" : "circle-check"} mr-1"></i>
							${issue.state}
						</span>
						<span class="text-sm font-semibold text-muted-foreground">#${issue.iid}</span>
					</div>
					<h2 class="text-2xl font-semibold mb-3">${escapeHtml(issue.title)}</h2>
					${
						issue.description
							? `<div class="relative">
								<div class="issue-description-content text-sm text-muted-foreground markdown-content max-h-32 overflow-hidden transition-all duration-300">
									${
										typeof marked !== "undefined" && marked.parse
											? marked.parse(issue.description)
											: escapeHtml(issue.description).replace(/\n/g, "<br>")
									}
								</div>
								<button class="issue-description-toggle mt-2 text-xs text-primary hover:text-primary/80 flex items-center gap-1 font-medium">
									<span>Expand</span>
									<i class="fas fa-chevron-down"></i>
								</button>
							</div>`
							: ""
					}
				</div>
				<a href="${issue.webUrl}" target="_blank" class="text-primary hover:text-primary/80">
					<i class="fas fa-external-link-alt"></i>
				</a>
			</div>

			${
				labels.length > 0
					? `
				<div class="flex flex-wrap gap-2">
					${labels
						.map(
							(label) => `
						<span class="inline-flex items-center rounded-full px-2 py-1 text-xs font-medium" 
							style="background-color: ${label.color}22; color: ${label.color};">
							${escapeHtml(label.title)}
						</span>
					`
						)
						.join("")}
				</div>
			`
					: ""
			}

			<div class="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4 border-t">
				${
					issue.author
						? `
					<div class="flex flex-col">
						<span class="text-xs text-muted-foreground mb-1">Author</span>
						<div class="flex items-center gap-2">
							${
								issue.author.avatarUrl
									? `<img src="${getFullAvatarUrl(
											issue.author.avatarUrl
									  )}" class="w-6 h-6 rounded-full" />`
									: ""
							}
							<span class="text-sm font-medium">${escapeHtml(issue.author.name)}</span>
						</div>
					</div>
				`
						: ""
				}
				${
					issue.assignees?.nodes.length > 0
						? `
					<div class="flex flex-col">
						<span class="text-xs text-muted-foreground mb-1">Assignees</span>
						<div class="flex flex-wrap gap-2">
							${issue.assignees.nodes
								.map(
									(assignee) => `
								<div class="flex items-center gap-1">
									${
										assignee.avatarUrl
											? `<img src="${getFullAvatarUrl(
													assignee.avatarUrl
											  )}" class="w-5 h-5 rounded-full" />`
											: ""
									}
									<span class="text-sm">${escapeHtml(assignee.name)}</span>
								</div>
							`
								)
								.join("")}
						</div>
					</div>
				`
						: ""
				}
				<div class="flex flex-col">
					<span class="text-xs text-muted-foreground mb-1">Time Spent</span>
					<div class="flex items-center gap-2">
						<i class="fas fa-clock text-primary"></i>
						<span class="text-lg font-semibold text-primary">${totalHours}h</span>
						<span class="text-sm text-muted-foreground">(${timeLogs.length} entries)</span>
					</div>
				</div>
			</div>

			<div class="grid grid-cols-2 gap-4 pt-4 border-t text-sm">
				${
					issue.createdAt
						? `
					<div>
						<span class="text-muted-foreground">Created:</span>
						<span class="font-medium ml-1">${formatDate(issue.createdAt)}</span>
					</div>
				`
						: ""
				}
				${
					issue.updatedAt
						? `
					<div>
						<span class="text-muted-foreground">Updated:</span>
						<span class="font-medium ml-1">${formatDate(issue.updatedAt)}</span>
					</div>
				`
						: ""
				}
			</div>
		</div>
	`;

	// Add click handler for expand/collapse button
	const toggleButton = card.querySelector(".issue-description-toggle");
	const descriptionContent = card.querySelector(".issue-description-content");
	if (toggleButton && descriptionContent) {
		toggleButton.addEventListener("click", () => {
			const isExpanded = descriptionContent.classList.contains("max-h-none");
			if (isExpanded) {
				descriptionContent.classList.remove("max-h-none");
				descriptionContent.classList.add("max-h-32");
				toggleButton.querySelector("span").textContent = "Expand";
				toggleButton.querySelector("i").className = "fas fa-chevron-down";
			} else {
				descriptionContent.classList.remove("max-h-32");
				descriptionContent.classList.add("max-h-none");
				toggleButton.querySelector("span").textContent = "Collapse";
				toggleButton.querySelector("i").className = "fas fa-chevron-up";
			}
		});
	}

	return card;
}

function createTimeLogsSection(timeLogs, issue) {
	const section = document.createElement("div");
	section.className = "space-y-3";

	const header = document.createElement("h3");
	header.className = "text-lg font-semibold mb-2";
	header.textContent = "Time Logs";
	section.appendChild(header);

	// Group time logs by week
	const weekGroups = {};
	timeLogs.forEach((log) => {
		const weekKey = getWeekKey(log.spentAt);
		if (!weekGroups[weekKey]) {
			const weekStart = new Date(weekKey);
			weekGroups[weekKey] = {
				weekStart: weekStart,
				logs: [],
				totalSeconds: 0,
			};
		}

		log.issue = issue;

		weekGroups[weekKey].logs.push(log);
		weekGroups[weekKey].totalSeconds += log.timeSpent;
	});

	// Convert to array and sort by week (most recent first)
	const sortedWeeks = Object.values(weekGroups).sort((a, b) => b.weekStart - a.weekStart);

	// Create week containers
	const logsList = document.createElement("div");
	logsList.className = "space-y-4";

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

		// Create week container
		const weekContainer = createWeekContainer(weekGroup, sortedDays);
		logsList.appendChild(weekContainer);
	});

	section.appendChild(logsList);
	return section;
}

// ============================================================
// Time Logs Management
// ============================================================

export async function loadTimeLogs(periodDate, force = false) {
	const timeLogsList = document.getElementById("timeLogsList");
	const timeLogsLoading = document.getElementById("timeLogsLoading");
	const timeLogsError = document.getElementById("timeLogsError");
	const timeLogsEmpty = document.getElementById("timeLogsEmpty");

	// Use provided periodDate or fall back to currentPeriod
	const ref = periodDate ? new Date(periodDate) : currentPeriod;
	// Normalize to first/last of month
	const startDate = new Date(ref.getFullYear(), ref.getMonth(), 1, 0, 0, 0, 0);
	const endDate = new Date(ref.getFullYear(), ref.getMonth() + 1, 0, 23, 59, 59, 999);

	// Update currentPeriod to the ref
	currentPeriod = new Date(ref.getFullYear(), ref.getMonth(), 1);

	// Show loading state
	timeLogsList.classList.add("hidden");
	timeLogsError.classList.add("hidden");
	timeLogsEmpty.classList.add("hidden");
	timeLogsLoading.classList.remove("hidden");

	try {
		// periodKey in format YYYY-MM for caching
		const periodKey = `${currentPeriod.getFullYear()}-${String(
			currentPeriod.getMonth() + 1
		).padStart(2, "0")}`;

		// Try cached unless force
		const cached = !force && store.getTimeLogs(periodKey);
		let nodes = null;
		if (cached && Array.isArray(cached)) {
			nodes = cached;
		} else {
			// Fetch time logs from GitLab using GraphQL for the month period
			const response = await gitlabAPI.getRecentTimeLogs({
				first: 200,
				startDate: startDate.toISOString(),
				endDate: endDate.toISOString(),
			});
			nodes = response.nodes || [];
			// Cache them
			store.storeTimeLogs(periodKey, nodes);
		}

		timeLogsLoading.classList.add("hidden");

		// Store all time logs for search filtering
		setTimeLogsData(nodes);

		// Populate calendar with time logs data for this period
		populateTrackCalendar(nodes, currentPeriod);

		if (!nodes || nodes.length === 0) {
			timeLogsEmpty.classList.remove("hidden");
			return;
		}

		// Group time logs by week (respecting the current period)
		const groupedLogs = groupTimeLogsByWeek(nodes, currentPeriod);

		// Display time logs grouped by weeks
		timeLogsList.innerHTML = "";
		groupedLogs.forEach((weekGroup) => {
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

			// Sort days by date (most recent first)
			const sortedDays = Object.values(logsByDay).sort((a, b) => a.date - b.date);

			// Create week container with header and days
			const weekContainer = createWeekContainer(weekGroup, sortedDays);
			timeLogsList.appendChild(weekContainer);
		});

		timeLogsList.classList.remove("hidden");
	} catch (error) {
		console.error("Error loading time logs:", error);
		timeLogsLoading.classList.add("hidden");
		timeLogsError.classList.remove("hidden");
		document.getElementById("timeLogsErrorMessage").textContent =
			error.message || "Failed to load time logs. Please check your connection and try again.";
	}
}

// Change current period by offsetMonths (integer, positive or negative)
export function changePeriod(offsetMonths) {
	currentPeriod = new Date(currentPeriod.getFullYear(), currentPeriod.getMonth() + offsetMonths, 1);
	loadTimeLogs(currentPeriod);
}

function groupTimeLogsByWeek(timeLogs, periodDate) {
	const weeks = {};
	let total = 0;

	// Use provided periodDate (first day of month) or fall back to currentPeriod
	const ref = periodDate ? new Date(periodDate) : currentPeriod;
	const currentMonth = ref.getMonth();
	const currentYear = ref.getFullYear();
	const firstDayOfMonth = new Date(currentYear, currentMonth, 1);
	const lastDayOfMonth = new Date(currentYear, currentMonth + 1, 0);

	// Generate all weeks in the selected month
	let currentWeekStart = new Date(firstDayOfMonth);
	// Adjust to Monday
	const dayOfWeek = currentWeekStart.getDay();
	const daysToSubtract = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
	currentWeekStart.setDate(currentWeekStart.getDate() - daysToSubtract);

	// Generate weeks until we pass the last day of month
	const now = new Date();
	now.setHours(0, 0, 0, 0);

	while (currentWeekStart <= lastDayOfMonth && currentWeekStart <= now) {
		const weekKey = currentWeekStart.toISOString().split("T")[0];
		weeks[weekKey] = {
			weekStart: new Date(currentWeekStart),
			logs: [],
			totalSeconds: 0,
		};
		currentWeekStart.setDate(currentWeekStart.getDate() + 7);
	}

	timeLogs.forEach((log) => {
		const weekKey = getWeekKey(log.spentAt);
		if (!weeks[weekKey]) {
			// Don't create new weeks - skip logs that don't belong to the selected month weeks
			return;
		}
		weeks[weekKey].logs.push(log);
		weeks[weekKey].totalSeconds += log.timeSpent;
		total += 1;
	});

	document.getElementById("trackMonthEntries").textContent = `${total} entries`;

	// Convert to array and sort by week (most recent first)
	return Object.values(weeks).sort((a, b) => b.weekStart - a.weekStart);
}

export function createWeekContainer(weekGroup, sortedDays, createTimeLogCardFn, attachClickFn) {
	const weekStart = new Date(weekGroup.weekStart);
	const weekEnd = new Date(weekStart.getTime());
	weekEnd.setDate(weekEnd.getDate() + 6);

	const now = new Date();
	now.setHours(0, 0, 0, 0);
	const isCurrentWeek = now >= weekStart && now <= weekEnd;

	const formatWeekDate = (date) => {
		return date.toLocaleDateString("en-US", {
			month: "short",
			day: "numeric",
		});
	};

	const weekLabel = isCurrentWeek
		? `This Week ${formatWeekDate(weekStart)} - ${formatWeekDate(weekEnd)}`
		: `Week of ${formatWeekDate(weekStart)} - ${formatWeekDate(weekEnd)}`;

	// Convert total seconds to hours
	const totalHours = (weekGroup.totalSeconds / 3600).toFixed(1);

	// Create container for the entire week
	const container = document.createElement("div");
	container.className = "mt-4 first:mt-0";

	// Create week header
	const header = document.createElement("div");
	header.className = "flex items-center justify-between py-3 px-4 bg-muted rounded-lg";
	header.innerHTML = `
		<div class="flex items-center gap-2">
			<i class="fas fa-calendar-week text-muted-foreground"></i>
			<h3 class="font-semibold text-sm">${weekLabel}</h3>
		</div>
		<div class="flex items-center gap-2">
			<div class="w-20 bg-gray-200 rounded-full h-1.5 dark:bg-gray-700">
				<div
					class="bg-foreground h-1.5 rounded-full transition-[width] duration-300 ease-out max-w-full"
					style="width: ${(totalHours * 100) / 40}%"
				></div>
			</div>
      <span class="text-xs text-muted-foreground">${weekGroup.logs.length} entries</span>
			<span class="text-sm font-semibold text-primary">${totalHours}h</span>
		</div>
	`;

	container.appendChild(header);

	// Create days container
	const daysContainer = document.createElement("div");
	daysContainer.className = "grid md:grid-cols-2 lg:grid-cols-5 gap-2";

	// Add all day containers
	sortedDays.forEach((dayGroup) => {
		const dayContainer = createDayContainer(
			dayGroup,
			createTimeLogCardFn || createTimeLogCard,
			attachClickFn || _attachTimeLogCardClick
		);
		daysContainer.appendChild(dayContainer);
	});

	container.appendChild(daysContainer);

	return container;
}

export function createDayContainer(dayGroup, createTimeLogCard, _attachTimeLogCardClick) {
	const dayDate = new Date(dayGroup.date);
	const now = new Date();
	now.setHours(0, 0, 0, 0);
	const isToday = dayDate.toDateString() === now.toDateString();

	const formatDayDate = (date) => {
		return date.toLocaleDateString("en-US", {
			weekday: "short",
			month: "short",
			day: "numeric",
		});
	};

	const dayLabel = isToday ? "Today" : formatDayDate(dayDate);

	// Convert total seconds to hours
	const totalHours = (dayGroup.totalSeconds / 3600).toFixed(1);

	// Create container for the entire day
	const container = document.createElement("div");
	container.className = "mt-2 flex flex-col gap-2";

	// Create day header
	const header = document.createElement("div");
	header.className =
		"flex items-center justify-between py-2 px-3 bg-primary text-primary-foreground rounded-md";
	header.innerHTML = `
		<div class="flex items-center gap-2">
			<h4 class="font-medium text-xs">${dayLabel}</h4>
		</div>
		<div class="flex items-center gap-1">
      <span class="text-[10px]">${dayGroup.logs.length} entries</span>
			<span class="text-xs font-semibold">${totalHours}h</span>
		</div>
	`;

	container.appendChild(header);

	// Create logs container
	const logsContainer = document.createElement("div");
	logsContainer.className = "flex flex-col gap-2";

	// Add all logs for this day
	dayGroup.logs.forEach((log) => {
		const logCard = createTimeLogCard(log);
		logsContainer.appendChild(logCard);
		// Attach click handler to open delete modal
		if (_attachTimeLogCardClick) {
			_attachTimeLogCardClick(logCard, log);
		}
	});

	container.appendChild(logsContainer);

	return container;
}

function populateTrackCalendar(timeLogs, periodDate) {
	const ref = periodDate ? new Date(periodDate) : new Date();
	const currentMonth = ref.getMonth();
	const currentYear = ref.getFullYear();
	const today = new Date();

	// Update calendar title
	const monthNames = [
		"January",
		"February",
		"March",
		"April",
		"May",
		"June",
		"July",
		"August",
		"September",
		"October",
		"November",
		"December",
	];
	document.getElementById(
		"trackCalendarMonthTitle"
	).textContent = `${monthNames[currentMonth]} ${currentYear}`;

	// Update track content title with current month
	document.getElementById(
		"trackContentTitle"
	).textContent = `${monthNames[currentMonth]} ${currentYear}`;

	// Get first day of month and calculate starting position
	const firstDay = new Date(currentYear, currentMonth, 1);
	const lastDay = new Date(currentYear, currentMonth + 1, 0);
	const daysInMonth = lastDay.getDate();

	// Calculate the starting position (Monday = 0, Sunday = 6)
	let startingDayOfWeek = firstDay.getDay();
	startingDayOfWeek = startingDayOfWeek === 0 ? 6 : startingDayOfWeek - 1; // Convert to Monday = 0

	// Create hours map from time logs
	const hoursMap = {};
	timeLogs.forEach((log) => {
		const spentDate = new Date(log.spentAt);
		if (spentDate.getMonth() === currentMonth && spentDate.getFullYear() === currentYear) {
			const dayKey = spentDate.getDate();
			if (!hoursMap[dayKey]) {
				hoursMap[dayKey] = 0;
			}
			// Convert seconds to hours
			hoursMap[dayKey] += log.timeSpent / 3600;
		}
	});

	// Calculate total hours for the month
	const totalHours = Object.values(hoursMap).reduce((sum, hours) => sum + hours, 0);
	document
		.querySelectorAll(".trackCalendarMonthTotal")
		.forEach((el) => (el.textContent = `${totalHours.toFixed(1)}h`));
	document.getElementById("trackCalendarMonthProgress").style.width = `${
		(totalHours * 100) / 160
	}%`;

	// Generate calendar grid
	const calendarGrid = document.getElementById("trackCalendarGrid");
	calendarGrid.innerHTML = "";

	// Add empty cells for days before month starts
	for (let i = 0; i < startingDayOfWeek; i++) {
		const emptyDay = document.createElement("div");
		emptyDay.className = "aspect-square p-1";
		calendarGrid.appendChild(emptyDay);
	}

	// Add days of the month
	for (let day = 1; day <= daysInMonth; day++) {
		const dayDiv = document.createElement("div");
		dayDiv.className = "aspect-square";

		const hours = hoursMap[day] || 0;
		const isToday =
			today.getDate() === day &&
			today.getMonth() === currentMonth &&
			today.getFullYear() === currentYear;

		let dayClasses =
			"w-full h-full flex flex-col items-center justify-center font-mono text-xs leading-[0.8] rounded-sm border transition-all duration-200 cursor-pointer hover:shadow-md";

		if (isToday) {
			dayClasses += " border-primary bg-primary text-primary-foreground font-bold";
		} else if (hours > 0) {
			if (hours >= 8) {
				dayClasses += " border-green-400 bg-green-50 text-green-800";
			} else if (hours >= 4) {
				dayClasses += " border-yellow-400 bg-yellow-50 text-yellow-800";
			} else {
				dayClasses += " border-orange-400 bg-orange-50 text-orange-800";
			}
		} else {
			dayClasses += " border-border bg-muted text-muted-foreground";
		}

		const hoursDisplay = hours > 0 ? `${hours.toFixed(1)}` : "";

		dayDiv.innerHTML = `
			<div class="${dayClasses}">
				<div class="font-semibold">${day}</div>
				<div class="text-[10px] tracking-tighter ${
					hours > 0 ? "font-medium" : "text-muted-foreground"
				}">${hoursDisplay}</div>
			</div>
		`;

		calendarGrid.appendChild(dayDiv);
	}
}

export function createTimeLogCard(log, showUser = true) {
	const card = document.createElement("div");
	card.className = "bg-card border rounded-lg p-3 hover:shadow-md transition-shadow";

	const spentDate = new Date(log.spentAt);
	const formattedDate = spentDate.toLocaleDateString("en-US", {
		year: "numeric",
		month: "short",
		day: "numeric",
	});
	const formattedTime = spentDate.toLocaleTimeString("en-US", {
		hour: "2-digit",
		minute: "2-digit",
		hour12: false,
	});

	/*
${
  log.issue
    ? `<div class="mb-2">
    <a href="${
      log.issue.webUrl
    }" target="_blank" class="text-sm font-medium hover:text-primary flex items-center gap-1">
      <i class="fas fa-circle-exclamation text-xs"></i>
      #${log.issue.iid} - ${escapeHtml(log.issue.title)}
      <i class="fas fa-external-link-alt text-xs"></i>
    </a>
    <span class="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
      log.issue.state === "opened"
        ? "bg-green-100 text-green-800"
        : "bg-purple-100 text-purple-800"
    }">
      ${log.issue.state}
    </span>
  </div>`
    : ""
}

${
  log.mergeRequest
    ? `<div class="mb-2">
    <a href="${
      log.mergeRequest.webUrl
    }" target="_blank" class="text-sm font-medium hover:text-primary flex items-center gap-1">
      <i class="fas fa-code-branch text-xs"></i>
      !${log.mergeRequest.iid} - ${escapeHtml(log.mergeRequest.title)}
      <i class="fas fa-external-link-alt text-xs"></i>
    </a>
    <span class="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
      log.mergeRequest.state === "opened"
        ? "bg-blue-100 text-blue-800"
        : "bg-gray-100 text-gray-800"
    }">
      ${log.mergeRequest.state}
    </span>
  </div>`
    : ""
}
*/

	card.innerHTML = `
    <div class="flex items-start gap-3">
      <div class="flex-1 min-w-0 flex flex-col gap-1">
        <div class="flex w-full items-center justify-between gap-2">
          <span class="text-xs text-muted-foreground">${formattedDate} ${formattedTime}</span>
          <span class="text-xs font-semibold text-primary">${gitlabAPI.formatDuration(
						log.timeSpent
					)}</span>
        </div>
        
        ${
					log.summary
						? `<p class="text-sm">${escapeHtml(log.summary)}</p>`
						: log.note && log.note.body
						? `<p class="text-sm">${escapeHtml(log.note.body)}</p>`
						: ""
				}
        
        <div class="flex items-center gap-3 text-xs text-muted-foreground">
          ${
						showUser && log.user
							? `<span class="flex items-center gap-1">
            <i class="fas fa-user"></i>
            ${escapeHtml(log.user.name)}
          </span>`
							: ""
					}
        </div>

        <div class="flex items-center justify-between">
          <div class="flex items-center gap-2">
            <a href="${log.issue.webUrl}" target="_blank" 
              class="font-bold text-xs text-blue-500 hover:text-blue-600" 
              title="#${log.issue.iid}: ${log.issue.title}">
              #${log.issue.iid}
              <i class="fas fa-external-link-alt text-xs"></i>
            </a>
            <span class="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-mono font-bold ${
							log.issue.state === "opened"
								? "bg-green-100 text-green-800"
								: "bg-purple-100 text-purple-800"
						}">
              ${log.issue.state}
            </span>
          </div>
        </div>
      </div>
    </div>
  `;

	return card;
}

// ============================================================
// Event Handlers Setup
// ============================================================

export function initializeEventHandlers() {
	// Provide the app API to the external events module so it can wire listeners
	setupEventHandlers({
		hideError,
		saveCredentials,
		showDashboard,
		loadTimeLogs,
		clearCredentials,
		switchTab,
		loadProjects,
		showProjectsList,
		loadIssues,
		showNewLogModal,
		populateNewLogIssues,
		hideNewLogModal,
		handleNewLogSubmit,
		handleDeleteTimelog,
		changePeriod,
		showIssuesList,
		showIssueDetail,
	});

	// Initialize search event listeners with required dependencies
	initializeSearchEventListeners({
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
	});
}
