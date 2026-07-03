import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import axios from "axios";
import { getContext } from "./client.js";
import { getIssueContext } from "./context.js";
import { loadConfig } from "./config.js";

function makeRawClient() {
  const config = loadConfig();
  return axios.create({
    baseURL: `${config.baseUrl}/rest/api/2`,
    headers: {
      Authorization: `Bearer ${config.token}`,
      "Content-Type": "application/json",
    },
  });
}

export function registerTools(server: McpServer) {
  const { client, weblinks } = getContext();
  const raw = makeRawClient();

  server.tool(
    "jira_get_issue",
    "Get details of a specific Jira issue by its key (e.g., PROJ-123)",
    { issueKey: z.string().describe("The Jira issue key (e.g., PROJ-123)") },
    async ({ issueKey }) => {
      const issue = await client.issues.get({
        issueKeyOrId: issueKey,
        fields: "*all",
        expand: "renderedFields,names,schema,changelog",
      });
      return { content: [{ type: "text", text: JSON.stringify(issue, null, 2) }] };
    }
  );

  server.tool(
    "jira_get_issue_context",
    "Get comprehensive context for a Jira issue: summary, description, comments, attachments, issuelinks, remote links (weblinks), changelog, parent, and subtasks — all in one call",
    { issueKey: z.string().describe("The Jira issue key (e.g., PROJ-123)") },
    async ({ issueKey }) => {
      const ctx = await getIssueContext(issueKey);
      return { content: [{ type: "text", text: JSON.stringify(ctx, null, 2) }] };
    }
  );

  server.tool(
    "jira_search_issues",
    'Search for Jira issues using JQL (Jira Query Language). Examples: "project = PROJ AND status = Open", "assignee = currentUser() AND status != Done"',
    {
      jql: z.string().describe("JQL query string to search for issues"),
      maxResults: z.number().default(50).describe("Maximum number of results to return (default: 50)"),
    },
    async ({ jql, maxResults }) => {
      const result = await client.issues.search({ jql, maxResults });
      return {
        content: [{ type: "text", text: JSON.stringify(result.issues ?? result, null, 2) }],
      };
    }
  );

  server.tool(
    "jira_create_issue",
    "Create a new Jira issue in a specified project",
    {
      projectKey: z.string().describe("The project key where the issue will be created"),
      summary: z.string().describe("Brief summary/title of the issue"),
      issueType: z.string().describe("Type of issue (e.g., Bug, Task, Story, Epic)"),
      description: z.string().optional().describe("Detailed description of the issue"),
      priority: z.string().optional().describe("Priority level (e.g., High, Medium, Low)"),
      assignee: z.string().optional().describe("Username of the person to assign the issue to"),
      labels: z.array(z.string()).optional().describe("Array of labels to add to the issue"),
      components: z.array(z.string()).optional().describe("Array of component names"),
      customFields: z.record(z.unknown()).optional().describe("Map of additional Jira custom field values"),
    },
    async ({ projectKey, summary, issueType, description, priority, assignee, labels, components, customFields }) => {
      const result = await client.issues.create({
        projectKeyOrId: projectKey,
        issueTypeName: issueType,
        summary,
        description,
        assignee,
        priority,
        labels,
        components,
        customFields: customFields as Record<string, unknown> | undefined,
      });
      return {
        content: [{ type: "text", text: `Successfully created issue ${(result as any).key}\n\n${JSON.stringify(result, null, 2)}` }],
      };
    }
  );

  server.tool(
    "jira_update_issue",
    "Update an existing Jira issue",
    {
      issueKey: z.string().describe("The Jira issue key to update"),
      summary: z.string().optional().describe("New summary/title for the issue"),
      description: z.string().optional().describe("New description for the issue"),
      assignee: z.string().optional().describe("Username to assign the issue to"),
      priority: z.string().optional().describe("New priority level"),
      labels: z.array(z.string()).optional().describe("New array of labels"),
      customFields: z.record(z.unknown()).optional().describe("Map of additional Jira custom field values"),
    },
    async ({ issueKey, summary, description, assignee, priority, labels, customFields }) => {
      const fields: Record<string, unknown> = {};
      if (summary) fields.summary = summary;
      if (description !== undefined) fields.description = description;
      if (assignee) fields.assignee = { name: assignee };
      if (priority) fields.priority = { name: priority };
      if (labels) fields.labels = labels;
      if (customFields) Object.assign(fields, customFields);
      await client.issues.update({ issueKeyOrId: issueKey, fields });
      const issue = await client.issues.get({ issueKeyOrId: issueKey, fields: "*all" });
      return {
        content: [{ type: "text", text: `Successfully updated issue ${issue.key}\n\n${JSON.stringify(issue, null, 2)}` }],
      };
    }
  );

  server.tool(
    "jira_delete_issue",
    "Delete a Jira issue permanently",
    { issueKey: z.string().describe("The Jira issue key to delete") },
    async ({ issueKey }) => {
      await client.issues.delete({ issueKeyOrId: issueKey });
      return { content: [{ type: "text", text: `Successfully deleted issue ${issueKey}` }] };
    }
  );

  server.tool(
    "jira_add_comment",
    "Add a comment to a Jira issue",
    {
      issueKey: z.string().describe("The Jira issue key"),
      comment: z.string().describe("The comment text to add"),
    },
    async ({ issueKey, comment }) => {
      const result = await client.issues.addComment({ issueKeyOrId: issueKey, body: comment });
      return {
        content: [{ type: "text", text: `Successfully added comment to ${issueKey}\n\n${JSON.stringify(result, null, 2)}` }],
      };
    }
  );

  server.tool(
    "jira_edit_comment",
    "Edit an existing comment on a Jira issue",
    {
      issueKey: z.string().describe("The Jira issue key"),
      commentId: z.string().describe("The ID of the comment to edit"),
      body: z.string().describe("New comment body"),
    },
    async ({ issueKey, commentId, body }) => {
      const result = await client.issues.editComment({ issueKeyOrId: issueKey, commentId, body });
      return {
        content: [{ type: "text", text: `Successfully edited comment ${commentId} on ${issueKey}\n\n${JSON.stringify(result, null, 2)}` }],
      };
    }
  );

  server.tool(
    "jira_delete_comment",
    "Delete a comment from a Jira issue",
    {
      issueKey: z.string().describe("The Jira issue key"),
      commentId: z.string().describe("The ID of the comment to delete"),
    },
    async ({ issueKey, commentId }) => {
      await client.issues.deleteComment({ issueKeyOrId: issueKey, commentId });
      return { content: [{ type: "text", text: `Successfully deleted comment ${commentId} from ${issueKey}` }] };
    }
  );

  server.tool(
    "jira_get_comments",
    "Get all comments from a Jira issue",
    { issueKey: z.string().describe("The Jira issue key") },
    async ({ issueKey }) => {
      const res = await raw.get(`/issue/${issueKey}/comment`);
      return {
        content: [{ type: "text", text: JSON.stringify(res.data.comments ?? res.data, null, 2) }],
      };
    }
  );

  server.tool(
    "jira_get_projects",
    "List all available Jira projects",
    {},
    async () => {
      const projects = await client.projects.getAll();
      return { content: [{ type: "text", text: JSON.stringify(projects, null, 2) }] };
    }
  );

  server.tool(
    "jira_get_project",
    "Get details of a specific Jira project",
    { projectKey: z.string().describe("The project key") },
    async ({ projectKey }) => {
      const project = await client.projects.get({ projectKeyOrId: projectKey });
      return { content: [{ type: "text", text: JSON.stringify(project, null, 2) }] };
    }
  );

  server.tool(
    "jira_get_issue_types",
    "Get available issue types for a project",
    { projectKey: z.string().describe("The project key") },
    async ({ projectKey }) => {
      const project = await client.projects.get({ projectKeyOrId: projectKey });
      return { content: [{ type: "text", text: JSON.stringify((project as any).issueTypes ?? [], null, 2) }] };
    }
  );

  server.tool(
    "jira_get_project_versions",
    "Get versions for a Jira project",
    { projectKey: z.string().describe("The project key") },
    async ({ projectKey }) => {
      const versions = await client.projects.getVersions({ projectKeyOrId: projectKey });
      return { content: [{ type: "text", text: JSON.stringify(versions, null, 2) }] };
    }
  );

  server.tool(
    "jira_assign_issue",
    "Assign a Jira issue to a user",
    {
      issueKey: z.string().describe("The Jira issue key"),
      assignee: z.string().describe("Username to assign the issue to"),
    },
    async ({ issueKey, assignee }) => {
      await raw.put(`/issue/${issueKey}/assignee`, { name: assignee });
      return { content: [{ type: "text", text: `Successfully assigned ${issueKey} to ${assignee}` }] };
    }
  );

  server.tool(
    "jira_get_current_user",
    "Get information about the currently authenticated user",
    {},
    async () => {
      const user = await client.users.getMyself();
      return { content: [{ type: "text", text: JSON.stringify(user, null, 2) }] };
    }
  );

  server.tool(
    "jira_search_users",
    "Search for Jira users by username or display name",
    { query: z.string().describe("Search string to match against usernames or display names") },
    async ({ query }) => {
      const users = await client.users.searchUsers({ username: query });
      return { content: [{ type: "text", text: JSON.stringify(users, null, 2) }] };
    }
  );

  // --- Transitions ---

  server.tool(
    "jira_get_transitions",
    "Get available status transitions for a Jira issue",
    { issueKey: z.string().describe("The Jira issue key") },
    async ({ issueKey }) => {
      const transitions = await client.issues.getTransitions({ issueKeyOrId: issueKey });
      return { content: [{ type: "text", text: JSON.stringify(transitions, null, 2) }] };
    }
  );

  server.tool(
    "jira_transition_issue",
    "Transition a Jira issue to a new status",
    {
      issueKey: z.string().describe("The Jira issue key"),
      transitionId: z.string().describe("The transition ID (from jira_get_transitions)"),
      comment: z.string().optional().describe("Optional comment to add during the transition"),
    },
    async ({ issueKey, transitionId, comment }) => {
      await client.issues.transition({ issueKeyOrId: issueKey, transitionId, comment });
      return { content: [{ type: "text", text: `Successfully transitioned ${issueKey}` }] };
    }
  );

  // --- Worklogs ---

  server.tool(
    "jira_get_worklogs",
    "Get worklogs for a Jira issue",
    { issueKey: z.string().describe("The Jira issue key") },
    async ({ issueKey }) => {
      const result = await client.issues.getWorklogs({ issueKeyOrId: issueKey });
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    }
  );

  server.tool(
    "jira_add_worklog",
    "Add a worklog entry to a Jira issue",
    {
      issueKey: z.string().describe("The Jira issue key"),
      timeSpent: z.string().describe("Time spent (e.g., '2h', '1d 3h')"),
      comment: z.string().optional().describe("Optional worklog comment"),
      started: z.string().optional().describe("Start datetime (ISO 8601, e.g., '2024-01-15T09:00:00.000+0000')"),
    },
    async ({ issueKey, timeSpent, comment, started }) => {
      const result = await client.issues.addWorklog({ issueKeyOrId: issueKey, timeSpent, comment, started });
      return { content: [{ type: "text", text: `Successfully added worklog to ${issueKey}\n\n${JSON.stringify(result, null, 2)}` }] };
    }
  );

  // --- Changelog ---

  server.tool(
    "jira_get_changelog",
    "Get changelog entries for a Jira issue",
    {
      issueKey: z.string().describe("The Jira issue key"),
      startAt: z.number().default(0).describe("Starting index for pagination"),
      maxResults: z.number().default(50).describe("Maximum entries to return"),
    },
    async ({ issueKey, startAt, maxResults }) => {
      const changelog = await client.issues.getChangelog({ issueKeyOrId: issueKey, startAt, maxResults });
      return { content: [{ type: "text", text: JSON.stringify(changelog, null, 2) }] };
    }
  );

  // --- Attachments ---

  server.tool(
    "jira_get_attachment",
    "Get attachment metadata by ID",
    { attachmentId: z.string().describe("The attachment ID") },
    async ({ attachmentId }) => {
      const att = await client.issues.getAttachment({ attachmentId });
      return { content: [{ type: "text", text: JSON.stringify(att, null, 2) }] };
    }
  );

  server.tool(
    "jira_add_attachment",
    "Add a file attachment to a Jira issue",
    {
      issueKey: z.string().describe("The Jira issue key"),
      filePath: z.string().describe("Absolute path to the file to attach"),
    },
    async ({ issueKey, filePath }) => {
      const result = await client.issues.addAttachment({ issueKeyOrId: issueKey, filePath });
      return { content: [{ type: "text", text: `Successfully attached file to ${issueKey}\n\n${JSON.stringify(result, null, 2)}` }] };
    }
  );

  server.tool(
    "jira_delete_attachment",
    "Delete an attachment by ID",
    { attachmentId: z.string().describe("The attachment ID") },
    async ({ attachmentId }) => {
      await client.issues.deleteAttachment({ attachmentId });
      return { content: [{ type: "text", text: `Successfully deleted attachment ${attachmentId}` }] };
    }
  );

  // --- Issue Links ---

  server.tool(
    "jira_get_link_types",
    "Get all available issue link types (e.g., Blocks, Duplicate, Relates)",
    {},
    async () => {
      const types = await client.links.getTypes();
      return { content: [{ type: "text", text: JSON.stringify(types, null, 2) }] };
    }
  );

  server.tool(
    "jira_create_issue_link",
    "Create a link between two Jira issues",
    {
      typeName: z.string().describe("Link type name (e.g., 'Blocks', 'Duplicate', 'Relates')"),
      inwardIssueKey: z.string().describe("Inward issue key (the 'is blocked by' side)"),
      outwardIssueKey: z.string().describe("Outward issue key (the 'blocks' side)"),
      comment: z.string().optional().describe("Optional comment"),
    },
    async ({ typeName, inwardIssueKey, outwardIssueKey, comment }) => {
      await client.links.create({ typeName, inwardIssueKey, outwardIssueKey, comment });
      return {
        content: [{ type: "text", text: JSON.stringify({ created: true, type: typeName, inward: inwardIssueKey, outward: outwardIssueKey }, null, 2) }],
      };
    }
  );

  server.tool(
    "jira_remove_issue_link",
    "Remove a link between two Jira issues",
    { linkId: z.string().describe("Issue link ID (from jira_get_issue or jira_get_issue_context response's issuelinks array)") },
    async ({ linkId }) => {
      await client.links.remove({ linkId });
      return { content: [{ type: "text", text: JSON.stringify({ removed: true, linkId }, null, 2) }] };
    }
  );

  // --- Remote Links / WebLinks ---

  server.tool(
    "jira_get_remote_links",
    "Get all remote links (weblinks) for a Jira issue — external URLs like GitLab MRs, Confluence pages, docs",
    { issueKey: z.string().describe("The Jira issue key") },
    async ({ issueKey }) => {
      const links = await weblinks.getAll(issueKey);
      return { content: [{ type: "text", text: JSON.stringify(links, null, 2) }] };
    }
  );

  server.tool(
    "jira_create_remote_link",
    "Create a remote link (weblink) on a Jira issue — for external URLs like GitLab MRs, Confluence pages, docs",
    {
      issueKey: z.string().describe("The Jira issue key"),
      url: z.string().describe("The external URL to link"),
      title: z.string().describe("Short human-readable title for the link"),
    },
    async ({ issueKey, url, title }) => {
      const result = await weblinks.create(issueKey, { url, title });
      return { content: [{ type: "text", text: `Successfully created weblink on ${issueKey}\n\n${JSON.stringify(result, null, 2)}` }] };
    }
  );

  server.tool(
    "jira_delete_remote_link",
    "Delete a remote link (weblink) from a Jira issue",
    {
      issueKey: z.string().describe("The Jira issue key"),
      linkId: z.string().describe("The remote link ID"),
    },
    async ({ issueKey, linkId }) => {
      await weblinks.delete(issueKey, linkId);
      return { content: [{ type: "text", text: `Successfully deleted weblink ${linkId} from ${issueKey}` }] };
    }
  );

  // --- Agile ---

  server.tool(
    "jira_get_agile_boards",
    "Get all Agile boards visible to the user",
    {
      type: z.enum(["scrum", "kanban"]).optional().describe("Filter by board type"),
      name: z.string().optional().describe("Filter by board name (partial match)"),
    },
    async ({ type, name }) => {
      const boards = await client.agile.getBoards({ type, name });
      return { content: [{ type: "text", text: JSON.stringify(boards, null, 2) }] };
    }
  );

  server.tool(
    "jira_get_sprints",
    "Get sprints for a board",
    {
      boardId: z.number().describe("The board ID"),
      state: z.enum(["future", "active", "closed"]).optional().describe("Filter by sprint state"),
    },
    async ({ boardId, state }) => {
      const sprints = await client.agile.getSprints({ boardId, state });
      return { content: [{ type: "text", text: JSON.stringify(sprints, null, 2) }] };
    }
  );

  server.tool(
    "jira_get_sprint_issues",
    "Get issues in a sprint",
    { sprintId: z.number().describe("The sprint ID") },
    async ({ sprintId }) => {
      const issues = await client.agile.getSprintIssues({ sprintId });
      return { content: [{ type: "text", text: JSON.stringify(issues, null, 2) }] };
    }
  );

  server.tool(
    "jira_get_board_issues",
    "Get issues on a board (backlog or active sprint)",
    {
      boardId: z.number().describe("The board ID"),
      jql: z.string().optional().describe("Optional JQL to filter issues"),
      maxResults: z.number().default(50).describe("Maximum results to return"),
    },
    async ({ boardId, jql, maxResults }) => {
      const issues = await client.agile.getBoardIssues({ boardId, jql, maxResults });
      return { content: [{ type: "text", text: JSON.stringify(issues, null, 2) }] };
    }
  );

  // --- Fields ---

  server.tool(
    "jira_search_fields",
    "Search for Jira custom fields by keyword",
    {
      keyword: z.string().describe("Keyword to search for in field names"),
      limit: z.number().default(10).describe("Maximum results to return"),
    },
    async ({ keyword, limit }) => {
      const fields = await client.fields.search(keyword, limit);
      return { content: [{ type: "text", text: JSON.stringify(fields, null, 2) }] };
    }
  );

  server.tool(
    "jira_get_field_options",
    "Get available options for a custom field (e.g., select list values)",
    { fieldId: z.string().describe("The custom field ID (e.g., 'customfield_10014')") },
    async ({ fieldId }) => {
      const options = await client.fields.getFieldOptions({ fieldId });
      return { content: [{ type: "text", text: JSON.stringify(options, null, 2) }] };
    }
  );

  // --- Components ---

  server.tool(
    "jira_get_components",
    "Get components for a Jira project",
    { projectKey: z.string().describe("The project key") },
    async ({ projectKey }) => {
      const res = await raw.get(`/project/${projectKey}/components`);
      return { content: [{ type: "text", text: JSON.stringify(res.data, null, 2) }] };
    }
  );

  // --- Create meta ---

  server.tool(
    "jira_get_create_meta",
    "Get issue creation metadata for a project and issue type — reveals required fields, available options, and custom field values",
    {
      projectKey: z.string().describe("Project key"),
      issueTypeName: z.string().optional().describe("Issue type name (e.g., 'Bug', 'Task')"),
    },
    async ({ projectKey, issueTypeName }) => {
      const meta = await client.issues.getCreateMeta({ projectKey, issueTypeName: issueTypeName ?? "Bug" });
      return { content: [{ type: "text", text: JSON.stringify(meta, null, 2) }] };
    }
  );

  // --- Dev Status ---

  server.tool(
    "jira_get_dev_status",
    "Get development information (branches, commits, pull requests) linked to a Jira issue",
    { issueKey: z.string().describe("The Jira issue key or ID") },
    async ({ issueKey }) => {
      const summary = await client.devStatus.getSummary(issueKey);
      return { content: [{ type: "text", text: JSON.stringify(summary, null, 2) }] };
    }
  );
}
