import { NextResponse } from "next/server";
import { withAuth } from "@/lib/api-middleware";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const API = "https://api.github.com";
const repository = () => process.env.DEPLOY_GITHUB_REPOSITORY || "";
const token = () => process.env.DEPLOY_GITHUB_TOKEN || "";
const workflow = () => process.env.DEPLOY_GITHUB_WORKFLOW || "deploy.yml";
const branch = () => process.env.DEPLOY_GITHUB_BRANCH || "main";

function headers() {
  return {
    Accept: "application/vnd.github+json",
    Authorization: `Bearer ${token()}`,
    "X-GitHub-Api-Version": "2022-11-28",
    "Content-Type": "application/json",
  };
}

export const GET = withAuth(async () => {
  const repo = repository();
  const configured = Boolean(token() && /^[\w.-]+\/[\w.-]+$/.test(repo));
  let runs: Array<{ id: number; name: string; status: string; conclusion: string | null; html_url: string; created_at: string }> = [];
  let providerError: string | undefined;
  if (configured) {
    try {
      const response = await fetch(`${API}/repos/${repo}/actions/workflows/${encodeURIComponent(workflow())}/runs?per_page=6`, {
        headers: headers(), cache: "no-store", signal: AbortSignal.timeout(8000),
      });
      if (!response.ok) providerError = response.status === 401 || response.status === 403 ? "GitHub token is invalid or lacks Actions read permission." : `GitHub returned HTTP ${response.status}.`;
      else {
        const body = await response.json();
        runs = (body.workflow_runs || []).map((run: Record<string, unknown>) => ({
          id: Number(run.id), name: String(run.name || "Deployment"), status: String(run.status || "unknown"),
          conclusion: run.conclusion ? String(run.conclusion) : null, html_url: String(run.html_url || ""), created_at: String(run.created_at || ""),
        }));
      }
    } catch { providerError = "Could not reach GitHub Actions API."; }
  }
  return NextResponse.json({ configured, provider: "GitHub Actions", repository: repo || null, workflow: workflow(), branch: branch(), runs, providerError });
}, { minRole: "company_owner" });

export const POST = withAuth(async (request) => {
  const repo = repository();
  if (!token() || !/^[\w.-]+\/[\w.-]+$/.test(repo)) {
    return NextResponse.json({ error: "Deployment provider is not configured. Set DEPLOY_GITHUB_REPOSITORY, DEPLOY_GITHUB_TOKEN, and optionally DEPLOY_GITHUB_WORKFLOW / DEPLOY_GITHUB_BRANCH on the server." }, { status: 503 });
  }
  let body: { imageTag?: unknown };
  try {
    const parsed: unknown = await request.json();
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return NextResponse.json({ error: "Request body must be a JSON object." }, { status: 400 });
    body = parsed as { imageTag?: unknown };
  } catch { return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 }); }
  if (body.imageTag !== undefined && typeof body.imageTag !== "string") return NextResponse.json({ error: "Image tag must be a string." }, { status: 400 });
  const imageTag = typeof body.imageTag === "string" ? body.imageTag.trim() : "latest";
  if (!/^(latest|[a-f0-9]{7,40})$/i.test(imageTag)) return NextResponse.json({ error: "Image tag must be 'latest' or a 7–40 character commit SHA." }, { status: 400 });

  try {
    const response = await fetch(`${API}/repos/${repo}/actions/workflows/${encodeURIComponent(workflow())}/dispatches`, {
      method: "POST", headers: headers(), body: JSON.stringify({ ref: branch(), inputs: { image_tag: imageTag } }),
      signal: AbortSignal.timeout(12000), cache: "no-store",
    });
    if (response.status !== 204) {
      const message = response.status === 404 || response.status === 422
        ? "GitHub workflow was not found or does not accept workflow_dispatch with the configured branch/input."
        : response.status === 401 || response.status === 403
          ? "GitHub token is invalid or lacks Actions write permission."
          : `GitHub rejected the deployment request (HTTP ${response.status}).`;
      return NextResponse.json({ error: message }, { status: 502 });
    }
    return NextResponse.json({ ok: true, message: "Deployment queued in GitHub Actions. The pipeline will run its CI, backup, migration, health-check and rollback safeguards." }, { status: 202 });
  } catch { return NextResponse.json({ error: "Could not reach GitHub Actions API." }, { status: 502 }); }
}, { minRole: "company_owner" });
