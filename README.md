# @leilashellroot/jira-data-center-mcp

MCP server for Jira Server/Data Center. Connects AI assistants to self-hosted Jira instances.

## Features

- **Issue management** — get, create, update, delete, search with JQL
- **Comments** — add, edit, delete, list
- **Transitions** — list available transitions, transition issues
- **WebLinks / Remote links** — read and manage external URLs (GitLab MRs, Confluence pages, docs)
- **Issue links** — create and remove links between issues (Blocks, Relates, etc.)
- **Agile** — boards, sprints, sprint issues
- **Worklogs** — get and add worklog entries
- **Changelog** — view issue change history
- **Attachments** — get metadata, add files, delete
- **jira_get_issue_context** — single call that returns everything: summary, description, comments, attachments, issuelinks, weblinks, changelog, parent, subtasks

## Installation

```bash
npm install -g @leilashellroot/jira-data-center-mcp
```

## Configuration

Set environment variables:

```bash
export JIRA_BASE_URL=https://jira.example.com
export JIRA_PAT=your-personal-access-token
```

Generate a PAT in Jira: **Profile → Personal Access Tokens → Create token**.

## Usage

### Direct

```bash
npx @leilashellroot/jira-data-center-mcp
```

### Claude Desktop

```json
{
  "mcpServers": {
    "jira": {
      "command": "npx",
      "args": ["-y", "@leilashellroot/jira-data-center-mcp"],
      "env": {
        "JIRA_BASE_URL": "https://jira.example.com",
        "JIRA_PAT": "your-token"
      }
    }
  }
}
```

### OpenCode / Cursor

```json
{
  "mcp": {
    "jira": {
      "type": "local",
      "command": ["npx", "-y", "@leilashellroot/jira-data-center-mcp"],
      "environment": {
        "JIRA_BASE_URL": "https://jira.example.com",
        "JIRA_PAT": "your-token"
      },
      "enabled": true
    }
  }
}
```

## Tools

| Tool | Description |
|---|---|
| `jira_get_issue` | Get issue details |
| `jira_get_issue_context` | Get comprehensive context in one call |
| `jira_search_issues` | Search with JQL |
| `jira_create_issue` | Create a new issue |
| `jira_update_issue` | Update an existing issue |
| `jira_delete_issue` | Delete an issue |
| `jira_add_comment` | Add a comment |
| `jira_edit_comment` | Edit a comment |
| `jira_delete_comment` | Delete a comment |
| `jira_get_comments` | List comments |
| `jira_get_projects` | List projects |
| `jira_get_project` | Get project details |
| `jira_get_issue_types` | Get issue types for a project |
| `jira_get_project_versions` | Get project versions |
| `jira_assign_issue` | Assign to a user |
| `jira_get_current_user` | Get authenticated user |
| `jira_search_users` | Search users |
| `jira_get_transitions` | List available transitions |
| `jira_transition_issue` | Transition to a new status |
| `jira_get_worklogs` | Get worklog entries |
| `jira_add_worklog` | Add a worklog |
| `jira_get_changelog` | View change history |
| `jira_get_attachment` | Get attachment metadata |
| `jira_add_attachment` | Add a file attachment |
| `jira_delete_attachment` | Delete an attachment |
| `jira_get_link_types` | List issue link types |
| `jira_create_issue_link` | Link two issues |
| `jira_remove_issue_link` | Remove issue link |
| `jira_get_remote_links` | Get weblinks/remote links |
| `jira_create_remote_link` | Create a weblink |
| `jira_delete_remote_link` | Delete a weblink |
| `jira_get_agile_boards` | List agile boards |
| `jira_get_sprints` | List sprints |
| `jira_get_sprint_issues` | Get sprint issues |
| `jira_get_board_issues` | Get board issues |
| `jira_search_fields` | Search custom fields |
| `jira_get_field_options` | Get custom field options |
| `jira_get_components` | Get project components |
| `jira_get_create_meta` | Get issue creation metadata |
| `jira_get_dev_status` | Get development info |

## Requirements

- Node.js >= 18
- Jira Server/Data Center 7.0+

## License

MIT
