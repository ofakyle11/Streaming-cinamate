import type { FormHTMLAttributes, ReactNode } from 'react';
import LogoMark from '../brand/LogoMark';
import '../../styles/auth.css';

export interface AuthCardProps extends FormHTMLAttributes<HTMLElement> {
  /** The card's h1. */
  title: string;
  /** One line under the title. */
  lead?: ReactNode;
  /** Glyph above the title: the Lumen mark (default) or a custom icon node. */
  icon?: ReactNode;
  /** Render the card as a <form>. */
  as?: 'form' | 'section';
  children?: ReactNode;
}

/**
 * The centred glass card every sign-in state sits in: sign-in form, "check
 * your email", expired link and the callback spinner. Takes the page's main
 * landmark so the route announcer and skip link land on it.
 */
export default function AuthCard({
  title,
  lead,
  icon,
  as = 'section',
  children,
  className,
  ...rest
}: AuthCardProps) {
  const Tag = as;
  return (
    <main className="auth-page">
      <div className="auth-bg" aria-hidden="true" />
      <Tag className={['auth-card', className].filter(Boolean).join(' ')} {...rest}>
        <div className="auth-mark">{icon ?? <LogoMark size={56} decorative />}</div>
        <h1 className="auth-title">{title}</h1>
        {lead && <p className="auth-lead">{lead}</p>}
        {children}
      </Tag>
    </main>
  );
}
