# OKG Manager Support

OKG Manager includes native Discord support tickets in the Zeppelin bot.

## Configure

1. Open OKG Manager Dashboard → Features → Support.
2. Enable Support.
3. Set the public panel channel ID and ticket category ID.
4. Add support staff role IDs. The bot needs Manage Channels, View Channel, Send Messages, Read Message History, and permission to create channels.
5. Optionally set a transcript log channel, panel title/description, welcome message, ticket prefix, and the per-user open-ticket limit.
6. Save, then run `/support-panel` in the server. The command requires Manage Server.

## Ticket workflow

- A user selects **Open a ticket** and completes the subject/details form.
- The bot creates a private channel visible to the ticket owner and configured support roles.
- Support staff can claim and unclaim an open ticket.
- The ticket owner or support staff can close it; staff can reopen or delete closed tickets.
- Closing sends a text transcript to the configured log channel, when one is configured. Transcript collection paginates up to 5,000 messages and records message timestamps, authors, attachment URLs, and embed summaries.
- The configured open-ticket limit prevents users from opening too many concurrent tickets.

## Permissions and limitations

- Only configured support roles, members with Manage Channels, or administrators can claim/unclaim, reopen, and delete tickets.
- A ticket owner or authorized support staff can close a ticket.
- Ticket controls are bot interactions; users cannot change ticket state merely by editing a channel name.
- Transcript history is capped at 5,000 messages to protect memory use. Discord does not expose deleted messages to a later transcript.
- This is the current native foundation. Advanced Ticket Tool parity—multiple panels/categories with per-panel forms, staff-only notes, service-level metrics, and a searchable dashboard ticket queue—still requires additional implementation.
## Smoke-test checklist

- [ ] Save Support settings and confirm the enabled state persists after reloading the dashboard.
- [ ] Run `/support-panel` and confirm the panel appears in the selected channel.
- [ ] Open a ticket, submit both form fields, and verify only the ticket owner and support staff can see it.
- [ ] Confirm a second ticket is blocked when the open-ticket limit is reached.
- [ ] Claim and unclaim the ticket with staff and non-staff accounts to verify permission checks.
- [ ] Close the ticket and verify the transcript appears in the configured log channel.
- [ ] Reopen the ticket and verify the owner can send messages again.
- [ ] Delete a test ticket with a support staff account.
