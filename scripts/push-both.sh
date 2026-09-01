#!/usr/bin/env bash
# Push to Origin (always) and GitHub (if GITHUB_TOKEN or GH_TOKEN is set).
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"
branch="$(git symbolic-ref --short HEAD)"

git push -u origin "$branch"

token="${GITHUB_TOKEN:-${GH_TOKEN:-}}"
if [[ -z "$token" ]]; then
  echo "GitHub skip: set GITHUB_TOKEN (or GH_TOKEN) in Cursor environment secrets."
  exit 0
fi

git push "https://x-access-token:${token}@github.com/Davidhr3104/multi-agent-orchestrator.git" "$branch"
echo "Pushed $branch to Origin + GitHub."
