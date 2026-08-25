import { describe, expect, it } from 'vitest';
import { countLinks, uniqueLinked } from '../threads';

const links = [
  { owner_id: 'a', target_type: 'KH', target_id: 'c1' },
  { owner_id: 'a', target_type: 'SP', target_id: 'p1' },
  { owner_id: 'a', target_type: 'KH', target_id: 'c2' },
  { owner_id: 'b', target_type: 'KH', target_id: 'c1' },
];

describe('countLinks', () => {
  it('đếm số link cho mỗi owner', () => {
    expect(countLinks(links, 'a')).toBe(3);
    expect(countLinks(links, 'b')).toBe(1);
    expect(countLinks(links, 'z')).toBe(0);
  });
});

describe('uniqueLinked', () => {
  it('trả id không trùng theo loại cho 1 owner', () => {
    const r = uniqueLinked(links, 'a', 'KH');
    expect(r).toEqual(['c1', 'c2']);
    expect(uniqueLinked(links, 'a', 'SP')).toEqual(['p1']);
  });
});
