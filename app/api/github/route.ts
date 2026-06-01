import { NextResponse } from "next/server";

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

// GraphQL query to get pinned repositories
const PINNED_REPOS_QUERY = `
query($username: String!) {
  user(login: $username) {
    pinnedItems(first: 6, types: REPOSITORY) {
      nodes {
        ... on Repository {
          name
        }
      }
    }
  }
}
`;

async function fetchPinnedRepos(username: string): Promise<string[]> {
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

    if (!response.ok) {
      return [];
    }

    const data = await response.json();
    const pinnedNodes = data?.data?.user?.pinnedItems?.nodes || [];
    return pinnedNodes.map((node: { name: string }) => node.name);
  } catch {
    return [];
  }
}

export async function GET() {
  try {
    const username = "immane";

    // Fetch user info, repos, and pinned repos in parallel
    const [userRes, reposRes, pinnedRepoNames] = await Promise.all([
      fetch(`https://api.github.com/users/${username}`, {
        headers: {
          Accept: "application/vnd.github.v3+json",
          "User-Agent": "Portfolio-App",
        },
        next: { revalidate: 3600 },
      }),
      fetch(
        `https://api.github.com/users/${username}/repos?sort=updated&per_page=100`,
        {
          headers: {
            Accept: "application/vnd.github.v3+json",
            "User-Agent": "Portfolio-App",
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

    // Create a Set of pinned repo names for quick lookup
    const pinnedSet = new Set(pinnedRepoNames);

    // Separate pinned and non-pinned repos
    const pinnedRepos = filteredRepos.filter((repo) => pinnedSet.has(repo.name));
    const nonPinnedRepos = filteredRepos.filter((repo) => !pinnedSet.has(repo.name));

    // Sort pinned repos by the order they appear in pinnedRepoNames
    pinnedRepos.sort((a, b) => {
      return pinnedRepoNames.indexOf(a.name) - pinnedRepoNames.indexOf(b.name);
    });

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
    });
  } catch (error) {
    console.error("GitHub API error:", error);
    return NextResponse.json(
      { error: "Failed to fetch GitHub data" },
      { status: 500 }
    );
  }
}
