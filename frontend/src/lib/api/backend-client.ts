const backendApiBaseUrl = process.env.NEXT_PUBLIC_BACKEND_API_URL ?? 'http://localhost:4000/api/v1';
const defaultCompanyId = process.env.NEXT_PUBLIC_DEFAULT_COMPANY_ID;

interface BackendErrorDetails {
  formErrors?: string[];
  fieldErrors?: Record<string, string[] | undefined>;
  issues?: Array<{
    path?: string;
    message?: string;
  }>;
}

interface BackendErrorBody {
  error?: {
    message?: string;
    details?: BackendErrorDetails;
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
    const message = body.error?.message || `Request failed with status ${response.status}.`;
    const detailMessage = formatBackendErrorDetails(body.error?.details);
    return detailMessage ? `${message}: ${detailMessage}` : message;
  } catch {
    return `Request failed with status ${response.status}.`;
  }
}

function formatBackendErrorDetails(details?: BackendErrorDetails) {
  if (!details) return '';

  const messages = [
    ...formatIssueErrors(details.issues),
    ...formatFieldErrors(details.fieldErrors),
    ...(details.formErrors ?? []),
  ].filter(Boolean);

  const uniqueMessages = Array.from(new Set(messages));
  if (uniqueMessages.length === 0) return '';

  const visibleMessages = uniqueMessages.slice(0, 4);
  const remainingCount = uniqueMessages.length - visibleMessages.length;
  return `${visibleMessages.join(' ')}${remainingCount > 0 ? ` ${remainingCount} more issue(s).` : ''}`;
}

function formatIssueErrors(issues?: Array<{ path?: string; message?: string }>) {
  if (!issues) return [];
  return issues
    .map(issue => {
      if (!issue.message) return '';
      const path = formatErrorPath(issue.path);
      return path ? `${path}: ${issue.message}` : issue.message;
    })
    .filter(Boolean);
}

function formatFieldErrors(fieldErrors?: Record<string, string[] | undefined>) {
  if (!fieldErrors) return [];
  return Object.entries(fieldErrors).flatMap(([fieldName, errors]) => {
    const path = formatErrorPath(fieldName);
    return (errors ?? []).map(error => (path ? `${path}: ${error}` : error));
  });
}

function formatErrorPath(path?: string) {
  if (!path) return '';

  const parts = path.split('.').filter(Boolean);
  const labels: string[] = [];

  for (let index = 0; index < parts.length; index += 1) {
    const part = parts[index];
    const nextPart = parts[index + 1];
    if (part === 'lines' && nextPart && /^\d+$/.test(nextPart)) {
      labels.push(`Line ${Number(nextPart) + 1}`);
      index += 1;
      continue;
    }
    labels.push(toTitleCase(part));
  }

  return labels.join(' ');
}

function toTitleCase(value: string) {
  return value
    .replace(/_/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/\b\w/g, letter => letter.toUpperCase());
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
