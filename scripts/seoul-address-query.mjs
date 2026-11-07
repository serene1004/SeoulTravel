export function addressQuery(address) {
  const withoutDetails = address
    .trim()
    .replace(/^\d{3,6}(?:-\d{3,6})?\s+/, '')
    .replace(/\([^)]*\)/g, ' ')
    .replace(/(로|길)\s*(\d)/g, '$1 $2')
    .replace(/\s+/g, ' ')
    .trim();
  return withoutDetails.match(/^(.*?\s\d+(?:-\d+)?)(?=\s|$)/)?.[1] ?? withoutDetails;
}
