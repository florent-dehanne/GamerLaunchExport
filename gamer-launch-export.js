/**
 * Export a Gamer Launch guild forum, to paste into the browser console while
 * logged in to the guild account, on one of your guild site's pages.
 *
 * It only reads pages your session already sees: the session clears the
 * Cloudflare challenge, and private sections come out only if your account has
 * access to them. No access is forced, no identifier is guessed.
 *
 * Minimisation by default (see OPTIONS): no avatars (the Gravatar address is a
 * hash of the e-mail), anonymous authors dropped, optional cut-off date.
 *
 * Output: a JSON file in the ornaweb.import.v1 format (see FORMAT.md).
 */
(async () => {
    const OPTIONS = {
        delayMs: 1000,           // one request per second
        includeAnonymous: false, // keep posts signed "Anonymous" (mostly spam)
        includeAvatars: false,   // keep the avatar URL (not advised: Gravatar = MD5 of the e-mail)
        since: null,             // e.g. '2020-01-01': keep only posts from this date onwards
        maxPagesPerForum: 50,    // safety guard
    };

    const gid = new URLSearchParams(location.search).get('gid');
    if (!gid) {
        console.error('Open a page of the site with ?gid=… in the URL first.');
        return;
    }

    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    const base = `${location.origin}/mobile/forums`;

    // Fallback label for a forum read before any category header
    const UNCATEGORIZED = 'Uncategorized';

    // Link text without its counting badge (posts / replies counter)
    const labelWithoutBadge = (el) => {
        const clone = el.cloneNode(true);
        clone.querySelectorAll('.badge, .label').forEach((b) => b.remove());
        return clone.textContent.replace(/\s+/g, ' ').trim();
    };

    // Dates are in the site's language: German and English month abbreviations
    const MONTHS = {
        jan: 1, feb: 2, mär: 3, märz: 3, mar: 3, apr: 4, mai: 5, may: 5, jun: 6,
        juni: 6, jul: 7, juli: 7, aug: 8, sep: 9, sept: 9, okt: 10, oct: 10,
        nov: 11, dez: 12, dec: 12,
    };

    // "Feb. 17, 2020" / "März. 26, 2025" → "2020-02-17", or null if unreadable
    const toIsoDate = (raw) => {
        const m = raw.match(/^([A-Za-zä]+)\.?\s+(\d{1,2}),\s*(\d{4})$/);
        if (!m) {
            return null;
        }
        const month = MONTHS[m[1].toLowerCase()];
        if (!month) {
            return null;
        }
        return `${m[3]}-${String(month).padStart(2, '0')}-${m[2].padStart(2, '0')}`;
    };

    const fetchDoc = async (url) => {
        await sleep(OPTIONS.delayMs);
        const res = await fetch(url, { credentials: 'include' });
        if (!res.ok) {
            throw new Error(`${res.status} on ${url}`);
        }
        return new DOMParser().parseFromString(await res.text(), 'text/html');
    };

    // Index: categories and forums
    const readIndex = async () => {
        const doc = await fetchDoc(`${base}/?gid=${gid}`);
        const forums = [];
        let category = null;
        for (const el of doc.querySelectorAll('h5.forum_category_header, a.list-group-item')) {
            if (el.tagName === 'H5') {
                category = el.textContent.trim();
            } else {
                const forumId = new URLSearchParams(el.search).get('forum_id');
                if (forumId) {
                    forums.push({ forumId, category: category || UNCATEGORIZED, title: labelWithoutBadge(el) });
                }
            }
        }
        return forums;
    };

    // One forum: all its topics, page by page
    const readTopics = async (forumId) => {
        const topics = [];
        for (let page = 0; page < OPTIONS.maxPagesPerForum; page++) {
            const doc = await fetchDoc(`${base}/view_forum.php?forum_id=${forumId}&paging_page=${page}&gid=${gid}`);
            for (const a of doc.querySelectorAll('.list-group a.list-group-item')) {
                const topicId = new URLSearchParams(a.search).get('topic_id');
                if (!topicId) {
                    continue;
                }
                const pinned = !!a.querySelector('.fa-thumb-tack');
                topics.push({ topicId, title: labelWithoutBadge(a), pinned });
            }
            const next = [...doc.querySelectorAll('ul.pagination a')].find((a) => a.textContent.trim() === 'Next');
            if (!next) {
                break;
            }
        }
        return topics;
    };

    // One topic: its posts, page by page
    const readPosts = async (topicId, forumId) => {
        const posts = [];
        let pageUrl = `${base}/view_topic.php?topic_id=${topicId}&forum_id=${forumId}&gid=${gid}`;
        const seen = new Set();
        while (pageUrl && !seen.has(pageUrl)) {
            seen.add(pageUrl);
            const doc = await fetchDoc(pageUrl);
            for (const item of doc.querySelectorAll('#forum-posts > .list-group-item')) {
                const header = item.querySelector('.row p');
                const body = item.querySelector('.forum-posts-message');
                if (!header || !body) {
                    continue;
                }
                // Header: "<avatar> Author - Date"
                const headerText = header.textContent.replace(/\s+/g, ' ').trim();
                const sep = headerText.lastIndexOf(' - ');
                const name = sep > -1 ? headerText.slice(0, sep).trim() : headerText;
                const rawDate = sep > -1 ? headerText.slice(sep + 3).trim() : '';
                const post = {
                    author: { name },
                    postedAt: toIsoDate(rawDate),
                    bodyHtml: body.innerHTML.trim(),
                };
                if (post.postedAt === null && rawDate) {
                    post.postedAtRaw = rawDate;
                }
                if (OPTIONS.includeAvatars) {
                    const img = header.querySelector('img');
                    post.author.avatar = img ? img.src : null;
                }
                posts.push(post);
            }
            const next = [...doc.querySelectorAll('ul.pager a, ul.pagination a')]
                .find((a) => /next|›|»/i.test(a.textContent.trim()));
            pageUrl = next ? next.href : null;
        }
        return posts;
    };

    // Minimisation filters
    const keep = (post) => {
        if (!OPTIONS.includeAnonymous && /^anonymous$/i.test(post.author.name)) {
            return false;
        }
        if (OPTIONS.since && post.postedAt && post.postedAt < OPTIONS.since) {
            return false;
        }
        return true;
    };

    console.log(`Exporting forum gid=${gid} — reading the index…`);
    const forums = await readIndex();
    console.log(`${forums.length} forums found.`);

    // ornaweb.import.v1 format: neutral envelope, provenance isolated in `source`,
    // categories → forums → topics → posts. One file = one content type.
    const out = {
        format: 'ornaweb.import.v1',
        source: { platform: 'gamer-launch', exportedAt: new Date().toISOString(), siteRef: gid },
        forum: { categories: [] },
    };
    window.__glExport = out; // from now on: whatever was read survives an error mid-run
    const categoriesByName = new Map();
    let totalPosts = 0;

    for (const forum of forums) {
        const topics = await readTopics(forum.forumId);
        console.log(`  ${forum.category} / ${forum.title}: ${topics.length} topics`);
        const exportedTopics = [];
        for (const topic of topics) {
            let posts;
            try {
                posts = (await readPosts(topic.topicId, forum.forumId)).filter(keep);
            } catch (e) {
                console.warn(`Topic ${topic.topicId} skipped (${e.message})`);
                continue;
            }
            if (posts.length === 0) {
                continue;
            }
            exportedTopics.push({
                title: topic.title,
                pinned: topic.pinned,
                externalRef: topic.topicId,
                posts,
            });
            totalPosts += posts.length;
        }
        if (!categoriesByName.has(forum.category)) {
            const category = { name: forum.category, forums: [] };
            categoriesByName.set(forum.category, category);
            out.forum.categories.push(category);
        }
        categoriesByName.get(forum.category).forums.push({
            name: forum.title,
            externalRef: forum.forumId,
            topics: exportedTopics,
        });
    }

    console.log(`Done: ${totalPosts} posts kept. Downloading the JSON…`);
    const blob = new Blob([JSON.stringify(out, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `ornaweb-import-forum-${gid}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();

    return out; // window.__glExport stays available in the console if the download is blocked
})();
