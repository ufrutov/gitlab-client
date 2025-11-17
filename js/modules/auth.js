const AUTH_STORAGE_KEY = "userAuth";

export function getStoredAuth() {
	const auth = localStorage.getItem(AUTH_STORAGE_KEY);
	if (auth) {
		try {
			const { username, token } = JSON.parse(auth);
			if (username && token) {
				const parsed = JSON.parse(auth);
				return { username: parsed.username, token: parsed.token, repository: parsed.repository };
			}
		} catch (e) {
			console.error("Error parsing auth data:", e);
			localStorage.removeItem(AUTH_STORAGE_KEY);
		}
	}
	return null;
}

import store from "../utils/store.js";

export function saveCredentials(username, token, repository) {
	const auth = {
		username,
		token,
		repository,
		timestamp: new Date().toISOString(),
	};
	localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(auth));
	try {
		// Clear cached store on new credentials to avoid leaking data between accounts
		if (store && typeof store.clearAll === "function") store.clearAll();
	} catch (e) {
		// ignore
	}
}

export function clearCredentials() {
	localStorage.removeItem(AUTH_STORAGE_KEY);
}

export function showDashboard(username) {
	const authForm = document.getElementById("authForm");
	const dashboard = document.getElementById("dashboard");
	const displayUsername = document.getElementById("displayUsername");
	if (authForm) authForm.classList.add("hidden");
	if (dashboard) dashboard.classList.remove("hidden");
	if (displayUsername) displayUsername.textContent = username;
}

export function showLoginForm() {
	const authForm = document.getElementById("authForm");
	const dashboard = document.getElementById("dashboard");
	const loginForm = document.getElementById("loginForm");
	if (authForm) authForm.classList.remove("hidden");
	if (dashboard) dashboard.classList.add("hidden");
	if (loginForm) loginForm.reset();
	hideError();
}

export function showError(message) {
	const errorDiv = document.getElementById("errorMessage");
	if (!errorDiv) return;
	errorDiv.textContent = message;
	errorDiv.classList.remove("hidden");
}

export function hideError() {
	const errorDiv = document.getElementById("errorMessage");
	if (!errorDiv) return;
	errorDiv.classList.add("hidden");
}

export default {
	getStoredAuth,
	saveCredentials,
	clearCredentials,
	showDashboard,
	showLoginForm,
	showError,
	hideError,
};
