import {
  fileNameOf,
  isCleanupDue,
  orphanFileNames,
  PHOTO_CLEANUP_INTERVAL_MS,
  resizeToFit,
} from '../photos';

describe('resizeToFit', () => {
  it('scales the long side down to 1280 px', () => {
    expect(resizeToFit(4000, 3000)).toEqual({ width: 1280 });
    expect(resizeToFit(3000, 4000)).toEqual({ height: 1280 });
    expect(resizeToFit(2000, 2000)).toEqual({ width: 1280 });
  });

  it('leaves small images alone', () => {
    expect(resizeToFit(1280, 720)).toBeNull();
    expect(resizeToFit(640, 480)).toBeNull();
  });

  it('accepts a custom limit', () => {
    expect(resizeToFit(800, 600, 400)).toEqual({ width: 400 });
  });
});

describe('fileNameOf', () => {
  it('takes the last segment and drops query/hash', () => {
    expect(fileNameOf('file:///data/user/0/app/files/meal-photos/abc.jpg')).toBe('abc.jpg');
    expect(fileNameOf('file:///x/abc.jpg?v=2#t')).toBe('abc.jpg');
    expect(fileNameOf('abc.jpg')).toBe('abc.jpg');
  });
});

describe('orphanFileNames', () => {
  it('returns files without an entry, matching by file name', () => {
    expect(
      orphanFileNames(
        ['a.jpg', 'b.jpg', 'c.jpg'],
        ['file:///docs/meal-photos/a.jpg', null, 'file:///old/container/meal-photos/c.jpg'],
      ),
    ).toEqual(['b.jpg']);
  });

  it('treats everything as orphaned when nothing is referenced', () => {
    expect(orphanFileNames(['a.jpg'], [])).toEqual(['a.jpg']);
  });
});

describe('isCleanupDue', () => {
  const now = 1_000_000_000_000;
  it('runs the first time and then at most once a day', () => {
    expect(isCleanupDue(null, now)).toBe(true);
    expect(isCleanupDue(Number.NaN, now)).toBe(true);
    expect(isCleanupDue(now - 1000, now)).toBe(false);
    expect(isCleanupDue(now - PHOTO_CLEANUP_INTERVAL_MS, now)).toBe(true);
  });
});
