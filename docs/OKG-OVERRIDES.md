# OKG Administrative & Management — Overrides and server exceptions

This guide covers the supported per-module override system and Automod exception lists. Configure these in each server's module configuration through the OKG dashboard or your existing YAML configuration workflow.

## 1. Automod immunity and ignored locations

These settings belong inside `plugins.automod.config`. IDs must be Discord snowflakes written as strings.

```yaml
plugins:
  automod:
    enabled: true
    config:
      immune_roles:
        - "123456789012345678"
      immune_users: []
      ignored_channels:
        - "123456789012345678"
      ignored_categories: []
      rules: {}
```

`immune_roles` uses an ANY-match: a member is immune if they hold at least one listed role. It does not grant staff command permissions and does not bypass Discord permissions. `immune_users`, `ignored_channels`, and `ignored_categories` are separate opt-in lists. Thread messages are checked against their parent channel. Empty lists preserve existing behavior.

**Safety note:** Immunity applies to all Automod rules, so only exempt trusted roles. Keep command permissions configured separately with `role_permissions`.

## 2. Per-module configuration overrides

The platform's existing `overrides` mechanism is nested under an individual module alongside `config`. Use it when settings should differ by channel, category, user, role/permission level, or other supported criteria.

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

Use only override criteria supported by the dashboard's config editor/schema; arbitrary keys are not automatically valid criteria.

## 3. Staff/log channels

Log destinations are configured by the Logs module's `channels` map, keyed by destination channel ID. Each destination supports included/excluded event types and supported filtering options. Restrict access with Discord channel permissions; configuring a destination is not itself a privacy boundary.

## 4. Staff permissions and hierarchy

Keep authorization and hierarchy separate:

- `role_permissions`: each role ID maps to the exact command permissions granted to members with that role.
- `role_levels`: optional numeric hierarchy metadata; higher values outrank lower values. Levels do not grant moderation permissions by themselves.
- Module `overrides`: scoped configuration changes, not permission grants.
- Automod immunity: bypasses Automod only; it does not grant commands or Discord permissions.
- Log destinations: route logs; they do not grant access to those channels.

This separation prevents a logging channel, an Automod exemption, or a numeric hierarchy level from accidentally granting staff access.
