"use client";

import { useState, useEffect, useCallback, useRef, useReducer } from "react";
import { api } from "@/lib/api-client";

interface UseApiQueryOptions {
  enabled?: boolean;
}

interface UseApiQueryResult<T> {
  data: T | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
}

interface QueryState<T> {
  data: T | null;
  isLoading: boolean;
  error: string | null;
}

type QueryAction<T> =
  | { type: "FETCH_START" }
  | { type: "FETCH_SUCCESS"; data: T }
  | { type: "FETCH_ERROR"; error: string }
  | { type: "FETCH_RESET" };

function queryReducer<T>(
  state: QueryState<T>,
  action: QueryAction<T>
): QueryState<T> {
  switch (action.type) {
    case "FETCH_START":
      return { ...state, isLoading: true, error: null };
    case "FETCH_SUCCESS":
      return { data: action.data, isLoading: false, error: null };
    case "FETCH_ERROR":
      return { data: null, isLoading: false, error: action.error };
    case "FETCH_RESET":
      return { data: null, isLoading: false, error: null };
  }
}

export function useApiQuery<T>(
  path: string | null,
  options?: UseApiQueryOptions
): UseApiQueryResult<T> {
  const [state, dispatch] = useReducer(queryReducer<T>, {
    data: null,
    isLoading: false,
    error: null,
  });
  const [triggerKey, setTriggerKey] = useState(0);
  const abortRef = useRef<AbortController | null>(null);

  const enabled = options?.enabled !== false;
  const canFetch = path && enabled;

  const refetch = useCallback(() => {
    setTriggerKey((k) => k + 1);
  }, []);

  useEffect(() => {
    if (!canFetch) return;

    if (abortRef.current) {
      abortRef.current.abort();
    }

    const controller = new AbortController();
    abortRef.current = controller;

    dispatch({ type: "FETCH_START" });

    api
      .get<T>(path)
      .then((result) => {
        if (!controller.signal.aborted) {
          dispatch({ type: "FETCH_SUCCESS", data: result });
        }
      })
      .catch((err: Error) => {
        if (!controller.signal.aborted) {
          dispatch({ type: "FETCH_ERROR", error: err.message || "Request failed" });
        }
      });

    return () => {
      controller.abort();
    };
  }, [path, enabled, triggerKey]);

  return { ...state, refetch };
}

interface UseApiMutationOptions<TData, TResult = unknown> {
  method?: "POST" | "PUT" | "PATCH" | "DELETE";
  path?: string;
  onSuccess?: (data: TResult) => void;
  onError?: (error: string) => void;
}

interface UseApiMutationResult<TData, TResult = unknown> {
  mutate: (data: TData, pathOverride?: string) => void;
  mutateAsync: (data: TData, pathOverride?: string) => Promise<TResult>;
  isLoading: boolean;
  error: string | null;
  reset: () => void;
}

export function useApiMutation<TData, TResult = unknown>(
  options?: UseApiMutationOptions<TData, TResult>
): UseApiMutationResult<TData, TResult> {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const method = options?.method || "POST";

  const mutateAsync = useCallback(
    async (data: TData, pathOverride?: string): Promise<TResult> => {
      const url = pathOverride || options?.path;
      if (!url) throw new Error("No path provided for mutation");

      setIsLoading(true);
      setError(null);

      try {
        let result: TResult;
        if (method === "PUT") {
          result = await api.put<TResult>(url, data);
        } else if (method === "PATCH") {
          result = await api.patch<TResult>(url, data);
        } else if (method === "DELETE") {
          result = await api.del<TResult>(url);
        } else {
          result = await api.post<TResult>(url, data);
        }

        options?.onSuccess?.(result);
        return result;
      } catch (err: unknown) {
        const message =
          err instanceof Error ? err.message : "Request failed";
        setError(message);
        options?.onError?.(message);
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    [method, options?.path]
  );

  const mutate = useCallback(
    (data: TData, pathOverride?: string) => {
      mutateAsync(data, pathOverride).catch(() => {
        // Error already handled in mutateAsync
      });
    },
    [mutateAsync]
  );

  const reset = useCallback(() => {
    setError(null);
    setIsLoading(false);
  }, []);

  return { mutate, mutateAsync, isLoading, error, reset };
}