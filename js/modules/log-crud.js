import gitlabAPI from "../utils/gitlab.js";
import { escapeHtml, formatDate } from "../utils/utils.js";
import store from "../utils/store.js";
import * as favorites from "../utils/favorites.js";

// New Log modal helpers (moved out of app.js to avoid clutter and allow reuse)

function showErrorElement(message) {
	const errorDiv = document.getElementById("errorMessage");
	if (errorDiv) {
		errorDiv.textContent = message;
		errorDiv.classList.remove("hidden");
	}
}

export function showNewLogModal() {
	const modal = document.getElementById("newLogModal");
	// Ensure title shows Add mode
	if (modal) {
		const titleEl = modal.querySelector("h3");
		if (titleEl) titleEl.textContent = "Add Time Log";
	}
	const dateInput = document.getElementById("newLogDate");
	if (modal) modal.classList.remove("hidden");
	// Set today's date by default
	try {
		const today = new Date();
		const yyyy = today.getFullYear();
		const mm = String(today.getMonth() + 1).padStart(2, "0");
		const dd = String(today.getDate()).padStart(2, "0");
		if (dateInput) dateInput.value = `${yyyy}-${mm}-${dd}`;
	} catch (e) {
		// ignore
	}
	// Populate projects (async)
	populateNewLogProjects();
}

// Internal state for delete flow
let _currentTimelogId = null;

/**
 * Open the modal in 'delete' mode for a given timelog object.
 * The `log` object is expected to contain at least `id`, `spentAt`, `summary`, and `issue` information.
 */
export async function openDeleteTimelogModal(log) {
	if (!log) return;
	_currentTimelogId = log.id;

	// Populate read-only fields
	const dateInput = document.getElementById("newLogDate");
	const durationInput = document.getElementById("newLogDuration");
	const projectSelect = document.getElementById("newLogProject");
	const issueSelect = document.getElementById("newLogIssue");
	const summaryEl = document.getElementById("newLogSummary");
	const submitBtn = document.getElementById("newLogSubmitBtn");
	const deleteBtn = document.getElementById("newLogDeleteBtn");

	// Fill values (spentAt -> yyyy-mm-dd)
	try {
		if (dateInput) {
			const d = new Date(log.spentAt);
			const yyyy = d.getFullYear();
			const mm = String(d.getMonth() + 1).padStart(2, "0");
			const dd = String(d.getDate()).padStart(2, "0");
			dateInput.value = `${yyyy}-${mm}-${dd}`;
		}
	} catch (e) {
		// ignore
	}

	if (durationInput) durationInput.value = log.timeSpentHuman || "";
	if (summaryEl) {
		summaryEl.value = log.summary || log.note.body || "";
	}

	// Show delete button, hide submit
	if (submitBtn) submitBtn.classList.add("hidden");
	if (deleteBtn) deleteBtn.classList.remove("hidden");

	// Disable inputs to indicate read-only delete confirmation
	[dateInput, durationInput, projectSelect, issueSelect, summaryEl].forEach((el) => {
		if (el) el.disabled = true;
	});

	// Try to resolve project for this timelog by parsing issue.webUrl and fetching project details
	const setProjectOption = (value, label) => {
		if (!projectSelect) return;
		projectSelect.innerHTML = `<option value="${escapeHtml(value)}">${escapeHtml(label)}</option>`;
	};

	if (log.issue && log.issue.webUrl && projectSelect) {
		// Helper to extract fullPath from webUrl
		const extractProjectFullPathFromUrl = (webUrl) => {
			try {
				const u = new URL(webUrl);
				const parts = u.pathname.split("/").filter(Boolean); // remove empty
				// Find index of '-' which precedes issues MR paths
				const dashIndex = parts.indexOf("-");
				let projectParts;
				if (dashIndex > 0) {
					projectParts = parts.slice(0, dashIndex);
				} else {
					// Fallback: find 'issues' segment
					const issuesIdx = parts.indexOf("issues");
					if (issuesIdx > 0) projectParts = parts.slice(0, issuesIdx);
				}
				if (projectParts && projectParts.length > 0) return projectParts.join("/");
			} catch (e) {
				return null;
			}
			return null;
		};

		const projectFullPath = extractProjectFullPathFromUrl(log.issue.webUrl);
		if (projectFullPath) {
			try {
				const proj = await gitlabAPI.getProject(projectFullPath);
				if (proj) {
					setProjectOption(projectFullPath, proj.name || projectFullPath);
				}
			} catch (err) {
				// If fetching project failed, fall back to showing the parsed path
				setProjectOption(projectFullPath, projectFullPath);
			}
		} else {
			// No project path could be derived: show a placeholder
			setProjectOption("", "Unknown project");
		}
	}

	// Populate issue select with the issue from the log
	if (log.issue && issueSelect) {
		const issueIid = log.issue.iid || "";
		const issueTitle = log.issue.title || "";
		issueSelect.innerHTML = `<option value="${escapeHtml(String(issueIid))}">#${escapeHtml(
			String(issueIid),
		)} - ${escapeHtml(issueTitle)}</option>`;
	}

	// Disable delete button if current user doesn't own the timelog
	if (deleteBtn && log.user) {
		try {
			const currentUser = await gitlabAPI.getCurrentUser();
			if (currentUser && currentUser.id !== log.user.id) {
				deleteBtn.disabled = true;
				deleteBtn.title = "You can only delete your own time logs";
			}
		} catch (err) {
			console.error("Error checking user ownership:", err);
		}
	}

	// Show modal
	const modal = document.getElementById("newLogModal");

	// Update modal title to Edit when in delete mode
	if (modal) {
		const titleEl = modal.querySelector("h3");
		if (titleEl) {
			titleEl.innerHTML = `Time Log at <span class="text-bold border-b-2 border-black border-dotted">${formatDate(
				log.spentAt,
				false,
				"dd/mm/yyyy",
			)}</span> for <a href="${
				log.issue.webUrl
			}" target="_blank" class="text-blue-500 hover:text-blue-600" title="${
				log.issue.title || ""
			}">#${log.issue.iid}</a>`;
		}
		modal.classList.remove("hidden");
	}
}

/**
 * Open a read-only view modal for a given timelog object.
 */
export function openViewLogModal(log) {
	if (!log) return;
	_currentTimelogId = log.id;

	const dateEl = document.getElementById("viewLogDate");
	const durationEl = document.getElementById("viewLogDuration");
	const issueLink = document.getElementById("viewLogIssueLink");
	const summaryEl = document.getElementById("viewLogSummary");
	const titleEl = document.getElementById("viewLogTitle");

	try {
		if (dateEl) dateEl.textContent = formatDate(log.spentAt, false, "dd/mm/yyyy");
	} catch (e) {
		if (dateEl) dateEl.textContent = String(log.spentAt || "");
	}

	if (durationEl) durationEl.textContent = log.timeSpentHuman || "";

	if (issueLink) {
		const iid = log.issue && log.issue.iid ? log.issue.iid : "";
		const title = log.issue && log.issue.title ? log.issue.title : "";
		const webUrl = log.issue && log.issue.webUrl ? log.issue.webUrl : "#";
		issueLink.textContent = iid ? `#${iid} - ${title}` : title || "";
		issueLink.href = webUrl;
		issueLink.title = title || "";
		// Store iid and title as data attributes for clipboard formatting
		issueLink.setAttribute("data-iid", String(iid));
		issueLink.setAttribute("data-title", title || "");
	}

	if (summaryEl) summaryEl.textContent = log.summary || (log.note && log.note.body) || "";

	if (titleEl && log.spentAt && log.issue) {
		titleEl.innerHTML = `Time Log at <span class="text-bold border-b-2 border-black border-dotted">${formatDate(
			log.spentAt,
			false,
			"dd/mm/yyyy",
		)}</span> for <a href="${
			log.issue.webUrl
		}" target="_blank" class="text-blue-500 hover:text-blue-600" title="${escapeHtml(
			log.issue.title || "",
		)}">#${escapeHtml(String(log.issue.iid || ""))}<i class="fas fa-external-link-alt ml-1"></i></a>`;
	}

	const modal = document.getElementById("viewLogModal");
	if (modal) modal.classList.remove("hidden");
}

export function hideViewLogModal() {
	const modal = document.getElementById("viewLogModal");
	if (modal) modal.classList.add("hidden");
	_currentTimelogId = null;
}

/**
 * Handle delete button click; expects to be called by an event handler.
 */
export async function handleDeleteTimelog(e) {
	if (e && e.preventDefault) e.preventDefault();
	if (!_currentTimelogId) {
		showErrorElement("No timelog selected for deletion");
		return;
	}

	try {
		await gitlabAPI.deleteTimeLog(_currentTimelogId);
		// Close modal and notify app to refresh
		hideNewLogModal();
		// Clear timelogs cache for the period shown in the modal (if possible)
		try {
			const dateInput = document.getElementById("newLogDate");
			if (dateInput && dateInput.value) {
				const d = new Date(dateInput.value);
				const periodKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
				if (store && typeof store.clearTimeLogs === "function") store.clearTimeLogs(periodKey);
			}
		} catch (e) {
			// ignore
		}

		document.dispatchEvent(new CustomEvent("timeLogDeleted"));
	} catch (err) {
		console.error("Error deleting timelog:", err);
		showErrorElement(err.message || "Failed to delete time log");
	} finally {
		// Reset state
		_currentTimelogId = null;
	}
}

// Reset modal UI state to defaults (called when modal is closed)
export function _resetModalState() {
	const dateInput = document.getElementById("newLogDate");
	const durationInput = document.getElementById("newLogDuration");
	const projectSelect = document.getElementById("newLogProject");
	const issueSelect = document.getElementById("newLogIssue");
	const summaryEl = document.getElementById("newLogSummary");
	const submitBtn = document.getElementById("newLogSubmitBtn");
	const deleteBtn = document.getElementById("newLogDeleteBtn");

	// Clear values
	if (dateInput) dateInput.value = "";
	if (durationInput) durationInput.value = "";
	if (projectSelect) projectSelect.innerHTML = `<option value="">Select project</option>`;
	if (issueSelect) issueSelect.innerHTML = `<option value="">Select project first</option>`;
	if (summaryEl) summaryEl.value = "";

	// Re-enable inputs
	[dateInput, durationInput, projectSelect, issueSelect, summaryEl].forEach((el) => {
		if (el) el.disabled = false;
	});

	// Ensure submit visible and delete hidden
	if (submitBtn) submitBtn.classList.remove("hidden");
	if (deleteBtn) deleteBtn.classList.add("hidden");

	_currentTimelogId = null;
}

// Hide modal and reset state
export function hideNewLogModal() {
	const modal = document.getElementById("newLogModal");
	if (modal) modal.classList.add("hidden");
	_resetModalState();
}

async function populateNewLogProjects() {
	const projectSelect = document.getElementById("newLogProject");
	const issueSelect = document.getElementById("newLogIssue");
	if (!projectSelect) return;
	projectSelect.innerHTML = `<option value="">Loading projects...</option>`;
	try {
		// Try cache first
		let nodes = store && typeof store.getProjects === "function" ? store.getProjects() : null;
		if (!nodes || !Array.isArray(nodes) || nodes.length === 0) {
			const res = await gitlabAPI.listProjects({ first: 100, membership: true });
			nodes = res.nodes || [];
			// Cache projects
			try {
				if (store && typeof store.storeProjects === "function") store.storeProjects(nodes);
			} catch (e) {
				// ignore
			}
		}
		if (nodes.length === 0) {
			projectSelect.innerHTML = `<option value="">No projects found</option>`;
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

		projectSelect.innerHTML =
			`<option value="">Select project</option>` +
			sortedProjects
				.map((p) => `<option value="${escapeHtml(p.fullPath)}">${escapeHtml(p.name)}</option>`)
				.join("");
		// clear issues
		if (issueSelect) issueSelect.innerHTML = `<option value="">Select project first</option>`;
	} catch (err) {
		console.error("Error loading projects for new log:", err);
		projectSelect.innerHTML = `<option value="">Failed to load</option>`;
		showErrorElement("Failed to load projects");
	}
}

export async function populateNewLogIssues(projectFullPath) {
	const issueSelect = document.getElementById("newLogIssue");
	if (!issueSelect) return;
	issueSelect.innerHTML = `<option value="">Loading issues...</option>`;
	try {
		// Try cache first
		let nodes =
			store && typeof store.getIssues === "function" ? store.getIssues(projectFullPath) : null;
		if (!nodes || !Array.isArray(nodes) || nodes.length === 0) {
			const res = await gitlabAPI.listIssues(projectFullPath, { first: 100 });
			nodes = res.nodes || [];
			try {
				if (store && typeof store.storeIssues === "function")
					store.storeIssues(projectFullPath, nodes);
			} catch (e) {
				// ignore
			}
		}
		if (nodes.length === 0) {
			issueSelect.innerHTML = `<option value="">No issues found</option>`;
			return;
		}

		// Sort issues: favorites first
		const favoriteIssueIds = favorites.getFavoriteIssues();
		const sortedIssues = nodes.sort((a, b) => {
			const aIsFav = favoriteIssueIds.includes(a.id);
			const bIsFav = favoriteIssueIds.includes(b.id);
			if (aIsFav && !bIsFav) return -1;
			if (!aIsFav && bIsFav) return 1;
			return 0;
		});

		issueSelect.innerHTML =
			`<option value="">Select issue</option>` +
			sortedIssues
				.map(
					(i) =>
						`<option value="${escapeHtml(String(i.iid))}">#${escapeHtml(
							String(i.iid),
						)} - ${escapeHtml(i.title)}</option>`,
				)
				.join("");
	} catch (err) {
		console.error("Error loading issues for new log:", err);
		issueSelect.innerHTML = `<option value="">Failed to load</option>`;
		showErrorElement("Failed to load issues");
	}
}

export async function handleNewLogSubmit(e) {
	e.preventDefault();
	const date = document.getElementById("newLogDate")?.value;
	const project = document.getElementById("newLogProject")?.value;
	const issueIid = document.getElementById("newLogIssue")?.value;
	const summary = document.getElementById("newLogSummary")?.value || "";

	if (!project) {
		showErrorElement("Please select a project");
		return;
	}
	if (!issueIid) {
		showErrorElement("Please select an issue");
		return;
	}

	// Read duration from the form (e.g. '1h', '30m'). Default to '1h' when empty.
	const durationInput = document.getElementById("newLogDuration")?.value?.trim();
	const duration = durationInput && durationInput.length > 0 ? durationInput : "1h";

	try {
		// Check if the date is today
		const today = new Date();
		const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(
			2,
			"0",
		)}-${String(today.getDate()).padStart(2, "0")}`;
		const isToday = date === todayStr;

		// Use addSpentTimeAtDate if not today, otherwise use addSpentTime
		if (!isToday && date) {
			await gitlabAPI.addSpentTimeAtDate(project, issueIid, duration, date, summary);
		} else {
			await gitlabAPI.addSpentTime(project, issueIid, duration, summary);
		}
		hideNewLogModal();
		// Clear timelogs cache for the period of the added entry
		try {
			if (date) {
				const d = new Date(date);
				const periodKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
				if (store && typeof store.clearTimeLogs === "function") store.clearTimeLogs(periodKey);
			}
		} catch (e) {
			// ignore
		}

		// Notify app that a time log was added so it can refresh
		document.dispatchEvent(new CustomEvent("timeLogAdded"));
	} catch (err) {
		console.error("Error submitting time log:", err);
		showErrorElement(err.message || "Failed to add time log");
	}
}

export default {
	showNewLogModal,
	hideNewLogModal,
	populateNewLogIssues,
	handleNewLogSubmit,
	openViewLogModal,
	hideViewLogModal,
};
