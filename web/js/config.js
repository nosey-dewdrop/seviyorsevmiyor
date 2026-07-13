// Runtime config. The Worker answers only low-confidence conversations, with consent.
// Until it is deployed with PUBLIC_READ="on", the cloud path returns 403 and the app degrades
// gracefully ("cloud read is not open yet").
export const API_BASE = 'https://whatdoyoumean-api.damummyphus.workers.dev';
