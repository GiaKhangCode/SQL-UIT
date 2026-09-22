import { useEffect, useState, useCallback } from "react";
export function useLoad<T>(
  load: () => Promise<T>,
  dependencies: unknown[] = [],
) {
  const [data, setData] = useState<T>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const mutate = useCallback(async (newData?: T) => {
    if (newData !== undefined) {
      setData(newData);
      return newData;
    }
    setLoading(true);
    setError("");
    try {
      const value = await load();
      setData(value);
      return value;
    } catch (err) {
      setError("Student data could not be loaded. Please refresh to try again.");
    } finally {
      setLoading(false);
    }
  }, dependencies);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    load()
      .then((value) => {
        if (active) setData(value);
      })
      .catch(() => {
        if (active)
          setError(
            "Student data could not be loaded. Please refresh to try again.",
          );
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, dependencies);
  
  return { data, loading, error, mutate };
}
