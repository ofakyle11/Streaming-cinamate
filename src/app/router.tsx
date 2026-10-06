import { lazy } from 'react';
import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import AppLayout from './AppLayout';
import RouteError from '../components/errors/RouteError';
// Eager: a few hundred bytes that decide between the (lazy) Home and LandingPage chunks.
import FrontDoor from '../pages/FrontDoor';

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

export const router = createBrowserRouter([
  {
    path: '/',
    element: <AppLayout />,
    errorElement: <RouteError />,
    children: [
      // `/` is the front door: the landing page for signed-out first-time visitors, Home otherwise.
      { index: true, element: <FrontDoor /> },
      { path: 'title/:type/:id', element: <TitlePage /> },
      { path: 'search', element: <SearchPage /> },
      { path: 'my-list', element: <MyListPage /> },
      { path: 'profiles', element: <ProfilesPage /> },
      { path: 'account', element: <AccountPage /> },
      { path: 'plans', element: <PlansPage /> },
      { path: 'genre/:id', element: <GenrePage /> },
      { path: 'new', element: <NewPopularPage /> },
      { path: 'brand', element: <BrandPage /> },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
]);

export default function AppRouter() {
  return <RouterProvider router={router} />;
}
