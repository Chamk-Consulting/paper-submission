import { test } from "node:test";
import assert from "node:assert/strict";
import { detectIdentifier } from "../lib/auth/identifier.ts";

test("a PIN is recognised", () => {
  for (const v of ["1024", "PIN 1024", "pin:1059", "#1000"]) assert.equal(detectIdentifier(v).kind, "id", v);
  assert.equal(detectIdentifier("1024").chip, "PIN 1024 ✓");
});

test("emails and phones are not PINs", () => {
  assert.equal(detectIdentifier("a@b.org").kind, "email");
  assert.equal(detectIdentifier("+21612345678").kind, "phone");
  assert.equal(detectIdentifier("0612345678").kind, "phone");
  assert.notEqual(detectIdentifier("0999").kind, "id");
});
