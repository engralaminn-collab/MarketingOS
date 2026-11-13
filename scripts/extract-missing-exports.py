#!/usr/bin/env python3
"""
Extract missing function exports from the arena branch and append them
to the current main's lib files. This fixes the build errors without
overwriting existing main code.
"""
import subprocess
import os

ARENA = "f4b4c549f610eae0655dba59f806f2c460b80792"
REPO = "/home/z/my-project"

def arena_show(path):
    """Get file content from arena branch."""
    result = subprocess.run(
        ["git", "show", f"{ARENA}:{path}"],
        capture_output=True, text=True, cwd=REPO
    )
    return result.stdout if result.returncode == 0 else ""

def extract_function(content, name, is_export=True):
    """Extract a function/const/interface definition by name, including its full body."""
    lines = content.split("\n")
    start = None
    for i, line in enumerate(lines):
        # Match export statements: "export const NAME", "export async function NAME", "export function NAME", "export interface NAME"
        if f"export const {name}" in line or f"export async function {name}" in line or \
           f"export function {name}" in line or f"export interface {name}" in line or \
           f"export type {name}" in line:
            start = i
            break
    if start is None:
        return None

    # Find the end of the definition by tracking brace depth
    depth = 0
    end = start
    started_braces = False
    for i in range(start, len(lines)):
        line = lines[i]
        # Count braces
        depth += line.count("{") - line.count("}")
        if "{" in line:
            started_braces = True
        if started_braces and depth <= 0 and i > start:
            end = i
            break
        # For const without braces (e.g., export const X = [...]; ends with ;)
        if not started_braces and ";" in line and i == start:
            end = i
            break

    return "\n".join(lines[start:end+1])

def append_to_file(filepath, content, marker):
    """Append content to a file with a marker comment."""
    with open(filepath, "r") as f:
        existing = f.read()

    if marker in existing:
        print(f"  ⏭️  {filepath}: already has {marker}")
        return

    with open(filepath, "a") as f:
        f.write(f"\n\n// {marker}\n")
        f.write(content)
    print(f"  ✅ {filepath}: appended {marker}")

def main():
    print("Extracting missing exports from arena branch and appending to main lib files...\n")

    # 1. agent-tools.ts: AGENT_TOOL_DEFINITIONS + runMultiStepFreeAgent
    print("▶ src/lib/agent-tools.ts")
    arena_agent = arena_show("src/lib/agent-tools.ts")
    atd = extract_function(arena_agent, "AGENT_TOOL_DEFINITIONS")
    rmsa = extract_function(arena_agent, "runMultiStepFreeAgent")
    if atd and rmsa:
        append_to_file(
            os.path.join(REPO, "src/lib/agent-tools.ts"),
            f"\n{atd}\n\n{rmsa}\n",
            "Restored from arena branch (PR #15)"
        )

    # 2. ai-extensions.ts: transcribeFreeSpeech + analyzeAiWritingTells
    print("▶ src/lib/ai-extensions.ts")
    arena_ai = arena_show("src/lib/ai-extensions.ts")
    tfs = extract_function(arena_ai, "transcribeFreeSpeech")
    awt = extract_function(arena_ai, "analyzeAiWritingTells")
    if tfs and awt:
        append_to_file(
            os.path.join(REPO, "src/lib/ai-extensions.ts"),
            f"\n{tfs}\n\n{awt}\n",
            "Restored from arena branch (PR #14/#15)"
        )

    # 3. security.ts: isSecureTransport + rateLimiter
    print("▶ src/lib/security.ts")
    arena_sec = arena_show("src/lib/security.ts")
    ist = extract_function(arena_sec, "isSecureTransport")
    rl = extract_function(arena_sec, "rateLimiter")
    if ist and rl:
        append_to_file(
            os.path.join(REPO, "src/lib/security.ts"),
            f"\n{ist}\n\n{rl}\n",
            "Restored from arena branch (PR #21)"
        )

    # 4. ssrf.ts: SafeTextResponse interface + safeFetchText
    print("▶ src/lib/ssrf.ts")
    arena_ssrf = arena_show("src/lib/ssrf.ts")
    # SafeTextResponse is an interface
    str_iface = extract_function(arena_ssrf, "SafeTextResponse")
    sft = extract_function(arena_ssrf, "safeFetchText")
    if str_iface and sft:
        append_to_file(
            os.path.join(REPO, "src/lib/ssrf.ts"),
            f"\n{str_iface}\n\n{sft}\n",
            "Restored from arena branch (PR #21)"
        )

    print("\n✅ Done extracting and appending missing exports")

if __name__ == "__main__":
    main()
