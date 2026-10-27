/**
 * List the images of a Gamer Launch guild's galleries, to paste into the
 * browser console while on one of your guild site's pages (?gid=… in the URL).
 *
 * It only reads the gallery pages your session already sees, one request per
 * second, and downloads nothing but the list itself. Each image is listed in
 * its original size (the gallery shows a "…Thumb" copy; the original is the
 * same name without "Thumb").
 *
 * Output: gallery-urls-<gid>.txt, a ready-to-paste URLS list for
 * gamer-launch-images.js, with a comment line before each gallery.
 */
(async () => {
    const OPTIONS = {
        delayMs: 1000,          // one request per second
        maxPagesPerGallery: 100, // safety guard
    };

    const gid = new URLSearchParams(location.search).get('gid');
    if (!gid) {
        console.error('Open a page of the site with ?gid=… in the URL first.');
        return;
    }

    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    const base = `${location.origin}/gallery`;

    const fetchDoc = async (url) => {
        await sleep(OPTIONS.delayMs);
        const res = await fetch(url, { credentials: 'include' });
        if (!res.ok) {
            throw new Error(`${res.status} on ${url}`);
        }
        return new DOMParser().parseFromString(await res.text(), 'text/html');
    };

    // Path segments decoded then re-encoded: the gallery's raw "a b[1].jpg" becomes "a%20b%5B1%5D.jpg"
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

    // ".../nameThumb.jpg" → ".../name.jpg"
    const toOriginal = (thumbSrc) => thumbSrc.replace(/Thumb(\.[^./]+)$/, '$1');

    // Index: every gallery, from the grid and from the "Change Gallery" menu
    const readGalleries = async () => {
        const doc = await fetchDoc(`${base}/gallery.php?gid=${gid}`);
        const galleries = new Map();
        for (const a of doc.querySelectorAll('a[href*="gallery_detail.php"]')) {
            const id = new URL(a.getAttribute('href'), location.href).searchParams.get('gallery');
            const name = a.textContent.trim();
            if (id !== null && name && !galleries.has(id)) {
                const count = a.closest('td')?.textContent.match(/(\d+)\s+Images?/i);
                galleries.set(id, { id, name, expected: count ? Number(count[1]) : null });
            }
        }
        // Galleries missing from the grid, if any (the menu lists them all)
        for (const option of doc.querySelectorAll('#dl_gallery_pick option')) {
            const id = new URL(option.value, location.href).searchParams.get('gallery');
            if (id !== null && !galleries.has(id)) {
                galleries.set(id, { id, name: option.textContent.trim(), expected: null });
            }
        }
        return [...galleries.values()];
    };

    // One gallery: the original URL of each image, page by page
    const readImages = async (gallery) => {
        const urls = [];
        let found = null;
        for (let page = 0; page < OPTIONS.maxPagesPerGallery; page++) {
            const doc = await fetchDoc(`${base}/gallery_detail.php?gallery=${gallery.id}&paging_page=${page}&gid=${gid}`);
            let added = 0;
            for (const img of doc.querySelectorAll('.gallery_detail_container img.gallery-image')) {
                const url = normalize(toOriginal(img.getAttribute('src')));
                if (!urls.includes(url)) {
                    urls.push(url);
                    added++;
                }
            }
            // "75 Images found, showing 16"
            const total = doc.body.textContent.match(/(\d+)\s+Images?\s+found/i);
            found = total ? Number(total[1]) : found;
            if (added === 0 || (found !== null && urls.length >= found)) {
                break;
            }
        }
        const expected = found ?? gallery.expected;
        if (expected !== null && urls.length !== expected) {
            console.warn(`  "${gallery.name}": ${urls.length} images read, ${expected} announced.`);
        }
        return urls;
    };

    console.log(`Listing galleries gid=${gid} — reading the index…`);
    const galleries = await readGalleries();
    console.log(`${galleries.length} galleries found.`);

    const lines = ['const URLS = ['];
    let total = 0;
    for (const gallery of galleries) {
        let urls;
        try {
            urls = await readImages(gallery);
        } catch (e) {
            console.warn(`Gallery "${gallery.name}" skipped (${e.message})`);
            lines.push(`    // Gallery ${JSON.stringify(gallery.name)}: could not be read (${e.message})`);
            continue;
        }
        console.log(`  ${gallery.name}: ${urls.length} images`);
        if (!urls.length) {
            continue;
        }
        lines.push(`    // Gallery ${JSON.stringify(gallery.name.replace(/\s+/g, ' '))}`);
        lines.push(...urls.map((url) => `    '${url}',`));
        total += urls.length;
    }
    lines.push('];', '');
    const text = lines.join('\n');
    window.__glGalleryUrls = text;

    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([text], { type: 'text/plain' }));
    a.download = `gallery-urls-${gid}.txt`;
    document.body.appendChild(a);
    a.click();
    a.remove();

    console.log(`Done: ${total} images listed. If the download was blocked, the list is in window.__glGalleryUrls.`);
})();
