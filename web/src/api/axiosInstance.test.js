import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// The Next port replaced the bearer token with an httpOnly cookie: there is no
// request interceptor, `withCredentials` is on, and baseURL is the relative
// "/api". Only the 401 redirect behaviour remains testable here.
describe('axiosInstance', () => {
  let axiosInstance;

  beforeEach(async () => {
    vi.resetModules();
    window.localStorage.clear();
    window.sessionStorage.clear();
    delete window.location;
    window.location = { href: '' };
    const mod = await import('./axiosInstance.js');
    axiosInstance = mod.default;
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.clearAllMocks();
    vi.restoreAllMocks();
  });

  it('targets the same-origin /api and sends the session cookie', () => {
    expect(axiosInstance.defaults.baseURL).toBe('/api');
    expect(axiosInstance.defaults.withCredentials).toBe(true);
  });

  it('has no request interceptor (auth is the cookie)', () => {
    expect(axiosInstance.interceptors.request.handlers.filter(Boolean)).toHaveLength(0);
  });

  it('response interceptor handles 401 and redirects', async () => {
    const error = {
      response: { status: 401 },
      config: {},
    };
    const interceptor = axiosInstance.interceptors.response.handlers[0];
    try {
      await interceptor.rejected(error);
    } catch (e) {
      expect(e).toEqual(error);
    }
    expect(window.location.href).toBe('/auth/login');
  });

  it('response interceptor does not redirect when skipAuthLogout is true', async () => {
    const error = {
      response: { status: 401 },
      config: { skipAuthLogout: true },
    };
    const interceptor = axiosInstance.interceptors.response.handlers[0];
    window.location.href = '';
    try {
      await interceptor.rejected(error);
    } catch {
      // interceptor is expected to re-reject
    }
    expect(window.location.href).not.toBe('/auth/login');
  });

  it('response interceptor passes through for non-401 status', async () => {
    const error = {
      response: { status: 500 },
      config: {},
    };
    const interceptor = axiosInstance.interceptors.response.handlers[0];
    try {
      await interceptor.rejected(error);
    } catch (e) {
      expect(e.response.status).toBe(500);
    }
  });
});
