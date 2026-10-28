---
name: "read-slack-messages"
description: "Read Slack messages via the Slack MCP, including group DMs (mpim) and threads, avoiding channel_not_found and empty-search errors."
version: 1
created: "2026-09-16"
updated: "2026-10-06"
---
## When to Use
Use when the user shares a Slack permalink (e.g. onshape.slack.com/archives/<CID>/p<ts>) and asks me to read that message or a DM, or asks me to read Slack messages. The Slack MCP is connected (Slack servers expose slack_* tools). There is NO direct "read a message by permalink/ts" tool — you must use read_channel / read_thread / search, and each has gotchas.

## Procedure
1. Parse the permalink: https://<host>.slack.com/archives/<CID>/p<ts> -> channel_id = <CID>, message ts = <ts> (milliseconds; Slack ts format is seconds, so divide by 1000, e.g. 1789592645447359 -> 1789592645.447359).
2. Pick the approach by channel type. If it's a group DM (mpim) or 1:1 DM (im), or you're unsure: use slack_read_channel. If it's a public/private channel you can search: slack_search_public_and_private is fine.
3. For a group DM (mpim): Slack search does NOT reliably index it (slack_search_public_and_private with filters 'in:<DMid>' returns nothing). Use read_channel instead.
4. read_channel requires the param name 'channel_id' (NOT 'channel'). Passing 'channel' -> 'channel_not_found' even though the ID is correct.
5. Set oldest/latest as message timestamps in Slack ts format (e.g. '1789592645.447359') to bound the read; to isolate one message set oldest = latest = target ts (or oldest = target, latest = target + a few seconds).
6. If the message is in a thread, use slack_read_thread.
7. For a regular channel, search with slack_search_public_and_private: filters is a STRING (e.g. 'in:<CID> after:<ts>'), not an object; channel_types is a comma-separated string (public_channel, private_channel, mpim, im). Sort 'timestamp' asc to get oldest first.
8. There is no 'read message by ts' tool, so you always bound a read with oldest/latest or read the whole DM and scan for the target ts.
9. Report the message text; note if it's in a thread or has replies.

## Pitfalls
- No permalink->message tool exists. You cannot pass the permalink/ts to a 'read message' tool; you must bound read_channel/read_thread or search.
- Group DMs (mpim) are NOT indexed by Slack search. Searching 'in:<DMid>' returns no results - use read_channel for DMs.
- read_channel needs the param 'channel_id', not 'channel'. Wrong param name -> 'channel_not_found' (even though the ID is correct).
- oldest/latest should be Slack ts format (e.g. '1789592645.447359'), not the raw ms string. To isolate one message, set oldest = latest = target ts.
- Slack search filters is a STRING (Slack modifier syntax like 'in:#general after:2025-01-01'), not a JSON object. Passing an object -> validation error. channel_types is a comma-separated string, not an object.
- The connected Slack app only sees channels/DMs it's installed on. A channel in a different workspace -> 'channel_not_found'. (This app is on the onshape workspace; ptc.enterprise.slack.com channels are separate.)
- Calling read_channel with a single 'channel' param plus an 'oldest' param failed; the working call used 'channel_id'. When unsure, retry with channel_id and no stray params.

## Verification
1. read_channel returns messages and labels the type ('Group DM', channel name, etc.), and the returned list contains the target ts.
2. For search, results include the permalink and the target message.
3. The target message text matches the permalink the user was asked to read.