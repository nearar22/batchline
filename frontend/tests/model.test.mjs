import test from "node:test";
import assert from "node:assert/strict";
import { actionsFor, clean, gateTone, short } from "../src/model.mjs";
test("SDK values are made display-safe", () => assert.deepEqual(clean(new Map([["revision", 2n]])), { revision: 2 }));
test("actions stay bound to lifecycle and role", () => {
  const item = { owner: "0xaaa", reviewer: "0xbbb", status: "EVIDENCE_PENDING" };
  assert.deepEqual(actionsFor(item, ""), ["freeze"]);
  assert.deepEqual(actionsFor({ ...item, status: "FROZEN" }, ""), ["inspect"]);
  assert.deepEqual(actionsFor({ ...item, status: "QUARANTINED" }, "0xAaA"), ["quarantine"]);
  assert.deepEqual(actionsFor({ ...item, status: "AWAITING_RELEASE" }, "0xBbB"), ["release"]);
  assert.deepEqual(actionsFor({ ...item, status: "RELEASED" }, "0xbbb"), []);
});
test("display helpers expose gate state", () => { assert.equal(gateTone("OPEN"), "open"); assert.equal(short("0x1234567890abcdef"), "0x1234…cdef"); });
