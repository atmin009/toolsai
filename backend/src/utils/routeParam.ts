export function routeParam(param: string | string[] | undefined): string {
  if (param == null) return "";
  return Array.isArray(param) ? param[0] ?? "" : param;
}
