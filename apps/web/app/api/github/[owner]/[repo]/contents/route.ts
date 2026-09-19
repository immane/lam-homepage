import { NextRequest, NextResponse } from "next/server";

const MAX_PREVIEW_SIZE = 1_000_000;
const CONTENT_REVALIDATE_SECONDS = 900;
const CLIENT_CACHE_CONTROL = "private, max-age=60, stale-while-revalidate=300";
const repositorySegment = /^[a-zA-Z0-9_.-]+$/;

interface GitHubContent {
  name: string;
  path: string;
  type: "file" | "dir" | "symlink" | "submodule";
  size: number;
  content?: string;
  encoding?: string;
  download_url: string | null;
}

interface GitHubApiError {
  message?: string;
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

function isSafePath(path: string) {
  return path.split("/").every((segment) => segment && segment !== "." && segment !== "..");
}

function toEntry(content: GitHubContent) {
  return {
    name: content.name,
    path: content.path,
    type: content.type,
    size: content.size,
  };
}

function cachedJson(body: object) {
  return NextResponse.json(body, {
    headers: { "Cache-Control": CLIENT_CACHE_CONTROL },
  });
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ owner: string; repo: string }> }
) {
  const { owner, repo } = await params;
  const path = request.nextUrl.searchParams.get("path") || "";
  const raw = request.nextUrl.searchParams.get("raw") === "1";

  if (!repositorySegment.test(owner) || !repositorySegment.test(repo) || (path && !isSafePath(path))) {
    return NextResponse.json({ error: "Invalid repository path" }, { status: 400 });
  }

  const encodedPath = path
    .split("/")
    .filter(Boolean)
    .map(encodeURIComponent)
    .join("/");
  const response = await fetch(
    `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/contents/${encodedPath}`,
    { headers: githubHeaders(), next: { revalidate: CONTENT_REVALIDATE_SECONDS } }
  );

  if (!response.ok) {
    const error: GitHubApiError = await response.json().catch(() => ({}));
    if (response.status === 409 && !path) {
      return cachedJson({ kind: "directory", path, entries: [] });
    }
    if (response.status === 403 && error.message?.toLowerCase().includes("rate limit")) {
      return NextResponse.json(
        { error: "GitHub API rate limit reached. Configure GITHUB_TOKEN to continue browsing repositories." },
        { status: 429 }
      );
    }
    return NextResponse.json(
      { error: error.message || "GitHub content is unavailable" },
      { status: response.status }
    );
  }

  const content: GitHubContent | GitHubContent[] = await response.json();

  if (Array.isArray(content)) {
    return cachedJson({
      kind: "directory",
      path,
      entries: content.map(toEntry).sort((a, b) => {
        if (a.type !== b.type) return a.type === "dir" ? -1 : 1;
        return a.name.localeCompare(b.name);
      }),
    });
  }

  if (raw && content.download_url) {
    return NextResponse.redirect(content.download_url, {
      headers: { "Cache-Control": CLIENT_CACHE_CONTROL },
    });
  }

  let text: string | null = null;
  if (content.type === "file" && content.encoding === "base64" && content.content && content.size <= MAX_PREVIEW_SIZE) {
    const decoded = Buffer.from(content.content, "base64");
    text = decoded.includes(0) ? null : decoded.toString("utf8");
  }

  return cachedJson({
    kind: "file",
    entry: toEntry(content),
    downloadUrl: content.download_url,
    content: text,
    canPreview: text !== null,
  });
}
