## 1.3.21

### Fixed
- Always prompt members to choose a destination server when DMing OKG Manager, including when only one eligible server exists.
- Acknowledge server-selection interactions immediately before fetching guild/member data, preventing Discord's three-second interaction timeout.
- Reply clearly when Modmail is not configured, and log incoming DM handling for production diagnosis.

### Changed
- Aligned root, backend, and dashboard package versions at 1.3.21.

### Credits
- Updated by Jeffery Spinnel.

## 1.3.20

### Added
- Added per-server Modmail support with member consent, server selection, private staff inbox threads, staff notifications, and two-way member/staff messaging.
- Added Modmail follow-up forwarding, attachment forwarding, and conversation closure notices.

### Permissions and configuration
- Added dashboard settings for enabling Modmail and selecting the inbox, staff role, and admin role for each server.
- Restricted conversation closure to configured Modmail administrators while allowing staff to reply.
- Prevented @everyone and @here mentions in forwarded member messages.

### Reliability
- Added active and archived inbox-thread lookup to reconnect member conversations after bot restarts.
- Added documentation for staff-only inbox permissions and Modmail setup.

### Changed
- Aligned root, backend, and dashboard package versions at 1.3.20.

### Credits
- Updated by Jeffery Spinnel.

## 1.3.19

### Fixed
- Fixed a critical AutoMod false-positive path where zero or negative link/message spam thresholds could match ordinary messages with no corresponding spam activity.
- Added runtime validation for invalid spam thresholds in both AutoMod and the legacy Spam plugin without invalidating existing server configurations.
- Fixed message-edit accounting so editing one message replaces only that message's recent-action contribution instead of erasing the member's entire spam history.
- Made recent-action recording idempotent when a saved-message event is delivered more than once.
- Fixed AutoMod debug results so successful matches, including silent-clean matches, are correctly reported as triggered.
- Fixed link matcher precedence so excluded domains/words are checked before inclusion rules, one excluded link does not hide other links in the same message, and combined include/exclude settings no longer flag unrelated domains.

### Reliability
- Preserved existing configuration compatibility while safely ignoring invalid spam thresholds.
- Kept per-user and per-channel spam history accurate across message edits.

### Credits
- Updated by Jeffery Spinnel.

## 1.3.18

### Added
- Added /economy balance and /economy leaderboard for member balance lookups and server rankings.
- Added moderator commands to add, remove, and set member cash or bank balances with required audit reasons.
- Added an administrator-only per-member economy reset.
- Added server-specific currency symbol display and concise handling for UnbelievaBoat API errors.
- Documented economy command permissions and safe usage in docs/ECONOMY.md.

### Permissions and safeguards
- Balance and leaderboard are available to server members.
- Add, remove, and set require Manage Messages, Manage Server, or Administrator.
- Full member reset requires Manage Server or Administrator.
- All operations use the connected server's own encrypted UnbelievaBoat token. No mass-economy reset command is provided.

### Credits
- Updated by Jeffery Spinnel.

## 1.3.17

### Improved
- Redesigned giveaway and raffle embeds with consistent OKG community-event branding, clearer prize and entry details, readable deadlines, and explicit closed states.
- Reworked the server Features page into a consistent, responsive layout that clearly explains giveaways, UnbelievaBoat, and support tickets.
- Improved entry confirmations and made repeat entry clicks idempotent instead of silently withdrawing a member's entry.

### Reliability
- Added per-event completion locking to prevent overlapping draws.
- Persisted winner selection and payout-pending state before calling UnbelievaBoat, reducing the risk of duplicate transfers after a bot restart.
- Kept previous winners in the reroll exclusion history and display only the latest draw's winners.
- Removed provider response details from cash-payout error logs. Ambiguous or failed payouts remain marked for review and are not retried automatically.

### Credits
- Updated by Jeffery Spinnel.

## 1.3.16

### Added
- Added per-Discord-server UnbelievaBoat integration settings in the OKG Manager dashboard, with private token entry, connection testing, status, and disconnect controls.
- Added /unbelievaboat connect, status, and disconnect commands as a Discord-native alternative.
- Encrypted each server's UnbelievaBoat token at rest with AES-256-GCM and isolated credentials by Discord server ID.
- Added server-permission-checked API endpoints for managing UnbelievaBoat connections.
- Updated giveaway and raffle cash payouts to use only the credential configured for the event's own server.

### Changed
- Removed the shared `UNBELIEVABOAT_API_TOKEN` environment-variable requirement.
- Updated giveaway documentation with the per-server setup instructions.
- Aligned root, backend, and dashboard package versions at 1.3.16.

### Security
- Tokens are never returned to the dashboard, displayed after saving, or written to application logs.
- Connection is only saved after UnbelievaBoat confirms access to the exact Discord server.

### Credits
- Updated by Jeffery Spinnel.

## 1.3.14

### Fixed
- Routed primary OKG server release announcements directly to its designated existing channel `1562496808838631556`, while keeping other servers restricted to their dedicated setup channels.
- Kept release delivery retryable when the designated channel is missing or cannot receive messages.

### Changed
- Aligned root, backend, and dashboard package versions at 1.3.14.

## 1.3.13

### Fixed
- Restricted automatic release announcements to the dedicated channel created by `/updates-setup`; the bot no longer falls back to general, system, or arbitrary chat channels.
- Standardized the dedicated update channel name to `okg-admin-manage-updates`, including renaming an existing setup channel when `/updates-setup` is run again.

### Changed
- Aligned root, backend, and dashboard package versions at 1.3.13.

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
