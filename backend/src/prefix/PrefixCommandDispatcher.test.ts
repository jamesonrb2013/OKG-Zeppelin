import test from "ava";
import { extractPrefixedCommand, isOkgPlatformOwner } from "./PrefixCommandDispatcher.js";

test("parses the default !o prefix", (t) => {
  t.is(extractPrefixedCommand("!o ban @member spam"), "ban @member spam");
});

test("prefix matching is case-insensitive and accepts repeated whitespace", (t) => {
  t.is(extractPrefixedCommand("!O    PING"), "PING");
});

test("parses keep alive as a normal multi-word command", (t) => {
  t.is(extractPrefixedCommand("!o keep alive"), "keep alive");
});

test("supports a configured per-guild prefix as well as !o", (t) => {
  t.is(extractPrefixedCommand("?   ban @member", "? "), "ban @member");
  t.is(extractPrefixedCommand("?ban @member", "?"), "ban @member");
  t.is(extractPrefixedCommand("!o ban @member", "? "), "ban @member");
});

test("does not match a longer word beginning with the prefix", (t) => {
  t.is(extractPrefixedCommand("!other ban"), null);
});

test("recognizes the prefix with no command", (t) => {
  t.is(extractPrefixedCommand("!o"), "");
});

test("recognizes the actual OKG platform owner for moderation authorization", (t) => {
  t.true(isOkgPlatformOwner("1441223435043868735"));
  t.false(isOkgPlatformOwner("1540731259544666132"));
  t.false(isOkgPlatformOwner("123456789012345678"));
});
