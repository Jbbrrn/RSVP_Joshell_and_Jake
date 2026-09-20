import { useEffect, useId, useRef, useState } from 'react';
import { clearToken, getInvitation, getMe, getToken, setToken, verifyName } from './api';
import InvitationSite from './InvitationSite.jsx';
import { Sprig, formatWeddingDate } from './ornaments.jsx';

const VERIFY_MS = 60_000;

function Wreath() {
  return (
    <svg className="guest-wreath" viewBox="0 0 96 96" aria-hidden="true" focusable="false">
      <circle cx="48" cy="48" r="30" fill="none" stroke="#a9c6e8" strokeWidth="1.2" />
      <g fill="#789fce" opacity="0.85">
        <ellipse cx="48" cy="16" rx="4" ry="7" />
        <ellipse cx="70" cy="26" rx="4" ry="7" transform="rotate(40 70 26)" />
        <ellipse cx="80" cy="48" rx="4" ry="7" transform="rotate(90 80 48)" />
        <ellipse cx="70" cy="70" rx="4" ry="7" transform="rotate(130 70 70)" />
        <ellipse cx="48" cy="80" rx="4" ry="7" />
        <ellipse cx="26" cy="70" rx="4" ry="7" transform="rotate(-130 26 70)" />
        <ellipse cx="16" cy="48" rx="4" ry="7" transform="rotate(90 16 48)" />
        <ellipse cx="26" cy="26" rx="4" ry="7" transform="rotate(-40 26 26)" />
      </g>
    </svg>
  );
}

export default function GuestFlow() {
  const nameId = useId();
  const errorId = useId();
  const nameRef = useRef(null);
  const openedRef = useRef(null);
  const viewBtnRef = useRef(null);
  const abortRef = useRef(null);

  const [phase, setPhase] = useState('sealed');
  const [fullName, setFullName] = useState('');
  const [error, setError] = useState('');
  const [timedOut, setTimedOut] = useState(false);
  const [guest, setGuest] = useState(null);
  const [invitation, setInvitation] = useState(null);
  const [skipMotion, setSkipMotion] = useState(false);
  const [screen, setScreen] = useState('flow');

  useEffect(() => {
    const token = getToken();
    if (!token) return undefined;
    let cancelled = false;
    (async () => {
      try {
        const [me, invite] = await Promise.all([getMe(token), getInvitation(token)]);
        if (cancelled) return;
        setGuest(me.guest);
        setInvitation(invite);
        setSkipMotion(true);
        setPhase('opened');
      } catch {
        if (!cancelled) clearToken();
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if ((phase === 'name-entry' || phase === 'not-found') && nameRef.current) {
      nameRef.current.focus();
      nameRef.current.scrollIntoView({ block: 'nearest' });
    }
  }, [phase]);

  useEffect(() => {
    if (phase !== 'opened') return undefined;
    const id = window.setTimeout(() => {
      if (viewBtnRef.current) viewBtnRef.current.focus();
      else if (openedRef.current) openedRef.current.focus();
    }, skipMotion ? 0 : 950);
    return () => window.clearTimeout(id);
  }, [phase, skipMotion]);

  function openSeal() {
    setPhase('name-entry');
    setError('');
    setTimedOut(false);
  }

  async function onSubmit(event) {
    event.preventDefault();
    setError('');
    setTimedOut(false);
    setPhase('verifying');
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    const timer = window.setTimeout(() => controller.abort(), VERIFY_MS);

    try {
      const verified = await verifyName(fullName, controller.signal);
      setToken(verified.token);
      const invite = await getInvitation(verified.token);
      setGuest(verified.guest);
      setInvitation(invite);
      setSkipMotion(false);
      setPhase('opened');
    } catch (err) {
      if (err.name === 'AbortError') {
        setTimedOut(true);
        setPhase('name-entry');
        setError('This is taking a little longer than usual. Please try again.');
        return;
      }
      if (err.status === 404) {
        setPhase('not-found');
        setError('We could not find that name. Please check the spelling and try again.');
        return;
      }
      setPhase('name-entry');
      setError(err.message || 'Something went wrong. Please try again.');
    } finally {
      window.clearTimeout(timer);
    }
  }

  const pageClass = [
    'guest-page',
    `is-${phase}`,
    phase === 'opened' ? 'is-opened' : '',
    skipMotion ? 'is-instant' : '',
  ]
    .filter(Boolean)
    .join(' ');

  const showPanel = phase === 'name-entry' || phase === 'verifying' || phase === 'not-found';

  if (screen === 'site' && guest && invitation) {
    return (
      <InvitationSite
        guest={guest}
        invitation={invitation}
        onGuestChange={setGuest}
        onBack={() => setScreen('flow')}
      />
    );
  }

  return (
    <main className={pageClass}>
      <div className="guest-photo" />
      <div className="guest-scrim" />

      <div className="guest-column">
        <div className="guest-scene">
          <div className="envelope" aria-hidden={phase !== 'opened'}>
            <div className="envelope-back" />
            <div className="envelope-flap" />
            <article
              className="invite-card"
              tabIndex={phase === 'opened' ? -1 : undefined}
              ref={openedRef}
              aria-hidden={phase !== 'opened'}
            >
              {phase === 'opened' && guest && invitation ? (
                <div className="invite-card-content">
                  <Sprig />
                  <p className="guest-kicker" id="opened-heading">
                    Welcome, {guest.role} {guest.fullName}
                  </p>
                  <h1 className="guest-names">
                    {invitation.couple.bride}
                    <span>and</span>
                    {invitation.couple.groom}
                  </h1>
                  <p className="guest-meta">{invitation.venue?.name}</p>
                  <p className="guest-meta">{formatWeddingDate(invitation.date)}</p>
                  <button
                    type="button"
                    className="guest-btn guest-btn-open-site"
                    ref={viewBtnRef}
                    onClick={() => setScreen('site')}
                  >
                    View invitation & RSVP <span aria-hidden="true">→</span>
                  </button>
                  <Sprig className="guest-sprig-bottom" />
                </div>
              ) : null}
            </article>
            <div className="envelope-pocket" />
            <button
              type="button"
              className="wax-seal"
              onClick={openSeal}
              disabled={phase !== 'sealed'}
              aria-label="Open invitation and enter your name"
              tabIndex={phase === 'sealed' ? 0 : -1}
            >
              <span className="seal-half seal-left">
                <span className="seal-letter">J</span>
              </span>
              <span className="seal-half seal-right">
                <span className="seal-letter">J</span>
              </span>
              <svg className="seal-fissure" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
                <defs>
                  <linearGradient id="goldGlow" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#fff2cb" stopOpacity="0.4" />
                    <stop offset="50%" stopColor="#ffecc0" stopOpacity="1" />
                    <stop offset="100%" stopColor="#f7dfa4" stopOpacity="0.4" />
                  </linearGradient>
                </defs>
                <path
                  d="M 50 0 L 48.5 14 L 52 28 L 47.5 42 L 52.5 56 L 48 70 L 51.5 84 L 50 100"
                  fill="none"
                  stroke="url(#goldGlow)"
                  strokeWidth="2.4"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
          </div>
        </div>

        {phase === 'sealed' ? <p className="guest-hint">Tap the seal to begin.</p> : null}

        {showPanel ? (
          <section className="guest-panel" aria-live="polite">
            {phase === 'verifying' ? (
              <div className="guest-verifying">
                <Wreath />
                <p>Preparing your invitation…</p>
              </div>
            ) : (
              <form onSubmit={onSubmit}>
                <p className="guest-dear">
                  Dear <span>{fullName.trim() || '____'}</span>,
                </p>
                <p className="guest-lead">Enter your full name to check your invitation.</p>
                <div className="guest-field">
                  <label htmlFor={nameId}>Full name</label>
                  <input
                    id={nameId}
                    ref={nameRef}
                    name="fullName"
                    autoComplete="name"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    aria-invalid={Boolean(error)}
                    aria-describedby={error ? errorId : undefined}
                    required
                    minLength={3}
                  />
                </div>
                {error ? (
                  <p className="guest-error" id={errorId} role="alert">
                    {error}
                    {timedOut ? ' The server may be waking up.' : ''}
                  </p>
                ) : null}
                <button type="submit" className="guest-btn">
                  Continue <span aria-hidden="true">→</span>
                </button>
              </form>
            )}
          </section>
        ) : null}
      </div>
    </main>
  );
}
