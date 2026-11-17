export function readBackendPort(): number {
  const port = Number(process.env['FLOWERBRO_BACKEND_PORT'] ?? 8080);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('FLOWERBRO_BACKEND_PORT deve essere una porta TCP valida.');
  }
  return port;
}
