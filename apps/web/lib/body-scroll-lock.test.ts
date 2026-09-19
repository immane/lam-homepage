import { beforeEach, describe, expect, it } from "vitest";
import { acquireBodyLock, releaseBodyLock } from "./body-scroll-lock";

beforeEach(() => {
  document.body.style.overflow = "";
  document.body.style.paddingRight = "";
});

describe("body-scroll-lock", () => {
  it("acquire 后 overflow 为 hidden，且 jsdom 下 paddingRight 保持空（delta 恒为 0）", () => {
    acquireBodyLock("t-acquire");
    expect(document.body.style.overflow).toBe("hidden");
    // jsdom 里 document.documentElement.clientWidth 恒为 0，delta 恒为 0，不写 paddingRight
    expect(document.body.style.paddingRight).toBe("");
    releaseBodyLock("t-acquire");
  });

  it("所有 holder 都 release 后 overflow 恢复为空字符串", () => {
    acquireBodyLock("t-restore");
    expect(document.body.style.overflow).toBe("hidden");
    releaseBodyLock("t-restore");
    expect(document.body.style.overflow).toBe("");
    expect(document.body.style.paddingRight).toBe("");
  });

  it("两个不同 key：只 release 一个锁仍在，全 release 才解", () => {
    acquireBodyLock("t-ref-a");
    acquireBodyLock("t-ref-b");
    releaseBodyLock("t-ref-a");
    expect(document.body.style.overflow).toBe("hidden");
    releaseBodyLock("t-ref-b");
    expect(document.body.style.overflow).toBe("");
  });

  it("同一 key acquire 两次再 release 一次即清空（Set 去重语义）", () => {
    acquireBodyLock("t-dedup");
    acquireBodyLock("t-dedup");
    releaseBodyLock("t-dedup");
    expect(document.body.style.overflow).toBe("");
  });

  it("release 不存在的 key 不抛错、不影响已有锁", () => {
    acquireBodyLock("t-unknown-holder");
    expect(() => releaseBodyLock("t-unknown-missing")).not.toThrow();
    expect(document.body.style.overflow).toBe("hidden");
    releaseBodyLock("t-unknown-holder");
    expect(document.body.style.overflow).toBe("");
  });
});
