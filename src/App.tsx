import AppRouter from './app/router';
import { AuthProvider } from './auth';

export default function App() {
  return (
    <AuthProvider>
      <AppRouter />
    </AuthProvider>
  );
}
