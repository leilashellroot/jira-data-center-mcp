export interface JiraMCPConfig {
  baseUrl: string;
  token: string;
}

export function loadConfig(): JiraMCPConfig {
  const baseUrl = process.env.JIRA_BASE_URL;
  const token = process.env.JIRA_PAT;

  if (!baseUrl) {
    throw new Error("JIRA_BASE_URL environment variable is required");
  }
  if (!token) {
    throw new Error("JIRA_PAT environment variable is required");
  }

  return { baseUrl, token };
}
