const backendApiBaseUrl = process.env.NEXT_PUBLIC_BACKEND_API_URL ?? 'http://localhost:4000/api/v1';
const defaultCompanyId = process.env.NEXT_PUBLIC_DEFAULT_COMPANY_ID;

interface BackendErrorBody {
  error?: {
    message?: string;
  };
}

export class BackendApiError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
  ) {
    super(message);
    this.name = 'BackendApiError';
  }
}

async function readErrorMessage(response: Response) {
  try {
    const body = await response.json() as BackendErrorBody;
    return body.error?.message || `Request failed with status ${response.status}.`;
  } catch {
    return `Request failed with status ${response.status}.`;
  }
}

export async function backendGet<TResponse>(path: string): Promise<TResponse> {
  const response = await fetch(`${backendApiBaseUrl}${path}`, {
    method: 'GET',
    headers: {
      Accept: 'application/json',
      ...(defaultCompanyId ? { 'x-company-id': defaultCompanyId } : {}),
    },
  });

  if (!response.ok) {
    throw new BackendApiError(await readErrorMessage(response), response.status);
  }

  return response.json() as Promise<TResponse>;
}

export async function backendPost<TResponse, TBody>(path: string, body: TBody): Promise<TResponse> {
  const response = await fetch(`${backendApiBaseUrl}${path}`, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      ...(defaultCompanyId ? { 'x-company-id': defaultCompanyId } : {}),
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    throw new BackendApiError(await readErrorMessage(response), response.status);
  }

  return response.json() as Promise<TResponse>;
}

export async function backendPatch<TResponse, TBody>(path: string, body: TBody): Promise<TResponse> {
  const response = await fetch(`${backendApiBaseUrl}${path}`, {
    method: 'PATCH',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      ...(defaultCompanyId ? { 'x-company-id': defaultCompanyId } : {}),
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    throw new BackendApiError(await readErrorMessage(response), response.status);
  }

  return response.json() as Promise<TResponse>;
}

export async function backendDelete<TResponse>(path: string): Promise<TResponse> {
  const response = await fetch(`${backendApiBaseUrl}${path}`, {
    method: 'DELETE',
    headers: {
      Accept: 'application/json',
      ...(defaultCompanyId ? { 'x-company-id': defaultCompanyId } : {}),
    },
  });

  if (!response.ok) {
    throw new BackendApiError(await readErrorMessage(response), response.status);
  }

  return response.json() as Promise<TResponse>;
}
