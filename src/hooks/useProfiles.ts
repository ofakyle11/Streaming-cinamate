import { useShallow } from 'zustand/react/shallow';
import { selectActiveProfile, useLastFrameStore } from '../state/store';

export function useActiveProfile() {
  return useLastFrameStore(selectActiveProfile);
}

/** True when the active profile is a kids profile (catalogue should be filtered). */
export function useIsKidsProfile() {
  return useLastFrameStore((s) => selectActiveProfile(s)?.kid ?? false);
}

export function useProfiles() {
  return useLastFrameStore((s) => s.profiles);
}

export function useProfileActions() {
  return useLastFrameStore(
    useShallow((s) => ({
      addProfile: s.addProfile,
      updateProfile: s.updateProfile,
      removeProfile: s.removeProfile,
      setActiveProfile: s.setActiveProfile,
    })),
  );
}
