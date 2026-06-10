const TIMEOUT_MS = 12_000;
const RETRY_DELAY_MS = 2_000;
const MAX_RETRIES = 3;
const RETRYABLE_STATUSES = new Set([429, 500, 502, 503, 504]);

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

function zeroSparkline() {
  return Array(10).fill(0);
}

function shouldRetryStatus(status) {
  return RETRYABLE_STATUSES.has(status);
}

async function waitForRetry(retryDelayMs) {
  if (retryDelayMs > 0) {
    await new Promise((resolve) => setTimeout(resolve, retryDelayMs));
  }
}

export async function github(path, { maxRetries = MAX_RETRIES, retryDelayMs = RETRY_DELAY_MS } = {}) {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    let response;
    try {
      response = await fetch(`https://api.github.com${path}`, {
        headers: buildHeaders(),
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
    } catch (err) {
      if (attempt < maxRetries) {
        await waitForRetry(retryDelayMs);
        continue;
      }
      throw err;
    }

    if (response.ok) return response.json();

    if (shouldRetryStatus(response.status) && attempt < maxRetries) {
      await waitForRetry(retryDelayMs);
      continue;
    }

    throw new Error(`GitHub API ${response.status}: ${await response.text()}`);
  }
}

export async function githubParticipation(
  username,
  repoName,
  { maxRetries = MAX_RETRIES, retryDelayMs = RETRY_DELAY_MS } = {},
) {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    let response;
    try {
      response = await fetch(
        `https://api.github.com/repos/${username}/${repoName}/stats/participation`,
        { headers: buildHeaders(), signal: AbortSignal.timeout(TIMEOUT_MS) },
      );
    } catch {
      if (attempt < maxRetries) {
        await waitForRetry(retryDelayMs);
        continue;
      }
      return zeroSparkline();
    }

    // 202 means GitHub is computing stats; ok:true but body is not ready.
    if (response.status === 202 || shouldRetryStatus(response.status)) {
      if (attempt < maxRetries) {
        await waitForRetry(retryDelayMs);
        continue;
      }
      return zeroSparkline();
    }

    if (!response.ok) return zeroSparkline();

    let data;
    try {
      data = await response.json();
    } catch {
      return zeroSparkline();
    }
    const all = data?.all;
    if (!Array.isArray(all) || all.length === 0) return zeroSparkline();
    return all.slice(-10);
  }

  return zeroSparkline();
}
