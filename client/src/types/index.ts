export interface User {
  id: string;
  email: string;
  name: string;
  avatar?: string;
  githubUsername?: string;
}

export interface ProfileMenuProps {
  name: string;
  avatarUrl: string;
};

export interface GitHubRepo {
  id: number;
  name: string;
  full_name: string;
  description: string | null;
  private: boolean;
  html_url: string;
  clone_url: string;
  owner: {
    login: string;
  };
}

export interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}

export interface RepoCardProps {
  name: string;
  description?: string | null;
  url?: string;
  cloneUrl?: string;
  isPrivate?: boolean;
};