#!/usr/bin/env bash
# Install the git pre-commit hook that runs cache-bust.js before every commit.
#
# Run once after cloning the repo:
#     bash scripts/install-hooks.sh
#
# After install, every `git commit` automatically rehashes ?v= cache busters
# in index.html / terminal.html so the deployed bundle stays in sync with
# the source files.
set -euo pipefail

REPO_ROOT="$(git rev-parse --show-toplevel)"
HOOK_PATH="$REPO_ROOT/.git/hooks/pre-commit"

cat > "$HOOK_PATH" <<'HOOK'
#!/usr/bin/env bash
# Auto-installed by scripts/install-hooks.sh — do not edit by hand.
set -euo pipefail
REPO_ROOT="$(git rev-parse --show-toplevel)"

# Only run if any tracked asset (css/, js/, *.html) is staged.
STAGED=$(git diff --cached --name-only --diff-filter=ACM | grep -E '^(css/|js/|.*\.html)$' || true)
if [ -z "$STAGED" ]; then
  exit 0
fi

# Rewrite ?v= hashes against the working tree (not the staged blobs — close
# enough since the staged content matches working tree at commit time).
node "$REPO_ROOT/scripts/cache-bust.js"

# If cache-bust.js modified index.html / terminal.html, re-stage them so
# the new hashes land in this commit instead of trailing it.
git add "$REPO_ROOT/index.html" "$REPO_ROOT/terminal.html" 2>/dev/null || true
HOOK

chmod +x "$HOOK_PATH"
echo "✅ pre-commit hook installed at .git/hooks/pre-commit"
echo "   Test it: touch js/utils.js && git add js/utils.js && git commit -m 'test'"
