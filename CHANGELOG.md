## 1.3.37

### Added
- Added an owner-only Developer Center with live console output, recent log history, filters, system health cards, and an allowlisted diagnostic command terminal.
- Captured bot and API console output into a shared Redis-backed log history with a 1,000-entry retention limit.
- Added bot/API heartbeats and live database/Redis health checks.
- Added audited developer command execution and secret redaction before log persistence.
- Added a Redis-backed API-to-bot command bridge for real Discord operations: authorized server listing, server inspection, administrative role discovery, member inspection, and bot-authored channel messages.
- Added guarded role creation with optional member assignment, explicit permission selection, and Discord role-hierarchy enforcement.
- Added authorized-server channel discovery with channel names, types, and IDs.
- Added role assignment and removal with member-manageability and bot role-hierarchy checks.
- Added explicitly confirmed role deletion; the bot refuses to delete @everyone, managed roles, or roles at/above its highest role.
- Added role editing for names and allowlisted permissions, with role hierarchy enforcement.
- Added text, voice, and category channel creation plus explicitly confirmed channel deletion; the bot checks Manage Channels and channel deletability.
- Added filtered CSV export for the Developer Center log explorer, including spreadsheet-formula injection protection.
- Added read-only database table-size/row-estimate and Redis memory/uptime/connection diagnostics.

### Security
- Kept Developer Center endpoints behind the existing platform-owner authorization check.
- Disabled arbitrary shell execution; only explicit read-only diagnostic commands are accepted.

### Credits
- Updated by Jeffery Spinnel.

## 1.3.36

### Fixed
- Fixed the moderation message-command permission pipeline: Vety's built-in filter previously rejected commands before the custom moderation wrapper could apply the platform/server-owner exception.
- The built-in permission filter is now explicitly skipped for wrapped moderation message commands; the moderation wrapper still enforces the exact `can_*` permission for every non-owner.
- Restored execution and feedback for message-prefix moderation commands including mute, warn, and note.

### Reliability
- Preserved role/channel permission checks and the platform/server-owner rules; no moderation permission bypass was introduced.

### Credits
- Updated by Jeffery Spinnel.

## 1.3.35

### Fixed
- Corrected the private Vety command prefix to the single-character `!` prefix used by Vety's message-command dispatcher.
- Intercepted public messages before Vety's native listener so bare `!command` messages are not executed, while `!o` and configured custom prefixes are explicitly forwarded through the normal command pipeline.
- Unified command-alias forwarding with the same internal prefix.

### Reliability
- Added regression coverage for the Vety-compatible internal prefix and early prefix interception.

### Credits
- Updated by Jeffery Spinnel.

## 1.3.34

### Fixed
- Fixed Vety command parser configuration when no global config row exists: the global fallback now receives the same private internal prefix as guild configs.
- Replaced the invisible Unicode prefix marker with a private ASCII-only `~!` prefix so Vety can reliably parse forwarded messages.
- Kept `!o` as the universal public prefix, configured server prefixes supported, and bare `!command` rejected.

### Reliability
- Added regression coverage for the explicit private prefix used by forwarded commands.

### Credits
- Updated by Jeffery Spinnel.

## 1.3.33

### Fixed
- Finalized isolated public-prefix routing: `!o` always works, configured per-server prefixes work, and bare `!command` is not accepted.
- Routed exact mute and warn regression cases through Vety using its private internal prefix.
- Added a dispatcher regression proving a bare `!mute` is ignored.
- Kept the Help output on the configured public prefix.

### Changed
- Aligned root, backend, and dashboard package versions at 1.3.33.

### Credits
- Updated by Jeffery Spinnel.

## 1.3.32

### Fixed
- Isolated Vety's internal message-command prefix behind an invisible private marker, so users cannot invoke commands with bare `!command`.
- Kept `!o` as the universal public default and retained per-server custom prefixes through the same Vety command dispatcher.
- Updated Help output to display the configured public prefix instead of Vety's private internal marker.
- Added regression coverage confirming bare `!mute` and `!warn` are not public commands and that rewritten commands use the private internal prefix.

### Changed
- Aligned root, backend, and dashboard package versions at 1.3.32.

### Credits
- Updated by Jeffery Spinnel.

## 1.3.31

### Fixed
- Made forwarded public-prefix messages writable, matching Vety's command-alias dispatch contract so the normal message-command parser can process rewritten commands.
- Added an exact regression test for `!o mute <@1528924568020844655> 15m test`, verifying that the command name and all arguments reach Vety unchanged.
- Added a visible, user-safe error response when public-prefix dispatch throws, while retaining full diagnostic details in bot logs.

### Changed
- Aligned root, backend, and dashboard package versions at 1.3.31.

### Credits
- Updated by Jeffery Spinnel.

## 1.3.30

### Fixed
- Restored reliable public message-prefix routing so `!o` and configured per-server prefixes are normalized to Vety's internal command prefix and dispatched through Vety's normal command pipeline.
- Preserved the original Discord message while forwarding a rewritten message with an own `content` property, avoiding the inherited Message.content accessor failure.
- Kept prefix command execution behind the authorized-guild check and Vety's configured command permission checks.
- Added dispatcher-level regression coverage for default and custom public prefixes.

### Changed
- Aligned root, backend, and dashboard package versions at 1.3.30.

### Credits
- Updated by Jeffery Spinnel.

## 1.3.27

### Fixed
- Replaced the custom role_permissions moderation gate with Vety's native command permission pipeline. Prefix moderation commands now evaluate their configured permission keys (such as can_ban, can_kick, can_warn, and can_mute) against the effective guild plugin configuration.
- Restored role, user, and channel-specific permission overrides through the same configuration resolver used by Vety.
- Updated secondary moderation permission checks to use the effective command configuration instead of a separate role_permissions map.
- Kept prefix dispatch available in every guild text channel and thread; command permissions, not a hard-coded channel allowlist, decide whether a command may run.

### Changed
- Aligned root, backend, and dashboard package versions at 1.3.27.

### Credits
- Updated by Jeffery Spinnel.

## 1.3.26

### Fixed
- Fixed the actual prefix dispatch failure: forwarded Discord messages now define their rewritten content as an own property, matching Vety's documented dispatch contract instead of assigning over the inherited Message.content accessor.
- Removed the platform-owner permission bypass. Moderation message commands now require the matching configured role_permissions grant for every user.
- Re-check the member's current Discord roles when evaluating configured message-command permissions, avoiding false denials from partial or stale cached member data.
- Fixed command-alias forwarding to use the same safe message-cloning method.
- Added a regression test proving forwarded command content is readable and the original Discord message remains unchanged.

### Changed
- Aligned root, backend, and dashboard package versions at 1.3.26.

### Credits
- Updated by Jeffery Spinnel.

## 1.3.23

### Fixed
- Rebuilt message-prefix routing with a dedicated dispatcher instead of the previous fragile prefix conversion.
- Normalize the default `!o` prefix and configured per-server prefixes to Vety's internal command prefix before dispatch.
- Preserve existing message-command handlers, arguments, plugin filters, and permission checks.
- Apply the explicit OKG platform-owner authorization flag only to the platform owner's own prefix commands.
- Normalize command aliases through the same internal prefix before dispatch.
- Add reliable `!o ping`, `!o keepalive`, and `!o keep alive` health checks, including the authenticated Dyno webhook path.

### Reliability
- Add automated prefix parsing tests for case handling, whitespace, custom prefixes, and invalid prefix lookalikes.
- Keep Modmail message processing independent from prefix command routing.

### Credits
- Updated by Jeffery Spinnel.

## 1.3.22

### Added
- Rebuilt Modmail member and staff messages as branded OKG embeds with consistent status, delivery, and closure feedback.
- Added multiple independent open Modmail conversations per member and server, with a member-facing conversation picker and a configurable per-server open-conversation limit.
- Added staff slash commands: `/modmail dm` sends a branded direct message through the bot, and `/modmail open` creates a new conversation and notifies the member.
- Added an administrator-only close button to each staff conversation thread.

### Reliability and permissions
- Revalidate server membership and conversation ownership when members use selection menus.
- Enforce the configured staff/admin roles for Modmail staff commands and conversation closure.
- Keep archived conversations out of the open-conversation limit and active conversation picker.

### Configuration
- Added `plugins.support.config.modmail_max_open_conversations`; defaults to 5 and supports 1–20 open conversations per member per server.

### Credits
- Updated by Jeffery Spinnel.

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
