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

Add this secret to the bot service environment:

```text
UNBELIEVABOAT_API_TOKEN=your_unbelievaboat_api_token
```

The token must belong to an UnbelievaBoat API application with access to the target server. Do not put it in source code, Discord messages, or client-side dashboard settings. Without this secret, ordinary prizes and winner selection still work, while cash payouts remain pending.

## Permissions

The command requires Manage Server (or Administrator). The bot needs View Channel, Send Messages, Embed Links, and Read Message History in the selected post channel. Users need access to the event channel to enter.
