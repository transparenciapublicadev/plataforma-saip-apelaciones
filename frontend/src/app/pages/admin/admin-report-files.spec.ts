import { describe, expect, it } from 'vitest';
import { createReportPdf, csvOf } from './admin-report-files';

describe('Administrative report exports', () => {
  it('builds a query PDF containing the supplied records with the installed table plugin', () => {
    const document = createReportPdf({
      title: 'Synthetic query', head: [['Entity', 'Requests']],
      body: [['Known synthetic entity', 12]], file: 'synthetic-query.pdf',
    });
    const bytes = document.output();
    expect(bytes.startsWith('%PDF-')).toBe(true);
    expect(bytes).toContain('Known synthetic entity');
    expect(bytes).toContain('(12)');
    expect(bytes).toContain('Exportaci');
  });

  it('escapes CSV fields and keeps missing fields empty instead of manufacturing values', () => {
    expect(csvOf([['Entity', 'Requests'], ['Synthetic "entity"', 0], [undefined, null]]))
      .toBe('"Entity","Requests"\n"Synthetic ""entity""","0"\n"",""');
  });
});
