import { lazy } from 'react';
import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import AppLayout from './AppLayout';
import RouteError from '../components/errors/RouteError';

const Home = lazy(() => import('../pages/Home'));
const TitlePage = lazy(() => import('../pages/TitlePage'));
const SearchPage = lazy(() => import('../pages/SearchPage'));
const MyListPage = lazy(() => import('../pages/MyListPage'));
const ProfilesPage = lazy(() => import('../pages/ProfilesPage'));
const AccountPage = lazy(() => import('../pages/AccountPage'));
const PlansPage = lazy(() => import('../pages/PlansPage'));
const GenrePage = lazy(() => import('../pages/GenrePage'));
const NotFoundPage = lazy(() => import('../pages/NotFoundPage'));
const NewPopularPage = lazy(() => import('../pages/NewPopularPage'));
const BrandPage = lazy(() => import('../pages/BrandPage'));
const SignInPage = lazy(() => import('../pages/SignInPage'));
const SignInSentPage = lazy(() => import('../pages/SignInSentPage'));
const AuthCallbackPage = lazy(() => import('../pages/AuthCallbackPage'));

export const router = createBrowserRouter([
  {
    path: '/',
    element: <AppLayout />,
    errorElement: <RouteError />,
    children: [
      { index: true, element: <Home /> },
      { path: 'title/:type/:id', element: <TitlePage /> },
      { path: 'search', element: <SearchPage /> },
      { path: 'my-list', element: <MyListPage /> },
      { path: 'profiles', element: <ProfilesPage /> },
      { path: 'account', element: <AccountPage /> },
      { path: 'plans', element: <PlansPage /> },
      { path: 'genre/:id', element: <GenrePage /> },
      { path: 'new', element: <NewPopularPage /> },
      { path: 'brand', element: <BrandPage /> },
      { path: 'sign-in', element: <SignInPage /> },
      { path: 'sign-in/sent', element: <SignInSentPage /> },
      { path: 'auth/callback', element: <AuthCallbackPage /> },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
]);

export default function AppRouter() {
  return <RouterProvider router={router} />;
}
