/** Photo flow with the native modules replaced by in-memory fakes. */
const mockFiles = new Set<string>();

jest.mock('expo-file-system', () => {
  class Directory {
    uri: string;
    constructor(base: { uri: string } | string, name: string) {
      this.uri = `${typeof base === 'string' ? base : base.uri}/${name}`;
    }
    create() {}
    get exists() {
      return true;
    }
    list() {
      return [...mockFiles]
        .filter((uri) => uri.startsWith(`${this.uri}/`))
        .map((uri) => new File(uri));
    }
  }
  class File {
    uri: string;
    constructor(base: { uri: string } | string, name?: string) {
      const root = typeof base === 'string' ? base : base.uri;
      this.uri = name ? `${root}/${name}` : root;
    }
    get name() {
      return this.uri.slice(this.uri.lastIndexOf('/') + 1);
    }
    get exists() {
      return mockFiles.has(this.uri);
    }
    delete() {
      mockFiles.delete(this.uri);
    }
    moveSync(target: File) {
      mockFiles.delete(this.uri);
      mockFiles.add(target.uri);
    }
  }
  return { Directory, File, Paths: { document: { uri: 'file:///docs' } } };
});

const mockResize = jest.fn();
const mockSaveAsync = jest.fn(async () => ({ uri: 'file:///cache/compressed.jpg' }));
jest.mock('expo-image-manipulator', () => ({
  SaveFormat: { JPEG: 'jpeg' },
  ImageManipulator: {
    manipulate: () => ({
      resize: mockResize,
      renderAsync: async () => ({ saveAsync: mockSaveAsync }),
    }),
  },
}));

const mockPicker = {
  requestCameraPermissionsAsync: jest.fn(),
  requestMediaLibraryPermissionsAsync: jest.fn(),
  launchCameraAsync: jest.fn(),
  launchImageLibraryAsync: jest.fn(),
};
// Lazy: the module under test is imported (hoisted) before mockPicker is initialised.
jest.mock('expo-image-picker', () => ({
  requestCameraPermissionsAsync: () => mockPicker.requestCameraPermissionsAsync(),
  requestMediaLibraryPermissionsAsync: () => mockPicker.requestMediaLibraryPermissionsAsync(),
  launchCameraAsync: (o: unknown) => mockPicker.launchCameraAsync(o),
  launchImageLibraryAsync: (o: unknown) => mockPicker.launchImageLibraryAsync(o),
}));

const mockReferenced = new Set<string>();
let mockCleanupAt: number | null = null;
jest.mock('@/db', () => ({
  repositories: {
    logs: {
      isPhotoReferenced: (uri: string) => mockReferenced.has(uri),
      photoUris: () => [...mockReferenced],
    },
    settings: {
      getPhotoCleanupAt: () => mockCleanupAt,
      setPhotoCleanupAt: (ms: number) => {
        mockCleanupAt = ms;
      },
    },
  },
}));

// eslint-disable-next-line import/first
import { cleanupOrphanPhotos, persistPhoto, pickPhoto, releasePhoto } from '../mealPhotos';

beforeEach(() => {
  mockFiles.clear();
  mockReferenced.clear();
  mockCleanupAt = null;
  jest.clearAllMocks();
});

describe('pickPhoto', () => {
  it('reports a denied permission without opening the camera', async () => {
    mockPicker.requestCameraPermissionsAsync.mockResolvedValue({
      granted: false,
      canAskAgain: false,
    });
    await expect(pickPhoto('camera')).resolves.toEqual({
      kind: 'denied',
      source: 'camera',
      canAskAgain: false,
    });
    expect(mockPicker.launchCameraAsync).not.toHaveBeenCalled();
  });

  it('compresses a large photo to 1280 px JPEG at 0.7', async () => {
    mockPicker.requestMediaLibraryPermissionsAsync.mockResolvedValue({ granted: true });
    mockPicker.launchImageLibraryAsync.mockResolvedValue({
      canceled: false,
      assets: [{ uri: 'file:///picked.jpg', width: 4000, height: 3000 }],
    });
    await expect(pickPhoto('library')).resolves.toEqual({
      kind: 'picked',
      uri: 'file:///cache/compressed.jpg',
    });
    expect(mockResize).toHaveBeenCalledWith({ width: 1280 });
    expect(mockSaveAsync).toHaveBeenCalledWith({ format: 'jpeg', compress: 0.7 });
  });

  it('does not upscale small photos and handles cancel', async () => {
    mockPicker.requestCameraPermissionsAsync.mockResolvedValue({ granted: true });
    mockPicker.launchCameraAsync.mockResolvedValueOnce({
      canceled: false,
      assets: [{ uri: 'file:///small.jpg', width: 800, height: 600 }],
    });
    await pickPhoto('camera');
    expect(mockResize).not.toHaveBeenCalled();

    mockPicker.launchCameraAsync.mockResolvedValueOnce({ canceled: true, assets: null });
    await expect(pickPhoto('camera')).resolves.toEqual({ kind: 'canceled' });
  });
});

describe('storage', () => {
  it('moves the picked file into documents/meal-photos with a uuid name', () => {
    mockFiles.add('file:///cache/compressed.jpg');
    const uri = persistPhoto('file:///cache/compressed.jpg');
    expect(uri).toMatch(/^file:\/\/\/docs\/meal-photos\/[0-9a-f-]{36}\.jpg$/);
    expect([...mockFiles]).toEqual([uri]);
  });

  it('deletes a photo only when no entry points to it', () => {
    const uri = 'file:///docs/meal-photos/a.jpg';
    mockFiles.add(uri);
    mockReferenced.add(uri);
    releasePhoto(uri);
    expect(mockFiles.has(uri)).toBe(true);

    mockReferenced.clear();
    releasePhoto(uri);
    releasePhoto(null);
    expect(mockFiles.has(uri)).toBe(false);
  });

  it('sweeps orphans at most once a day', () => {
    const kept = 'file:///docs/meal-photos/kept.jpg';
    const orphan = 'file:///docs/meal-photos/orphan.jpg';
    mockFiles.add(kept);
    mockFiles.add(orphan);
    mockReferenced.add(kept);

    expect(cleanupOrphanPhotos(1_000)).toBe(1);
    expect([...mockFiles]).toEqual([kept]);

    mockFiles.add(orphan);
    expect(cleanupOrphanPhotos(2_000)).toBe(0);
    expect(mockFiles.has(orphan)).toBe(true);
    expect(cleanupOrphanPhotos(1_000 + 24 * 3_600_000)).toBe(1);
  });
});
