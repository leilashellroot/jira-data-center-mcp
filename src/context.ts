import { getContext } from "./client.js";

export interface IssueContext {
  key: string;
  summary: string;
  description: string | null;
  issueType: string;
  status: string;
  priority: string | null;
  assignee: string | null;
  reporter: string | null;
  created: string;
  updated: string;
  resolution: string | null;
  labels: string[];
  components: { name: string }[];
  parent: { key: string; summary?: string } | null;
  subtasks: { key: string; summary: string }[];
  issuelinks: Array<{
    id: string;
    type: { name: string; inward: string; outward: string };
    inwardIssue?: { key: string; summary?: string };
    outwardIssue?: { key: string; summary?: string };
  }>;
  comments: Array<{
    id: string;
    author: string;
    created: string;
    body: string;
  }>;
  attachments: Array<{
    id: string;
    filename: string;
    size: number;
    mimeType: string;
    created: string;
    content: string;
  }>;
  remoteLinks: Array<{
    id: number;
    url: string;
    title: string;
  }>;
  changelog?: Array<{
    author: string;
    created: string;
    items: Array<{ field: string; fromString: string | null; toString: string | null }>;
  }>;
}

export async function getIssueContext(issueKey: string): Promise<IssueContext> {
  const { client, weblinks } = getContext();

  const issue = await client.issues.get({
    issueKeyOrId: issueKey,
    fields: "*all",
    expand: "renderedFields,names,schema,transitions,changelog",
  });

  const [remoteLinksResult, parentIssueResult] = await Promise.allSettled([
    weblinks.getAll(issueKey),
    issue.fields?.parent
      ? client.issues.get({
          issueKeyOrId: issue.fields.parent.key,
          fields: "summary,status,priority,assignee",
        })
      : Promise.resolve(null),
  ]);

  const remoteLinks =
    remoteLinksResult.status === "fulfilled"
      ? remoteLinksResult.value.map((rl) => ({
          id: rl.id,
          url: rl.object?.url ?? "",
          title: rl.object?.title ?? "",
        }))
      : [];

  const parent =
    parentIssueResult.status === "fulfilled" && parentIssueResult.value
      ? {
          key: (parentIssueResult.value as any).key ?? "",
          summary: (parentIssueResult.value as any).fields?.summary ?? undefined,
        }
      : null;

  const comments = (issue.fields?.comment?.comments ?? []).map((c: any) => ({
    id: String(c.id ?? ""),
    author: c.author?.displayName ?? c.author?.name ?? "",
    created: c.created ?? "",
    body: c.body ?? "",
  }));

  const attachments = (issue.fields?.attachment ?? []).map((a: any) => ({
    id: String(a.id ?? ""),
    filename: a.filename ?? "",
    size: a.size ?? 0,
    mimeType: a.mimeType ?? "",
    created: a.created ?? "",
    content: a.content ?? "",
  }));

  const issuelinks = (issue.fields?.issuelinks ?? []).map((l: any) => ({
    id: l.id ?? "",
    type: {
      name: l.type?.name ?? "",
      inward: l.type?.inward ?? "",
      outward: l.type?.outward ?? "",
    },
    inwardIssue: l.inwardIssue
      ? { key: l.inwardIssue.key, summary: l.inwardIssue.fields?.summary }
      : undefined,
    outwardIssue: l.outwardIssue
      ? { key: l.outwardIssue.key, summary: l.outwardIssue.fields?.summary }
      : undefined,
  }));

  const subtasks = (issue.fields?.subtasks ?? []).map((s: any) => ({
    key: s.key ?? "",
    summary: s.fields?.summary ?? "",
  }));

  const changelog = issue.changelog?.histories?.map((h: any) => ({
    author: h.author?.displayName ?? h.author?.name ?? "",
    created: h.created ?? "",
    items: (h.items ?? []).map((i: any) => ({
      field: i.field ?? "",
      fromString: i.fromString ?? null,
      toString: i.toString ?? null,
    })),
  }));

  return {
    key: issue.key,
    summary: issue.fields?.summary ?? "",
    description: typeof issue.fields?.description === "string"
      ? issue.fields.description
      : issue.fields?.description
        ? JSON.stringify(issue.fields.description)
        : null,
    issueType: issue.fields?.issuetype?.name ?? "",
    status: issue.fields?.status?.name ?? "",
    priority: issue.fields?.priority?.name ?? null,
    assignee: issue.fields?.assignee?.displayName ?? issue.fields?.assignee?.name ?? null,
    reporter: issue.fields?.reporter?.displayName ?? issue.fields?.reporter?.name ?? null,
    created: issue.fields?.created ?? "",
    updated: issue.fields?.updated ?? "",
    resolution: issue.fields?.resolution?.name ?? null,
    labels: issue.fields?.labels ?? [],
    components: (issue.fields?.components ?? []).map((c: any) => ({ name: c.name ?? "" })),
    parent: issue.fields?.parent
      ? {
          key: issue.fields.parent.key ?? "",
          summary: parent?.summary ?? undefined,
        }
      : null,
    subtasks,
    issuelinks,
    comments,
    attachments,
    remoteLinks,
    changelog,
  };
}
