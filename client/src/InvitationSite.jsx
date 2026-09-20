import { useId, useState } from 'react';
import { getToken, submitRsvp } from './api';
import { namesMatch, tidyName, uniqueCompanionNames } from './names.js';
import { Sprig, formatWeddingDate } from './ornaments.jsx';

const STATUS_LABEL = {
  pending: 'Pending',
  attending: 'Attending',
  declined: 'Declined',
};

export default function InvitationSite({ guest, invitation, onGuestChange, onBack }) {
  const companionId = useId();
  const [selectedStatus, setSelectedStatus] = useState(
    guest.rsvpStatus === 'declined' ? 'declined' : 'attending'
  );
  const [companions, setCompanions] = useState(guest.companions || []);
  const [newCompName, setNewCompName] = useState('');
  const [companionError, setCompanionError] = useState('');
  const [rsvpSaving, setRsvpSaving] = useState(false);
  const [rsvpSuccess, setRsvpSuccess] = useState('');
  const [rsvpError, setRsvpError] = useState('');

  function addCompanion(event) {
    event.preventDefault();
    setCompanionError('');
    const trimmed = tidyName(newCompName);
    if (trimmed.length < 2) {
      setCompanionError('Please enter a companion full name.');
      return;
    }
    if (trimmed.length > 150) {
      setCompanionError('Companion name is too long.');
      return;
    }
    if (companions.length >= guest.maxCompanions) {
      setCompanionError(`You can bring up to ${guest.maxCompanions} companion(s).`);
      return;
    }
    if (companions.some((name) => namesMatch(name, trimmed))) {
      setCompanionError('This companion is already in your list.');
      return;
    }
    if (namesMatch(guest.fullName, trimmed)) {
      setCompanionError('Please use a different name than your own.');
      return;
    }
    setCompanions([...companions, trimmed]);
    setNewCompName('');
  }

  async function saveRsvp() {
    setRsvpSaving(true);
    setRsvpError('');
    setRsvpSuccess('');
    try {
      const token = getToken();
      const names = selectedStatus === 'attending' ? uniqueCompanionNames(companions) : [];
      const res = await submitRsvp(token, { status: selectedStatus, companions: names });
      onGuestChange(res.guest);
      setCompanions(res.guest.companions || []);
      setRsvpSuccess(
        selectedStatus === 'attending'
          ? 'Your attendance is saved. You can change this later if you need to.'
          : 'Your response is saved. You can change this later if you need to.'
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
          <div className="rsvp-guest-header">
            <span className="rsvp-role-pill">{guest.role}</span>
            <h2 className="rsvp-guest-title">{guest.fullName}</h2>
          </div>

          <div className="rsvp-status-callout">
            <span className="status-callout-label">Current status</span>
            <span className={`status-badge status-${guest.rsvpStatus}`}>
              {STATUS_LABEL[guest.rsvpStatus] || guest.rsvpStatus}
            </span>
          </div>
          {deadline ? (
            <p className="companion-area-note">Please reply by {deadline}.</p>
          ) : (
            <p className="companion-area-note">You can change your answer later.</p>
          )}

          <div className="rsvp-choice-container">
            <button
              type="button"
              className={`rsvp-choice-btn ${selectedStatus === 'attending' ? 'is-selected' : ''}`}
              onClick={() => {
                setSelectedStatus('attending');
                setRsvpSuccess('');
              }}
            >
              <span className="choice-title">Attending</span>
              <span className="choice-sub">I will be there</span>
            </button>
            <button
              type="button"
              className={`rsvp-choice-btn ${selectedStatus === 'declined' ? 'is-selected' : ''}`}
              onClick={() => {
                setSelectedStatus('declined');
                setRsvpSuccess('');
              }}
            >
              <span className="choice-title">Declined</span>
              <span className="choice-sub">I cannot attend</span>
            </button>
          </div>

          {selectedStatus === 'attending' ? (
            <div className="rsvp-companion-area">
              <div className="companion-area-header">
                <h3 className="companion-area-title">Companions</h3>
                <span className="companion-counter">
                  {companions.length} / {guest.maxCompanions}
                </span>
              </div>
              <p className="companion-area-note">
                You can bring up to {guest.maxCompanions} companion{guest.maxCompanions === 1 ? '' : 's'}.
              </p>

              {companions.length > 0 ? (
                <ul className="companion-chips-list">
                  {companions.map((name, index) => (
                    <li key={`${name}-${index}`} className="companion-chip">
                      <span>{name}</span>
                      <button
                        type="button"
                        className="comp-remove-btn"
                        onClick={() => {
                          setCompanions(companions.filter((_, i) => i !== index));
                          setCompanionError('');
                        }}
                        aria-label={`Remove ${name}`}
                      >
                        ×
                      </button>
                    </li>
                  ))}
                </ul>
              ) : null}

              {companions.length < guest.maxCompanions ? (
                <form className="companion-input-row" onSubmit={addCompanion}>
                  <div className="guest-field companion-field">
                    <label htmlFor={companionId}>Companion full name</label>
                    <input
                      id={companionId}
                      className="companion-text-input"
                      value={newCompName}
                      onChange={(e) => setNewCompName(e.target.value)}
                      autoComplete="name"
                    />
                  </div>
                  <button type="submit" className="companion-add-btn">
                    Add
                  </button>
                </form>
              ) : (
                <p className="companion-max-note">
                  You are at your companion limit. Ask us if you need that raised.
                </p>
              )}
              {companionError ? (
                <p className="guest-error comp-error" role="alert">
                  {companionError}
                </p>
              ) : null}
            </div>
          ) : null}

          {rsvpError ? (
            <p className="guest-error" role="alert">
              {rsvpError}
            </p>
          ) : null}
          {rsvpSuccess ? <p className="guest-success-banner">{rsvpSuccess}</p> : null}

          <button
            type="button"
            className="guest-btn rsvp-save-btn"
            disabled={rsvpSaving}
            onClick={saveRsvp}
          >
            {rsvpSaving ? 'Saving…' : 'Save RSVP'}
          </button>
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
