import test from "ava";
import { createForwardedPrefixMessage, extractPrefixedCommand, INTERNAL_COMMAND_PREFIX, registerPrefixCommandDispatcher } from "./PrefixCommandDispatcher.js";

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

test("does not treat a bare exclamation mark as a public command prefix", (t) => {
  t.is(extractPrefixedCommand("!mute <@123> 15m test"), null);
  t.is(extractPrefixedCommand("!warn <@123> reason"), null);
});

test("recognizes the prefix with no command", (t) => {
  t.is(extractPrefixedCommand("!o"), "");
});

test("forwards rewritten commands as an own content property without mutating the Discord message", (t) => {
  const originalContent = "!o ban @member reason";
  const original = Object.defineProperty({}, "content", {
    configurable: true,
    enumerable: true,
    get: () => originalContent,
  }) as any;
  const forwarded = createForwardedPrefixMessage(original as any, "!ban @member reason");

  t.is(forwarded.content, "!ban @member reason");
  t.is(original.content, originalContent);
  t.is(Object.getPrototypeOf(forwarded), original);
  t.true(Object.prototype.hasOwnProperty.call(forwarded, "content"));
  t.true(Object.getOwnPropertyDescriptor(forwarded, "content")?.writable);
});


test("registers one public !o handler and forwards ordinary commands to Vety", async (t) => {
  let messageHandler: ((message: any) => Promise<void>) | undefined;
  let forwarded: any;
  const fakeClient = {
    user: null,
    on(event: string, handler: (message: any) => Promise<void>) {
      if (event === "messageCreate") messageHandler = handler;
      return this;
    },
  };
  const fakeVety = {
    async dispatchMessageCommands(message: any) {
      forwarded = message;
    },
  };
  const fakeAllowedGuilds = {
    async isAllowed() {
      return true;
    },
  };

  registerPrefixCommandDispatcher(
    fakeClient as any,
    fakeVety as any,
    fakeAllowedGuilds as any,
    () => "!o ",
  );

  t.is(typeof messageHandler, "function");
  const original = {
    guildId: "guild-1",
    guild: {},
    content: "!o help",
    author: { id: "user-1", bot: false },
    mentions: { users: { has: () => false } },
    async reply() {},
  };
  await messageHandler!(original);

  t.is(forwarded.content, INTERNAL_COMMAND_PREFIX + "help");
  t.is(original.content, "!o help");
  t.is(Object.getPrototypeOf(forwarded), original);
});

test("routes the exact warn test command to Vety with its arguments intact", async (t) => {
  let messageHandler: ((message: any) => Promise<void>) | undefined;
  let forwarded: any;
  const fakeClient = {
    user: null,
    on(event: string, handler: (message: any) => Promise<void>) {
      if (event === "messageCreate") messageHandler = handler;
      return this;
    },
  };
  const fakeVety = {
    async dispatchMessageCommands(message: any) {
      forwarded = message;
    },
  };
  const fakeAllowedGuilds = {
    async isAllowed() {
      return true;
    },
  };

  registerPrefixCommandDispatcher(fakeClient as any, fakeVety as any, fakeAllowedGuilds as any, () => "!o ");

  const original = {
    guildId: "guild-1",
    guild: {},
    content: "!o warn <@1528924568020844655> test",
    author: { id: "user-1", bot: false },
    mentions: { users: { has: () => false } },
    async reply() {},
  };
  await messageHandler!(original);

  t.is(forwarded.content, INTERNAL_COMMAND_PREFIX + "warn <@1528924568020844655> test");
  t.is(original.content, "!o warn <@1528924568020844655> test");
});

test("routes the exact mute test command to Vety with its arguments intact", async (t) => {
  let messageHandler: ((message: any) => Promise<void>) | undefined;
  let forwarded: any;
  const fakeClient = {
    user: null,
    on(event: string, handler: (message: any) => Promise<void>) {
      if (event === "messageCreate") messageHandler = handler;
      return this;
    },
  };
  const fakeVety = {
    async dispatchMessageCommands(message: any) {
      forwarded = message;
    },
  };
  const fakeAllowedGuilds = {
    async isAllowed() {
      return true;
    },
  };

  registerPrefixCommandDispatcher(fakeClient as any, fakeVety as any, fakeAllowedGuilds as any, () => "!o ");

  const original = {
    guildId: "guild-1",
    guild: {},
    content: "!o mute <@1528924568020844655> 15m test",
    author: { id: "user-1", bot: false },
    mentions: { users: { has: () => false } },
    async reply() {},
  };
  await messageHandler!(original);

  t.is(forwarded.content, INTERNAL_COMMAND_PREFIX + "mute <@1528924568020844655> 15m test");
  t.is(original.content, "!o mute <@1528924568020844655> 15m test");
});

test("replies visibly when Vety throws while dispatching a public command", async (t) => {
  let messageHandler: ((message: any) => Promise<void>) | undefined;
  let replyContent = "";
  const fakeClient = {
    user: null,
    on(event: string, handler: (message: any) => Promise<void>) {
      if (event === "messageCreate") messageHandler = handler;
      return this;
    },
  };
  const fakeVety = {
    async dispatchMessageCommands() {
      throw new Error("test dispatch failure");
    },
  };
  const fakeAllowedGuilds = {
    async isAllowed() {
      return true;
    },
  };

  registerPrefixCommandDispatcher(fakeClient as any, fakeVety as any, fakeAllowedGuilds as any, () => "!o ");

  await messageHandler!({
    guildId: "guild-1",
    guild: {},
    content: "!o mute <@1528924568020844655> 15m test",
    author: { id: "user-1", bot: false },
    mentions: { users: { has: () => false } },
    async reply(payload: any) {
      replyContent = payload.content;
    },
  });

  t.true(replyContent.includes("internal error occurred"));
});

test("does not dispatch a bare ! command", async (t) => {
  let messageHandler: ((message: any) => Promise<void>) | undefined;
  let dispatchCount = 0;
  const fakeClient = {
    user: null,
    on(event: string, handler: (message: any) => Promise<void>) {
      if (event === "messageCreate") messageHandler = handler;
      return this;
    },
  };
  const fakeVety = {
    async dispatchMessageCommands() {
      dispatchCount += 1;
    },
  };
  const fakeAllowedGuilds = {
    async isAllowed() {
      return true;
    },
  };

  registerPrefixCommandDispatcher(fakeClient as any, fakeVety as any, fakeAllowedGuilds as any, () => "!o ");

  await messageHandler!({
    guildId: "guild-1",
    guild: {},
    content: "!mute <@1528924568020844655> 15m test",
    author: { id: "user-1", bot: false },
    mentions: { users: { has: () => false } },
    async reply() {},
  });

  t.is(dispatchCount, 0);
});

test("dispatches configured custom prefixes through the same Vety command pipeline", async (t) => {
  let messageHandler: ((message: any) => Promise<void>) | undefined;
  let forwarded: any;
  const fakeClient = {
    user: null,
    on(event: string, handler: (message: any) => Promise<void>) {
      if (event === "messageCreate") messageHandler = handler;
      return this;
    },
  };
  const fakeVety = {
    async dispatchMessageCommands(message: any) {
      forwarded = message;
    },
  };
  const fakeAllowedGuilds = {
    async isAllowed() {
      return true;
    },
  };

  registerPrefixCommandDispatcher(
    fakeClient as any,
    fakeVety as any,
    fakeAllowedGuilds as any,
    () => "? ",
  );

  await messageHandler!({
    guildId: "guild-1",
    guild: {},
    content: "? help",
    author: { id: "user-1", bot: false },
    mentions: { users: { has: () => false } },
    async reply() {},
  });

  t.is(forwarded.content, INTERNAL_COMMAND_PREFIX + "help");
});
