/**
 * One-line JSON logs on stdout, so Docker and any log collector can search them by field.
 * Never pass passwords, tokens or request bodies in `fields`.
 */
type LogLevel = 'info' | 'warn' | 'error';

function write(level: LogLevel, message: string, fields: Record<string, unknown> = {}) {
  const entry = { time: new Date().toISOString(), level, message, service: 'erp-backend', ...fields };
  const line = JSON.stringify(entry, (_key, value) => (value instanceof Error ? { name: value.name, message: value.message, stack: value.stack } : value));
  if (level === 'error') console.error(line);
  else console.log(line);
}

export const logger = {
  info: (message: string, fields?: Record<string, unknown>) => write('info', message, fields),
  warn: (message: string, fields?: Record<string, unknown>) => write('warn', message, fields),
  error: (message: string, fields?: Record<string, unknown>) => write('error', message, fields),
};
