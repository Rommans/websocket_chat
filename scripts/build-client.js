const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const source = path.join(root, 'client');
const destination = path.join(root, 'dist');
const VERSIONED_ASSETS = ['style.css', 'chat.js'];

fs.rmSync(destination, { recursive: true, force: true });
fs.cpSync(source, destination, { recursive: true });

// GitHub Pages lets browsers cache files for 10 minutes, so a reload after a deploy could pair the new
// index.html with the previous stylesheet or script. Versioning their URLs by content makes the new page
// always fetch the matching files.
const indexPath = path.join(destination, 'index.html');
const html = VERSIONED_ASSETS.reduce((page, file) => {
    const reference = `"${file}"`;

    if (!page.includes(reference)) {
        throw new Error(`index.html does not reference ${file}; update VERSIONED_ASSETS in build-client.js`);
    }

    const hash = crypto.createHash('sha256')
        .update(fs.readFileSync(path.join(destination, file)))
        .digest('hex')
        .slice(0, 10);

    return page.replace(reference, `"${file}?v=${hash}"`);
}, fs.readFileSync(indexPath, 'utf8'));

fs.writeFileSync(indexPath, html);

console.log(`Built client into ${destination}`);
