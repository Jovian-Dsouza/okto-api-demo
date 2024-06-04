export function getQueryString(query: any) {
  const queryParams: string[] = [];
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined) {
      queryParams.push(`${key}=${value}`);
    }
  }
  const queryString = queryParams.join("&");
  return queryString;
}
