const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api";

type Tokens = {
  access: string;
  refresh: string;
};

// Session ID for anonymous users
function getSessionId(): string {
  if (typeof window === "undefined") return "";
  let id = localStorage.getItem("session_id");
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem("session_id", id);
  }
  return id;
}

function getTokens(): Tokens | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem("tokens");
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function setTokens(tokens: Tokens) {
  localStorage.setItem("tokens", JSON.stringify(tokens));
}

export function clearTokens() {
  localStorage.removeItem("tokens");
  localStorage.removeItem("user");
}

async function refreshAccessToken(): Promise<string | null> {
  const tokens = getTokens();
  if (!tokens?.refresh) return null;

  try {
    const res = await fetch(`${API_URL}/auth/token/refresh/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh: tokens.refresh }),
    });
    if (!res.ok) {
      clearTokens();
      return null;
    }
    const data = await res.json();
    setTokens({ access: data.access, refresh: data.refresh || tokens.refresh });
    return data.access;
  } catch {
    clearTokens();
    return null;
  }
}

export async function apiFetch<T = unknown>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const tokens = getTokens();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "X-Session-ID": getSessionId(),
    ...(options.headers as Record<string, string>),
  };

  if (tokens?.access) {
    headers["Authorization"] = `Bearer ${tokens.access}`;
  }

  let res = await fetch(`${API_URL}${path}`, { ...options, headers });

  // If 401, try refreshing the token once
  if (res.status === 401 && tokens?.refresh) {
    const newAccess = await refreshAccessToken();
    if (newAccess) {
      headers["Authorization"] = `Bearer ${newAccess}`;
      res = await fetch(`${API_URL}${path}`, { ...options, headers });
    }
  }

  if (res.status === 204) return undefined as T;

  const data = await res.json();
  if (!res.ok) {
    const message = data?.error?.message || data?.detail || "Something went wrong";
    throw new Error(typeof message === "string" ? message : JSON.stringify(message));
  }

  return data as T;
}

// Auth helpers
export async function login(email: string, password: string) {
  const data = await apiFetch<{ access: string; refresh: string; user: User }>("/auth/login/", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
  setTokens({ access: data.access, refresh: data.refresh });
  localStorage.setItem("user", JSON.stringify(data.user));
  return data;
}

export async function register(email: string, name: string, password: string) {
  const data = await apiFetch<{ user: User; tokens: Tokens }>("/auth/register/", {
    method: "POST",
    body: JSON.stringify({ email, name, password }),
  });
  setTokens(data.tokens);
  localStorage.setItem("user", JSON.stringify(data.user));
  return data;
}

export function getStoredUser(): User | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem("user");
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function isLoggedIn(): boolean {
  return !!getTokens()?.access;
}

// Types
export type User = {
  id: number;
  email: string;
  name: string;
  created_at: string;
};

export type Article = {
  id: number;
  source_url: string | null;
  title: string;
  raw_text: string;
  summary: string;
  key_points: string[];
  tags: string[];
  is_public: boolean;
  is_owner: boolean;
  author_name: string;
  created_at: string;
  updated_at: string;
};

export type ArticleListItem = {
  id: number;
  source_url: string | null;
  title: string;
  summary: string;
  tags: string[];
  is_public: boolean;
  author_name: string;
  created_at: string;
};

export type Highlight = {
  id: number;
  article: number;
  text: string;
  color: string;
  note: string;
  source: string;
  is_own: boolean;
  created_at: string;
};

export type ChatMessage = {
  id: number;
  role: "user" | "assistant";
  content: string;
  created_at: string;
};

export type PaginatedResponse<T> = {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
};

export type Severity = "high" | "medium" | "low";

export type ContradictionPosition = {
  article_id: number;
  article_title: string;
  stance: string;
  quote: string;
};

export type Contradiction = {
  topic: string;
  explanation: string;
  severity: Severity;
  severity_score: number | null;
  verification_reason?: string;
  positions: ContradictionPosition[];
};

export type ComparisonResult = {
  contradictions: Contradiction[];
  article_count: number;
  candidate_count: number;
  confirmed_count: number;
};

export type ComparisonReport = {
  id: number;
  title: string;
  articles: { id: number; title: string }[];
  result: ComparisonResult;
  created_at: string;
};

export type ComparisonListItem = {
  id: number;
  title: string;
  article_count: number;
  contradiction_count: number;
  created_at: string;
};
