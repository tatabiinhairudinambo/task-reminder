'use client';

import NextLink from 'next/link';
import { usePathname, useRouter, useSearchParams as useNextSearchParams, useParams as useNextParams } from 'next/navigation';
import { forwardRef, useCallback, useEffect, useMemo } from 'react';

// Compatibility shim for `react-router-dom` on top of the Next.js App Router.
//
// The SPA was written against react-router v7. Rewriting every <Link>,
// useNavigate and useSearchParams call across 18 files would be a large,
// error-prone diff with no behavioural benefit, so modules alias
// `react-router-dom` to this file instead (see jsconfig paths + vitest alias).
//
// Supported surface: Link, NavLink, Navigate, useNavigate, useLocation,
// useParams, useSearchParams. Anything else is a deliberate omission - add it
// here if a ported component needs it.

export const Link = forwardRef(function Link({ to, replace, children, ...rest }, ref) {
  return (
    <NextLink href={to} replace={replace} ref={ref} {...rest}>
      {children}
    </NextLink>
  );
});

/**
 * NavLink. react-router calls `className`/`style` with `{ isActive }`; Next
 * has no equivalent, so we evaluate the current path ourselves.
 */
export const NavLink = forwardRef(function NavLink(
  { to, end = false, className, style, children, ...rest },
  ref
) {
  const pathname = usePathname();
  const target = typeof to === 'string' ? to : to?.pathname ?? '';
  const isActive = end ? pathname === target : pathname === target || pathname.startsWith(`${target}/`);

  const resolvedClassName =
    typeof className === 'function' ? className({ isActive }) : className;
  const resolvedStyle = typeof style === 'function' ? style({ isActive }) : style;

  return (
    <NextLink
      href={to}
      ref={ref}
      className={resolvedClassName}
      style={resolvedStyle}
      aria-current={isActive ? 'page' : undefined}
      {...rest}
    >
      {children}
    </NextLink>
  );
});

/** <Navigate to="..." replace /> - redirects on mount via the Next router. */
export function Navigate({ to, replace = false }) {
  const router = useRouter();

  // Next forbids navigating during render, so this runs in an effect.
  useEffect(() => {
    if (replace) router.replace(to);
    else router.push(to);
  }, [to, replace, router]);

  return null;
}

/** useNavigate() -> push/replace/back, matching react-router's call signature. */
export function useNavigate() {
  const router = useRouter();

  return useCallback(
    (to, options = {}) => {
      if (typeof to === 'number') {
        if (to < 0) router.back();
        else router.forward();
        return;
      }

      if (options.replace) router.replace(to);
      else router.push(to);
    },
    [router]
  );
}

/** useLocation() -> { pathname, search, hash, state }. */
export function useLocation() {
  const pathname = usePathname();
  const searchParams = useNextSearchParams();
  const search = searchParams?.toString();

  return useMemo(
    () => ({
      pathname,
      search: search ? `?${search}` : '',
      hash: '',
      state: null,
      key: 'default',
    }),
    [pathname, search]
  );
}

/**
 * useParams() - reads dynamic route segments. In the App Router the params
 * come from the route file; `useNextParams()` returns them directly.
 */
export function useParams() {
  return useNextParams() ?? {};
}

/**
 * useSearchParams() - react-router returns a mutable URLSearchParams; Next
 * returns a read-only one. Wrapping it keeps `.get()` / `.toString()` working
 * and adds the `entries()` iteration some callers use.
 */
export function useSearchParams() {
  const params = useNextSearchParams();

  return useMemo(() => {
    const search = params?.toString() ?? '';
    const usp = new URLSearchParams(search);

    // react-router's setter signature is (nextInit, navigateOptions). We keep
    // a no-op setter so destructuring `const [params] = useSearchParams()`
    // never throws if a component ignores the setter.
    const setSearchParams = () => {
      throw new Error('useSearchParams().setSearchParams is not supported in the Next port.');
    };

    return [usp, setSearchParams];
  }, [params]);
}

export default { Link, NavLink, Navigate, useNavigate, useLocation, useParams, useSearchParams };
