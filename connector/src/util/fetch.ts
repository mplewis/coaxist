export async function errorForResponse(res: Response): Promise<string> {
  const stat = `${res.status} ${res.statusText}`;
  const body = await res.text();
  return `${stat}\n${body}`;
}
