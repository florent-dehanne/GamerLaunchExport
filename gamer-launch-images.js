/**
 * Download the images hosted on Amazon S3 (s3.amazonaws.com) into a ZIP, to
 * paste into the browser console.
 *
 * Run it from a tab open on one of the images (a https://s3.amazonaws.com/...
 * address), NOT from the guild site: from any other page the browser blocks
 * the downloads (CORS).
 *
 * List the image URLs in URLS below: every S3 URL found there is kept,
 * duplicates removed.
 *
 * Output: gamer-launch-images.zip, with a manifest.json mapping each file to
 * its original URL and listing the failures.
 */
(async () => {
    // Your image URLs, one per line, each between quotes and followed by a comma:
    //     'https://s3.amazonaws.com/your-bucket/picture.jpg',
    const URLS = [
    ];

    const OPTIONS = {
        timeoutMs: 30000, // give up on an image after this delay
        retries: 1,       // extra attempts before an image counts as failed
    };

    const ORIGIN = 'https://s3.amazonaws.com';

    if (location.origin !== ORIGIN) {
        console.warn(`This page is on ${location.origin}: downloads will likely be blocked (CORS). ` +
            `Open one of the images (${ORIGIN}/...) in a tab and run the script there.`);
    }

    // Any S3 URL as path-style https, so it is same-origin with the tab;
    // null for a URL that is not on S3
    const toS3Url = (raw) => {
        // Trailing punctuation, and a ")" closing a parenthesis opened before the URL:
        // "(https://…/a_(3).jpg)," → "https://…/a_(3).jpg"
        let text = raw.replace(/&amp;/g, '&');
        for (;;) {
            const trimmed = text.replace(/[.,;:!?]+$/, '');
            const unbalanced = trimmed.endsWith(')')
                && trimmed.split('(').length < trimmed.split(')').length;
            const next = unbalanced ? trimmed.slice(0, -1) : trimmed;
            if (next === text) {
                break;
            }
            text = next;
        }
        let url;
        try {
            url = new URL(text);
        } catch {
            return null;
        }
        const host = url.hostname.toLowerCase();
        if (host === 's3.amazonaws.com') {
            return `${ORIGIN}${url.pathname}${url.search}`;
        }
        // Virtual-hosted style: bucket.s3.amazonaws.com/key → s3.amazonaws.com/bucket/key
        const m = host.match(/^(.+)\.s3\.amazonaws\.com$/);
        if (m) {
            return `${ORIGIN}/${m[1]}${url.pathname}${url.search}`;
        }
        return null;
    };

    // An entry may also be a piece of HTML or JSON: every URL in it is picked out
    const found = URLS.flatMap((text) => String(text).match(/https?:\/\/[^\s"'<>\\]+/gi) || []);
    const skipped = [];
    const urls = [];
    for (const raw of found) {
        const url = toS3Url(raw);
        if (url === null) {
            skipped.push(raw);
        } else if (!urls.includes(url)) {
            urls.push(url);
        }
    }
    if (skipped.length) {
        console.warn(`${skipped.length} URL(s) not on S3, skipped:`, skipped);
    }
    if (!urls.length) {
        console.error('No S3 URL found: add your URLs to the URLS list at the top of the script.');
        return;
    }

    try {
        if (typeof window.JSZip?.prototype?.generateAsync !== 'function') {
            await new Promise((resolve, reject) => {
                const s = document.createElement('script');
                s.src = 'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js';
                s.integrity = 'sha512-XMVd28F1oH/O71fzwBnV7HucLxVwtxf26XV8P4wPk26EDxuGZ91N8bsOttmnomcCD3CS5ZMRL50H0GgOHvegtg==';
                s.crossOrigin = 'anonymous';
                s.onload = resolve;
                s.onerror = () => reject(new Error('could not load JSZip from cdnjs.cloudflare.com'));
                // An S3 error page is an XML document, without a <head>
                (document.head || document.documentElement).appendChild(s);
            });
        }
        if (typeof window.JSZip?.prototype?.generateAsync !== 'function') {
            throw new Error('JSZip loaded but unavailable on this page');
        }
    } catch (e) {
        console.error(`Cannot build the ZIP: ${e.message}.`);
        return;
    }

    // The last path segment, decoded if possible, made safe as a file name
    const fileName = (url, index) => {
        const segment = new URL(url).pathname.split('/').pop();
        let name;
        try {
            name = decodeURIComponent(segment);
        } catch {
            name = segment; // malformed escape such as "100%" or a Latin-1 "%E4"
        }
        name = name
            .replace(/[\/\\:*?"<>|\x00-\x1f]/g, '_')
            .replace(/^\.+/, '')
            .slice(0, 150);
        return name || `image-${index + 1}`;
    };

    const EXTENSIONS = {
        'image/jpeg': 'jpg', 'image/png': 'png', 'image/gif': 'gif',
        'image/webp': 'webp', 'image/bmp': 'bmp', 'image/svg+xml': 'svg',
    };

    const fetchBlob = async (url) => {
        for (let attempt = 0; ; attempt++) {
            try {
                const response = await fetch(url, { signal: AbortSignal.timeout(OPTIONS.timeoutMs) });
                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}`);
                }
                return await response.blob();
            } catch (e) {
                if (attempt >= OPTIONS.retries) {
                    throw e;
                }
            }
        }
    };

    const zip = new JSZip();
    const pad = String(urls.length).length;
    const manifest = { files: [], failed: [] };

    for (let i = 0; i < urls.length; i++) {
        const url = urls[i];
        const progress = `[${i + 1}/${urls.length}]`;
        try {
            const blob = await fetchBlob(url);
            let name = fileName(url, i);
            const ext = EXTENSIONS[blob.type.split(';')[0]];
            if (ext && !/\.[a-z0-9]{2,4}$/i.test(name)) {
                name += `.${ext}`;
            }
            const entry = `${String(i + 1).padStart(pad, '0')}-${name}`;
            zip.file(entry, blob);
            manifest.files.push({ file: entry, url });
            console.log(`${progress} OK: ${entry}`);
        } catch (e) {
            manifest.failed.push({ url, error: e.message });
            console.warn(`${progress} Failed: ${url}`, e.message);
        }
    }

    if (!manifest.files.length) {
        console.error('No image retrieved. Check that this tab is on https://s3.amazonaws.com (CORS).');
        return;
    }

    zip.file('manifest.json', JSON.stringify(manifest, null, 2));
    console.log('Building the ZIP…');
    const archive = await zip.generateAsync({ type: 'blob' });

    const download = () => {
        const a = document.createElement('a');
        a.href = URL.createObjectURL(archive);
        a.download = 'gamer-launch-images.zip';
        (document.body || document.documentElement).appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(a.href), 60000);
    };
    window.__glImages = { archive, manifest, download };
    download();

    console.log(`${manifest.files.length}/${urls.length} images added to the ZIP.`);
    if (manifest.failed.length) {
        console.warn(`${manifest.failed.length} failed (also listed in manifest.json), to retry:\n` +
            manifest.failed.map((f) => f.url).join('\n'));
    }
    console.log('If the download was blocked, run __glImages.download() to try again.');
})();
