import { escapeHtml } from "../utils/utils.js";

// events.js: setup DOM event listeners. Accepts an app API object to avoid circular imports.
export function initializeEventHandlers(app) {
	// Helpers from app API (accept empty object if app not provided)
	const {
		hideError,
		saveCredentials,
		showDashboard,
		loadTimeLogs,
		changePeriod,
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
		showIssuesList,
		showIssueDetail,
	} = app || {};

	// Handle login form submission
	const loginForm = document.getElementById("loginForm");
	if (loginForm) {
		loginForm.addEventListener("submit", function (e) {
			e.preventDefault();
			if (hideError) hideError();

			const username = document.getElementById("username").value.trim();
			const token = document.getElementById("token").value.trim();
			const repository = document.getElementById("repository")
				? document.getElementById("repository").value.trim()
				: "";

			// Basic validation
			if (!username || !token || !repository) {
				const err = document.getElementById("errorMessage");
				if (err) {
					err.textContent = "Please fill in all fields";
					err.classList.remove("hidden");
				}
				return;
			}

			if (username.length < 3) {
				const err = document.getElementById("errorMessage");
				if (err) {
					err.textContent = "Username must be at least 3 characters";
					err.classList.remove("hidden");
				}
				return;
			}

			if (token.length < 8) {
				const err = document.getElementById("errorMessage");
				if (err) {
					err.textContent = "Token must be at least 8 characters";
					err.classList.remove("hidden");
				}
				return;
			}

			// Basic repository validation
			if (
				repository.length < 5 ||
				!(repository.startsWith("http://") || repository.startsWith("https://"))
			) {
				const err = document.getElementById("errorMessage");
				if (err) {
					err.textContent = "Repository must be a valid URL (include https://)";
					err.classList.remove("hidden");
				}
				return;
			}

			// Save credentials and show dashboard
			if (saveCredentials) saveCredentials(username, token, repository);
			if (showDashboard) showDashboard(username);
			// On auth, force refresh of projects and time logs
			if (loadProjects) loadProjects(true);
			if (loadTimeLogs) loadTimeLogs(undefined, true);
		});
	}

	// Handle logout
	const logoutBtn = document.getElementById("logoutBtn");
	if (logoutBtn) {
		logoutBtn.addEventListener("click", function () {
			if (clearCredentials) clearCredentials();
			if (showProjectsList) showProjectsList();
			// Show login form by reloading or manipulating DOM
			document.getElementById("authForm").classList.remove("hidden");
			document.getElementById("dashboard").classList.add("hidden");
			const loginFormEl = document.getElementById("loginForm");
			if (loginFormEl) loginFormEl.reset();
		});
	}

	// Handle tab clicks
	document.querySelectorAll(".tab-button").forEach((button) => {
		button.addEventListener("click", function () {
			const tabName = this.getAttribute("data-tab");
			if (switchTab) switchTab(tabName);

			// Load data when switching tabs
			if (tabName === "track") {
				if (loadTimeLogs) loadTimeLogs();
			} else if (tabName === "projects") {
				if (loadProjects) loadProjects();
			}
		});
	});

	// Handle sidebar toggle
	const sidebarToggle = document.getElementById("sidebarToggle");
	if (sidebarToggle) {
		sidebarToggle.addEventListener("click", function () {
			const sidebar = document.getElementById("sidebar");
			sidebar.classList.toggle("collapsed");

			// Update toggle button icon
			const icon = this.querySelector("i");
			if (sidebar.classList.contains("collapsed")) {
				icon.className = "fas fa-angles-right";
				this.setAttribute("title", "Expand sidebar");
			} else {
				icon.className = "fas fa-angles-left";
				this.setAttribute("title", "Collapse sidebar");
			}
		});
	}

	// Theme toggle button (uses window.toggleTheme from tailwind.theme.js)
	const themeToggleBtn = document.getElementById("themeToggleBtn");
	if (themeToggleBtn) {
		const icon = themeToggleBtn.querySelector("i");

		function updateThemeIcon() {
			const isDark = document.documentElement.classList.contains("dark");
			if (icon) {
				// sun for light, moon for dark
				icon.className = isDark ? "fas fa-moon" : "fas fa-sun";
			}
		}

		themeToggleBtn.addEventListener("click", function () {
			if (window && typeof window.toggleTheme === "function") {
				window.toggleTheme();
			}
			updateThemeIcon();
		});

		// Initialize icon state and listen for storage changes (other tabs)
		updateThemeIcon();
		window.addEventListener("storage", function (e) {
			if (e.key === "theme") updateThemeIcon();
		});
	}

	// Handle New Log button - open modal
	const newLogBtnEl = document.getElementById("newLogBtn");
	if (newLogBtnEl) {
		newLogBtnEl.addEventListener("click", function () {
			if (showNewLogModal) showNewLogModal();
		});
	}

	// Modal interactions: project -> load issues, cancel and submit
	const projectSelectEl = document.getElementById("newLogProject");
	if (projectSelectEl) {
		projectSelectEl.addEventListener("change", function (e) {
			const val = e.target.value;
			if (val && populateNewLogIssues) populateNewLogIssues(val);
		});
	}

	const cancelBtn = document.getElementById("newLogCancelBtn");
	if (cancelBtn && hideNewLogModal) cancelBtn.addEventListener("click", hideNewLogModal);

	const newLogFormEl = document.getElementById("newLogForm");
	if (newLogFormEl && handleNewLogSubmit)
		newLogFormEl.addEventListener("submit", handleNewLogSubmit);

	// Delete button handler (provided by log-crud)
	const deleteBtn = document.getElementById("newLogDeleteBtn");
	if (deleteBtn && handleDeleteTimelog) deleteBtn.addEventListener("click", handleDeleteTimelog);

	// Close the new log modal when clicking the overlay (outside the modal content)
	const newLogModalEl = document.getElementById("newLogModal");
	if (newLogModalEl) {
		// overlay marked with aria-hidden="true" in the markup
		const overlay = newLogModalEl.querySelector("[aria-hidden='true']");
		if (overlay) {
			overlay.addEventListener("click", function () {
				if (hideNewLogModal) {
					hideNewLogModal();
				} else {
					// Fallback: hide modal directly
					newLogModalEl.classList.add("hidden");
				}
			});
		}
	}

	// Close the new log modal when Esc is pressed (only if modal is visible)
	document.addEventListener("keydown", function (e) {
		if (e.key === "Escape" || e.key === "Esc") {
			const modal = document.getElementById("newLogModal");
			if (modal && !modal.classList.contains("hidden")) {
				if (hideNewLogModal) {
					hideNewLogModal();
				} else {
					// Fallback: hide modal directly if no handler provided
					modal.classList.add("hidden");
				}
			}
		}
	});

	// Handle refresh projects button
	const refreshProjects = document.getElementById("refreshProjects");
	if (refreshProjects) {
		refreshProjects.addEventListener("click", function () {
			const selectedProject = sessionStorage.getItem("selectedProject");
			const selectedProjectName = sessionStorage.getItem("selectedProjectName");

			if (selectedProject && selectedProjectName) {
				if (loadIssues) loadIssues(selectedProject, true);
			} else {
				if (loadProjects) loadProjects(true);
			}
		});
	}

	// Handle back to projects list button (from issues breadcrumb)
	const backToProjectsList = document.getElementById("backToProjectsList");
	if (backToProjectsList && showProjectsList)
		backToProjectsList.addEventListener("click", showProjectsList);

	// Handle back to projects list button (from issue detail breadcrumb)
	const backToProjectsListFromIssue = document.getElementById("backToProjectsListFromIssue");
	if (backToProjectsListFromIssue && showProjectsList)
		backToProjectsListFromIssue.addEventListener("click", showProjectsList);

	// Handle back to projects button (shows issues list)
	const backToProjects = document.getElementById("backToProjects");
	if (backToProjects && showProjectsList)
		backToProjects.addEventListener("click", showProjectsList);

	// Handle back to issues button
	const backToIssues = document.getElementById("backToIssues");
	if (backToIssues && showIssuesList) backToIssues.addEventListener("click", showIssuesList);

	// Handle refresh time logs button
	const refreshTimeLogs = document.getElementById("refreshTimeLogs");
	if (refreshTimeLogs)
		refreshTimeLogs.addEventListener("click", function () {
			if (loadTimeLogs) loadTimeLogs(undefined, true);
		});

	// Month navigation buttons
	const loadPrev = document.getElementById("loadPrevMonth");
	if (loadPrev) {
		loadPrev.addEventListener("click", function () {
			if (changePeriod) changePeriod(-1);
		});
	}
	const loadNext = document.getElementById("loadNextMonth");
	if (loadNext) {
		loadNext.addEventListener("click", function () {
			if (changePeriod) changePeriod(1);
		});
	}

	// Refresh time logs when a new time log is added or deleted via the modal
	document.addEventListener("timeLogAdded", function () {
		// Force refresh of time logs on add/delete
		if (loadTimeLogs) loadTimeLogs(undefined, true);
	});
	document.addEventListener("timeLogDeleted", function () {
		if (loadTimeLogs) loadTimeLogs(undefined, true);
	});
}

export default { initializeEventHandlers };
