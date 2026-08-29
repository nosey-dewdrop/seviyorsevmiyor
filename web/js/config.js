// Runtime config. The Worker hosts the Groq spiker (voice layer) only.
// Until it is deployed, cloud paths 403/fail and the app degrades gracefully to the on-device
// template lines — the product never breaks without the cloud.
export const API_BASE = 'https://seviyorsevmiyor-api.damummyphus.workers.dev';
