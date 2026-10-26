/** Backend API address used by the Next.js server (sign-in and the /api/v1 proxy). Never used in the browser. */
export function backendInternalUrl() {
  const publicUrl = process.env.NEXT_PUBLIC_BACKEND_API_URL;
  const url = process.env.BACKEND_API_INTERNAL_URL
    || (publicUrl && !publicUrl.startsWith('/') ? publicUrl : 'http://localhost:4000/api/v1');
  return url.replace(/\/+$/, '');
}
