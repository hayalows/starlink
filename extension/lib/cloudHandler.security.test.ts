import { beforeEach, describe, expect, it, vi } from "vitest";

const storage = vi.hoisted(() => ({
  get: vi.fn(),
  set: vi.fn(),
}));
vi.mock("wxt/browser", () => ({
  browser: {
    storage: { local: storage },
  },
}));

const { migrateLegacySession } = await import("./cloudHandler");

describe("legacy Starlink session migration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("replaces a saved cookie header with a non-secret connection marker", async () => {
    storage.get.mockResolvedValueOnce({ cloudSession: "Starlink.Com.Sso=old-secret" });

    await migrateLegacySession();

    expect(storage.set).toHaveBeenCalledWith({ cloudSession: true });
  });

  it("does not rewrite an already-migrated marker", async () => {
    storage.get.mockResolvedValueOnce({ cloudSession: true });

    await migrateLegacySession();

    expect(storage.set).not.toHaveBeenCalled();
  });

  it("does not treat an empty legacy value as a connected account", async () => {
    storage.get.mockResolvedValueOnce({ cloudSession: "" });

    await migrateLegacySession();

    expect(storage.set).toHaveBeenCalledWith({ cloudSession: false });
  });
});
