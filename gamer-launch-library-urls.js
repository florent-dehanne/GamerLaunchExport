/**
 * List the files of a Gamer Launch guild's File Library, to paste into the
 * browser console while on one of your guild site's pages (?gid=… in the URL).
 *
 * It only reads the File Library page your session already sees, and
 * downloads nothing but the list itself.
 *
 * Only images are listed by default: other files (videos, archives…) can
 * weigh tens of MB each and make the ZIP slow and heavy. They are added at the
 * end as commented-out lines with their size, to uncomment if wanted.
 *
 * Output: library-urls-<gid>.txt, a ready-to-paste URLS list for
 * gamer-launch-images.js.
 */
(async () => {
    const OPTIONS = {
        includeOtherFiles: false, // true: list videos, archives… like images
    };

    const IMAGE = /\.(jpe?g|png|gif|webp|bmp|svg)$/i;

    const gid = new URLSearchParams(location.search).get('gid');
    if (!gid) {
        console.error('Open a page of the site with ?gid=… in the URL first.');
        return;
    }

    // Path segments decoded then re-encoded: "a%20b.jpg" and "a b.jpg" give the same URL
    const normalize = (href) => {
        const url = new URL(href, location.href);
        url.protocol = 'https:';
        url.pathname = url.pathname.split('/').map((segment) => {
            const escaped = segment.replace(/%(?![0-9a-f]{2})/gi, '%25'); // a raw "100%" stays literal
            try {
                return encodeURIComponent(decodeURIComponent(escaped));
            } catch {
                return escaped; // not UTF-8 (e.g. a Latin-1 "%E4"): keep it as is
            }
        }).join('/');
        // Quotes would end the string in the list, parentheses would cut the URL in gamer-launch-images.js
        return url.href.replace(/'/g, '%27').replace(/\(/g, '%28').replace(/\)/g, '%29');
    };

    const res = await fetch(`${location.origin}/gallery/library.php?gid=${gid}`, { credentials: 'include' });
    if (!res.ok) {
        console.error(`Cannot read the File Library (HTTP ${res.status}).`);
        return;
    }
    const doc = new DOMParser().parseFromString(await res.text(), 'text/html');

    // Rows: file link, date, size ("42.29 MB")
    const urls = [];
    const others = [];
    const seen = new Set();
    for (const row of doc.querySelectorAll('table.data-table tr')) {
        const a = row.querySelector('td a[href]');
        if (!a) {
            continue;
        }
        const url = normalize(a.getAttribute('href'));
        if (!/^https:\/\/s3\.amazonaws\.com\//.test(url) || seen.has(url)) {
            continue;
        }
        seen.add(url);
        if (OPTIONS.includeOtherFiles || IMAGE.test(new URL(url).pathname)) {
            urls.push(url);
        } else {
            others.push({ url, size: row.querySelectorAll('td')[2]?.textContent.trim() || '?' });
        }
    }
    if (!urls.length && !others.length) {
        console.error('No file found in the File Library.');
        return;
    }

    const lines = ['// File Library', 'const URLS = ['];
    lines.push(...urls.map((url) => `    '${url}',`));
    if (others.length) {
        lines.push('    // Other files (videos, archives…), skipped: remove the "//" to download one');
        lines.push(...others.map(({ url, size }) => `    // '${url}', // ${size}`));
    }
    lines.push('];', '');
    const text = lines.join('\n');
    window.__glLibraryUrls = text;

    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([text], { type: 'text/plain' }));
    a.download = `library-urls-${gid}.txt`;
    document.body.appendChild(a);
    a.click();
    a.remove();

    console.log(`${urls.length} files listed` +
        (others.length ? `, ${others.length} other files commented out (videos, archives…)` : '') +
        '. If the download was blocked, the list is in window.__glLibraryUrls.');
})();
