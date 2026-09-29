import { ButtonHTMLAttributes, forwardRef } from 'react';

export interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** Required: icon-only buttons need an accessible name. */
  label: string;
  size?: 'sm' | 'md' | 'lg';
  glass?: boolean;
}

const cx = (...parts: Array<string | false | undefined>) => parts.filter(Boolean).join(' ');

const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { label, size = 'md', glass = true, className, children, type = 'button', title, ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      aria-label={label}
      title={title ?? label}
      className={cx('icon-btn', glass && 'glass', size !== 'md' && size, className)}
      {...rest}
    >
      {children}
    </button>
  );
});

export default IconButton;
