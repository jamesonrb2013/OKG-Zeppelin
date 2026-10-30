# Changelog

## 1.3.10

### Added
- Added server-wide Automod exception lists for immune roles, immune users, ignored channels, and ignored categories.
- Added parent-channel handling for Automod exclusions on thread messages.
- Added documentation for Automod exceptions, plugin configuration overrides, staff hierarchy, and log routing.

### Fixed
- Fixed Automod exception-list schema validation by using the Discord snowflake schema.
- Fixed Automod bypass checks so trusted roles/users and ignored locations are checked before rules execute.
- Fixed Automod async action handling by awaiting actions and isolating failures, so one failed action does not stop later actions or rules.
- Fixed role-permission hierarchy checks for target members when permissions are configured through `role_permissions`.
- Fixed equal-level wildcard-role hierarchy handling and added regression coverage.
- Fixed per-guild slash-command registration so custom commands appear immediately.
- Fixed Discord.js guild-command registration options and related TypeScript types.
- Fixed slash-command synchronization to preserve unrelated guild commands when OKG Manager's built-in AI commands were removed.

### Changed
- Removed the built-in AI runtime, AI commands, obsolete AI settings, and unused OmniRoute environment settings from OKG Manager. AI functionality is handled separately through the API Router / OKG Intelligence architecture.
- Aligned the root, backend, and dashboard package versions at 1.3.10.

## 1.3.11
- Maintenance version bump; no additional feature changes are included in this entry.
