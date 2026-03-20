import { useCallback, useEffect, useRef, useState } from "react";

export function useTimer(running: boolean) {
  const [seconds, setSeconds] = useState(0);
  const ref = useRef<number | null>(null);

  const reset = useCallback(() => setSeconds(0), []);

  useEffect(() => {
    if (running) {
      if (ref.current == null) {
        ref.current = window.setInterval(() => setSeconds((s) => s + 1), 1000);
      }
    } else if (ref.current != null) {
      clearInterval(ref.current);
      ref.current = null;
    }
    return () => {
      if (ref.current != null) {
        clearInterval(ref.current);
        ref.current = null;
      }
    };
  }, [running]);

  return { seconds, reset };
}
