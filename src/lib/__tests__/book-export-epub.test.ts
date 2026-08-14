import { describe, it, expect } from "vitest";
import { contentOpf, coverExtension } from "../book-export-epub";
import { coverStoragePath, isAcceptedCoverMime } from "../project-cover";

const chapters = [{ title: "One", html: "<p>hi</p>" }];

const base = {
  projectTitle: "My Book",
  author: "Elena",
  language: "en",
  uuid: "abc",
  chapters,
};

describe("epub cover metadata", () => {
  it("emits both the legacy meta tag and the EPUB 3 manifest property", () => {
    const opf = contentOpf({ ...base, coverMime: "image/jpeg" });
    expect(opf).toContain('<meta name="cover" content="cover-image"/>');
    expect(opf).toContain(
      '<item id="cover-image" href="images/cover.jpg" media-type="image/jpeg" properties="cover-image"/>',
    );
    expect(opf).toContain('<itemref idref="cover" linear="no"/>');
  });

  it("uses the png extension for png covers", () => {
    expect(coverExtension("image/png")).toBe("png");
    expect(coverExtension("image/jpeg")).toBe("jpg");
    const opf = contentOpf({ ...base, coverMime: "image/png" });
    expect(opf).toContain('href="images/cover.png"');
  });

  it("omits all cover tags when no cover is set", () => {
    const opf = contentOpf({ ...base, coverMime: null });
    expect(opf).not.toContain('name="cover"');
    expect(opf).not.toContain("cover-image");
    expect(opf).not.toContain("cover.xhtml");
  });

  it("writes optional publication metadata", () => {
    const opf = contentOpf({
      ...base,
      coverMime: null,
      isbn: "9781234567897",
      description: "A blurb",
      subtitle: "Book One",
    });
    expect(opf).toContain("urn:isbn:9781234567897");
    expect(opf).toContain("<dc:description>A blurb</dc:description>");
    expect(opf).toContain("Book One");
  });
});

describe("cover storage rules", () => {
  it("keeps the project id as the root path segment", () => {
    const path = coverStoragePath("proj-1", "my cover!.jpg");
    expect(path.split("/")[0]).toBe("proj-1");
    expect(path).toContain("/cover/");
    expect(path).not.toMatch(/[!\s]/);
  });

  it("accepts only jpeg and png", () => {
    expect(isAcceptedCoverMime("image/jpeg")).toBe(true);
    expect(isAcceptedCoverMime("image/png")).toBe(true);
    expect(isAcceptedCoverMime("image/gif")).toBe(false);
  });
});
