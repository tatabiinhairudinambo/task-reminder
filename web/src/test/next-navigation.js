// Test doubles for the Next modules the react-router shim imports. Vitest
// aliases `next/navigation` and `next/link` here (see vitest.config.js) so the
// ported client tests can render hooks/components without a Next runtime.

const noop = () => {};

export function useRouter() {
  return {
    push: noop,
    replace: noop,
    back: noop,
    forward: noop,
    refresh: noop,
    prefetch: noop,
  };
}

export function usePathname() {
  return '/dashboard';
}

export function useSearchParams() {
  return new URLSearchParams();
}

export function useParams() {
  return {};
}

export function redirect() {
  noop();
}
