'use client';

import { useEffect, useRef } from 'react';

/**
 * Runs `callback` each time a dialog transitions to open. Used to (re)seed
 * forms without resetting them again when props change while the user types.
 */
export function useOnOpen(open: boolean, callback: () => void) {
  const callbackRef = useRef(callback);
  useEffect(() => {
    callbackRef.current = callback;
  });
  useEffect(() => {
    if (open) callbackRef.current();
  }, [open]);
}
