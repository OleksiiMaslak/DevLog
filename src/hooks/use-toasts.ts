import { useRef, useState } from "react";

export type Toast = { id: number; message: string; type: "success" | "error" };

export function useToasts() {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const toastIdRef = useRef(0);
  const timersRef = useRef(new Map<number, ReturnType<typeof setTimeout>>());

  function dismissToast(id: number) {
    clearTimeout(timersRef.current.get(id));
    timersRef.current.delete(id);
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }

  function addToast(message: string, type: Toast["type"]) {
    const id = ++toastIdRef.current;
    setToasts((prev) => [...prev, { id, message, type }]);
    timersRef.current.set(id, setTimeout(() => dismissToast(id), 4000));
  }

  return { toasts, addToast, dismissToast };
}
