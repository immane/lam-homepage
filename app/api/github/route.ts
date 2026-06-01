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

export async function GET() {
  try {
    const username = "immane";

    // Fetch user info and repos in parallel
    const [userRes, reposRes] = await Promise.all([
      fetch(`https://api.github.com/users/${username}`, {
        headers: {
          Accept: "application/vnd.github.v3+json",
          "User-Agent": "Portfolio-App",
        },
        next: { revalidate: 3600 }, // Cache for 1 hour
      }),
      fetch(
        `https://api.github.com/users/${username}/repos?sort=updated&per_page=30`,
        {
          headers: {
            Accept: "application/vnd.github.v3+json",
            "User-Agent": "Portfolio-App",
          },
          next: { revalidate: 3600 },
        }
      ),
    ]);

    if (!userRes.ok || !reposRes.ok) {
      throw new Error("Failed to fetch GitHub data");
    }

    const user: GitHubUser = await userRes.json();
    const allRepos: GitHubRepo[] = await reposRes.json();

    // Filter out forks and sort by stars, then by recent update
    const repos = allRepos
      .filter((repo) => !repo.fork)
      .sort((a, b) => {
        // First by stars
        if (b.stargazers_count !== a.stargazers_count) {
          return b.stargazers_count - a.stargazers_count;
        }
        // Then by update date
        return (
          new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
        );
      })
      .slice(0, 6);

    // Calculate stats
    const languages = new Set(allRepos.map((r) => r.language).filter(Boolean));
    const totalStars = allRepos.reduce((sum, r) => sum + r.stargazers_count, 0);
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
      repos: repos.map((repo) => ({
        name: repo.name,
        description: repo.description,
        language: repo.language,
        stars: repo.stargazers_count,
        url: repo.html_url,
        topics: repo.topics,
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
