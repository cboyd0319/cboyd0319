const TIMEOUT_MS = 12_000;
const RETRY_DELAY_MS = 2_000;
const MAX_RETRIES = 3;

function buildHeaders() {
  const headers = {
    accept: "application/vnd.github+json",
    "x-github-api-version": "2022-11-28",
    "user-agent": "cboyd0319-profile-readme",
  };
  if (process.env.GITHUB_TOKEN) {
    headers.authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  }
  return headers;
}

export async function github(path) {
  const response = await fetch(`https://api.github.com${path}`, {
    headers: buildHeaders(),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });

  if (!response.ok) {
    throw new Error(`GitHub API ${response.status}: ${await response.text()}`);
  }

  return response.json();
}

export async function githubParticipation(username, repoName) {
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    let response;
    try {
      response = await fetch(
        `https://api.github.com/repos/${username}/${repoName}/stats/participation`,
        { headers: buildHeaders(), signal: AbortSignal.timeout(TIMEOUT_MS) },
      );
    } catch {
      return Array(10).fill(0);
    }

    // 202 means GitHub is computing stats — ok:true but body is not ready
    if (response.status === 202) {
      if (attempt < MAX_RETRIES) {
        await new Promise((r) => setTimeout(r, RETRY_DELAY_MS));
        continue;
      }
      return Array(10).fill(0);
    }

    if (!response.ok) return Array(10).fill(0);

    const data = await response.json();
    const all = data?.all;
    if (!Array.isArray(all) || all.length === 0) return Array(10).fill(0);
    return all.slice(-10);
  }

  return Array(10).fill(0);
}
