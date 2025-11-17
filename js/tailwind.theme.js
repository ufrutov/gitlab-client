// Tailwind CSS configuration for shadcn/ui theme
// This config uses CSS variables for colors so we can switch light/dark at runtime
tailwind.config = {
	darkMode: "class",
	theme: {
		extend: {
			colors: {
				border: "var(--border)",
				input: "var(--input)",
				ring: "var(--ring)",
				background: "var(--background)",
				foreground: "var(--foreground)",
				primary: {
					DEFAULT: "var(--primary)",
					foreground: "var(--primary-foreground)",
				},
				secondary: {
					DEFAULT: "var(--secondary)",
					foreground: "var(--secondary-foreground)",
				},
				destructive: {
					DEFAULT: "var(--destructive)",
					foreground: "var(--destructive-foreground)",
				},
				muted: {
					DEFAULT: "var(--muted)",
					foreground: "var(--muted-foreground)",
				},
				accent: {
					DEFAULT: "var(--accent)",
					foreground: "var(--accent-foreground)",
				},
				card: {
					DEFAULT: "var(--card)",
					foreground: "var(--card-foreground)",
				},
			},
			borderRadius: {
				lg: "0.5rem",
				md: "calc(0.5rem - 2px)",
				sm: "calc(0.5rem - 4px)",
			},
			// Ensure Tailwind's border utilities use the theme variable as default
			borderColor: {
				DEFAULT: "var(--border)",
			},
		},
	},
};

// Theme variable definitions for light and dark themes
(function () {
	const light = {
		"--border": "hsl(214.3 31.8% 91.4%)",
		"--input": "hsl(214.3 31.8% 91.4%)",
		"--ring": "hsl(222.2 84% 4.9%)",
		"--background": "hsl(0 0% 100%)",
		"--foreground": "hsl(222.2 84% 4.9%)",
		"--primary": "hsl(222.2 47.4% 11.2%)",
		"--primary-foreground": "hsl(210 40% 98%)",
		"--secondary": "hsl(210 40% 96.1%)",
		"--secondary-foreground": "hsl(222.2 47.4% 11.2%)",
		"--destructive": "hsl(0 84.2% 60.2%)",
		"--destructive-foreground": "hsl(210 40% 98%)",
		"--muted": "hsl(210 40% 96.1%)",
		"--muted-foreground": "hsl(215.4 16.3% 46.9%)",
		"--accent": "hsl(210 40% 96.1%)",
		"--accent-foreground": "hsl(222.2 47.4% 11.2%)",
		"--card": "hsl(0 0% 100%)",
		"--card-foreground": "hsl(222.2 84% 4.9%)",
	};

	const dark = {
		"--border": "hsla(0, 0%, 14%, 1.00)",
		"--input": "hsl(220 14% 14%)",
		"--ring": "hsl(210 40% 98%)",
		"--background": "hsl(222.2 84% 4.9%)",
		"--foreground": "hsl(210 40% 98%)",
		"--primary": "hsl(210 40% 98%)",
		"--primary-foreground": "hsl(222.2 47.4% 11.2%)",
		"--secondary": "hsl(220 14% 14%)",
		"--secondary-foreground": "hsl(210 40% 98%)",
		"--destructive": "hsl(0 62% 50%)",
		"--destructive-foreground": "hsl(210 40% 98%)",
		"--muted": "hsl(220 12% 10%)",
		"--muted-foreground": "hsl(210 40% 98%)",
		"--accent": "hsl(220 14% 14%)",
		"--accent-foreground": "hsl(210 40% 98%)",
		"--card": "hsl(222.2 84% 6.5%)",
		"--card-foreground": "hsl(210 40% 98%)",
	};

	function applyVars(map) {
		const root = document.documentElement;
		Object.keys(map).forEach((k) => root.style.setProperty(k, map[k]));
	}

	// Initialize theme from localStorage, prefers-color-scheme, or default to light
	function initTheme() {
		const stored = localStorage.getItem("theme");
		let theme = stored;
		if (!theme) {
			const prefersDark =
				window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
			theme = prefersDark ? "dark" : "light";
		}
		setTheme(theme);
	}

	// Expose functions on window to toggle or set theme
	window.setTheme = function (theme) {
		if (theme === "dark") {
			document.documentElement.classList.add("dark");
			applyVars(dark);
		} else {
			document.documentElement.classList.remove("dark");
			applyVars(light);
		}
		try {
			localStorage.setItem("theme", theme);
		} catch (e) {
			// ignore
		}
	};

	window.toggleTheme = function () {
		const isDark = document.documentElement.classList.contains("dark");
		window.setTheme(isDark ? "light" : "dark");
	};

	// initialize now
	initTheme();
})();
