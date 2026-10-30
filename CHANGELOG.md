## 1.3.12

### Fixed
- Restored native Vety prefix-command dispatch by removing the temporary listener that intercepted and rejected every prefix command.
- Made the primary One Kid Gaming server a built-in, always-authorized server, seeded its database row and initial config before per-guild plugins load, and blocked disallow/removal operations against it.
- Made runtime version reporting read the root package version instead of a separately hard-coded value.
- Rebuilt release announcements to read only the matching version section from this changelog and track successful delivery independently for each authorized server.
- Made failed release posts retry on a later startup without reposting versions already delivered successfully.
- Hardened guild configuration reload processing so non-guild system records are skipped safely and one guild reload failure cannot block later updates.
- Fixed command-startup type narrowing so the per-server update channel is safely selected before posting.
- Fixed release-note extraction so it stops cleanly before the next top-level changelog heading.

### Changed
- Added a release workflow that validates matching package versions, runs formatting/lint/build checks, publishes only that version's changelog notes, and points the release tag at the tested commit.
- Added a deployment preflight so Blitz builds validate formatting, lint, shared types, backend types, and the dashboard before publishing an image.

# Changelog

## 1.3.10

### Added
- Added configurable Automod exemptions for trusted roles and users, plus ignored channels and categories.
- Added parent-channel inheritance for Automod exclusions in threads.
- Added the per-plugin configuration override and staff/logging configuration guide.
- Added server-specific YAML configuration support for OKG Manager.
- Added invite-code management for authorized Discord servers, including server-bound codes, generated install links, and activation when a code is redeemed.
- Added owner/staff dashboard controls and platform-owner access handling, including a protected, non-removable platform-owner grant.
- Added configurable bot update announcement channels and ping roles, with automatic update announcements across servers.
- Added owner-only Discord controls for the API Router.
- Added documentation links for the Terms of Service and Privacy Policy.

### Fixed
- Fixed Automod exception-list validation and ensured exceptions are applied before any rule executes.
- Fixed Automod async actions so each action is awaited and failures are isolated instead of interrupting the remaining actions/rules.
- Fixed moderation hierarchy checks for target members using `role_permissions`.
- Fixed equal-level wildcard-role hierarchy handling and added regression tests.
- Fixed immediate per-guild registration and visibility of custom slash commands.
- Fixed Discord.js guild-command registration options and TypeScript types.
- Fixed slash-command synchronization so removing OKG Manager AI commands does not remove unrelated server commands.
- Fixed `/mod-mute` interaction timeouts.
- Fixed dashboard login and authorized-server access checks, invite-code validation/redemption, and owner-only invite management.
- Fixed duplicate update announcements and update-announcement formatting/role parsing.
- Fixed default prefix matching, whitespace handling, and prefix-related startup behavior.
- Fixed API Router request typing, deployment environment-variable precedence, and transient OmniRoute timeout handling during the AI integration work.

### Changed
- Removed the built-in AI commands, runtime, settings entity, and obsolete OmniRoute environment settings from OKG Manager. AI is handled separately through the API Router / OKG Intelligence architecture.
- Aligned the root, backend, and dashboard package versions at 1.3.10.

## 1.3.11
- Maintenance version bump to publish the previously missing 1.3.10 changelog. No additional feature changes are included in this version.
