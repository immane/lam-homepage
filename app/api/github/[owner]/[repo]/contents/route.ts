import { NextRequest, NextResponse } from "next/server";

const MAX_PREVIEW_SIZE = 1_000_000;
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

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ owner: string; repo: string }> }
) {
  const { owner, repo } = await params;
  const path = request.nextUrl.searchParams.get("path") || "";

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
    { headers: githubHeaders(), next: { revalidate: 300 } }
  );

  if (!response.ok) {
    return NextResponse.json({ error: "GitHub content is unavailable" }, { status: response.status });
  }

  const content: GitHubContent | GitHubContent[] = await response.json();

  if (Array.isArray(content)) {
    return NextResponse.json({
      kind: "directory",
      path,
      entries: content.map(toEntry).sort((a, b) => {
        if (a.type !== b.type) return a.type === "dir" ? -1 : 1;
        return a.name.localeCompare(b.name);
      }),
    });
  }

  let text: string | null = null;
  if (content.type === "file" && content.encoding === "base64" && content.content && content.size <= MAX_PREVIEW_SIZE) {
    const decoded = Buffer.from(content.content, "base64");
    text = decoded.includes(0) ? null : decoded.toString("utf8");
  }

  return NextResponse.json({
    kind: "file",
    entry: toEntry(content),
    content: text,
    canPreview: text !== null,
  });
}
