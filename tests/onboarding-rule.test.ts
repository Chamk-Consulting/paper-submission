import { test } from "node:test";
import assert from "node:assert/strict";
import { stepFor, PASSWORD_STEP_SINCE } from "../lib/auth/onboarding-rule.ts";

const after = new Date(PASSWORD_STEP_SINCE + 60_000).toISOString();
const before = new Date(PASSWORD_STEP_SINCE - 86_400_000).toISOString();
const done = { profile_completed_at: before };
const base = { confirmedAt: after, needsTwoStep: false, meta: {} as Record<string, unknown>, person: done };

test("unconfirmed → confirm", () => assert.equal(stepFor({ ...base, confirmedAt: null }), "confirm"));
test("two-step before everything else", () => assert.equal(stepFor({ ...base, needsTwoStep: true, person: null }), "two-step"));
test("new account without password → password", () => assert.equal(stepFor({ ...base, person: null }), "password"));
test("explicit onb=password wins over an old confirmation", () => assert.equal(stepFor({ ...base, confirmedAt: before, meta: { onb: "password" } }), "password"));
test("password set → profile", () => assert.equal(stepFor({ ...base, meta: { password_set_at: after }, person: { profile_completed_at: null } }), "profile"));
test("old account is never asked for a password", () => assert.equal(stepFor({ ...base, confirmedAt: before, person: { profile_completed_at: null } }), "profile"));
test("missing record → record", () => assert.equal(stepFor({ ...base, meta: { password_set_at: after }, person: null }), "record"));
test("everything finished → done", () => assert.equal(stepFor({ ...base, meta: { password_set_at: after } }), "done"));
test("old finished account → done", () => assert.equal(stepFor({ ...base, confirmedAt: before }), "done"));
test("a password saved by reset clears a stale onb=password", () => assert.equal(stepFor({ ...base, meta: { onb: "password", password_set_at: after } }), "done"));
