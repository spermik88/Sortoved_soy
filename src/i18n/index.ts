import { ru } from './ru';

function getValue(source: Record<string, unknown>, path: string) {
  return path.split('.').reduce<unknown>((acc, part) => {
    if (typeof acc === 'object' && acc !== null && part in acc) {
      return (acc as Record<string, unknown>)[part];
    }

    return path;
  }, source);
}

export function t(path: string): string {
  const value = getValue(ru as unknown as Record<string, unknown>, path);
  return typeof value === 'string' ? value : path;
}

export { ru };
