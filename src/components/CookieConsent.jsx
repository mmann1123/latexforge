import { useState, useEffect } from 'react';

export default function CookieConsent() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const consent = localStorage.getItem('cookie-consent');
    if (!consent) setVisible(true);
  }, []);

  function handleAccept() {
    localStorage.setItem('cookie-consent', 'accepted');
    setVisible(false);
    // Enable GA if it wasn't loaded on page load
    if (!window.gtag) {
      const s = document.createElement('script');
      s.async = true;
      s.src = 'https://www.googletagmanager.com/gtag/js?id=G-Y6B556JJNX';
      document.head.appendChild(s);
      window.dataLayer = window.dataLayer || [];
      window.gtag = function () { window.dataLayer.push(arguments); };
      window.gtag('js', new Date());
      window.gtag('config', 'G-Y6B556JJNX');
    }
  }

  function handleDecline() {
    localStorage.setItem('cookie-consent', 'declined');
    setVisible(false);
    // Disable GA
    window['ga-disable-G-Y6B556JJNX'] = true;
  }

  if (!visible) return null;

  return (
    <div className="cookie-banner">
      <p className="cookie-banner-text">
        This site uses cookies for authentication and analytics.{' '}
        <a href="/legal#cookies">Learn more</a>
      </p>
      <div className="cookie-banner-actions">
        <button onClick={handleAccept} className="btn cookie-btn-accept">Accept</button>
        <button onClick={handleDecline} className="btn cookie-btn-decline">Decline Analytics</button>
      </div>
    </div>
  );
}
