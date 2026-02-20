import PublicSiteHeader from "../components/PublicSiteHeader";

const howToReachRoutes = [
  {
    route: "Route 1",
    title:
      "Thiruvarur Railway Junction to Kakkalani Lakshmi Narayana Perumal Temple",
    distance: "10 km",
    href: "https://www.google.com/maps/dir/Thiruvarur+Railway+Junction,+QJ7M%2BXP6,+Santhamangalam,+KTR+Nagar,+Thiruvarur,+Tamil+Nadu+610001/Kakkalani+Lakshmi+Narayana+Perumal+Temple,+PMJM%2B2C5,+Thappalanpuliyur+II,+Tamil+Nadu+610106/@10.7475922,79.6428365,8026m/data=!3m1!1e3!4m15!4m14!1m5!1m1!1s0x3a5547f68962cfab:0x748b80cb3811bfbd!2m2!1d79.6342509!2d10.7649169!1m5!1m1!1s0x3a55416ffc6238d3:0x75bc85e1ff87c819!2m2!1d79.6835975!2d10.730005!3e0!5i1?entry=ttu&g_ep=EgoyMDI2MDIxNi4wIKXMDSoASAFQAw%3D%3D",
  },
  {
    route: "Route 2",
    title:
      "Thiruvarur Railway Junction to Kakkalani Lakshmi Narayana Perumal Temple",
    distance: "14 km",
    href: "https://www.google.com/maps/dir/Thiruvarur+Railway+Junction,+QJ7M%2BXP6,+Santhamangalam,+KTR+Nagar,+Thiruvarur,+Tamil+Nadu+610001/Kakkalani+Lakshmi+Narayana+Perumal+Temple,+PMJM%2B2C5,+Thappalanpuliyur+II,+Tamil+Nadu+610106/@10.7475922,79.6428365,8026m/data=!3m1!1e3!4m14!4m13!1m5!1m1!1s0x3a5547f68962cfab:0x748b80cb3811bfbd!2m2!1d79.6342509!2d10.7649169!1m5!1m1!1s0x3a55416ffc6238d3:0x75bc85e1ff87c819!2m2!1d79.6835975!2d10.730005!3e0?entry=ttu&g_ep=EgoyMDI2MDIxNi4wIKXMDSoASAFQAw%3D%3D",
  },
  {
    route: "Route 3",
    title:
      "Thiruvarur Railway Junction to Kakkalani Lakshmi Narayana Perumal Temple",
    distance: "Distance to be updated",
    href: "",
  },
  {
    route: "Route 4",
    title:
      "Kumbakonam Railway Station to Kakkalani Lakshmi Narayana Perumal Temple",
    distance: "60 km",
    href: "https://www.google.com/maps/dir/Kumbakonam+Railway+Station,+C2,+North+St,+Rajapondy+Nagar,+Kumbakonam,+Tamil+Nadu+612001/Kakkalani+Lakshmi+Narayana+Perumal+Temple,+PMJM%2B2C5,+Thappalanpuliyur+II,+Tamil+Nadu+610106/@10.8283533,79.4658279,32097m/data=!3m1!1e3!4m14!4m13!1m5!1m1!1s0x3a5533ad521f7f57:0x1ad5b98c064ad97d!2m2!1d79.3896086!2d10.9537712!1m5!1m1!1s0x3a55416ffc6238d3:0x75bc85e1ff87c819!2m2!1d79.6835975!2d10.730005!3e0?entry=ttu&g_ep=EgoyMDI2MDIxNi4wIKXMDSoASAFQAw%3D%3D",
  },
  {
    route: "Route 5",
    title: "Nagapattinam to Kakkalani Lakshmi Narayana Perumal Temple",
    distance: "22 km",
    href: "https://www.google.com/maps/dir/Nagapattinam,+Tamil+Nadu/Kakkalani+Lakshmi+Narayana+Perumal+Temple,+PMJM%2B2C5,+Thappalanpuliyur+II,+Tamil+Nadu+610106/@10.7454277,79.7324732,19649m/data=!3m1!1e3!4m14!4m13!1m5!1m1!1s0x3a556c9797ef6927:0xc869efbb726e6072!2m2!1d79.8448512!2d10.7672313!1m5!1m1!1s0x3a55416ffc6238d3:0x75bc85e1ff87c819!2m2!1d79.6835975!2d10.730005!3e0?entry=ttu&g_ep=EgoyMDI2MDIxNi4wIKXMDSoASAFQAw%3D%3D",
  },
] as const;

const ArrowRightIcon = () => (
  <svg
    width="13"
    height="13"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.5"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <line x1="5" y1="12" x2="19" y2="12" />
    <polyline points="12 5 19 12 12 19" />
  </svg>
);

const LandingPage = () => {
  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@400;500;600&family=Outfit:wght@300;400;500;600&display=swap');

        :root {
          --crimson: #b10026;
          --crimson-dark: #8e001c;
          --navy: #05091f;
          --gold: #c9a84c;
          --sand: #f0e6d3;        /* warm parchment */
          --sand-mid: #e8d5b7;    /* mid sand for section bg */
          --terracotta: #c4703a;  /* warm accent */
          --earth: #7a5c3a;       /* deep brown text */
          --card-bg: #fdf8f2;     /* warm off-white cards */
        }

        .landing-root {
          font-family: 'Outfit', sans-serif;
          /* warm sandy parchment — mirrors the map illustration palette */
          background: var(--sand);
          color: #2a1f14;
        }

        /* ── HERO: full-viewport image, all devices ── */
        .hero {
          width: 100%;
          height: 100vh;
          line-height: 0;
          overflow: hidden;
        }

        .hero-img {
          display: block;
          width: 100%;
          height: 100%;
          object-fit: cover;
          object-position: center center;
        }

        /* ── HOW TO REACH ── */
        .reach-section {
          /* alternating warm band: slightly deeper sand with a subtle noise feel */
          background: linear-gradient(160deg, #ede0c8 0%, #e8d4b0 50%, #eddcc6 100%);
          padding: 4rem 0 5.5rem;
          position: relative;
        }

        /* decorative top border strip */
        .reach-section::before {
          content: '';
          position: absolute;
          top: 0; left: 0; right: 0;
          height: 4px;
          background: linear-gradient(to right, var(--terracotta), var(--gold), var(--crimson));
        }

        .reach-inner {
          max-width: 1280px;
          margin: 0 auto;
          padding: 0 2rem;
        }

        .reach-header {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          margin-bottom: 2.25rem;
        }

        .reach-pin {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 28px;
          height: 28px;
          background: var(--crimson);
          border-radius: 50%;
          color: #fff;
          flex-shrink: 0;
        }

        .reach-label {
          font-size: 0.68rem;
          font-weight: 700;
          letter-spacing: 0.3em;
          text-transform: uppercase;
          color: var(--crimson);
        }

        .reach-divider {
          flex: 1;
          height: 1px;
          background: linear-gradient(to right, rgba(177,0,38,0.35), rgba(177,0,38,0.05));
        }

        .route-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
          gap: 1.1rem;
        }

        .route-card {
          position: relative;
          /* warm card with a subtle parchment tint */
          background: var(--card-bg);
          border: 1px solid rgba(122, 92, 58, 0.18);
          border-radius: 1.1rem;
          padding: 1.5rem 1.6rem;
          display: flex;
          flex-direction: column;
          gap: 0.55rem;
          overflow: hidden;
          transition: box-shadow 0.22s, transform 0.18s, border-color 0.22s;
        }

        /* animated top bar on hover */
        .route-card::after {
          content: '';
          position: absolute;
          top: 0; left: 0; right: 0;
          height: 3px;
          background: linear-gradient(to right, var(--crimson), var(--terracotta));
          transform: scaleX(0);
          transform-origin: left;
          transition: transform 0.25s ease;
        }

        .route-card:hover {
          box-shadow: 0 16px 40px -10px rgba(122, 92, 58, 0.22);
          transform: translateY(-2px);
          border-color: rgba(122, 92, 58, 0.32);
        }

        .route-card:hover::after {
          transform: scaleX(1);
        }

        .route-number {
          font-size: 0.62rem;
          font-weight: 700;
          letter-spacing: 0.22em;
          text-transform: uppercase;
          color: var(--crimson);
        }

        .route-title {
          font-size: 0.875rem;
          font-weight: 500;
          color: #2a1f14;
          line-height: 1.55;
          margin: 0;
        }

        .route-distance {
          display: inline-flex;
          align-items: center;
          gap: 0.3rem;
          font-size: 0.75rem;
          font-weight: 600;
          color: var(--earth);
          /* warm sand pill instead of cold grey */
          background: rgba(122, 92, 58, 0.1);
          padding: 0.25rem 0.65rem;
          border-radius: 999px;
          width: fit-content;
        }

        .route-link {
          display: inline-flex;
          align-items: center;
          gap: 0.35rem;
          margin-top: 0.5rem;
          padding-top: 0.75rem;
          font-size: 0.78rem;
          font-weight: 600;
          color: var(--crimson);
          text-decoration: none;
          border-top: 1px solid rgba(122,92,58,0.15);
          transition: gap 0.18s, color 0.18s;
        }
        .route-link:hover {
          gap: 0.55rem;
          color: var(--crimson-dark);
        }

        .route-pending {
          display: inline-flex;
          align-items: center;
          gap: 0.35rem;
          margin-top: 0.5rem;
          padding-top: 0.75rem;
          font-size: 0.78rem;
          font-weight: 500;
          color: #a08060;
          border-top: 1px solid rgba(122,92,58,0.15);
        }

        /* ── FOOTER ── */
        .footer {
          background: var(--navy);
          padding: 2.25rem 2rem;
        }

        .footer-inner {
          max-width: 1280px;
          margin: 0 auto;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 0.35rem;
        }

        .footer-brand {
          font-family: 'Cormorant Garamond', serif;
          font-size: 1rem;
          font-weight: 500;
          letter-spacing: 0.18em;
          text-transform: uppercase;
          color: var(--gold);
        }

        .footer-rule {
          width: 40px;
          height: 1px;
          background: rgba(201,168,76,0.4);
          margin: 0.2rem 0;
        }

        .footer-copy {
          font-size: 0.75rem;
          color: rgba(255,255,255,0.35);
          letter-spacing: 0.03em;
        }

        @media (max-width: 640px) {
          .reach-inner { padding: 0 1.25rem; }
          .route-grid { grid-template-columns: 1fr; }
        }
      `}</style>

      <div id="top" className="landing-root">
        {/*
          Switched from variant="overlay" to variant="solid".
          "overlay" was injecting separate colour classes for the brand name
          (blue) and nav links (gold/yellow), creating the visual inconsistency.
          "solid" keeps a single unified colour palette across all header elements.
          
          ⚠️  If PublicSiteHeader doesn't accept variant="solid", share the
          component code and I'll patch the colour logic there directly.
        */}
        <PublicSiteHeader variant="solid" />

        <main>
          {/* ── HERO: image only, no text ── */}
          <section id="hero-map" className="hero">
            <img
              src="/images/landing-page-image.jpg"
              alt="Kakkalani Village Landscape Plan, Tamil Nadu"
              className="hero-img"
            />
          </section>

          {/* ── HOW TO REACH ── */}
          <section id="how-to-reach" className="reach-section">
            <div className="reach-inner">
              <div className="reach-header">
                <span className="reach-pin">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" />
                  </svg>
                </span>
                <span className="reach-label">How to Reach</span>
                <div className="reach-divider" />
              </div>

              <div className="route-grid">
                {howToReachRoutes.map((route) => (
                  <div key={route.route} className="route-card">
                    <span className="route-number">{route.route}</span>
                    <p className="route-title">{route.title}</p>
                    <span className="route-distance">🛣 {route.distance}</span>
                    {route.href ? (
                      <a
                        href={route.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="route-link"
                      >
                        Open in Google Maps <ArrowRightIcon />
                      </a>
                    ) : (
                      <p className="route-pending">⏳ Map link coming soon</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </section>
        </main>

        {/* ── FOOTER ── */}
        <footer id="contact" className="footer">
          <div className="footer-inner">
            <span className="footer-brand">Kakkalani Gramam</span>
            <div className="footer-rule" />
            <p className="footer-copy">
              © 2026 Kakkalani Gramam Temple, Agraharam. All rights reserved.
            </p>
          </div>
        </footer>
      </div>
    </>
  );
};

export default LandingPage;