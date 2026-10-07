import { describe, expect, it } from "vitest";
import { SUPPORT_LINKS } from "./supportLinks";

// The expected values are written out in full rather than built from REPO the
// way the source builds them. Sharing that constant would make this pass no
// matter what REPO became — precisely the substitution worth catching. Spelled
// out, changing any link takes a second deliberate edit here.
//
// `toEqual` on the whole object rather than key by key, so a row that appears or
// disappears fails too.
describe("support menu links", () => {
  it("point where they are meant to", () => {
    expect(SUPPORT_LINKS).toEqual({
      starRepo: "https://github.com/hayalows/starlink",
      githubSponsors: "https://github.com/sponsors/daveyhert",
      buyMeACoffee: "https://buymeacoffee.com/daveyhert",
      patreon: "https://www.patreon.com/DaveyHert",
      latestRelease: "https://github.com/hayalows/starlink/releases/latest",
      reportIssue: "https://github.com/hayalows/starlink/issues/new?labels=bug",
      requestFeature: "https://github.com/hayalows/starlink/issues/new?labels=enhancement",
      contact: "mailto:hello@dishylink.com",
      x: "https://x.com/daveyhert",
      linkedin: "http://linkedin.com/in/daveyhert/",
      privacyPolicy: "https://github.com/hayalows/starlink/blob/master/PRIVACY.md",
      disclaimer: "https://github.com/hayalows/starlink/blob/master/DISCLAIMER.md",
    });
  });
});
