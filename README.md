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

The simplest configuration uses the existing environment variables:

```bash
export JIRA_BASE_URL=https://jira.example.com
export JIRA_PAT=your-personal-access-token
```

The upstream-compatible names are also supported:

```bash
export JIRA_HOST=jira.example.com
export JIRA_API_TOKEN=your-personal-access-token
```

`JIRA_HOST` assumes HTTPS. Use `JIRA_API_BASE_PATH` for a full URL such as
`https://jira.example.com/rest` when Jira is hosted below a context path.

### Setup CLI

The setup command validates credentials and stores configuration in
`~/.atlassian-dc-mcp/jira.env` with mode `0600` on POSIX systems:

```bash
npx @leilashellroot/jira-data-center-mcp setup
```

It also supports scripted setup:

```bash
npx @leilashellroot/jira-data-center-mcp setup --non-interactive \
  --host jira.example.com \
  --token "$JIRA_TOKEN"
```

Configuration precedence is process environment, `ATLASSIAN_DC_MCP_CONFIG_FILE`
or the current directory `.env`, the home configuration file, then the macOS
Keychain token when available. Process environment variables always win.

`JIRA_DEFAULT_PAGE_SIZE` defaults to `25`. Set
`ATLASSIAN_DC_MCP_REQUEST_TIMEOUT_MS` to change the default 30-second Jira
request timeout.

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

### Remote SSE

Start the server with the legacy SSE transport:

```bash
MCP_TRANSPORT=sse MCP_HOST=0.0.0.0 MCP_PORT=3000 npx @leilashellroot/jira-data-center-mcp
```

Connect an SSE-compatible MCP client to `http://localhost:3000/sse`. The client will receive the POST endpoint from the SSE `endpoint` event.

### Remote Streamable HTTP

Start the current MCP remote transport:

```bash
MCP_TRANSPORT=streamable-http MCP_HOST=0.0.0.0 MCP_PORT=3000 npx @leilashellroot/jira-data-center-mcp
```

Connect a Streamable HTTP MCP client to `http://localhost:3000/mcp`.

For OpenCode or Cursor, use a remote server entry instead of a local command:

```json
{
  "mcp": {
    "jira": {
      "type": "remote",
      "url": "http://localhost:3000/mcp",
      "enabled": true
    }
  }
}
```

Remote configuration variables:

| Variable | Default | Description |
|---|---|---|
| `MCP_TRANSPORT` | `stdio` | `stdio`, `sse`, or `streamable-http` |
| `MCP_HOST` | `127.0.0.1` | HTTP bind host; use `0.0.0.0` for network access |
| `MCP_PORT` | `3000` | HTTP port |
| `MCP_HTTP_PATH` | `/mcp` | Streamable HTTP endpoint |
| `MCP_SSE_PATH` | `/sse` | SSE connection endpoint |
| `MCP_MESSAGES_PATH` | `/messages` | SSE message POST endpoint |
| `MCP_ALLOWED_HOSTS` | unset | Comma-separated Host values for DNS rebinding protection |
| `MCP_ALLOWED_ORIGINS` | unset | Comma-separated Origin values for DNS rebinding protection |
| `MCP_CORS_ORIGIN` | unset | Optional `Access-Control-Allow-Origin` value |

When binding beyond localhost, put the server behind authentication and HTTPS. The Jira PAT is used by the server for every connected client.

## Tools

| Tool | Description |
|---|---|
| `jira_get_issue` | Get issue details with optional field projections and expansions |
| `jira_get_issue_context` | Get comprehensive context in one call |
| `jira_search_issues` | Search with JQL, pagination, field projections, and expansions |
| `jira_create_issue` | Create a new issue |
| `jira_update_issue` | Update an existing issue |
| `jira_delete_issue` | Delete an issue |
| `jira_add_comment` | Add a comment |
| `jira_edit_comment` | Edit a comment |
| `jira_delete_comment` | Delete a comment |
| `jira_get_comments` | List comments with pagination and rendered-body expansion |
| `jira_get_projects` | List projects |
| `jira_get_project` | Get project details |
| `jira_get_issue_types` | Get issue types for a project |
| `jira_get_project_versions` | Get project versions |
| `jira_assign_issue` | Assign to a user |
| `jira_get_current_user` | Get authenticated user |
| `jira_search_users` | Search users |
| `jira_get_transitions` | List available transitions |
| `jira_transition_issue` | Transition to a new status with fields and update operations |
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
| `jira_get_dev_status` | Get development summary or detailed pull requests, repositories, and branches |
| `jira_get_filter` | Resolve filter ID to JQL, name, view URL |
| `jira_get_filter_issues` | Get filter metadata + matching issues |

## Requirements

- Node.js >= 18
- Jira Server/Data Center 7.0+

## Acknowledgements

This project incorporates feature ideas and workflows from the community-maintained
[Atlassian Data Center MCP](https://github.com/b1ff/atlassian-dc-mcp) project by
b1ff. In particular, the upstream-compatible configuration sources and setup CLI,
configurable page sizes and field projections, detailed development-status queries,
flexible transition payloads, request timeouts, and credential validation were
adapted from that project. The upstream project remains independently licensed
under the MIT License.

### Enhanced tool parameters

- `jira_search_issues`: `startAt`, `maxResults`, `fields`, and `expand` are optional.
- `jira_get_issue`: `fields` and `expand` are optional; compact fields are returned by default to reduce response size.
- `jira_get_comments`: `startAt`, `maxResults`, and `expand` are optional.
- `jira_update_issue`: supports `issueTypeId` and Jira `update` operations in addition to the existing standard fields.
- `jira_transition_issue`: supports transition-screen `fields` and arbitrary `customFields`/`update` payloads.
- `jira_get_dev_status`: set `detail` to `true` and choose `dataType` (`pullrequest`, `repository`, or `branch`) and `applicationType` (`stash`, `bitbucket`, `github`, or `githube`).

## License

MIT
