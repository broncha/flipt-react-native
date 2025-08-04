import React, {
  useContext,
  useCallback,
  createContext,
  useEffect,
  useRef,
  useMemo,
  useSyncExternalStore,
} from 'react';
import { FliptClient } from './wrapper';
import type { ClientOptions } from './wrapper';

export interface FliptClientHook {
  client: FliptClient | null;
  isLoading: boolean;
  error: Error | null;
}

export interface FliptStore extends FliptClientHook {
  subscribe: (onStoreChange: () => void) => () => void;
  attach: () => void;
  detach: () => void;
}

export const useStore = (options: ClientOptions): FliptStore => {
  const listeners = useMemo(() => new Set<() => void>(), []);

  const store = useMemo(
    () => ({
      client: null as FliptClient | null,
      isLoading: true,
      error: null as Error | null,
      subscribe: (listener: () => void) => {
        listeners.add(listener);
        return () => {
          listeners.delete(listener);
        };
      },
      attach: () => {
        mountedRef.current = true;
        setupPolling();
      },
      detach: () => {
        mountedRef.current = false;
        clearInterval(intervalIdRef.current);
        intervalIdRef.current = undefined;
      },
    }),
    [listeners]
  );

  const storeRef = useRef<FliptStore>(store);

  const notify = useCallback(() => {
    listeners.forEach((l) => l());
  }, [listeners]);

  const intervalIdRef = useRef<ReturnType<typeof setInterval> | undefined>(
    undefined
  );
  const mountedRef = useRef<boolean>(false);
  const lastHashRef = useRef<string | null>(null);

  const setupPolling = useCallback(() => {
    // Default to 120 seconds if updateInterval is not set
    const interval =
      (options.updateInterval !== undefined ? options.updateInterval : 10) *
      1000;
    if (
      interval > 0 &&
      mountedRef.current &&
      store.client !== null &&
      intervalIdRef.current === undefined
    ) {
      intervalIdRef.current = setInterval(() => {
        if (store.client && mountedRef.current) {
          try {
            const updated = store.client.refresh(lastHashRef.current);
            if (updated) {
              // Update our stored hash
              try {
                lastHashRef.current = store.client!.getSnapshotHash();
                notify();
              } catch (hashError) {
                // Still notify of changes even if we can't get the new hash
                notify();
              }
            }
          } catch (error) {
            lastHashRef.current = null;
          }
        }
      }, interval);
    }
  }, [options.updateInterval, store.client, notify]);

  useEffect(() => {
    mountedRef.current = true;

    return () => {
      mountedRef.current = false;
      if (intervalIdRef.current) {
        clearInterval(intervalIdRef.current);
        intervalIdRef.current = undefined;
      }
      // Clean up the FliptClient
      if (store.client) {
        store.client.close();
        store.client = null;
      }
    };
  }, [store]);

  useEffect(() => {
    let isMounted = true;

    const initializeClient = async () => {
      try {
        const client = new FliptClient({
          ...options,
        });

        if (isMounted) {
          store.client = client;
          store.isLoading = false;

          // Get initial hash
          try {
            lastHashRef.current = client.getSnapshotHash();
          } catch (hashError) {
            // Initial hash failed, will be handled on first poll
          }

          setupPolling();
          notify();
        }
      } catch (err) {
        if (isMounted) {
          console.error('Error initializing client:', err);
          store.error = err as Error;
          store.isLoading = false;
          notify();
        }
      }
    };

    initializeClient().catch((err) => {
      console.error('Unhandled error in initializeClient:', err);
      if (isMounted) {
        store.error = err as Error;
        store.isLoading = false;
        notify();
      }
    });

    return () => {
      isMounted = false;
    };
  }, [options, notify, setupPolling, store]);

  return store;
};

export interface FliptProviderProps {
  children: React.ReactNode;
  options: ClientOptions;
}

export const FliptContext = createContext<FliptStore | null>(null);

export const FliptProvider: React.FC<FliptProviderProps> = ({
  children,
  options,
}) => {
  const store = useStore(options);

  useEffect(() => {
    store.attach();
    return () => store.detach();
  }, [store]);

  return (
    <FliptContext.Provider value={store}>{children}</FliptContext.Provider>
  );
};

export const useFliptContext = (): FliptClientHook => {
  const context = useContext(FliptContext);
  if (context === null) {
    throw new Error('useFliptContext must be used within a FliptProvider');
  }
  return context;
};

export const useFliptSelector = <T extends unknown>(
  selector: (
    client: FliptClient | null,
    isLoading: boolean,
    error: Error | null
  ) => T
): T => {
  const store = useContext(FliptContext);
  if (store === null) {
    throw new Error('useFliptSelector must be used within a FliptProvider');
  }

  const selectorWrapper = useCallback(() => {
    return selector(store.client, store.isLoading, store.error);
  }, [store, selector]);

  return useSyncExternalStore(
    store.subscribe,
    selectorWrapper,
    selectorWrapper
  );
};

export const useFliptBoolean = (
  flagKey: string,
  fallback: boolean,
  entityId: string,
  context: Record<string, string> = {}
): boolean => {
  const result = useFliptSelector((client, isLoading, error) => {
    if (client && !isLoading && !error) {
      try {
        return client.evaluateBoolean({
          flagKey,
          entityId,
          context,
        }).enabled;
      } catch (e) {
        // Evaluation error - return fallback
      }
    }
    return fallback;
  });

  return result;
};

export const useFliptVariant = (
  flagKey: string,
  fallback: string,
  entityId: string,
  context: Record<string, string> = {}
): string => {
  const result = useFliptSelector((client, isLoading, error) => {
    if (client && !isLoading && !error) {
      try {
        return client.evaluateVariant({
          flagKey,
          entityId,
          context,
        }).variantKey;
      } catch (e) {
        // Evaluation error - return fallback
      }
    }
    return fallback;
  });

  return result;
};
