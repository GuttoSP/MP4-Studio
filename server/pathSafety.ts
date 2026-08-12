import { isAbsolute, relative, resolve } from 'node:path';

export function resolveInside(root: string, ...segments: string[]): string {
  if (segments.some((segment) => isAbsolute(segment))) {
    throw new Error('O caminho solicitado está fora da área controlada.');
  }
  const normalizedRoot = resolve(root);
  const candidate = resolve(normalizedRoot, ...segments);
  const offset = relative(normalizedRoot, candidate);
  if (offset === '..' || offset.startsWith(`..\\`) || offset.startsWith('../') || isAbsolute(offset)) {
    throw new Error('O caminho solicitado está fora da área controlada.');
  }
  return candidate;
}
