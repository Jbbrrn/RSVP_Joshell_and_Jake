import { useState, useEffect } from 'react';
import GuestFlow from './GuestFlow.jsx';
import AdminDashboard from './AdminDashboard.jsx';

export default function App() {
  const [isAdmin, setIsAdmin] = useState(() => window.location.pathname.startsWith('/admin'));

  useEffect(() => {
    const sync = () => setIsAdmin(window.location.pathname.startsWith('/admin'));
    window.addEventListener('popstate', sync);
    return () => window.removeEventListener('popstate', sync);
  }, []);

  function goGuest() {
    window.history.pushState({}, '', '/');
    setIsAdmin(false);
  }

  if (isAdmin) {
    return <AdminDashboard onBack={goGuest} />;
  }

  return <GuestFlow />;
}
