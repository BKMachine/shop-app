import type { Request } from 'express';
import trimRequestStrings, { trimStringValues } from '../trimRequestStrings.js';

describe('trimRequestStrings', () => {
  it('recursively trims string values in nested objects and arrays', () => {
    expect(
      trimStringValues({
        top: '  value  ',
        nested: {
          items: ['  one  ', 'two', 3, null],
          deeper: {
            empty: '   ',
          },
        },
      }),
    ).toEqual({
      top: 'value',
      nested: {
        items: ['one', 'two', 3, null],
        deeper: {
          empty: '',
        },
      },
    });
  });

  it('normalizes body, query, and params before route handlers run', () => {
    const req = {
      body: {
        name: '  Alice  ',
        tags: ['  first  ', ' second '],
        nested: { note: '  hello  ' },
      },
      query: {
        search: '  widget  ',
        ids: ['  a  ', ' b '],
      },
      params: {
        id: '  123  ',
      },
    } as unknown as Request;
    let nextCalls = 0;
    const next = () => {
      nextCalls += 1;
    };

    trimRequestStrings(req, {} as never, next);

    expect(req.body).toEqual({
      name: 'Alice',
      tags: ['first', 'second'],
      nested: { note: 'hello' },
    });
    expect(req.query).toEqual({
      search: 'widget',
      ids: ['a', 'b'],
    });
    expect(req.params).toEqual({ id: '123' });
    expect(nextCalls).toBe(1);
  });
});
