import { NextResponse } from "next/server";

const CLIENT_CACHE_CONTROL = "private, max-age=60, stale-while-revalidate=300";

export interface GitHubRepo {
  name: string;
  description: string | null;
  language: string | null;
  stargazers_count: number;
  html_url: string;
  fork: boolean;
  updated_at: string;
  topics: string[];
}

export interface GitHubUser {
  login: string;
  name: string | null;
  avatar_url: string;
  bio: string | null;
  company: string | null;
  blog: string | null;
  location: string | null;
  public_repos: number;
  followers: number;
  following: number;
  created_at: string;
}

interface PinnedRepoRef {
  owner: string;
  name: string;
}

function githubHeaders() {
  return {
    Accept: "application/vnd.github+json",
    "User-Agent": "Portfolio-App",
    ...(process.env.GITHUB_TOKEN
      ? { Authorization: `Bearer ${process.env.GITHUB_TOKEN}` }
      : {}),
  };
}

// GraphQL query to get pinned repositories
const PINNED_REPOS_QUERY = `
query($username: String!) {
  user(login: $username) {
    pinnedItems(first: 6, types: REPOSITORY) {
      nodes {
        ... on Repository {
          name
          owner {
            login
          }
        }
      }
    }
  }
}
`;

// Fetch pinned repos via HTML scraping (no token required)
async function fetchPinnedReposFromHTML(username: string): Promise<PinnedRepoRef[]> {
  try {
    const response = await fetch(`https://github.com/${username}`, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; Portfolio-App/1.0)",
        Accept: "text/html",
      },
      next: { revalidate: 3600 },
    });

    if (!response.ok) return [];

    const html = await response.text();

    // Match pinned repository owner/name from the HTML
    // GitHub uses data-hovercard-url for pinned repos
    const pinnedPattern = /class="[^"]*pinned-item-list-item[^"]*"[\s\S]*?href="\/([^/"]+)\/([^/"]+)"/g;
    const matches: PinnedRepoRef[] = [];
    let match;

    while ((match = pinnedPattern.exec(html)) !== null) {
      const owner = match[1].trim();
      const name = match[2].trim();
      if (
        owner &&
        name &&
        !matches.some((r) => r.owner === owner && r.name === name)
      ) {
        matches.push({ owner, name });
      }
    }

    // Fallback: try another pattern
    if (matches.length === 0) {
      const altPattern = /itemprop="name codeRepository"[^>]*>([^<]+)</g;
      while ((match = altPattern.exec(html)) !== null) {
        const repoName = match[1].trim();
        if (repoName && !matches.some((r) => r.name === repoName)) {
          matches.push({ owner: username, name: repoName });
        }
      }
    }

    return matches;
  } catch {
    return [];
  }
}

async function fetchPinnedRepos(username: string): Promise<PinnedRepoRef[]> {
  // Try GraphQL first if token is available
  if (process.env.GITHUB_TOKEN) {
    try {
      const response = await fetch("https://api.github.com/graphql", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
          "User-Agent": "Portfolio-App",
        },
        body: JSON.stringify({
          query: PINNED_REPOS_QUERY,
          variables: { username },
        }),
        next: { revalidate: 3600 },
      });

      if (response.ok) {
        const data = await response.json();
        const pinnedNodes = data?.data?.user?.pinnedItems?.nodes || [];
        if (pinnedNodes.length > 0) {
          return pinnedNodes.map((node: { name: string; owner: { login: string } }) => ({
            owner: node.owner?.login || username,
            name: node.name,
          }));
        }
      }
    } catch {
      // Fall through to HTML scraping
    }
  }

  // Fallback to HTML scraping
  return fetchPinnedReposFromHTML(username);
}

// Fetch a single repo (used for pinned repos not owned by the user)
async function fetchRepo(
  owner: string,
  name: string
): Promise<GitHubRepo | null> {
  try {
    const response = await fetch(
      `https://api.github.com/repos/${owner}/${name}`,
      {
        headers: {
          ...githubHeaders(),
        },
        next: { revalidate: 3600 },
      }
    );

    if (!response.ok) return null;

    const repo: GitHubRepo = await response.json();
    return repo;
  } catch {
    return null;
  }
}

export async function GET() {
  try {
    const username = "immane";

    // Fetch user info, repos, and pinned repos in parallel
    const [userRes, reposRes, pinnedRepoNames] = await Promise.all([
      fetch(`https://api.github.com/users/${username}`, {
        headers: {
          ...githubHeaders(),
        },
        next: { revalidate: 3600 },
      }),
      fetch(
        `https://api.github.com/users/${username}/repos?sort=updated&per_page=100`,
        {
          headers: {
            ...githubHeaders(),
          },
          next: { revalidate: 3600 },
        }
      ),
      fetchPinnedRepos(username),
    ]);

    if (!userRes.ok || !reposRes.ok) {
      throw new Error("Failed to fetch GitHub data");
    }

    const user: GitHubUser = await userRes.json();
    const allRepos: GitHubRepo[] = await reposRes.json();

    // Filter out forks
    const filteredRepos = allRepos.filter((repo) => !repo.fork);

    // Build a lookup of repos owned by the user
    const ownedByName = new Map<string, GitHubRepo>(
      filteredRepos.map((repo) => [repo.name, repo])
    );

    // Resolve pinned repos in their pinned order.
    // Pinned repos can live under other organizations, so fetch those individually.
    const pinnedRepos: GitHubRepo[] = [];
    for (const pinned of pinnedRepoNames) {
      // Repos owned by the user are already in the repos list
      const owned =
        pinned.owner === username
          ? ownedByName.get(pinned.name)
          : undefined;
      if (owned) {
        pinnedRepos.push(owned);
        continue;
      }
      const orgRepo = await fetchRepo(pinned.owner, pinned.name);
      if (orgRepo && !orgRepo.fork) {
        pinnedRepos.push(orgRepo);
      }
    }

    const pinnedSet = new Set(pinnedRepos.map((repo) => repo.name));

    // Non-pinned repos are those owned by the user that are not pinned
    const nonPinnedRepos = filteredRepos.filter((repo) => !pinnedSet.has(repo.name));

    // Sort non-pinned repos by stars, then by recent update
    nonPinnedRepos.sort((a, b) => {
      if (b.stargazers_count !== a.stargazers_count) {
        return b.stargazers_count - a.stargazers_count;
      }
      return (
        new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
      );
    });

    // Combine: pinned first, then non-pinned
    const sortedRepos = [...pinnedRepos, ...nonPinnedRepos];

    // Calculate stats
    const languages = new Set(filteredRepos.map((r) => r.language).filter(Boolean));
    const totalStars = filteredRepos.reduce((sum, r) => sum + r.stargazers_count, 0);
    const createdYear = new Date(user.created_at).getFullYear();

    return NextResponse.json({
      user: {
        login: user.login,
        name: user.name,
        avatar_url: user.avatar_url,
        bio: user.bio,
        company: user.company,
        blog: user.blog,
        location: user.location,
        public_repos: user.public_repos,
        followers: user.followers,
        following: user.following,
      },
      repos: sortedRepos.map((repo) => ({
        name: repo.name,
        description: repo.description,
        language: repo.language,
        stars: repo.stargazers_count,
        url: repo.html_url,
        topics: repo.topics,
        isPinned: pinnedSet.has(repo.name),
      })),
      stats: {
        totalRepos: user.public_repos,
        totalStars,
        languages: languages.size,
        createdYear,
        followers: user.followers,
      },
    }, {
      headers: { "Cache-Control": CLIENT_CACHE_CONTROL },
    });
  } catch (error) {
    console.error("GitHub API error:", error);
    return NextResponse.json(
      { error: "Failed to fetch GitHub data" },
      { status: 500 }
    );
  }
}
