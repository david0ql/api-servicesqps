import {
  isLegacyMobileClient,
  isAllowedWhilePasswordChangePending,
  normalizeRequestPath,
  passwordChangeRequiredBody,
  shouldBlockForPasswordChange,
} from './password-change.util';

describe('password-change.util', () => {
  describe('normalizeRequestPath', () => {
    it('quita query, barra final y pasa a minúsculas', () => {
      expect(normalizeRequestPath('/Auth/Me/?x=1')).toBe('/auth/me');
      expect(normalizeRequestPath('/users/12?foo=bar')).toBe('/users/12');
      expect(normalizeRequestPath('')).toBe('/');
      expect(normalizeRequestPath(undefined)).toBe('/');
    });
  });

  describe('isAllowedWhilePasswordChangePending', () => {
    it.each([
      ['POST', '/auth'],
      ['POST', '/auth/'],
      ['GET', '/auth/me'],
      ['GET', '/auth/me?t=123'],
      ['POST', '/auth/change-password'],
      ['OPTIONS', '/services'],
    ])('permite %s %s', (method, url) => {
      expect(isAllowedWhilePasswordChangePending(method, url, '7')).toBe(true);
    });

    it.each([
      ['GET', '/services/by-user/7'],
      ['POST', '/services/by-communities'],
      ['GET', '/news/unread'],
      ['POST', '/news/1/accept'],
      ['GET', '/auth/me/extra'],
      ['GET', '/auth/change-password'],
      ['PATCH', '/users/7'],
      ['DELETE', '/users/7'],
      ['GET', '/users'],
      ['GET', '/users/roles'],
      ['POST', '/users/require-password-change'],
      ['POST', '/auth/change-password/x'],
    ])('bloquea %s %s', (method, url) => {
      expect(isAllowedWhilePasswordChangePending(method, url, '7')).toBe(false);
    });

    it('GET /users/:id solo para el propio usuario', () => {
      expect(isAllowedWhilePasswordChangePending('GET', '/users/7', '7')).toBe(true);
      expect(isAllowedWhilePasswordChangePending('GET', '/users/7', 7)).toBe(true);
      expect(isAllowedWhilePasswordChangePending('GET', '/users/8', '7')).toBe(false);
      expect(isAllowedWhilePasswordChangePending('GET', '/users/7', null)).toBe(false);
    });

    it('acepta método en minúsculas', () => {
      expect(isAllowedWhilePasswordChangePending('get', '/auth/me', '1')).toBe(true);
    });
  });

  describe('shouldBlockForPasswordChange', () => {
    it('no bloquea si el usuario no tiene la marca', () => {
      expect(shouldBlockForPasswordChange({ id: '1', mustChangePassword: false }, 'GET', '/services')).toBe(false);
      expect(shouldBlockForPasswordChange({ id: '1', mustChangePassword: 0 }, 'GET', '/services')).toBe(false);
      expect(shouldBlockForPasswordChange({ id: '1' }, 'GET', '/services')).toBe(false);
      expect(shouldBlockForPasswordChange(null, 'GET', '/services')).toBe(false);
    });

    it('con la marca bloquea datos y deja pasar la allowlist', () => {
      const user = { id: '5', mustChangePassword: true };
      expect(shouldBlockForPasswordChange(user, 'GET', '/services/by-user/5')).toBe(true);
      expect(shouldBlockForPasswordChange(user, 'GET', '/auth/me')).toBe(false);
      expect(shouldBlockForPasswordChange(user, 'POST', '/auth/change-password')).toBe(false);
      expect(shouldBlockForPasswordChange(user, 'GET', '/users/5')).toBe(false);
      expect(shouldBlockForPasswordChange({ id: '5', mustChangePassword: 1 }, 'GET', '/extras')).toBe(true);
    });
  });

  it('el cuerpo del 403 trae code y mensaje para apps viejas', () => {
    expect(passwordChangeRequiredBody()).toEqual(expect.objectContaining({
      statusCode: 403,
      code: 'PASSWORD_CHANGE_REQUIRED',
      message: 'Debes cambiar tu clave. Actualiza la app si no ves la opción.',
    }));
  });
});

describe('isLegacyMobileClient', () => {
  it('app vieja (sin header) no se bloquea; app nueva y web sí', () => {
    expect(isLegacyMobileClient({ 'user-agent': 'ServicesQPS/69 CFNetwork/3860.700.1 Darwin/25.6.0' })).toBe(true);
    expect(isLegacyMobileClient({ 'user-agent': 'okhttp/4.12.0' })).toBe(true);
    expect(isLegacyMobileClient({ 'user-agent': 'okhttp/4.12.0', 'x-qps-password-gate': '1' })).toBe(false);
    expect(isLegacyMobileClient({ 'user-agent': 'Mozilla/5.0 (Macintosh) Chrome/131' })).toBe(false);
    expect(isLegacyMobileClient(undefined)).toBe(false);
  });
});
