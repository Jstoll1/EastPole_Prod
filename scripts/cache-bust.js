#!/usr/bin/env node
/**
 * cache-bust.js
 *
 * Rewrites every `<asset>?v=...` query string in index.html and terminal.html
 * to the first 8 characters of the referenced file's SHA-256 hash. Run
 * from a git pre-commit hook (see scripts/install-hooks.sh) so cache
 * versions automatically track file content — no more manual ?v=NNN bumps.
 *
 * What it touches:
 *   - <link rel="stylesheet" href="./css/<file>?v=...">
 *   - <script defer src="./js/<file>?v=...">
 *
 * What it does NOT touch:
 *   - External URLs (no rewrite if href starts with http/https)
 *   - References without an existing ?v= query string (left alone — opt-in)
 *
 * Idempotent: running twice with no asset changes produces no diff.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.resolve(__dirname, '..');
const HTML_FILES = ['index.html', 'terminal.html'].map(f => path.join(ROOT, f));

// Match asset references with an existing ?v= so we only rewrite files
// that opt in. Captures: <prefix>./<dir>/<file>?v=<existing>
const ASSET_RE = /(["'])\.\/((?:js|css)\/[^"'?\s]+)\?v=[^"'\s]+(["'])/g;

function hashFile(filePath) {
  const buf = fs.readFileSync(filePath);
  return crypto.createHash('sha256').update(buf).digest('hex').slice(0, 8);
}

function rewrite(html, htmlPath) {
  let touched = 0;
  const out = html.replace(ASSET_RE, (match, q1, relPath, q2) => {
    const assetPath = path.join(ROOT, relPath);
    if (!fs.existsSync(assetPath)) {
      console.warn(`  ⚠ ${path.basename(htmlPath)}: ${relPath} not found, skipping`);
      return match;
    }
    const hash = hashFile(assetPath);
    touched++;
    return `${q1}./${relPath}?v=${hash}${q2}`;
  });
  return { out, touched };
}

let totalChanged = 0;
HTML_FILES.forEach(htmlPath => {
  if (!fs.existsSync(htmlPath)) return;
  const before = fs.readFileSync(htmlPath, 'utf8');
  const { out, touched } = rewrite(before, htmlPath);
  if (out !== before) {
    fs.writeFileSync(htmlPath, out);
    totalChanged++;
    console.log(`  ✎ ${path.basename(htmlPath)}: ${touched} asset refs rehashed`);
  } else {
    console.log(`  · ${path.basename(htmlPath)}: ${touched} refs scanned, no change`);
  }
});

if (totalChanged === 0) {
  process.exit(0);
}
console.log(`✅ cache-bust: ${totalChanged} HTML file(s) updated`);
