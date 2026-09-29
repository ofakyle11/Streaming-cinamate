import { useShallow } from 'zustand/react/shallow';
import { selectActiveProfile, useLastFrameStore } from '../state/store';

export function useActiveProfile() {
  return useLastFrameStore(selectActiveProfile);
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
