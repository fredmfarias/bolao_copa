import { useEffect, useRef } from 'react';

export function useAutoSave<T>(
  data: T,
  onSave: (data: T) => Promise<void>,
  delayMs = 1500
) {
  const onSaveRef = useRef(onSave);
  onSaveRef.current = onSave;

  useEffect(() => {
    const timer = setTimeout(() => {
      onSaveRef.current(data);
    }, delayMs);
    return () => clearTimeout(timer);
  }, [data, delayMs]);
}
