import {
  buildRefreshPhotoUrl,
  canViewRefreshPhotos,
  isAllowedImageUpload,
  isValidRefreshPhotoPath,
  normalizeRefreshPhotos,
} from './refresh-photos.util';

describe('refresh-photos.util', () => {
  it('builds absolute urls from the public base url', () => {
    expect(buildRefreshPhotoUrl('/uploads/service-refresh/a.jpg', 'https://api.example.com/')).toBe(
      'https://api.example.com/uploads/service-refresh/a.jpg',
    );
    expect(buildRefreshPhotoUrl('/uploads/service-refresh/a.jpg', undefined)).toBe('/uploads/service-refresh/a.jpg');
    expect(buildRefreshPhotoUrl('https://cdn/x.jpg', 'https://api')).toBe('https://cdn/x.jpg');
  });

  it('only accepts paths produced by the upload endpoint', () => {
    expect(isValidRefreshPhotoPath('/uploads/service-refresh/1700-abc-def.jpg')).toBe(true);
    expect(isValidRefreshPhotoPath('/uploads/service-chat/1/a.jpg')).toBe(false);
    expect(isValidRefreshPhotoPath('/uploads/service-refresh/../x.jpg')).toBe(false);
    expect(isValidRefreshPhotoPath('/uploads/service-refresh/sub/x.jpg')).toBe(false);
    expect(isValidRefreshPhotoPath(42)).toBe(false);
  });

  it('normalizes the photo list (trim, dedupe, drop empties)', () => {
    expect(normalizeRefreshPhotos([' a ', 'a', '', null, 'b'])).toEqual(['a', 'b']);
    expect(normalizeRefreshPhotos(undefined)).toEqual([]);
  });

  it('accepts images only', () => {
    expect(isAllowedImageUpload({ mimetype: 'image/jpeg', originalname: 'x.jpg' })).toBe(true);
    expect(isAllowedImageUpload({ mimetype: 'application/octet-stream', originalname: 'x.HEIC' })).toBe(true);
    expect(isAllowedImageUpload({ mimetype: 'video/mp4', originalname: 'x.mp4' })).toBe(false);
    expect(isAllowedImageUpload({ mimetype: 'application/pdf', originalname: 'x.pdf' })).toBe(false);
  });

  it('allows admins, QA, managers, supervisors and the assigned cleaner', () => {
    const service = { userId: '10' };
    expect(canViewRefreshPhotos({ id: '10', roleId: '4' }, service)).toBe(true);
    expect(canViewRefreshPhotos({ id: '11', roleId: '4' }, service)).toBe(false);
    expect(canViewRefreshPhotos({ id: '11', roleId: '8' }, service)).toBe(false);
    for (const roleId of ['1', '9', '7', '3', '6']) {
      expect(canViewRefreshPhotos({ id: '99', roleId }, service)).toBe(true);
    }
    expect(canViewRefreshPhotos(null, service)).toBe(false);
  });
});
