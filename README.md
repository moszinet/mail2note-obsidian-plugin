# mail2note

Forward emails to your personal mail2note address and have them appear automatically in your Obsidian vault as markdown notes, complete with attachments.

## Install

1. Open Obsidian and go to **Settings → Community plugins → Browse**.
2. Search for **mail2note** and select **Install**.
3. Enable the plugin under **Settings → Community plugins**.

## Configure

Open **Settings → Community plugins → mail2note** and fill in:

- **API base URL** — leave as `https://mail2note.com` unless you self-host.
- **API key** — copy your `m2n_...` key from the [mail2note dashboard](https://mail2note.com).
- **Target folder** — vault folder where imported notes land (default: `mail2note/`).
- **Poll interval** — how often the plugin checks for new notes (default: every minute).
- **Attachment folder** — where to save email attachments relative to the target folder.
- **Filename template** — pattern for note filenames; supports `{date}`, `{subject}`, `{message_id}`.

You can also trigger an immediate sync via the ribbon icon or **Command palette → mail2note: Sync now**.

## Privacy

- The plugin only contacts the configured API base URL (default `https://mail2note.com`).
- Your API key and note contents are never logged or shared with any other service.
- Notes and attachments are written only into the configured vault folder.
- No telemetry is collected.

## Links

- Website: [https://mail2note.com](https://mail2note.com)
- Backend repository: [https://github.com/moszinet/mail2note](https://github.com/moszinet/mail2note)
- Issues: [https://github.com/moszinet/mail2note-obsidian-plugin/issues](https://github.com/moszinet/mail2note-obsidian-plugin/issues)
