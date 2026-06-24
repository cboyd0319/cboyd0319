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

  throw new Error(`GitHub API request to ${path} exhausted retries`);
}
