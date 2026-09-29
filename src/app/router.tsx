import { lazy } from 'react';
import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import AppLayout from './AppLayout';

const Home = lazy(() => import('../pages/Home'));
const TitlePage = lazy(() => import('../pages/TitlePage'));
const SearchPage = lazy(() => import('../pages/SearchPage'));
const MyListPage = lazy(() => import('../pages/MyListPage'));
const ProfilesPage = lazy(() => import('../pages/ProfilesPage'));
const AccountPage = lazy(() => import('../pages/AccountPage'));
const PlansPage = lazy(() => import('../pages/PlansPage'));
const GenrePage = lazy(() => import('../pages/GenrePage'));
const NotFoundPage = lazy(() => import('../pages/NotFoundPage'));

export const router = createBrowserRouter([
  {
    path: '/',
    element: <AppLayout />,
    children: [
      { index: true, element: <Home /> },
      { path: 'title/:type/:id', element: <TitlePage /> },
      { path: 'search', element: <SearchPage /> },
      { path: 'my-list', element: <MyListPage /> },
      { path: 'profiles', element: <ProfilesPage /> },
      { path: 'account', element: <AccountPage /> },
      { path: 'plans', element: <PlansPage /> },
      { path: 'genre/:id', element: <GenrePage /> },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
]);

export default function AppRouter() {
  return <RouterProvider router={router} />;
}
