# OKG-Zeppelin 1.3.10 — Overrides and server exceptions

This guide covers the supported per-plugin override system and the new Automod exception lists. Configure these in each guild's plugin configuration through the dashboard or your existing YAML configuration workflow.

## 1. Automod immunity and ignored locations

These settings belong inside `plugins.automod.config`. IDs must be Discord snowflakes written as strings.

```yaml
plugins:
  automod:
    enabled: true
    config:
      # Members with any listed role are exempt from every automod rule.
      immune_roles:
        - "123456789012345678"
      # Optional user-specific exemptions.
      immune_users: []
      # Ignore messages/events originating in these channels/categories.
      ignored_channels:
        - "123456789012345678"
      ignored_categories: []
      rules: {}
```

`immune_roles` uses an ANY-match: a member is immune if they hold at least one listed role. It does not grant staff command permissions and does not bypass Discord permissions. `immune_users`, `ignored_channels`, and `ignored_categories` are separate opt-in lists. Thread messages are checked against their parent channel. Empty lists preserve existing behavior.

**Safety note:** Immunity applies to all Automod rules, so only exempt trusted roles. Keep command permissions configured separately with `role_permissions`.

## 2. Per-plugin configuration overrides

Zeppelin's existing `overrides` mechanism is nested under an individual plugin alongside `config`. Use it when settings should differ by channel, category, user, role/permission level, or other supported criteria. Overrides tailor that plugin's config without changing the server-wide defaults.

Example: disable one automod rule for a staff permission level while leaving other rules enabled:

```yaml
plugins:
  automod:
    config:
      rules:
        link_filter:
          enabled: true
          triggers:
            - match_links:
                links: ["example.com"]
          actions:
            clean: true
    overrides:
      - level: ">=50"
        config:
          rules:
            link_filter:
              enabled: false
```

Use only override criteria supported by the dashboard's config editor/schema; arbitrary keys are not automatically valid criteria. Keep the base config safe when no override matches.

## 3. Staff/log channels

Log destinations are configured by the Logs plugin's `channels` map, keyed by destination channel ID. Each destination supports included/excluded event types, excluded users/roles/channels/categories/threads, bot filtering, and message formatting.

```yaml
plugins:
  logs:
    config:
      channels:
        "123456789012345678":
          include: ["MEMBER_BAN", "MEMBER_KICK", "MEMBER_WARN", "AUTOMOD_ACTION"]
          exclude: []
          excluded_roles: []
          excluded_channels: []
          excluded_categories: []
          excluded_threads: []
          exclude_bots: false
```

Replace the sample ID with the actual staff-log channel and use event names available in the Logs config schema. Restrict access with Discord channel permissions; configuring a destination is not itself a privacy boundary.

## 4. Staff permissions and hierarchy

Keep authorization and hierarchy separate:

- `role_permissions`: each role ID maps to the exact command permissions granted to members with that role.
- `role_levels`: optional numeric hierarchy metadata; higher values outrank lower values. Levels do not grant moderation permissions by themselves.
- Plugin `overrides`: scoped configuration changes, not permission grants.
- Automod immunity: bypasses Automod only; it does not grant commands or Discord permissions.
- Log destinations: route logs; they do not grant access to those channels.

This separation prevents a logging channel, an Automod exemption, or a numeric hierarchy level from accidentally granting staff access.
