# OKG Manager Economy Management

OKG Manager provides a moderator-facing control layer for the economy connected to each Discord server's own UnbelievaBoat API token.

## Commands

- `/economy balance [member]` — privately view a member's cash, bank, total, and leaderboard rank.
- `/economy leaderboard [sort] [page]` — display the server leaderboard sorted by total, cash, or bank.
- `/economy add member amount account reason` — add cash or bank funds.
- `/economy remove member amount account reason` — remove cash or bank funds.
- `/economy set member amount account reason` — set one balance bucket while preserving the other.
- `/economy reset member reason` — reset both cash and bank to zero.

The balance and leaderboard commands are available to server members. Add, remove, and set require **Manage Messages**, **Manage Server**, or **Administrator**. Reset is more sensitive and requires **Manage Server** or **Administrator**.

All management operations are scoped to the current Discord server. Each server's encrypted token is used only for that server's API requests. Reasons are passed to UnbelievaBoat as audit-log reasons. The bot never displays or logs the saved token.

## Safety

- Amounts must be whole numbers and cannot be negative in slash-command input.
- Add/remove use UnbelievaBoat's balance-update endpoint.
- Set reads the current balance, changes only the selected cash or bank field, and preserves the other field.
- Reset is an explicit two-balance reset for one selected member; there is no mass reset-economy command.
- Provider errors are translated into concise user-facing messages; raw response bodies and credentials are not exposed.
- The bot does not retry money-changing API calls automatically, avoiding accidental duplicate transfers after ambiguous network failures.

## Setup

A server administrator must first connect the server's own UnbelievaBoat token using **Features → UnbelievaBoat** in the dashboard or `/unbelievaboat connect`. The token must have access to the same Discord server where the command is being used.

The commands use UnbelievaBoat's documented user balance GET, PATCH, PUT, and guild leaderboard endpoints. See the [UnbelievaBoat API reference](https://api-docs.unbelievaboat.com/reference/reference).
