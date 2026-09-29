import { avatarInitial, resolveAvatarId } from './avatars';

export interface ProfileAvatarProps {
  name: string;
  avatar: string;
  kid?: boolean;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

/** Gradient glass avatar with the profile's initial. Decorative: callers label it. */
export default function ProfileAvatar({ name, avatar, kid = false, size = 'md', className }: ProfileAvatarProps) {
  const id = resolveAvatarId(avatar);
  const classes = ['lf-avatar', size, className].filter(Boolean).join(' ');
  return (
    <span className={classes} data-avatar={id} aria-hidden>
      <span className="lf-avatar-initial">{avatarInitial(name)}</span>
      {kid && <span className="lf-avatar-kids">Kids</span>}
    </span>
  );
}
