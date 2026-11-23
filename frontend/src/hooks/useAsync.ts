import { useCallback, useEffect, useRef, useState, type DependencyList } from 'react';

export interface AsyncState<T> {
  data: T | undefined;
  error: unknown;
  loading: boolean;
  reload(): void;
  setData(updater: (current: T | undefined) => T | undefined): void;
}

/** Runs an async loader on mount / when deps change, ignoring stale responses. */
export function useAsync<T>(loader: () => Promise<T>, deps: DependencyList): AsyncState<T> {
  const [data, setDataState] = useState<T | undefined>(undefined);
  const [error, setError] = useState<unknown>(undefined);
  const [loading, setLoading] = useState(true);
  const [nonce, setNonce] = useState(0);
  const callId = useRef(0);

  useEffect(() => {
    const id = ++callId.current;
    setLoading(true);
    setError(undefined);
    loader()
      .then((result) => {
        if (id === callId.current) setDataState(result);
      })
      .catch((err: unknown) => {
        if (id === callId.current) setError(err);
      })
      .finally(() => {
        if (id === callId.current) setLoading(false);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, nonce]);

  const reload = useCallback(() => setNonce((n) => n + 1), []);
  const setData = useCallback((updater: (current: T | undefined) => T | undefined) => setDataState(updater), []);

  return { data, error, loading, reload, setData };
}

export function useDebounced<T>(value: T, delayMs = 300): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);
  return debounced;
}
