import type { ReactNode } from 'react';

interface Props {
  className?: string;
  children?: ReactNode;
}

export function Card({ className, children }: Props) {
  return <div className={`card ${className ?? ''}`}>{children}</div>;
}

interface TitleProps {
  children: ReactNode;
  hint?: ReactNode;
  action?: ReactNode;
}

export function CardTitle({ children, hint, action }: TitleProps) {
  return (
    <h3 className="card-title">
      <span>
        {children}
        {hint && <span className="card-title__hint">{hint}</span>}
      </span>
      {action}
    </h3>
  );
}
