#!/usr/bin/env python3
"""
Find the historical commit/tree that contains the most missing files,
then restore all missing files from the best source commit.
"""
import json
import subprocess
import os
import sys

REPO_DIR = "/home/z/my-project"

def main():
    # Load missing files
    with open(os.path.join(REPO_DIR, "scripts", "genuinely-missing.json")) as f:
        missing = json.load(f)
    missing_paths = [m["filepath"] for m in missing]
    print(f"Missing files to recover: {len(missing_paths)}")

    # Candidate commits that might contain the missing files
    # These are commits from arena branches that were merged but later lost from main
    candidates = [
        "74c04c5",   # Add secure SetupBot and fail-closed marketing safeguards
        "e493089",   # Complete the agency operating model
        "origin/arena/8d5a00bc-marketingos",  # latest on that arena branch
    ]

    # Also check the arena branch tips
    branches = subprocess.run(
        ["git", "branch", "-a", "--format=%(refname:short)"],
        capture_output=True, text=True, cwd=REPO_DIR
    ).stdout.strip().split("\n")
    arena_branches = [b.strip() for b in branches if "arena" in b]
    candidates.extend(arena_branches)

    # Deduplicate
    seen = set()
    unique_candidates = []
    for c in candidates:
        if c not in seen:
            seen.add(c)
            unique_candidates.append(c)

    print(f"\nChecking {len(unique_candidates)} candidate refs for file coverage...\n")

    best_commit = None
    best_count = 0
    best_files = []

    for candidate in unique_candidates:
        # Resolve to commit SHA
        try:
            sha = subprocess.run(
                ["git", "rev-parse", candidate],
                capture_output=True, text=True, cwd=REPO_DIR
            ).stdout.strip()
            if not sha or "HEAD" in sha and len(sha) < 10:
                continue
        except Exception:
            continue

        # Check how many missing files exist in this commit's tree
        found = 0
        found_files = []
        for path in missing_paths:
            try:
                result = subprocess.run(
                    ["git", "cat-file", "-e", f"{sha}:{path}"],
                    capture_output=True, cwd=REPO_DIR
                )
                if result.returncode == 0:
                    found += 1
                    found_files.append(path)
            except Exception:
                pass

        pct = (found / len(missing_paths) * 100) if missing_paths else 0
        icon = "🏆" if found > best_count else "  "
        print(f"  {icon} {candidate[:40]:40s} → {found:3d}/{len(missing_paths)} files ({pct:.0f}%)")

        if found > best_count:
            best_count = found
            best_commit = sha
            best_files = found_files

    print(f"\n{'='*70}")
    print(f"Best source: {best_commit}")
    print(f"Coverage: {best_count}/{len(missing_paths)} files ({best_count/len(missing_paths)*100:.0f}%)")
    print(f"{'='*70}")

    if best_count == 0:
        print("❌ No historical commit contains the missing files!")
        return 1

    # Check which files are NOT covered by the best commit
    not_covered = [p for p in missing_paths if p not in best_files]
    if not_covered:
        print(f"\n⚠️  {len(not_covered)} files NOT in best commit (may need other sources):")
        for p in not_covered:
            print(f"   {p}")

    # Save the best commit and covered files for the restore script
    result = {
        "best_commit": best_commit,
        "covered_files": best_files,
        "not_covered": not_covered,
        "total_missing": len(missing_paths),
    }
    with open(os.path.join(REPO_DIR, "scripts", "recovery-plan.json"), "w") as f:
        json.dump(result, f, indent=2)
    print(f"\nRecovery plan saved to scripts/recovery-plan.json")

    return 0

if __name__ == "__main__":
    sys.exit(main())
