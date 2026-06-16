export type handlers_workspaceAddMembersResponse = {
  emails?: Array<string>;
  errors?: { [key: string]: unknown };
  limit_exceeded?: boolean;
  message?: string;
};
