export interface HeliosMemory {
  creator: string;
  projectName: string;
  coreStack: string;
  rules: string;
  targetProject: string;
  dynamicMemory: string[];
  userActiveRepos: Record<string, string>;
  admins: string[];
  lastContextUrl?: string | null;
}
