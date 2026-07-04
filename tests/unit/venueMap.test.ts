import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { venueMapUrl } from "@/server/domain/public/venueMap";

const KEY_ENV = "MAPS_STATIC_KEY";

describe("venueMapUrl", () => {
  const original = process.env[KEY_ENV];
  beforeEach(() => {
    delete process.env[KEY_ENV];
  });
  afterEach(() => {
    if (original === undefined) delete process.env[KEY_ENV];
    else process.env[KEY_ENV] = original;
  });

  it("returns a plain maps link when no key is configured", () => {
    const url = venueMapUrl({ name: "German House", address: "315 Gregory St", latitude: null, longitude: null });
    expect(url).toContain("google.com/maps");
    expect(url).not.toContain("staticmap");
    expect(url).toContain(encodeURIComponent("315 Gregory St"));
  });

  it("returns a static-image URL when a key is configured", () => {
    process.env[KEY_ENV] = "test-key";
    const url = venueMapUrl({ name: "German House", address: "315 Gregory St", latitude: null, longitude: null });
    expect(url).toContain("staticmap");
    expect(url).toContain("test-key");
  });

  it("prefers coordinates over address when present", () => {
    const url = venueMapUrl({ name: "X", address: "somewhere", latitude: 43.15, longitude: -77.6 });
    expect(url).toContain("43.15");
    expect(url).toContain("-77.6");
  });
});
