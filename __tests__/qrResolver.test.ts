import { qrResolver } from '../src/services/qrResolver';

describe('qrResolver', () => {
  it('parses valid url and uses query title when present', () => {
    const result = qrResolver.resolve(
      'https://docs.google.com/spreadsheets/d/demo123?title=Соя 3',
      [],
    );

    expect(result.sheetUrl).toContain('docs.google.com');
    expect(result.title).toBe('Соя 3');
    expect(result.plotPhotos).toHaveLength(3);
    expect(result.duplicateStatus).toBe(false);
  });

  it('marks duplicates', () => {
    const raw = 'https://example.com/table?id=1';
    const result = qrResolver.resolve(raw, [raw]);

    expect(result.duplicateStatus).toBe(true);
  });

  it('builds fallback title when title is missing', () => {
    const result = qrResolver.resolve('https://example.com/sheet/demo', []);

    expect(result.title.length).toBeGreaterThan(0);
  });

  it('throws for non-http urls', () => {
    expect(() => qrResolver.resolve('ftp://example.com/demo', [])).toThrow();
  });
});
