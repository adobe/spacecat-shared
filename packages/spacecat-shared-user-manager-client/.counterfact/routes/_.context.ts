import type { Context$ } from "../types/_.context.js";

/**
 * LLMO-5616 User Manager mock state.
 *
 * The root Context is a persistent singleton across requests (Counterfact's
 * ContextRegistry), so this object IS the mock's in-session state. Stateful
 * route handlers under `.counterfact/routes/**` delegate to these methods.
 *
 * `seed()` loads a known fixture set; `reset()` returns to it (called by the
 * E2E suite in `beforeEach` and by the non-spec `POST /__reset` route).
 * Counterfact only compiles its own `routes/` tree, so this state cannot live
 * in `src/` — see the package README "Mock architecture".
 */

type Dict = Record<string, unknown>;
type Workspace = { id: string; parent_id: string | null } & Dict;
type Member = { user_id: string } & Dict;

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

export const DEFAULT_FIXTURES = {
  profile: { user_id: "user-1", email: "owner@example.com", first_name: "Owner" },
  workspaces: [
    { id: "ws-root", parent_id: null, name: "Root Workspace", subscription_tier: "enterprise" },
    { id: "ws-child", parent_id: "ws-root", name: "Child Workspace", subscription_tier: "team" },
  ] as Workspace[],
  members: {
    "ws-root": [{ user_id: "user-1", role: "owner" }, { user_id: "user-2", role: "editor" }],
  } as Record<string, Member[]>,
  resources: {
    "ws-root": { workspace_id: "ws-root", limits: { projects: 100, keywords: 10000 } },
    "ws-child": { workspace_id: "ws-child", limits: { projects: 10, keywords: 1000 } },
  } as Record<string, Dict>,
  serviceUnits: {
    "ws-root": { workspace_id: "ws-root", balance: 5000 },
  } as Record<string, Dict>,
};

export class Context {
  profile: Dict = {};

  workspaces = new Map<string, Workspace>();

  members = new Map<string, Map<string, Member>>();

  resources = new Map<string, Dict>();

  serviceUnits = new Map<string, Dict>();

  idCounter = 0;

  constructor($: Context$) {
    void $;
    this.seed();
  }

  // --- lifecycle ---
  seed(fixtures = DEFAULT_FIXTURES) {
    const f = clone(fixtures);
    this.profile = f.profile;
    this.workspaces = new Map(f.workspaces.map((w) => [w.id, w]));
    this.members = new Map(
      Object.entries(f.members).map(([wid, list]) => [
        wid,
        new Map(list.map((m) => [m.user_id, m])),
      ]),
    );
    this.resources = new Map(Object.entries(f.resources));
    this.serviceUnits = new Map(Object.entries(f.serviceUnits));
    this.idCounter = 0;
  }

  reset() {
    this.seed();
  }

  nextId(prefix = "ws") {
    this.idCounter += 1;
    return `${prefix}-new-${this.idCounter}`;
  }

  // --- profile ---
  getProfile() {
    return this.profile;
  }

  updateProfile(patch: Dict) {
    this.profile = { ...this.profile, ...patch };
    return this.profile;
  }

  // --- workspaces ---
  listWorkspaces() {
    return { items: [...this.workspaces.values()] };
  }

  getWorkspace(id: string) {
    return this.workspaces.get(id) ?? null;
  }

  createChild(parentId: string, body: Dict) {
    const id = this.nextId();
    const ws: Workspace = { ...body, id, parent_id: parentId };
    this.workspaces.set(id, ws);
    return ws;
  }

  updateWorkspace(id: string, patch: Dict) {
    const ws = this.workspaces.get(id);
    if (!ws) return null;
    const updated = { ...ws, ...patch, id };
    this.workspaces.set(id, updated);
    return updated;
  }

  deleteWorkspace(id: string) {
    return this.workspaces.delete(id);
  }

  // --- members ---
  listMembers(workspaceId: string) {
    const m = this.members.get(workspaceId);
    return { items: m ? [...m.values()] : [] };
  }

  addMembers(workspaceId: string, members: Member[]) {
    if (!this.workspaces.has(workspaceId)) return null;
    const map = this.members.get(workspaceId) ?? new Map<string, Member>();
    members.forEach((m) => map.set(m.user_id, m));
    this.members.set(workspaceId, map);
    return { items: [...map.values()] };
  }

  updateMember(workspaceId: string, userId: string, patch: Dict) {
    const map = this.members.get(workspaceId);
    const existing = map?.get(userId);
    if (!existing) return null;
    const updated = { ...existing, ...patch, user_id: userId };
    map!.set(userId, updated);
    return updated;
  }

  deleteMembers(workspaceId: string, userIds: string[]) {
    const map = this.members.get(workspaceId);
    if (!map) return false;
    userIds.forEach((uid) => map.delete(uid));
    return true;
  }

  // --- resources / service units ---
  getResources(workspaceId: string) {
    return this.resources.get(workspaceId) ?? null;
  }

  getTotalResources() {
    return { items: [...this.resources.values()] };
  }

  getServiceUnitsBalance(workspaceId: string) {
    return this.serviceUnits.get(workspaceId) ?? null;
  }
}
