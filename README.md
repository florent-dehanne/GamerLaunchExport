# Gamer Launch Export

Export your **Gamer Launch** guild's forum to a JSON file, before the platform goes offline.

> **Gamer Launch (formerly Guild Launch) shuts down on October 31, 2026.** After that date the
> sites — and their forums — are gone, with no export provided by the platform. This is a small,
> open tool to save your forum content while it's still readable.

The script runs **in your own browser**, reading only the pages your logged-in session already
sees. It produces a JSON file in the neutral [`ornaweb.import.v1`](FORMAT.md) format, which can be
re-imported into [Guildi](https://guildi.com) — or into anything else that reads the format.

## What you need

- A **computer** (not a phone) with a recent browser (Chrome, Firefox, Edge).
- To be **logged in** to the Gamer Launch account that administers your guild.

## How to use it

1. **Open a page of your guild's forum**, on a URL that contains `?gid=…`
   (for example `https://yourguild.wowlaunch.com/mobile/forums/?gid=123456`). Stay logged in.
2. **Open the browser console**: press `F12` (or right-click → "Inspect"), then the **"Console"** tab.
3. **Copy the contents of [`gamer-launch-export.js`](gamer-launch-export.js)** into the console and
   press `Enter`.
4. **Let it run.** It reads the forum page by page, **one request per second** so it doesn't hammer
   the site — a few minutes for a small forum, longer for a big one. Progress is printed in the
   console.
5. When it finishes, a file named **`ornaweb-import-forum-<gid>.json`** downloads automatically. If
   the download is blocked, the result is available in the console as `window.__glExport`.

## What it exports (and what it doesn't)

- ✅ **Categories, forums, topics and posts**: title, author (the display name), date, and the post
  body as HTML.
- ✅ **Pinned topics** are flagged as such.
- ❌ **Avatars** are not included (Gamer Launch only exposes them in a non-reusable form).
- ❌ By default, posts signed **"Anonymous"** (spam from logged-out visitors) are dropped.

## Options

At the top of the script, an `OPTIONS` block lets you adjust the export before pasting it:

| Option | Default | What it does |
|---|---|---|
| `includeAnonymous` | `false` | Set to `true` to keep "Anonymous" posts (mostly spam). |
| `since` | `null` | A date like `'2020-01-01'` to keep only posts **from** that date onwards. |
| `includeAvatars` | `false` | Keep each author's avatar URL (not advised: Gravatar is a hash of the e-mail). |
| `delayMs` | `1000` | Delay between requests, in milliseconds. Don't lower it too much. |

## Is this safe?

Yes. The script:

- only reads pages your session **already has access to** — it forces nothing and guesses no
  passwords or IDs;
- never sends your data anywhere — the JSON is built **in your browser** and downloaded to **your**
  computer;
- goes **one request per second**, to stay gentle on the site.

You can read the whole thing — it's a single file, [`gamer-launch-export.js`](gamer-launch-export.js).
Only export **your own** guild's content.

## Troubleshooting

- **Nothing downloads**: grab `window.__glExport` from the console (right-click → "Copy"), and paste
  it into a `.json` file.
- **The script stops partway**: whatever was read is still in `window.__glExport`; re-run from a fresh
  page if needed.
- **An error mentioning `gid`**: make sure the page URL contains `?gid=…`.

## Moving to Guildi

Guildi is an actively maintained guild-site platform. If you're moving your guild off Gamer Launch,
see **[the migration guide](https://guildi.com/en/gamer-launch-closing-alternative)**.

## License

[MIT](LICENSE) — free to use, read, and adapt.
