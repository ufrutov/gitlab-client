// Simple local store for caching GitLab data to avoid redundant API calls
// Uses localStorage with simple keys. No TTL: cache is invalidated explicitly.
const PREFIX = "appStore:";

function keyFor(k) {
	return PREFIX + k;
}

function safeParse(v) {
	try {
		return JSON.parse(v);
	} catch (e) {
		return null;
	}
}

export function clearAll() {
	try {
		Object.keys(localStorage).forEach((k) => {
			if (k && k.startsWith(PREFIX)) localStorage.removeItem(k);
		});
	} catch (e) {
		console.warn("store.clearAll error", e);
	}
}

// Projects
export function storeProjects(projects) {
	try {
		localStorage.setItem(keyFor("projects"), JSON.stringify(projects || []));
	} catch (e) {
		console.warn("store.storeProjects error", e);
	}
}

export function getProjects() {
	try {
		const v = localStorage.getItem(keyFor("projects"));
		return safeParse(v) || null;
	} catch (e) {
		return null;
	}
}

export function clearProjects() {
	try {
		localStorage.removeItem(keyFor("projects"));
	} catch (e) {}
}

// Issues per project (keyed by project fullPath)
function issuesKey(projectFullPath) {
	return keyFor(`issues:${projectFullPath}`);
}

export function storeIssues(projectFullPath, issues) {
	try {
		localStorage.setItem(issuesKey(projectFullPath), JSON.stringify(issues || []));
	} catch (e) {
		console.warn("store.storeIssues error", e);
	}
}

export function getIssues(projectFullPath) {
	try {
		const v = localStorage.getItem(issuesKey(projectFullPath));
		return safeParse(v) || null;
	} catch (e) {
		return null;
	}
}

export function clearIssues(projectFullPath) {
	try {
		localStorage.removeItem(issuesKey(projectFullPath));
	} catch (e) {}
}

// Time logs per period (YYYY-MM)
function timelogsKey(period) {
	return keyFor(`timelogs:${period}`);
}

export function storeTimeLogs(period, timelogs) {
	try {
		localStorage.setItem(timelogsKey(period), JSON.stringify(timelogs || []));
	} catch (e) {
		console.warn("store.storeTimeLogs error", e);
	}
}

export function getTimeLogs(period) {
	try {
		const v = localStorage.getItem(timelogsKey(period));
		return safeParse(v) || null;
	} catch (e) {
		return null;
	}
}

export function clearTimeLogs(period) {
	try {
		localStorage.removeItem(timelogsKey(period));
	} catch (e) {}
}

export default {
	storeProjects,
	getProjects,
	clearProjects,
	storeIssues,
	getIssues,
	clearIssues,
	storeTimeLogs,
	getTimeLogs,
	clearTimeLogs,
	clearAll,
};
