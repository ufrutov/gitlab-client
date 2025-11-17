/**
 * GitLab API Utility Class
 * Provides methods to interact with GitLab API using GraphQL
 * Authentication token is retrieved from localStorage
 */

export class GitLabAPI {
	constructor(baseUrl = "") {
		this.baseUrl = baseUrl;
		this.graphqlUrl = `${baseUrl}/api/graphql`;
		this.restApiUrl = `${baseUrl}/api/v4`;
	}

	/**
	 * Get authentication token from localStorage
	 * @returns {string|null} - The GitLab token or null if not found
	 */
	getToken() {
		try {
			const auth = localStorage.getItem("userAuth");
			if (auth) {
				const { token } = JSON.parse(auth);
				return token;
			}
		} catch (error) {
			console.error("Error retrieving token from localStorage:", error);
		}
		return null;
	}

	/**
	 * Get username from localStorage
	 * @returns {string|null} - The username or null if not found
	 */
	getUsername() {
		try {
			const auth = localStorage.getItem("userAuth");
			if (auth) {
				const { username } = JSON.parse(auth);
				return username;
			}
		} catch (error) {
			console.error("Error retrieving username from localStorage:", error);
		}
		return null;
	}

	/**
	 * Execute a GraphQL query against GitLab API
	 * @param {string} query - GraphQL query string
	 * @param {Object} variables - Query variables (optional)
	 * @returns {Promise<Object>} - GraphQL response data
	 */
	async graphql(query, variables = {}) {
		const token = this.getToken();
		if (!token) {
			throw new Error("No authentication token found. Please login first.");
		}

		try {
			const response = await fetch(this.graphqlUrl, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					Authorization: `Bearer ${token}`,
				},
				body: JSON.stringify({
					query,
					variables,
				}),
			});

			if (!response.ok) {
				throw new Error(`HTTP error! status: ${response.status} - ${response.statusText}`);
			}

			const result = await response.json();

			if (result.errors) {
				throw new Error(`GraphQL errors: ${JSON.stringify(result.errors)}`);
			}

			return result.data;
		} catch (error) {
			console.error("Error executing GraphQL query:", error);
			throw error;
		}
	}

	/**
	 * List all projects accessible to the current user
	 * @param {Object} options - Query options
	 * @param {number} options.first - Number of projects to fetch (default: 20)
	 * @param {string} options.after - Cursor for pagination
	 * @param {string} options.search - Search term for project name/path
	 * @param {boolean} options.membership - Only projects user is a member of
	 * @returns {Promise<Object>} - Projects data with pagination info
	 */
	async listProjects(options = {}) {
		const { first = 20, after = null, search = null, membership = true } = options;

		const query = `
			query ListProjects(
				$first: Int,
				$after: String,
				$search: String,
				$membership: Boolean
			) {
				projects(
					first: $first,
					after: $after,
					search: $search,
					membership: $membership
				) {
					pageInfo {
						hasNextPage
						hasPreviousPage
						startCursor
						endCursor
					}
					nodes {
						id
						name
						nameWithNamespace
						description
						fullPath
						path
						webUrl
						createdAt
						lastActivityAt
						visibility
						forksCount
						issuesEnabled
						mergeRequestsEnabled
						wikiEnabled
						snippetsEnabled
						avatarUrl
						namespace {
							id
							name
							path
							fullPath
						}
					}
				}
			}
		`;

		const data = await this.graphql(query, {
			first,
			after,
			search,
			membership,
		});

		return data.projects;
	}

	/**
	 * Get detailed information about a specific project
	 * @param {string} fullPath - Project full path (e.g., "username/project-name")
	 * @returns {Promise<Object>} - Project data
	 */
	async getProject(fullPath) {
		const query = `
			query GetProject($fullPath: ID!) {
				project(fullPath: $fullPath) {
					id
					name
					nameWithNamespace
					description
					fullPath
					path
					webUrl
					createdAt
					lastActivityAt
					visibility
					forksCount
					issuesEnabled
					mergeRequestsEnabled
					wikiEnabled
					snippetsEnabled
					avatarUrl
					namespace {
						id
						name
						path
						fullPath
					}
					statistics {
						commitCount
						storageSize
						repositorySize
						lfsObjectsSize
					}
				}
			}
		`;

		const data = await this.graphql(query, { fullPath });
		return data.project;
	}

	/**
	 * List issues for a specific project
	 * @param {string} projectPath - Project full path
	 * @param {Object} options - Query options
	 * @param {string} options.state - Issue state: 'opened', 'closed', 'all' (default: 'opened')
	 * @param {number} options.first - Number of issues to fetch (default: 20)
	 * @param {string} options.after - Cursor for pagination
	 * @param {Array<string>} options.labels - Filter by label names
	 * @param {string} options.assigneeUsername - Filter by assignee username
	 * @param {string} options.authorUsername - Filter by author username
	 * @param {string} options.search - Search term for issue title/description
	 * @returns {Promise<Object>} - Issues data with pagination info
	 */
	async listIssues(projectPath, options = {}) {
		const {
			state = "opened",
			first = 20,
			after = null,
			labels = null,
			assigneeUsername = null,
			authorUsername = null,
			search = null,
		} = options;

		const query = `
			query ListProjectIssues(
				$projectPath: ID!,
				$state: IssuableState,
				$first: Int,
				$after: String,
				$labels: [String!],
				$assigneeUsername: String,
				$authorUsername: String,
				$search: String
			) {
				project(fullPath: $projectPath) {
					issues(
						state: $state,
						first: $first,
						after: $after,
						labelName: $labels,
						assigneeUsername: $assigneeUsername,
						authorUsername: $authorUsername,
						search: $search
					) {
						pageInfo {
							hasNextPage
							hasPreviousPage
							startCursor
							endCursor
						}
						nodes {
							id
							iid
							title
							description
							state
							createdAt
							updatedAt
							closedAt
							dueDate
							webUrl
							author {
								id
								name
								username
								avatarUrl
							}
							assignees {
								nodes {
									id
									name
									username
									avatarUrl
								}
							}
							labels {
								nodes {
									id
									title
									color
									description
								}
							}
							milestone {
								id
								title
								description
								dueDate
							}
							userNotesCount
							upvotes
							downvotes
						}
					}
				}
			}
		`;

		const data = await this.graphql(query, {
			projectPath,
			state,
			first,
			after,
			labels,
			assigneeUsername,
			authorUsername,
			search,
		});

		return data.project.issues;
	}

	/**
	 * Get detailed information about a specific issue
	 * @param {string} projectPath - Project full path
	 * @param {string} iid - Issue internal ID (e.g., "123")
	 * @returns {Promise<Object>} - Issue data
	 */
	async getIssue(projectPath, iid) {
		const query = `
			query GetIssue($projectPath: ID!, $iid: String!) {
				project(fullPath: $projectPath) {
					issue(iid: $iid) {
						id
						iid
						title
						description
						descriptionHtml
						state
						createdAt
						updatedAt
						closedAt
						dueDate
						webUrl
						author {
							id
							name
							username
							avatarUrl
							webUrl
						}
						assignees {
							nodes {
								id
								name
								username
								avatarUrl
								webUrl
							}
						}
						labels {
							nodes {
								id
								title
								color
								description
							}
						}
						milestone {
							id
							title
							description
							dueDate
							startDate
							webUrl
							state
						}
						timeStats {
							timeEstimate
							totalTimeSpent
							humanTimeEstimate
							humanTotalTimeSpent
						}
						timelogs {
							nodes {
								timeSpent
								spentAt
								summary
								user {
									id
									name
									username
								}
							}
						}
						userNotesCount
						upvotes
						downvotes
						participants {
							nodes {
								id
								name
								username
								avatarUrl
							}
						}
					}
				}
			}
		`;

		const data = await this.graphql(query, { projectPath, iid });
		return data.project.issue;
	}

	/**
	 * Add spent time to an issue
	 * @param {string} projectId - Project ID (numeric or encoded)
	 * @param {string} issueIid - Issue internal ID
	 * @param {string} duration - Duration string (e.g., '1h', '30m', '2h30m')
	 * @param {string} summary - Summary of work done (optional)
	 * @returns {Promise<Object>} - Response data
	 */
	async addSpentTime(projectId, issueIid, duration, summary = "") {
		const token = this.getToken();
		if (!token) {
			throw new Error("No authentication token found. Please login first.");
		}

		let url = `${this.restApiUrl}/projects/${encodeURIComponent(
			projectId
		)}/issues/${issueIid}/add_spent_time?duration=${encodeURIComponent(duration)}`;

		if (summary) {
			url += `&summary=${encodeURIComponent(summary)}`;
		}

		try {
			const response = await fetch(url, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					"PRIVATE-TOKEN": token,
				},
			});

			if (!response.ok) {
				const errorText = await response.text();
				throw new Error(
					`HTTP error! status: ${response.status} - ${response.statusText}. ${errorText}`
				);
			}

			return await response.json();
		} catch (error) {
			console.error("Error adding spent time:", error);
			throw error;
		}
	}

	/**
	 * Delete a timelog entry
	 * Uses GraphQL mutation `timelogDelete`.
	 * @param {string} timelogId - The global ID (GraphQL ID) of the timelog to delete
	 * @returns {Promise<Object>} - Mutation result containing any errors
	 */
	async deleteTimeLog(timelogId) {
		if (!timelogId) {
			throw new Error("timelogId is required");
		}

		// GitLab expects the specific TimelogID scalar for this mutation
		const mutation = `
			mutation DeleteTimelog($id: TimelogID!) {
				timelogDelete(input: { id: $id }) {
					errors
				}
			}
		`;

		const data = await this.graphql(mutation, { id: timelogId });
		const result = data.timelogDelete;
		if (result && result.errors && result.errors.length > 0) {
			throw new Error(result.errors.join("; "));
		}

		return result;
	}

	/**
	 * Get current user information
	 * @returns {Promise<Object>} - Current user data
	 */
	async getCurrentUser() {
		const query = `
			query GetCurrentUser {
				currentUser {
					id
					username
					name
					email
					avatarUrl
					webUrl
					status {
						message
						availability
					}
				}
			}
		`;

		const data = await this.graphql(query);
		return data.currentUser;
	}

	/**
	 * Get recent time logs for the current user
	 * @param {Object} options - Query options
	 * @param {number} options.first - Number of timelogs to retrieve (default: 50, max: 100)
	 * @param {string} options.after - Cursor for pagination
	 * @param {string} options.startDate - Return timelogs created after given date (ISO 8601 format)
	 * @param {string} options.endDate - Return timelogs created before given date (ISO 8601 format)
	 * @param {string} options.username - Filter by specific username (optional, defaults to current user)
	 * @returns {Promise<Object>} - Timelogs data with pagination info
	 */
	async getRecentTimeLogs(options = {}) {
		const { first = 50, after = null, startDate = null, endDate = null, username = null } = options;

		// Get current user if username not specified
		let targetUsername = username;
		if (!targetUsername) {
			const currentUser = await this.getCurrentUser();
			targetUsername = currentUser.username;
		}

		const query = `
      query GetTimelogs(
        $first: Int,
        $after: String,
        $startDate: Time,
        $endDate: Time,
        $username: String
      ) {
        timelogs(
          first: $first,
          after: $after,
          startDate: $startDate,
          endDate: $endDate,
          username: $username
        ) {
          pageInfo {
            hasNextPage
            hasPreviousPage
            startCursor
            endCursor
          }
          nodes {
            id
            timeSpent
            spentAt
            summary
            user {
              id
              name
              username
              avatarUrl
            }
						issue {
							id
							iid
							title
							webUrl
							state
						}
						mergeRequest {
							id
							iid
							title
							webUrl
							state
						}
          }
        }
      }
    `;

		const data = await this.graphql(query, {
			first: Math.min(first, 100),
			after,
			startDate,
			endDate,
			username: targetUsername,
		});

		// Enrich timelogs with human-readable duration
		const enrichedTimelogs = data.timelogs.nodes.map((log) => ({
			...log,
			timeSpentHuman: this.formatDuration(log.timeSpent),
		}));

		// Sort by spentAt in descending order (most recent first)
		enrichedTimelogs.sort((a, b) => new Date(b.spentAt) - new Date(a.spentAt));

		return {
			pageInfo: data.timelogs.pageInfo,
			nodes: enrichedTimelogs,
		};
	}

	/**
	 * Get time logs for a specific project
	 * @param {string} projectId - Project ID or URL-encoded path
	 * @param {Object} options - Query options
	 * @param {number} options.per_page - Number of timelogs to retrieve (default: 50)
	 * @param {number} options.page - Page number (default: 1)
	 * @returns {Promise<Array>} - Array of timelog entries for the project
	 */
	async getProjectTimeLogs(projectId, options = {}) {
		const token = this.getToken();
		if (!token) {
			throw new Error("No authentication token found. Please login first.");
		}

		const { per_page = 50, page = 1 } = options;

		const params = new URLSearchParams({
			per_page: Math.min(per_page, 100).toString(),
			page: page.toString(),
		});

		try {
			const response = await fetch(
				`${this.restApiUrl}/projects/${encodeURIComponent(projectId)}/timelogs?${params}`,
				{
					headers: {
						"PRIVATE-TOKEN": token,
					},
				}
			);

			if (!response.ok) {
				throw new Error(`HTTP error! status: ${response.status} - ${response.statusText}`);
			}

			const timelogs = await response.json();

			return timelogs.map((log) => ({
				id: log.id,
				timeSpent: log.time_spent,
				timeSpentHuman: this.formatDuration(log.time_spent),
				spentAt: log.spent_at,
				createdAt: log.created_at,
				summary: log.summary || "",
				user: log.user,
				issue: log.issue
					? {
							id: log.issue.id,
							iid: log.issue.iid,
							title: log.issue.title,
							webUrl: log.issue.web_url,
					  }
					: null,
			}));
		} catch (error) {
			console.error("Error fetching project timelogs:", error);
			throw error;
		}
	}

	/**
	 * Format duration in seconds to human-readable string
	 * @param {number} seconds - Duration in seconds
	 * @returns {string} - Formatted duration (e.g., "2h 30m")
	 */
	formatDuration(seconds) {
		if (!seconds || seconds < 0) return "0m";

		const hours = Math.floor(seconds / 3600);
		const minutes = Math.floor((seconds % 3600) / 60);

		const parts = [];
		if (hours > 0) parts.push(`${hours}h`);
		if (minutes > 0) parts.push(`${minutes}m`);

		return parts.length > 0 ? parts.join(" ") : "0m";
	}

	/**
	 * Search across GitLab (projects, issues, merge requests, etc.)
	 * @param {string} search - Search term
	 * @param {string} scope - Search scope: 'projects', 'issues', 'merge_requests', 'milestones', 'users'
	 * @param {number} first - Number of results (default: 20)
	 * @returns {Promise<Object>} - Search results
	 */
	async search(search, scope = "projects", first = 20) {
		const token = this.getToken();
		if (!token) {
			throw new Error("No authentication token found. Please login first.");
		}

		try {
			const response = await fetch(
				`${this.restApiUrl}/search?scope=${scope}&search=${encodeURIComponent(
					search
				)}&per_page=${first}`,
				{
					headers: {
						"PRIVATE-TOKEN": token,
					},
				}
			);

			if (!response.ok) {
				throw new Error(`HTTP error! status: ${response.status} - ${response.statusText}`);
			}

			return await response.json();
		} catch (error) {
			console.error("Error searching:", error);
			throw error;
		}
	}
}

// Export a default instance for convenience. If the user has set a repository
// URL in localStorage (saved via the login form), use it as the base URL.
let defaultBase = "";

try {
	const auth = localStorage.getItem("userAuth");
	if (auth) {
		const parsed = JSON.parse(auth);

		if (parsed && parsed.repository) {
			defaultBase = parsed.repository;
		}
	}
} catch (e) {
	// ignore and fall back to default
}

export default new GitLabAPI(defaultBase);
