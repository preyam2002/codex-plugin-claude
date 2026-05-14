import test from "node:test";
import assert from "node:assert/strict";

import { parseArgs, splitRawArgumentString } from "../plugins/claude/scripts/lib/args.mjs";

test("parseArgs splits booleans and values", () => {
  const { options, positionals } = parseArgs(["--background", "--model", "claude-haiku-4-5", "fix", "the", "tests"], {
    valueOptions: ["model"],
    booleanOptions: ["background"]
  });
  assert.equal(options.background, true);
  assert.equal(options.model, "claude-haiku-4-5");
  assert.deepEqual(positionals, ["fix", "the", "tests"]);
});

test("parseArgs honours alias map and -- passthrough", () => {
  const { options, positionals } = parseArgs(["-m", "alias", "--", "--literal", "tail"], {
    valueOptions: ["model"],
    aliasMap: { m: "model" }
  });
  assert.equal(options.model, "alias");
  assert.deepEqual(positionals, ["--literal", "tail"]);
});

test("parseArgs throws when a value option lacks a value", () => {
  assert.throws(
    () => parseArgs(["--model"], { valueOptions: ["model"] }),
    /Missing value for --model/
  );
});

test("splitRawArgumentString handles quoted segments and escapes", () => {
  assert.deepEqual(
    splitRawArgumentString(`--model "claude haiku" 'do thing' raw\\ token`),
    ["--model", "claude haiku", "do thing", "raw token"]
  );
});
