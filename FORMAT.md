# The `ornaweb.import.v1` format

A small, neutral JSON format for moving guild/community content between platforms. It carries no
Gamer Launch (or phpBB) specifics in its structure — the origin is isolated in a `source` block, so
the same format can describe content from any platform and be imported anywhere.

See [`examples/ornaweb-import-forum-example.json`](examples/ornaweb-import-forum-example.json) for a
complete file.

## Envelope

```json
{
  "format": "ornaweb.import.v1",
  "source": { "platform": "gamer-launch", "exportedAt": "2026-10-16T09:00:00.000Z", "siteRef": "132742" },
  "forum": { "categories": [ ... ] }
}
```

- **`format`** — always `"ornaweb.import.v1"`.
- **`source`** — where the data came from, kept separate from the content itself:
  - `platform` — the origin platform (e.g. `"gamer-launch"`).
  - `exportedAt` — when the export ran, ISO 8601.
  - `siteRef` — the source site identifier (the Gamer Launch `gid`).
- **One content type per file.** `forum` today; `members`, `raids`, `gallery` are reserved for future
  exports. A file holds exactly one of these top-level content blocks.

## The `forum` block

Categories contain forums, forums contain topics, topics contain posts:

```json
"forum": {
  "categories": [
    {
      "name": "General",
      "forums": [
        {
          "name": "Announcements",
          "externalRef": "1",
          "topics": [
            {
              "title": "Welcome",
              "pinned": true,
              "externalRef": "1001",
              "posts": [
                { "author": { "name": "Shadow" }, "postedAt": "2020-02-17", "bodyHtml": "<p>Hi</p>" }
              ]
            }
          ]
        }
      ]
    }
  ]
}
```

### Fields

| Path | Required | Meaning |
|---|---|---|
| `categories[].name` | yes | Category label. |
| `categories[].forums[].name` | yes | Forum label. |
| `categories[].forums[].externalRef` | no | The source forum id — used to trace and to avoid duplicating on re-import. |
| `…topics[].title` | yes | Topic title. |
| `…topics[].pinned` | no | `true` for a pinned/announcement topic. |
| `…topics[].externalRef` | no | The source topic id. |
| `…posts[].author.name` | yes | The author's display name (a label, not an account). |
| `…posts[].author.avatar` | no | Avatar URL, only if the exporter was asked to keep it. |
| `…posts[].postedAt` | no | Post date, ISO 8601 (`YYYY-MM-DD`). |
| `…posts[].postedAtRaw` | no | The raw date string, kept when it couldn't be parsed to ISO. |
| `…posts[].bodyHtml` | yes | The post body, as HTML. Treat as untrusted input and sanitize on import. |

### Notes

- **`externalRef` is optional everywhere.** It records the source id so a re-import can recognise
  what it already imported and skip or update it instead of creating a duplicate. The format does not
  depend on it.
- **`author` is a label, not an account.** Imported posts are attributed by the importer, which may
  map a name to an existing member or create a placeholder — that's an import concern, not the
  format's.
- **Posts have no id of their own** in a Gamer Launch export (the mobile forum doesn't expose one),
  so de-duplication on re-import happens at the topic level.
