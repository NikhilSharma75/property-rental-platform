import { describe, it, expect } from "vitest";
import { errorMessage } from "../src/lib/errors";

describe("errorMessage", () => {
  it("uses the message of an Error", () => expect(errorMessage(new Error("nope"), "fallback")).toBe("nope"));
  it("accepts a thrown string", () => expect(errorMessage("bad", "fallback")).toBe("bad"));
  it("falls back for anything else", () => {
    expect(errorMessage(undefined, "fallback")).toBe("fallback");
    expect(errorMessage({ message: 1 }, "fallback")).toBe("fallback");
    expect(errorMessage(new Error(""), "fallback")).toBe("fallback");
  });
});
