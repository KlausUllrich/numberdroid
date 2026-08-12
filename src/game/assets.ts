export function publicAsset(path: string) {
  const relativePath = path.replace(/^\/+/, "");
  return `${import.meta.env.BASE_URL}${relativePath}`;
}
