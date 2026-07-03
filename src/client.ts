import { JiraClient } from "jira-data-center-client";
import axios, { type AxiosInstance } from "axios";
import { loadConfig } from "./config.js";

export interface RemoteLink {
  id: number;
  self: string;
  globalId?: string;
  application?: { type: string; name: string };
  relationship?: string;
  object: {
    url: string;
    title: string;
    summary?: string;
    icon?: { url16x16?: string; title?: string };
    status?: { resolved?: boolean; icon?: { url16x16?: string; title?: string } };
  };
}

export interface RemoteLinkCreated {
  id: number;
  self: string;
}

export class WebLinksApi {
  private client: AxiosInstance;

  constructor(baseUrl: string, token: string) {
    this.client = axios.create({
      baseURL: `${baseUrl}/rest/api/2`,
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    });
  }

  async getAll(issueKeyOrId: string): Promise<RemoteLink[]> {
    const res = await this.client.get<RemoteLink[]>(
      `/issue/${issueKeyOrId}/remotelink`
    );
    return res.data;
  }

  async get(issueKeyOrId: string, linkId: string): Promise<RemoteLink> {
    const res = await this.client.get<RemoteLink>(
      `/issue/${issueKeyOrId}/remotelink/${linkId}`
    );
    return res.data;
  }

  async create(
    issueKeyOrId: string,
    params: { url: string; title: string }
  ): Promise<RemoteLinkCreated> {
    const res = await this.client.post<RemoteLinkCreated>(
      `/issue/${issueKeyOrId}/remotelink`,
      { object: params }
    );
    return res.data;
  }

  async delete(issueKeyOrId: string, linkId: string): Promise<void> {
    await this.client.delete(`/issue/${issueKeyOrId}/remotelink/${linkId}`);
  }
}

export interface AppContext {
  client: JiraClient;
  weblinks: WebLinksApi;
}

let _ctx: AppContext | null = null;

export function getContext(): AppContext {
  if (_ctx) return _ctx;
  const config = loadConfig();
  _ctx = {
    client: new JiraClient({ baseUrl: config.baseUrl, token: config.token }),
    weblinks: new WebLinksApi(config.baseUrl, config.token),
  };
  return _ctx;
}
