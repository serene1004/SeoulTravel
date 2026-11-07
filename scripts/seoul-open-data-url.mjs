export function getSeoulOpenDataBaseUrl(value, { allowInsecureHttpOnce = false } = {}) {
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new Error('SEOUL_OPEN_DATA_API_BASE_URL must be a valid URL.');
  }

  if (url.username || url.password || url.search || url.hash) {
    throw new Error(
      'SEOUL_OPEN_DATA_API_BASE_URL must not include credentials, a query, or a fragment.',
    );
  }

  if (url.protocol === 'https:') return url.href.replace(/\/+$/, '');

  const isOfficialHttpEndpoint =
    url.protocol === 'http:' &&
    url.hostname === 'openapi.seoul.go.kr' &&
    url.port === '8088' &&
    (url.pathname === '/' || url.pathname === '');
  if (!allowInsecureHttpOnce || !isOfficialHttpEndpoint) {
    throw new Error(
      'HTTP is allowed only for an explicitly opted-in one-time request against the official Seoul Open API endpoint.',
    );
  }

  return url.href.replace(/\/+$/, '');
}
