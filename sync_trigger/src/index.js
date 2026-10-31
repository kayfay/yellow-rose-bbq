// Hourly trigger for the "Update Clover Data" GitHub Actions workflow.
export default {
  async scheduled(controller, env, ctx) {
    ctx.waitUntil(dispatchWorkflow(env));
  },
};

async function dispatchWorkflow(env) {
  const url = `https://api.github.com/repos/${env.GITHUB_REPO}/actions/workflows/${env.WORKFLOW_FILE}/dispatches`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.GITHUB_TOKEN}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'yellow-rose-sync-trigger',
    },
    body: JSON.stringify({ ref: env.GITHUB_REF }),
  });
  // GitHub returns 204 No Content on success; throw so the failure shows in the Worker's cron logs.
  if (res.status !== 204) {
    throw new Error(`Workflow dispatch failed: ${res.status} ${await res.text()}`);
  }
}
