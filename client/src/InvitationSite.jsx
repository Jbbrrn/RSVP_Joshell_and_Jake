import { useState } from 'react';
import { getToken, submitRsvp } from './api';
import { Sprig, formatWeddingDate } from './ornaments.jsx';

const STATUS_LABEL = {
  pending: 'Pending',
  attending: 'Attending',
  declined: 'Declined',
};

export default function InvitationSite({ guest, invitation, onGuestChange, onBack }) {
  const [selectedStatus, setSelectedStatus] = useState(
    guest.rsvpStatus === 'declined' ? 'declined' : 'attending'
  );
  const [rsvpSaving, setRsvpSaving] = useState(false);
  const [rsvpSuccess, setRsvpSuccess] = useState('');
  const [rsvpError, setRsvpError] = useState('');
  const [justSaved, setJustSaved] = useState(false);

  async function saveRsvp() {
    setRsvpSaving(true);
    setRsvpError('');
    setRsvpSuccess('');
    try {
      const token = getToken();
      const res = await submitRsvp(token, { status: selectedStatus });
      onGuestChange(res.guest);
      setJustSaved(true);
      window.setTimeout(() => setJustSaved(false), 2200);
      setRsvpSuccess(
        selectedStatus === 'attending'
          ? 'Your attendance is confirmed. We look forward to celebrating with you!'
          : 'Your response has been saved. We will miss you!'
      );
    } catch (err) {
      setRsvpError(err.message || 'Could not save RSVP. Please try again.');
    } finally {
      setRsvpSaving(false);
    }
  }

  const deadline = invitation.rsvpDeadline
    ? formatWeddingDate(invitation.rsvpDeadline)
    : null;

  return (
    <main className="guest-page is-opened is-site">
      <div className="guest-photo" />
      <div className="guest-scrim" />
      <div className="site-wrapper">
        <header className="site-top-bar">
          <button type="button" className="site-back-btn" onClick={onBack}>
            ← Back to envelope
          </button>
          <p className="site-monogram-badge">{invitation.monogram || 'J | J'}</p>
        </header>

        <article className="site-card site-hero-card">
          <Sprig />
          <p className="site-eyebrow">Together with their families</p>
          <h1 className="site-names">
            <span>{invitation.couple.bride}</span>
            <span className="site-and">and</span>
            <span>{invitation.couple.groom}</span>
          </h1>
          <p className="site-celebration-text">
            invite you to celebrate their wedding
          </p>
          <div className="site-date-venue-box">
            <p className="site-venue-name">{invitation.venue?.name}</p>
            <p className="site-date-name">{formatWeddingDate(invitation.date)}</p>
          </div>
          <Sprig className="guest-sprig-bottom" />
        </article>

        <section className="site-card site-rsvp-card" id="rsvp">
          <Sprig className="rsvp-sprig-top" />
          <div className="rsvp-guest-header">
            <span className="rsvp-role-pill">{guest.role}</span>
            <h2 className="rsvp-guest-title">{guest.fullName}</h2>
          </div>

          <div className="rsvp-status-callout">
            <span className="status-callout-label">Current status</span>
            <span className={`status-badge status-${guest.rsvpStatus}${justSaved ? ' is-updated' : ''}`}>
              {STATUS_LABEL[guest.rsvpStatus] || guest.rsvpStatus}
            </span>
          </div>

          <p className="rsvp-seat-note">A seat has been reserved in your honor.</p>

          {deadline ? (
            <p className="rsvp-deadline-note">Please reply by {deadline}.</p>
          ) : (
            <p className="rsvp-deadline-note">You can update your response at any time.</p>
          )}

          <div className="rsvp-choice-container" role="radiogroup" aria-label="RSVP attendance response">
            <button
              type="button"
              role="radio"
              aria-checked={selectedStatus === 'attending'}
              className={`rsvp-choice-btn ${selectedStatus === 'attending' ? 'is-selected' : ''}`}
              onClick={() => {
                setSelectedStatus('attending');
                setRsvpSuccess('');
              }}
            >
              <span className="choice-indicator" aria-hidden="true" />
              <span className="choice-title">Attending</span>
              <span className="choice-sub">Joyfully accepts</span>
            </button>
            <button
              type="button"
              role="radio"
              aria-checked={selectedStatus === 'declined'}
              className={`rsvp-choice-btn ${selectedStatus === 'declined' ? 'is-selected' : ''}`}
              onClick={() => {
                setSelectedStatus('declined');
                setRsvpSuccess('');
              }}
            >
              <span className="choice-indicator" aria-hidden="true" />
              <span className="choice-title">Declined</span>
              <span className="choice-sub">Regretfully declines</span>
            </button>
          </div>

          {rsvpError ? (
            <p className="guest-error" role="alert">
              {rsvpError}
            </p>
          ) : null}
          {rsvpSuccess ? (
            <div className="guest-success-banner" role="status">
              <svg className="success-icon" viewBox="0 0 20 20" fill="currentColor" width="16" height="16" aria-hidden="true">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
              <span>{rsvpSuccess}</span>
            </div>
          ) : null}

          <button
            type="button"
            className="guest-btn rsvp-save-btn"
            disabled={rsvpSaving}
            onClick={saveRsvp}
          >
            {rsvpSaving ? 'Saving…' : 'Save RSVP'}
          </button>
          <Sprig className="guest-sprig-bottom" />
        </section>

        <section className="site-card site-schedule-card">
          <h2 className="section-title">The day</h2>
          <div className="schedule-item">
            <div className="schedule-dot" />
            <div>
              <strong>Venue</strong>
              <p>{invitation.venue?.name}</p>
            </div>
          </div>
          <div className="schedule-item">
            <div className="schedule-dot" />
            <div>
              <strong>Date</strong>
              <p>{formatWeddingDate(invitation.date)}</p>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
