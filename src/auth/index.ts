export { default as AuthProvider } from './AuthProvider';
export type { AuthProviderProps } from './AuthProvider';
export { AuthContext, useAuth, useOptionalAuth } from './context';
export type { AuthContextValue, AuthStatus } from './context';
export { clearLocalData, isLastFrameKey, resetSyncedData } from './localData';
export {
  safeReturnTo,
  resolveReturnTo,
  signInHref,
  getStartedHref,
  rememberReturnTo,
  peekReturnTo,
  takeReturnTo,
  forgetReturnTo,
} from './returnTo';
export { currentDeviceId, describeUserAgent } from '../services/auth/devices';
