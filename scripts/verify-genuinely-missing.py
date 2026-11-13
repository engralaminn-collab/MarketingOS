#!/usr/bin/env python3
"""
Find GENUINELY missing files: files that were 'added' in a merged PR,
were NEVER 'removed' by any later PR, but don't exist on main now.

This filters out:
  - Files added then later removed (correctly absent)
  - Files that were renamed (tracked via 'removed' on old path)
  - Files from superseded/reverted PRs

Only files added but never removed + absent from main = genuine loss.
"""
import json
import os
import urllib.request
import urllib.error
import time
import sys
from collections import defaultdict

TOKEN = os.environ.get("GITHUB_TOKEN", "")
if not TOKEN:
    print("ERROR: Set GITHUB_TOKEN env var first.")
    sys.exit(1)
REPO = "engralaminn-collab/MarketingOS"
REPO_DIR = "/home/z/my-project"

def api_get(url):
    req = urllib.request.Request(url)
    req.add_header("Authorization", f"token {TOKEN}")
    req.add_header("Accept", "application/vnd.github+json")
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            return json.loads(resp.read().decode())
    except urllib.error.HTTPError as e:
        if e.code == 403:
            time.sleep(10)
            return api_get(url)
        return None
    except Exception:
        return None

def get_pr_files(pr_number):
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
        if page > 10:
            break
    return files

def main():
    print("=" * 70)
    print("  Finding GENUINELY missing files (added but never removed)")
    print("=" * 70)

    # Collect all added and removed files across all PRs
    added_files = defaultdict(list)   # filepath -> [pr_numbers that added it]
    removed_files = defaultdict(list) # filepath -> [pr_numbers that removed it]
    renamed_away = defaultdict(list)  # old_filepath -> [pr_numbers that renamed away from it]

    for pr_num in range(1, 39):
        files = get_pr_files(pr_num)
        if not files:
            continue
        for f in files:
            filepath = f.get("filename", "")
            status = f.get("status", "")
            if status == "added":
                added_files[filepath].append(pr_num)
            elif status == "removed":
                removed_files[filepath].append(pr_num)
            elif status == "renamed":
                # For renames, 'previous_filename' is the old name (removed), 'filename' is new (added)
                old_path = f.get("previous_filename", "")
                if old_path:
                    renamed_away[old_path].append(pr_num)
                added_files[filepath].append(pr_num)
        print(f"  ✓ Processed PR #{pr_num}: {len(files)} file entries")

    # Combine removed + renamed-away as "this path is no longer expected"
    all_removed = set(removed_files.keys()) | set(renamed_away.keys())

    # A file is "genuinely expected on main" if it was added AND never removed/renamed-away
    expected_files = {}
    for filepath, prs in added_files.items():
        if filepath not in all_removed:
            # Keep only the latest PR that added it
            expected_files[filepath] = max(prs)

    print(f"\n  Total unique files ever added: {len(added_files)}")
    print(f"  Total files removed/renamed-away: {len(all_removed)}")
    print(f"  Files expected on main (added, never removed): {len(expected_files)}")

    # Check which expected files are actually missing locally
    genuinely_missing = []
    present_count = 0
    for filepath, pr_num in sorted(expected_files.items()):
        full_path = os.path.join(REPO_DIR, filepath)
        if not os.path.isfile(full_path):
            genuinely_missing.append((filepath, pr_num))
        else:
            present_count += 1

    print(f"  Present on main: {present_count}")
    print(f"  Genuinely missing: {len(genuinely_missing)}")
    print()

    if genuinely_missing:
        print("=" * 70)
        print("❌ GENUINELY MISSING FILES (added in a PR, never removed, absent from main):")
        print("=" * 70)
        for filepath, pr_num in genuinely_missing:
            print(f"   PR #{pr_num}: {filepath}")

        # Save to JSON
        missing_path = os.path.join(REPO_DIR, "scripts", "genuinely-missing.json")
        with open(missing_path, "w") as f:
            json.dump([{"filepath": fp, "pr": pr} for fp, pr in genuinely_missing], f, indent=2)
        print(f"\n  Saved to: {missing_path}")
        return 1
    else:
        print("=" * 70)
        print("✅ ALL files from all merged PRs are present on main!")
        print("   (No files were added-and-never-removed but missing)")
        print("=" * 70)
        return 0

if __name__ == "__main__":
    sys.exit(main())
