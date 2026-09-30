'use client';

import { useEffect } from 'react';

/**
 * Applies the experience accent (admin / agency / client) on <html> so
 * content rendered in portals (dialogs, menus, toasts) inherits it too.
 */
export function usePortalTheme(portal: 'admin' | 'agency' | 'client') {
  useEffect(() => {
    const root = document.documentElement;
    root.dataset.portal = portal;
    return () => {
      if (root.dataset.portal === portal) delete root.dataset.portal;
    };
  }, [portal]);
}
