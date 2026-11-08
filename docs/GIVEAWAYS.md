# OKG Manager Giveaways & Raffles

## Discord commands

- `/giveaway create` — publish an event with a prize, duration, winner count, and optional type, channel, role requirement, description, and UnbelievaBoat cash reward.
- `/giveaway list` — show active events and their IDs.
- `/giveaway end id:<event-id>` — close an event early and draw winners.
- `/giveaway reroll id:<event-id>` — draw replacement winners from entrants who have not already won.

Durations use `m`, `h`, or `d` (for example `45m`, `6h`, or `2d`) and are limited to 30 days. Each Discord user can hold one entry per event and can withdraw it by pressing the entry button again. Role requirements are checked when the user enters.

## Database

The bot's normal TypeORM migration process creates `giveaways` and `giveaway_entries`. The event and entry records survive bot restarts. Ensure the deployment runs the standard backend migration step before starting the bot.

## UnbelievaBoat cash prizes

The UnbelievaBoat API does not provide a native giveaway/raffle endpoint. OKG Manager runs the event and selects winners itself, then uses UnbelievaBoat's economy API to add the configured cash amount to each winner's cash balance.

Each Discord server connects its own UnbelievaBoat API token. No shared `UNBELIEVABOAT_API_TOKEN` environment variable is used.

### Connect from the OKG Manager dashboard

1. Open the OKG Manager dashboard and select the Discord server.
2. Open **Features → UnbelievaBoat integration**.
3. Create or copy an API token from [UnbelievaBoat Applications](https://unbelievaboat.com/applications).
4. Paste the token into the password field and choose **Test & connect**.
5. OKG Manager verifies that the token can access that exact Discord server before saving it.

The token is encrypted at rest with AES-256-GCM using the existing server-side `KEY` secret. It is never returned to the dashboard or shown again after saving. Only users with the server's **Edit Config** dashboard permission can connect or disconnect the integration.

### Discord command alternative

Server administrators can also use:
- `/unbelievaboat connect` — opens a private modal to enter and test the token.
- `/unbelievaboat status` — checks whether this server is connected.
- `/unbelievaboat disconnect` — removes this server's active credential.

Each credential is keyed to its Discord server ID. Payouts only use the token saved for the giveaway's own server. Never share a real API token in public messages or source code. If a token is exposed, revoke it in UnbelievaBoat and connect a replacement.

Without a connection, ordinary prizes and winner selection still work. Cash prizes cannot be paid until the server connects its own token.

## Permissions

The command requires Manage Server (or Administrator). The bot needs View Channel, Send Messages, Embed Links, and Read Message History in the selected post channel. Users need access to the event channel to enter.
