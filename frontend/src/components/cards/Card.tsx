import { forwardRef, type HTMLAttributes, type ReactNode, type Ref } from 'react';

interface Props extends HTMLAttributes<HTMLDivElement> {
  className?: string;
  children?: ReactNode;
}

export const Card = forwardRef<HTMLDivElement, Props>(function Card(
  { className, children, ...rest }: Props,
  ref: Ref<HTMLDivElement>,
) {
  return (
    <div ref={ref} className={`card ${className ?? ''}`} {...rest}>
      {children}
    </div>
  );
});

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
