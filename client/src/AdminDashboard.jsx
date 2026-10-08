import { useState, useEffect, useRef } from 'react';
import { getAdminToken, setAdminToken, clearAdminToken } from './api';
import { tidyName } from './names.js';
import { Sprig } from './ornaments.jsx';

export default function AdminDashboard({ onBack }) {
  const [tab, setTab] = useState('dashboard');
  const [token, setTokenState] = useState(getAdminToken);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [loggingIn, setLoggingIn] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const [summary, setSummary] = useState(null);
  const [guests, setGuests] = useState([]);
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [searchDebounce, setSearchDebounce] = useState('');
  const [exporting, setExporting] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [newGuestName, setNewGuestName] = useState('');
  const [newGuestRole, setNewGuestRole] = useState('Guest');
  const [addGuestError, setAddGuestError] = useState('');
  const [addGuestSaving, setAddGuestSaving] = useState(false);

  const filterRef = useRef(null);
  const searchRef = useRef(null);

  function logoutIfUnauthorized(res) {
    if (res.status === 401) {
      clearAdminToken();
      setTokenState(null);
      return true;
    }
    return false;
  }

  async function loadSummary(givenToken) {
    try {
      const res = await fetch('/api/admin/summary', {
        headers: { Authorization: `Bearer ${givenToken}` },
      });
      if (logoutIfUnauthorized(res)) return;
      if (!res.ok) throw new Error('summary failed');
      const data = await res.json();
      setSummary(data);
      setLastUpdated(data.updatedAt ? new Date(data.updatedAt) : null);
    } catch {
      // keep stale data instead of blanking the dashboard
    }
  }

  async function loadGuests(givenToken, givenFilter, givenSearch) {
    try {
      const params = new URLSearchParams({ filter: givenFilter || 'all' });
      if (givenSearch) params.set('q', givenSearch);
      const res = await fetch(`/api/admin/guests?${params}`, {
        headers: { Authorization: `Bearer ${givenToken}` },
      });
      if (logoutIfUnauthorized(res)) return;
      if (!res.ok) throw new Error('guests failed');
      const data = await res.json();
      setGuests(data.guests || []);
    } catch {
      // keep stale data instead of blanking the dashboard
    }
  }

  useEffect(() => {
    if (!token) return undefined;
    const guestFilter = tab === 'print' ? 'all' : filter;
    const guestSearch = tab === 'print' ? '' : searchDebounce;
    void loadSummary(token);
    if (tab === 'dashboard' || tab === 'guests' || tab === 'print') {
      void loadGuests(token, guestFilter, guestSearch);
    }
  }, [tab, token, filter, searchDebounce]);

  useEffect(() => {
    if (!token) return undefined;
    const id = window.setInterval(() => {
      if (document.hidden) return;
      void loadSummary(token);
      const guestFilter = tab === 'print' ? 'all' : filter;
      const guestSearch = tab === 'print' ? '' : searchDebounce;
      if (tab === 'dashboard' || tab === 'guests' || tab === 'print') {
        void loadGuests(token, guestFilter, guestSearch);
      }
    }, 15_000);
    return () => window.clearInterval(id);
  }, [token, tab, filter, searchDebounce]);

  function handleLogin(event) {
    event.preventDefault();
    setLoginError('');
    setLoggingIn(true);
    fetch('/api/admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    })
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.message || 'Login failed.');
        setAdminToken(data.token);
        setTokenState(data.token);
        setUsername('');
        setPassword('');
        setLoginError('');
      })
      .catch((err) => setLoginError(err.message || 'Login failed.'))
      .finally(() => setLoggingIn(false));
  }

  function handleLogout() {
    clearAdminToken();
    setTokenState(null);
    setSummary(null);
    setGuests([]);
    setTab('login');
  }

  function handleFilterChange(value) {
    setFilter(value);
  }

  function handleSearchChange(value) {
    setSearch(value);
    window.clearTimeout(window._adminSearchDebounce);
    window._adminSearchDebounce = window.setTimeout(() => setSearchDebounce(value), 250);
  }

  function addInvitedGuest(event) {
    event.preventDefault();
    const fullName = tidyName(newGuestName);
    const role = tidyName(newGuestRole) || 'Guest';
    if (fullName.length < 3) {
      setAddGuestError('Enter the guest’s full name.');
      return;
    }
    setAddGuestError('');
    setAddGuestSaving(true);
    fetch('/api/admin/guests', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ fullName, role }),
    })
      .then(async (res) => {
        if (logoutIfUnauthorized(res)) return;
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.message || 'Could not add guest.');
        setNewGuestName('');
        setNewGuestRole('Guest');
        void loadGuests(token, filter, searchDebounce);
        void loadSummary(token);
      })
      .catch((err) => setAddGuestError(err.message || 'Could not add guest.'))
      .finally(() => setAddGuestSaving(false));
  }

  function downloadCSV() {
    setExporting(true);
    fetch('/api/admin/export.csv', {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(async (res) => {
        if (logoutIfUnauthorized(res)) return;
        if (!res.ok) throw new Error('Export failed.');
        const text = await res.text();
        const blob = new Blob([text], { type: 'text/csv; charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'guest-list.csv';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      })
      .catch((err) => window.alert(err.message || 'Export failed.'))
      .finally(() => setExporting(false));
  }

  function printList() {
    window.print();
  }

  function formatDate(iso) {
    if (!iso) return '—';
    return new Date(iso).toLocaleString('en-PH', {
      timeZone: 'Asia/Manila',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  function statusLabel(status) {
    return { pending: 'Pending', attending: 'Attending', declined: 'Declined' }[status] || status;
  }

  if (!token) {
    return (
      <div className="admin-page admin-page-login">
        <div className="admin-login-card">
          <div className="admin-login-monogram">
            <Sprig />
          </div>
          <h1 className="admin-login-title">Admin sign in</h1>
          <form onSubmit={handleLogin} className="admin-login-form">
            <div className="admin-field">
              <label htmlFor="admin-username">Username</label>
              <input
                id="admin-username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoComplete="username"
                required
              />
            </div>
            <div className="admin-field">
              <label htmlFor="admin-password">Password</label>
              <input
                id="admin-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                required
              />
            </div>
            {loginError ? <p className="admin-error" role="alert">{loginError}</p> : null}
            <button type="submit" className="admin-btn" disabled={loggingIn}>
              {loggingIn ? 'Signing in…' : 'Sign in'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-page">
      <aside className={`admin-sidebar${sidebarOpen ? ' admin-sidebar-open' : ''}`}>
        <button
          type="button"
          className="admin-menu-btn"
          onClick={() => setSidebarOpen(false)}
          aria-label="Close menu"
        >
          ×
        </button>
        <div className="admin-sidebar-brand">
          <Sprig />
          <span>Wedding Admin</span>
        </div>
        <nav className="admin-sidebar-nav">
          <button
            type="button"
            className={tab === 'dashboard' ? 'is-active' : ''}
            onClick={() => setTab('dashboard')}
          >
            Dashboard
          </button>
          <button
            type="button"
            className={tab === 'guests' ? 'is-active' : ''}
            onClick={() => setTab('guests')}
          >
            Guest list
          </button>
          <button
            type="button"
            className={tab === 'print' ? 'is-active' : ''}
            onClick={() => setTab('print')}
          >
            Print view
          </button>
          <button
            type="button"
            className={tab === 'settings' ? 'is-active' : ''}
            onClick={() => setTab('settings')}
          >
            Settings
          </button>
        </nav>
        <div className="admin-sidebar-footer">
          <button type="button" className="admin-btn-outline" onClick={handleLogout}>
            Sign out
          </button>
        </div>
      </aside>

      <main className="admin-content">
        <header className="admin-topbar">
          <div className="admin-topbar-left">
            <button
              type="button"
              className="admin-menu-btn"
              onClick={() => setSidebarOpen(true)}
              aria-label="Open menu"
            >
              ☰
            </button>
            <button
              type="button"
              className="admin-back-btn"
              onClick={() => {
                if (onBack) onBack();
                else window.history.pushState({}, '', '/');
              }}
              aria-label="Back to guest site"
            >
              ← Back to guest site
            </button>
            <h1 className="admin-title">
              {tab === 'dashboard' && 'Dashboard'}
              {tab === 'guests' && 'Guest list'}
              {tab === 'print' && 'Print view'}
              {tab === 'settings' && 'Settings'}
            </h1>
            {tab === 'dashboard' && lastUpdated ? (
              <span className="admin-live">
                Live · Updated{' '}
                {lastUpdated.toLocaleString('en-PH', {
                  timeZone: 'Asia/Manila',
                  hour: '2-digit',
                  minute: '2-digit',
                  second: '2-digit',
                })}
              </span>
            ) : null}
          </div>
          {tab === 'dashboard' || tab === 'guests' ? (
            <div className="admin-topbar-actions">
              {tab === 'guests' ? (
                <button type="button" className="admin-btn" onClick={downloadCSV} disabled={exporting}>
                  {exporting ? 'Exporting…' : 'Export CSV'}
                </button>
              ) : null}
              {tab === 'guests' || tab === 'dashboard' ? (
                <button type="button" className="admin-btn-outline" onClick={printList}>
                  Print list
                </button>
              ) : null}
            </div>
          ) : null}
        </header>

        {tab === 'dashboard' || tab === 'guests' ? (
          <section className="admin-dashboard">
            <div className="admin-stats">
              <div className="admin-stat-card">
                <span className="admin-stat-label">Invited guests</span>
                <span className="admin-stat-value">{summary?.invited ?? '—'}</span>
              </div>
              <div className="admin-stat-card">
                <span className="admin-stat-label">Opened letter</span>
                <span className="admin-stat-value">{summary?.opened ?? '—'}</span>
              </div>
              <div className="admin-stat-card admin-stat-emphasis">
                <span className="admin-stat-label">Not opened yet</span>
                <span className="admin-stat-value">{summary?.notOpened ?? '—'}</span>
              </div>
              <div className="admin-stat-card">
                <span className="admin-stat-label">Confirmed headcount</span>
                <span className="admin-stat-value">{summary?.confirmedHeadcount ?? '—'}</span>
              </div>
            </div>

            <div className="admin-summaries">
              <div className="admin-summary-card">
                <span className="admin-summary-label">Attending</span>
                <span className="admin-summary-value">{summary?.attending ?? 0}</span>
              </div>
              <div className="admin-summary-card">
                <span className="admin-summary-label">Pending</span>
                <span className="admin-summary-value">{summary?.pending ?? 0}</span>
              </div>
              <div className="admin-summary-card">
                <span className="admin-summary-label">Declined</span>
                <span className="admin-summary-value">{summary?.declined ?? 0}</span>
              </div>
            </div>

            <form className="admin-add-guest" onSubmit={addInvitedGuest}>
              <div className="admin-field">
                <label htmlFor="new-guest-name">Full name</label>
                <input
                  id="new-guest-name"
                  value={newGuestName}
                  onChange={(e) => setNewGuestName(e.target.value)}
                  autoComplete="name"
                  required
                  minLength={3}
                />
              </div>
              <div className="admin-field">
                <label htmlFor="new-guest-role">Role</label>
                <input
                  id="new-guest-role"
                  value={newGuestRole}
                  onChange={(e) => setNewGuestRole(e.target.value)}
                  maxLength={50}
                />
              </div>
              <button type="submit" className="admin-btn" disabled={addGuestSaving}>
                {addGuestSaving ? 'Adding…' : 'Add invited guest'}
              </button>
              {addGuestError ? <p className="admin-error" role="alert">{addGuestError}</p> : null}
            </form>

            <div className="admin-actions-bar">
              <div className="admin-filters">
                {['all', 'not-opened', 'attending', 'pending', 'declined'].map((value) => (
                  <button
                    key={value}
                    type="button"
                    className={filter === value ? 'is-active' : ''}
                    onClick={() => handleFilterChange(value)}
                    ref={value === filter ? filterRef : null}
                  >
                    {value === 'all' ? 'All' : value === 'not-opened' ? 'Not opened yet' : value === 'attending' ? 'Attending' : value === 'pending' ? 'Pending' : 'Declined'}
                  </button>
                ))}
              </div>
              <div className="admin-search">
                <label htmlFor="admin-search-input" className="sr-only">Search guests</label>
                <input
                  id="admin-search-input"
                  type="search"
                  placeholder="Search by name…"
                  value={search}
                  onChange={(e) => handleSearchChange(e.target.value)}
                  ref={searchRef}
                />
              </div>
            </div>

            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Guest</th>
                    <th>Role</th>
                    <th>Letter status</th>
                    <th>RSVP</th>
                  </tr>
                </thead>
                <tbody>
                  {guests.map((guest) => (
                    <tr key={guest.id}>
                      <td>
                        <div className="admin-guest-main">
                          <span className="admin-initials">{guest.fullName.split(' ').map((n) => n[0]).join('').slice(0, 2)}</span>
                          <span>{guest.fullName}</span>
                        </div>
                      </td>
                      <td>{guest.role}</td>
                      <td>{guest.openedAt ? `Opened ${formatDate(guest.openedAt)}` : 'Not opened yet'}</td>
                      <td>
                        <span className={`admin-status admin-status-${guest.rsvpStatus}`}>
                          {statusLabel(guest.rsvpStatus)}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        ) : null}

        {tab === 'print' ? (
          <section className="admin-print">
            <h2 className="section-title">Print guest list</h2>
            <table className="admin-table admin-print-table">
              <thead>
                <tr>
                  <th>Guest</th>
                  <th>Role</th>
                  <th>Letter status</th>
                  <th>RSVP</th>
                </tr>
              </thead>
              <tbody>
                {guests.map((guest) => (
                  <tr key={guest.id}>
                    <td>{guest.fullName}</td>
                    <td>{guest.role}</td>
                    <td>{guest.openedAt ? `Opened ${formatDate(guest.openedAt)}` : 'Not opened yet'}</td>
                    <td>{statusLabel(guest.rsvpStatus)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {summary ? (
              <div className="admin-print-totals">
                <p>Invited: {summary.invited}</p>
                <p>Opened: {summary.opened}</p>
                <p>Confirmed headcount: {summary.confirmedHeadcount}</p>
              </div>
            ) : null}
          </section>
        ) : null}

        {tab === 'settings' ? (
          <section className="admin-settings">
            <h2 className="section-title">Settings</h2>
            <div className="admin-settings-card">
              <p>Manage admin accounts, notification preferences, and security settings here.</p>
              <p>For now, you can reset admin passwords by running <code>node scripts/create-admin.js &lt;username&gt;</code>.</p>
            </div>
          </section>
        ) : null}
      </main>
    </div>
  );
}
