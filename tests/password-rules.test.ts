import { test } from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_POLICY, parsePolicy, scorePassword } from "../lib/auth/password-rules.ts";

test("default rules: 8+ with letters and a number, or a 12+ phrase", () => {
  assert.equal(scorePassword("tiger2026", "a@b.io").ok, true);
  assert.equal(scorePassword("tigerlily", "a@b.io").ok, false); // no number, under 12
  assert.equal(scorePassword("blue tiger lily", "a@b.io").ok, true); // phrase
  assert.equal(scorePassword("tig2", "a@b.io").ok, false); // too short
  assert.equal(scorePassword("password99", "a@b.io").ok, false); // common
  assert.equal(scorePassword("jdoe2026x", "jdoe@uni.edu").ok, false); // has the email name
});

test("stricter rules from admin", () => {
  const p = parsePolicy({ pw_min_length: 12, pw_mix: "three_kinds", pw_phrase_length: 16, pw_check_leaks: false });
  assert.deepEqual(p, { minLength: 12, mix: "three_kinds", phraseLength: 16, checkLeaks: false });
  assert.equal(scorePassword("tiger2026abc", "a@b.io", undefined, p).ok, false);
  assert.equal(scorePassword("Tiger2026abc", "a@b.io", undefined, p).ok, true);
  assert.equal(scorePassword("a long quiet phrase", "a@b.io", undefined, p).ok, true);
});

test("looser rules and bad values", () => {
  const p = parsePolicy({ pw_min_length: 6, pw_mix: "none", pw_phrase_length: 0 });
  assert.equal(scorePassword("tigers", "a@b.io", undefined, p).ok, true);
  assert.deepEqual(parsePolicy({ pw_min_length: 2, pw_mix: "x", pw_phrase_length: 500 }), DEFAULT_POLICY);
  assert.equal(parsePolicy({ pw_min_length: 14, pw_phrase_length: 12 }).phraseLength, 0); // a phrase shorter than the minimum means nothing
});
