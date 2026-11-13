#!/usr/bin/env python3
"""
Verify that every file from every merged PR (1-38) exists on the main branch.
Fetches the file list for each PR via the GitHub API and checks each path
against the local working tree (which is checked out at origin/main HEAD).
"""
import json
import os
import subprocess
import urllib.request
import urllib.error
import time
import sys

TOKEN = os.environ.get("GITHUB_TOKEN", "")
if not TOKEN:
    print("ERROR: Set GITHUB_TOKEN env var first.")
    sys.exit(1)
REPO = "engralaminn-collab/MarketingOS"
REPO_DIR = "/home/z/my-project"

def api_get(url):
    """Fetch JSON from GitHub API with auth."""
    req = urllib.request.Request(url)
    req.add_header("Authorization", f"token {TOKEN}")
    req.add_header("Accept", "application/vnd.github+json")
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            return json.loads(resp.read().decode())
    except urllib.error.HTTPError as e:
        if e.code == 404:
            return None
        if e.code == 403:  # rate limited
            print(f"  ⚠️ Rate limited, waiting 10s...")
            time.sleep(10)
            return api_get(url)
        print(f"  HTTP {e.code}: {e.reason} for {url}")
        return None
    except Exception as e:
        print(f"  Error: {e} for {url}")
        return None

def get_pr_files(pr_number):
    """Get all files for a PR (handles pagination)."""
    files = []
    page = 1
    while True:
        url = f"https://api.github.com/repos/{REPO}/pulls/{pr_number}/files?per_page=100&page={page}"
        data = api_get(url)
        if not data:
            break
        files.extend(data)
        if len(data) < 100:
            break
        page += 1
        if page > 10:  # safety limit
            break
    return files

def file_exists_locally(filepath):
    """Check if a file exists in the local working tree."""
    full_path = os.path.join(REPO_DIR, filepath)
    return os.path.isfile(full_path)

def main():
    print("=" * 70)
    print("  Verifying ALL files from ALL 38 merged PRs exist on main")
    print("=" * 70)

    total_prs = 0
    total_files = 0
    total_added = 0
    total_modified = 0
    missing_files = []  # (pr_number, filepath, status)
    checked_prs = []

    for pr_num in range(1, 39):
        files = get_pr_files(pr_num)
        if files is None:
            print(f"  PR #{pr_num}: could not fetch files (skipping)")
            continue

        total_prs += 1
        checked_prs.append(pr_num)
        pr_missing = 0
        pr_added = 0
        pr_modified = 0
        pr_total = len(files)

        for f in files:
            filepath = f.get("filename", "")
            status = f.get("status", "")
            total_files += 1

            if status == "added":
                total_added += 1
                pr_added += 1
                if not file_exists_locally(filepath):
                    missing_files.append((pr_num, filepath, status))
                    pr_missing += 1
            elif status == "modified":
                total_modified += 1
                pr_modified += 1
                if not file_exists_locally(filepath):
                    missing_files.append((pr_num, filepath, status))
                    pr_missing += 1
            elif status == "removed":
                # Removed files should NOT exist — skip
                pass
            elif status == "renamed":
                # Check the new filename
                new_path = f.get("filename", "")
                if new_path and not file_exists_locally(new_path):
                    missing_files.append((pr_num, new_path, status))
                    pr_missing += 1

        status_icon = "✅" if pr_missing == 0 else "❌"
        print(f"  {status_icon} PR #{pr_num:2d}: {pr_total:3d} files ({pr_added} added, {pr_modified} modified) — {pr_missing} missing")

    print()
    print("=" * 70)
    print(f"  Summary: checked {total_prs} PRs, {total_files} total file entries")
    print(f"  Added: {total_added}, Modified: {total_modified}")
    print(f"  Missing files: {len(missing_files)}")
    print("=" * 70)

    if missing_files:
        print("\n❌ MISSING FILES (file from a merged PR not on current main):")
        for pr_num, filepath, status in missing_files:
            print(f"   PR #{pr_num} [{status}]: {filepath}")

        # Write missing files to a JSON for the fix script
        missing_path = os.path.join(REPO_DIR, "scripts", "missing-files.json")
        with open(missing_path, "w") as f:
            json.dump(missing_files, f, indent=2)
        print(f"\n  Missing files list saved to: {missing_path}")
        return 1
    else:
        print("\n✅ ALL files from ALL merged PRs are present on main!")
        return 0

if __name__ == "__main__":
    sys.exit(main())
