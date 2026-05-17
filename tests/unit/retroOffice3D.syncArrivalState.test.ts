import { describe, expect, it } from "vitest";

describe("RetroOffice3D syncArrivalState guards", () => {
  it("setPhoneBoothDoorOpen guard prevents no-op updates", () => {
    const guard = (current: boolean) => (current ? false : current);

    expect(guard(false)).toBe(false);
    expect(guard(true)).toBe(false);
  });

  it("setSmsBoothDoorOpen guard prevents no-op updates", () => {
    const guard = (current: boolean) => (current ? false : current);

    expect(guard(false)).toBe(false);
    expect(guard(true)).toBe(false);
  });

  it("arrival state guard only updates when value changes", () => {
    const guard = (current: boolean, next: boolean) =>
      current === next ? current : next;

    expect(guard(false, false)).toBe(false);
    expect(guard(true, true)).toBe(true);
    expect(guard(false, true)).toBe(true);
    expect(guard(true, false)).toBe(false);
  });
});
