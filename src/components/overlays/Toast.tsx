import type { Severity } from '../../types';

export interface ToastItem {
  id: number;
  severity: Severity;
  title: string;
  message: string;
}

interface Props {
  toasts: ToastItem[];
  onDismiss: (id: number) => void;
}

export function ToastStack({ toasts, onDismiss }: Props) {
  if (toasts.length === 0) return null;
  return (
    <div className="toast-stack" role="region" aria-label="Notifications">
      {toasts.map(t => (
        <div key={t.id} className={`toast toast--${t.severity}`} role="status">
          <div className="toast__bar" />
          <div className="toast__body">
            <div className="toast__title">{t.title}</div>
            <div className="toast__msg">{t.message}</div>
          </div>
          <button
            type="button"
            className="toast__close"
            aria-label="Dismiss"
            onClick={() => onDismiss(t.id)}
          >
            ×
          </button>
        </div>
      ))}
    </div>
  );
}
