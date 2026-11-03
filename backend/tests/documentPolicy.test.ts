import { describe, it, expect } from "vitest";
import { CLIENT_UPLOAD_POLICY, OWNER_DELETABLE } from "../src/config/documentPolicy";

describe("document policy", () => {
  it("only lets clients upload USER_DOCUMENT (receipts and leases are server-generated)", () => {
    expect(Object.keys(CLIENT_UPLOAD_POLICY)).toEqual(["USER_DOCUMENT"]);
    expect(CLIENT_UPLOAD_POLICY.RECEIPT).toBeUndefined();
    expect(CLIENT_UPLOAD_POLICY.LEASE_DOCUMENT).toBeUndefined();
  });

  it("only lets owners delete USER_DOCUMENT", () => {
    expect(OWNER_DELETABLE).toEqual(["USER_DOCUMENT"]);
  });
});
