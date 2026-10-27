/**
 * List the files of a Gamer Launch guild's File Library, to paste into the
 * browser console while on one of your guild site's pages (?gid=… in the URL).
 *
 * It only reads the File Library page your session already sees, and
 * downloads nothing but the list itself.
 *
 * Output: library-urls-<gid>.txt, a ready-to-paste URLS list for
 * gamer-launch-images.js.
 */
(async () => {
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

    const urls = [];
    for (const a of doc.querySelectorAll('table.data-table td a[href]')) {
        const url = normalize(a.getAttribute('href'));
        if (/^https:\/\/s3\.amazonaws\.com\//.test(url) && !urls.includes(url)) {
            urls.push(url);
        }
    }
    if (!urls.length) {
        console.error('No file found in the File Library.');
        return;
    }

    const text = [
        '// File Library',
        'const URLS = [',
        ...urls.map((url) => `    '${url}',`),
        '];',
        '',
    ].join('\n');
    window.__glLibraryUrls = text;

    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([text], { type: 'text/plain' }));
    a.download = `library-urls-${gid}.txt`;
    document.body.appendChild(a);
    a.click();
    a.remove();

    console.log(`${urls.length} files listed. If the download was blocked, the list is in window.__glLibraryUrls.`);
})();
