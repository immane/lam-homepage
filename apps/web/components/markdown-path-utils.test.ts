import { describe, expect, it } from "vitest";
import {
  decodeSegment,
  githubRepositoryPath,
  isExternalUrl,
  resolveRepositoryPath,
} from "./markdown-preview";

describe("isExternalUrl", () => {
  it("http/https、协议相对 //、data:、blob:、mailto: 判 true", () => {
    expect(isExternalUrl("http://example.com/a.png")).toBe(true);
    expect(isExternalUrl("https://github.com/o/r")).toBe(true);
    expect(isExternalUrl("//cdn.example.com/a.png")).toBe(true);
    expect(isExternalUrl("data:image/png;base64,xxx")).toBe(true);
    expect(isExternalUrl("blob:https://example.com/uuid")).toBe(true);
    expect(isExternalUrl("mailto:foo@bar.com")).toBe(true);
  });

  it("相对路径、根路径、hash、空串判 false", () => {
    expect(isExternalUrl("./x")).toBe(false);
    expect(isExternalUrl("../x")).toBe(false);
    expect(isExternalUrl("/x")).toBe(false);
    expect(isExternalUrl("#frag")).toBe(false);
    expect(isExternalUrl("")).toBe(false);
  });
});

describe("decodeSegment", () => {
  it("正常解码 %XX 序列", () => {
    expect(decodeSegment("hello%20world")).toBe("hello world");
    expect(decodeSegment("%E4%B8%AD%E6%96%87")).toBe("中文");
  });

  it("畸形编码原样返回不抛错", () => {
    expect(decodeSegment("%E4%")).toBe("%E4%");
  });
});

describe("resolveRepositoryPath", () => {
  it("相对路径基于 currentPath 目录解析", () => {
    expect(resolveRepositoryPath("./image.png", "docs/README.md")).toBe("docs/image.png");
    expect(resolveRepositoryPath("image.png", "docs/README.md")).toBe("docs/image.png");
    expect(resolveRepositoryPath("../x", "docs/sub/README.md")).toBe("docs/x");
  });

  it("处理 ./.. 并可回到仓库根", () => {
    expect(resolveRepositoryPath("./a/./b.png", "docs/README.md")).toBe("docs/a/b.png");
    expect(resolveRepositoryPath("../../a.png", "docs/sub/README.md")).toBe("a.png");
  });

  it("/ 开头视为 repo 根", () => {
    expect(resolveRepositoryPath("/assets/a.png", "docs/README.md")).toBe("assets/a.png");
  });

  it("剥离 ?/# 后缀并解码 %XX，畸形编码不抛错", () => {
    expect(resolveRepositoryPath("docs/a.png?raw=1", "README.md")).toBe("docs/a.png");
    expect(resolveRepositoryPath("docs/a.png#frag", "README.md")).toBe("docs/a.png");
    expect(resolveRepositoryPath("%E4%B8%AD%E6%96%87.png", "docs/README.md")).toBe(
      "docs/中文.png"
    );
    expect(() => resolveRepositoryPath("a/%E4%.png", "README.md")).not.toThrow();
    expect(resolveRepositoryPath("a/%E4%.png", "README.md")).toBe("a/%E4%.png");
  });
});

describe("githubRepositoryPath", () => {
  it("同仓库 blob/raw/tree 视图返回仓库内路径", () => {
    expect(githubRepositoryPath("https://github.com/o/r/blob/main/docs/a.png", "o", "r")).toBe(
      "docs/a.png"
    );
    expect(githubRepositoryPath("https://github.com/o/r/raw/main/docs/a.png", "o", "r")).toBe(
      "docs/a.png"
    );
    expect(githubRepositoryPath("https://github.com/o/r/tree/main/docs", "o", "r")).toBe("docs");
  });

  it("不同仓库返回 null", () => {
    expect(
      githubRepositoryPath("https://github.com/other/r/blob/main/docs/a.png", "o", "r")
    ).toBeNull();
    expect(
      githubRepositoryPath("https://github.com/o/other/blob/main/docs/a.png", "o", "r")
    ).toBeNull();
  });

  it("非 github 域名返回 null", () => {
    expect(
      githubRepositoryPath("https://example.com/o/r/blob/main/docs/a.png", "o", "r")
    ).toBeNull();
  });

  it("非外部 URL 返回 null", () => {
    expect(githubRepositoryPath("docs/a.png", "o", "r")).toBeNull();
  });
});
