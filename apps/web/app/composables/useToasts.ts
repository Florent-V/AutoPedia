export interface Toast {
  id: number;
  title: string;
  message?: string;
  icon?: string;
  tier?: string;
}

let seq = 0;

export function useToasts() {
  const toasts = useState<Toast[]>('toasts', () => []);
  function push(toast: Omit<Toast, 'id'>, duration = 5000) {
    const id = ++seq;
    toasts.value = [...toasts.value, { ...toast, id }];
    setTimeout(() => dismiss(id), duration);
  }
  function dismiss(id: number) {
    toasts.value = toasts.value.filter((t) => t.id !== id);
  }
  return { toasts, push, dismiss };
}
