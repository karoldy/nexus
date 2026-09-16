import { describe, expect, it } from 'vitest';
import { normalizeContentPayload } from './content-payload';

describe('normalizeContentPayload', () => {
  it('requires body for NOTE and ARTICLE and nulls file fields', () => {
    const note = normalizeContentPayload({ type: 'NOTE', title: ' n ', body: ' hello ' });
    expect(note).toMatchObject({
      type: 'NOTE',
      title: 'n',
      body: 'hello',
      url: null,
      fileKey: null,
    });
    expect(() => normalizeContentPayload({ type: 'ARTICLE', title: 'a' })).toThrow(/body/i);
  });

  it('requires fileKey for DOCUMENT and url for RESOURCE', () => {
    const doc = normalizeContentPayload({
      type: 'DOCUMENT',
      title: 'spec',
      fileKey: ' uploads/a.pdf ',
      mimeType: 'application/pdf',
      fileSize: 12,
    });
    expect(doc.fileKey).toBe('uploads/a.pdf');
    expect(doc.body).toBeNull();
    expect(() => normalizeContentPayload({ type: 'RESOURCE', title: 'link' })).toThrow(/url/i);
    const resource = normalizeContentPayload({
      type: 'RESOURCE',
      title: 'link',
      url: ' https://example.com ',
    });
    expect(resource.url).toBe('https://example.com');
    expect(resource.fileKey).toBeNull();
  });

  it('rejects negative fileSize', () => {
    expect(() =>
      normalizeContentPayload({
        type: 'DOCUMENT',
        title: 'spec',
        fileKey: 'a',
        fileSize: -1,
      }),
    ).toThrow(/fileSize/i);
  });
});
