import React, { useState, useEffect, useCallback } from "react";
import PublicSiteHeader from "../components/PublicSiteHeader";
import EnglishTamilToggle from "../components/EnglishTamilToggle";

// ── DATA ─────────────────────────────────────────────────────────────────────
const temples = [
  {
    id: "lakshmi-narayanar-temple",
    name: "Lakshmi Narayanar Temple",
    type: "Vishnu Temple",
    img: "/images/kovi/lakshmi-narayanar/lakshmi-narayanar.png",
    contain: true,
  },
  {
    id: "aathangarai-pillayar",
    name: "Aathangarai Pillayar Koil",
    type: "Riverside Temple",
    img: "/images/kovi/pillayar/pillayar-hd.jpg",
    contain: false,
  },
  {
    id: "gnanambal-samedha-kalahasteeswarar",
    name: "Gnanambal Samedha Kalahasteeswarar Koil",
    type: "Ancient Shiva Temple",
    img: "/images/kovi/kalahasteeswarar/kalahasteeswarar-hd.png",
    contain: true,
  },
  {
    id: "mangala-azhagar-ayyanar-koil",
    name: "Mangala Azhagar Ayyanar Koil",
    type: "Village Guardian Deity",
    img: "/images/kovi/ayyanar/ayyanar.png",
    contain: true,
  },
];

// ── IMAGE SLIDESHOW COMPONENT ─────────────────────────────────────────────────
interface SlideshowImage {
  src: string;
  alt: string;
  caption?: string;
}

const ImageSlideshow: React.FC<{ images: SlideshowImage[] }> = ({ images }) => {
  const [current, setCurrent] = useState(0);
  const [isTransitioning, setIsTransitioning] = useState(false);

  const goTo = useCallback(
    (index: number) => {
      if (isTransitioning || index === current) return;
      setIsTransitioning(true);
      setTimeout(() => {
        setCurrent(index);
        setIsTransitioning(false);
      }, 300);
    },
    [current, isTransitioning]
  );

  const next = useCallback(() => {
    goTo((current + 1) % images.length);
  }, [current, images.length, goTo]);

  const prev = useCallback(() => {
    goTo((current - 1 + images.length) % images.length);
  }, [current, images.length, goTo]);

  // Auto-advance every 5 seconds
  useEffect(() => {
    if (images.length <= 1) return;
    const timer = setInterval(next, 5000);
    return () => clearInterval(timer);
  }, [next, images.length]);

  if (images.length === 0) return null;
  if (images.length === 1) {
    return (
      <div className="kp-slideshow">
        <div className="kp-slide-container">
          <img src={images[0].src} alt={images[0].alt} loading="lazy" />
        </div>
        {images[0].caption && <div className="kp-slide-caption">{images[0].caption}</div>}
      </div>
    );
  }

  return (
    <div className="kp-slideshow">
      <div className="kp-slide-container">
        <img
          src={images[current].src}
          alt={images[current].alt}
          loading="lazy"
          className={isTransitioning ? "kp-slide-fading" : "kp-slide-visible"}
        />
        {/* Navigation arrows */}
        <button className="kp-slide-arrow kp-slide-arrow--left" onClick={prev} aria-label="Previous image">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>
        <button className="kp-slide-arrow kp-slide-arrow--right" onClick={next} aria-label="Next image">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </button>
        {/* Counter */}
        <div className="kp-slide-counter">
          {current + 1} / {images.length}
        </div>
      </div>
      {images[current].caption && (
        <div className="kp-slide-caption">{images[current].caption}</div>
      )}
      {/* Dots */}
      <div className="kp-slide-dots">
        {images.map((_, i) => (
          <button
            key={i}
            className={`kp-slide-dot${i === current ? " kp-slide-dot--active" : ""}`}
            onClick={() => goTo(i)}
            aria-label={`Go to image ${i + 1}`}
          />
        ))}
      </div>
    </div>
  );
};

// ── CSS ───────────────────────────────────────────────────────────────────────
const CSS_STYLES = `
  /* ── KovilDetailsPage — Sacred Stone & Saffron ── */
  .kp {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    color: #0f172a;
    background-color: #fffbeb;
    min-height: 100vh;
    overflow-x: hidden;
  }
  .kp *, .kp *::before, .kp *::after { box-sizing: border-box; }

  /* layout */
  .kp-wrap { width: 100%; padding: 0 5%; }

  /* ── PAGE HEADER ── */
  .kp-pg-hdr {
    padding: 3rem 0 2rem;
    text-align: center;
    border-bottom: 1px solid #fef3c7;
    position: relative;
  }
  .kp-eyebrow {
    display: inline-flex; align-items: center; gap: .5rem;
    font-size: .72rem; font-weight: 700; letter-spacing: .3em; text-transform: uppercase;
    color: #d97706; margin-bottom: .65rem;
  }
  .kp-eyebrow::before, .kp-eyebrow::after {
    content: ''; display: inline-block; width: 24px; height: 1.5px;
    background: #d97706; opacity: .4;
  }
  .kp-pg-title {
    font-family: Georgia, 'Times New Roman', serif;
    font-size: clamp(2rem, 4vw, 3.25rem);
    font-weight: 700; color: #0f172a; margin: 0 0 .6rem; line-height: 1.15;
  }
  .kp-pg-title em { color: #d97706; font-style: normal; }
  .kp-pg-desc {
    font-size: clamp(.9rem, 1.8vw, 1.05rem);
    color: #475569; max-width: 600px; margin: 0 auto; line-height: 1.75;
  }

  /* ── TOGGLE — TOP RIGHT OF HEADER ── */
  .kp-toggle-topright {
    position: absolute;
    top: 1.5rem;
    right: 5%;
    z-index: 10;
  }
  @media (max-width: 640px) {
    .kp-toggle-topright {
      position: relative;
      top: auto; right: auto;
      display: flex; justify-content: flex-end;
      padding: .75rem 0 0;
    }
  }

  /* ── PILL TABS ── */
  .kp-tabs-wrap { padding: 1.75rem 0; }
  .kp-tabs {
    display: flex; flex-wrap: wrap; justify-content: center;
    gap: .55rem;
  }
  .kp-tab {
    display: inline-flex; align-items: center; gap: .5rem;
    min-height: 44px; padding: .45rem 1rem .45rem .45rem;
    border-radius: 999px; cursor: pointer;
    font-size: .82rem; font-weight: 600; line-height: 1.3;
    border: 2px solid #fef3c7; background: #fff; color: #334155;
    transition: border-color .2s, background .2s, box-shadow .2s, color .2s;
    white-space: nowrap;
  }
  .kp-tab:hover {
    border-color: #fcd34d; background: #fffbeb; color: #92400e;
  }
  .kp-tab--active {
    background: linear-gradient(to right, #d97706, #b45309);
    border-color: transparent; color: #fff;
    box-shadow: 0 4px 18px rgba(217,119,6,.3);
  }
  .kp-tab--active:hover {
    background: linear-gradient(to right, #b45309, #92400e);
    border-color: transparent; color: #fff;
  }
  .kp-tab-tag {
    display: inline-flex; align-items: center; justify-content: center;
    width: 26px; height: 26px; border-radius: 50%;
    background: #fef3c7; border: 1.5px solid #fcd34d;
    font-size: .65rem; font-weight: 700; color: #92400e; flex-shrink: 0;
  }
  .kp-tab--active .kp-tab-tag {
    background: rgba(255,255,255,.2); border-color: rgba(255,255,255,.4); color: #fff;
  }
  @media(max-width: 640px) {
    .kp-tabs { gap: .4rem; }
    .kp-tab { font-size: .76rem; padding: .4rem .75rem .4rem .4rem; min-height: 40px; }
  }

  /* ── CONTENT AREA ── */
  .kp-content { padding: 0 0 5rem; }

  /* reveal animation on content switch */
  @keyframes kp-fade-up {
    from { opacity: 0; transform: translateY(16px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  .kp-temple-sections > * {
    animation: kp-fade-up .5s cubic-bezier(.22,1,.36,1) both;
  }
  .kp-temple-sections > *:nth-child(1) { animation-delay: .0s; }
  .kp-temple-sections > *:nth-child(2) { animation-delay: .06s; }
  .kp-temple-sections > *:nth-child(3) { animation-delay: .12s; }
  .kp-temple-sections > *:nth-child(4) { animation-delay: .18s; }
  .kp-temple-sections > *:nth-child(5) { animation-delay: .24s; }
  .kp-temple-sections > *:nth-child(6) { animation-delay: .30s; }
  .kp-temple-sections > *:nth-child(n+7) { animation-delay: .36s; }

  /* ── TEMPLE HEADER BANNER ── */
  .kp-temple-hdr {
    background: linear-gradient(135deg, #d97706 0%, #b45309 100%);
    border-radius: 1.25rem; padding: 2rem 2rem 2rem 2rem;
    color: #fff; position: relative; overflow: hidden;
    margin-bottom: 1.5rem;
  }
  .kp-temple-hdr::before {
    content: 'ॐ';
    position: absolute; right: 1rem; top: 50%;
    transform: translateY(-50%);
    font-family: Georgia, serif; font-size: clamp(6rem, 14vw, 10rem);
    color: rgba(255,255,255,.08); line-height: 1;
    pointer-events: none; user-select: none;
  }
  .kp-temple-type {
    font-size: .63rem; font-weight: 700; letter-spacing: .3em; text-transform: uppercase;
    color: rgba(255,255,255,.8); margin-bottom: .5rem; display: block;
  }
  .kp-temple-name {
    font-family: Georgia, serif;
    font-size: clamp(1.4rem, 3.5vw, 2.25rem);
    font-weight: 700; color: #fff; margin: 0 0 .65rem; line-height: 1.2;
  }
  .kp-temple-desc {
    font-size: clamp(.875rem, 1.8vw, 1rem);
    color: rgba(255,255,255,.88); line-height: 1.75; margin: 0;
    max-width: 72ch;
  }

  /* ── IMAGE SLIDESHOW ── */
  .kp-slideshow {
    margin: 1.5rem 0;
  }
  .kp-slide-container {
    position: relative;
    border-radius: 1rem;
    overflow: hidden;
    background: #faf5eb;
    box-shadow: 0 4px 20px rgba(0,0,0,.1);
  }
  .kp-slide-container img {
    width: 100%;
    aspect-ratio: 16 / 9;
    object-fit: cover;
    display: block;
    transition: opacity .3s ease;
  }
  .kp-slide-fading { opacity: 0; }
  .kp-slide-visible { opacity: 1; }
  .kp-slide-arrow {
    position: absolute;
    top: 50%; transform: translateY(-50%);
    width: 40px; height: 40px;
    border-radius: 50%;
    background: rgba(255,255,255,.85);
    backdrop-filter: blur(4px);
    border: 1.5px solid rgba(217,119,6,.2);
    color: #92400e;
    display: flex; align-items: center; justify-content: center;
    cursor: pointer;
    transition: background .2s, transform .2s, box-shadow .2s;
    z-index: 5;
    box-shadow: 0 2px 8px rgba(0,0,0,.12);
  }
  .kp-slide-arrow:hover {
    background: #fff;
    box-shadow: 0 4px 14px rgba(217,119,6,.25);
    transform: translateY(-50%) scale(1.08);
  }
  .kp-slide-arrow--left { left: .75rem; }
  .kp-slide-arrow--right { right: .75rem; }
  .kp-slide-counter {
    position: absolute; bottom: .75rem; right: .75rem;
    background: rgba(0,0,0,.55);
    backdrop-filter: blur(4px);
    color: #fff;
    font-size: .7rem; font-weight: 600;
    padding: .25rem .65rem;
    border-radius: 999px;
    z-index: 5;
  }
  .kp-slide-caption {
    text-align: center;
    font-size: .78rem; color: #78716c;
    font-style: italic;
    margin-top: .5rem;
  }
  .kp-slide-dots {
    display: flex; justify-content: center; gap: .4rem;
    margin-top: .65rem;
  }
  .kp-slide-dot {
    width: 8px; height: 8px; border-radius: 50%;
    border: 1.5px solid #d97706;
    background: transparent;
    cursor: pointer;
    padding: 0;
    transition: background .2s, transform .2s;
  }
  .kp-slide-dot:hover { background: rgba(217,119,6,.35); }
  .kp-slide-dot--active {
    background: #d97706;
    transform: scale(1.2);
  }
  @media(max-width: 640px) {
    .kp-slide-arrow { width: 34px; height: 34px; }
    .kp-slide-arrow--left { left: .5rem; }
    .kp-slide-arrow--right { right: .5rem; }
  }

  /* ── SECTION CARD ── */
  .kp-sec {
    background: #fff; border: 1px solid rgba(217,119,6,.15);
    border-radius: 1.25rem; padding: 1.75rem 2rem;
    margin-bottom: 1.25rem;
    box-shadow: 0 2px 12px rgba(0,0,0,.05);
  }
  .kp-sec:last-child { margin-bottom: 0; }
  @media(max-width: 640px) { .kp-sec { padding: 1.25rem 1.1rem; } }
  @media(max-width: 640px) { .kp-temple-hdr { padding: 1.5rem 1.25rem; } }

  /* section heading */
  .kp-sec-hdr { margin-bottom: 1.4rem; }
  .kp-sec-eyebrow {
    font-size: .62rem; font-weight: 700; letter-spacing: .25em; text-transform: uppercase;
    color: #d97706; display: block; margin-bottom: .35rem;
  }
  .kp-sec-title {
    font-family: Georgia, 'Times New Roman', serif;
    font-size: clamp(1.15rem, 2.4vw, 1.6rem);
    font-weight: 700; color: #0f172a; margin: 0; line-height: 1.25;
  }
  .kp-rule {
    width: 38px; height: 3px;
    background: linear-gradient(to right, #d97706, #fbbf24);
    border-radius: 2px; margin: .5rem 0 0;
  }

  /* ── HIGHLIGHT BOX ── */
  .kp-hl {
    background: #fffbeb; border: 1px solid #fef3c7;
    border-left: 3px solid #d97706;
    border-radius: .75rem; padding: 1rem 1.1rem;
  }
  .kp-hl-title { font-size: .82rem; font-weight: 700; color: #0f172a; margin-bottom: .3rem; }
  .kp-hl-text { font-size: .9rem; color: #334155; line-height: 1.7; }
  .kp-hl-text strong { color: #0f172a; }

  /* ── SACRED STORY BOX ── */
  .kp-sacred {
    background: linear-gradient(135deg, #fffbeb 0%, #fff7e6 100%);
    border: 1.5px solid #fcd34d; border-radius: 1rem;
    padding: 1.1rem 1.25rem; margin: .75rem 0;
  }
  .kp-sacred-title {
    font-family: Georgia, serif; font-size: .92rem; font-weight: 700;
    color: #92400e; margin-bottom: .4rem;
  }
  .kp-sacred-text { font-size: .9rem; color: #334155; line-height: 1.72; }
  .kp-sacred-text strong { color: #0f172a; }

  /* ── DEITY / FEATURE ROW ── */
  .kp-deity-row {
    display: flex; align-items: flex-start; gap: 1rem;
    border-bottom: 1px solid rgba(217,119,6,.1);
    padding: 1rem 0;
  }
  .kp-deity-row:first-of-type { padding-top: 0; }
  .kp-deity-row:last-of-type { border-bottom: none; padding-bottom: 0; }
  .kp-deity-dot {
    width: 8px; height: 8px; border-radius: 50%;
    background: #d97706; flex-shrink: 0; margin-top: .45rem;
  }
  .kp-deity-name { font-size: .95rem; font-weight: 700; color: #0f172a; margin-bottom: .3rem; }
  .kp-deity-desc { font-size: .875rem; color: #334155; line-height: 1.7; }
  .kp-deity-desc strong { color: #0f172a; }

  /* ── TIMELINE ── */
  .kp-timeline { display: flex; flex-direction: column; }
  .kp-tl-item { display: flex; gap: 1.25rem; }
  .kp-tl-left { display: flex; flex-direction: column; align-items: center; flex-shrink: 0; width: 52px; }
  .kp-tl-year {
    width: 52px; height: 52px; border-radius: 50%;
    background: #d97706; color: #fff;
    font-size: .63rem; font-weight: 700; text-align: center; line-height: 1.2;
    display: flex; align-items: center; justify-content: center; flex-shrink: 0;
  }
  .kp-tl-line {
    width: 2px; flex: 1; min-height: 1.5rem;
    background: linear-gradient(to bottom, #d97706, #fef3c7);
  }
  .kp-tl-item:last-child .kp-tl-line { display: none; }
  .kp-tl-body { padding: 0 0 1.75rem; flex: 1; }
  .kp-tl-item:last-child .kp-tl-body { padding-bottom: 0; }
  .kp-tl-title { font-size: 1rem; font-weight: 700; color: #0f172a; margin-bottom: .3rem; }
  .kp-tl-text { font-size: .875rem; color: #334155; line-height: 1.7; }
  .kp-tl-text strong { color: #0f172a; }

  /* ── IMAGE GRID ── */
  .kp-img-grid { display: grid; grid-template-columns: 1fr 1fr; gap: .85rem; margin-top: 1rem; }
  @media(max-width: 480px) { .kp-img-grid { grid-template-columns: 1fr; } }
  .kp-img-card { border-radius: .75rem; overflow: hidden; }
  .kp-img-card img {
    width: 100%; aspect-ratio: 4/3; display: block;
    object-fit: cover; border-radius: .75rem;
    box-shadow: 0 2px 10px rgba(0,0,0,.1);
  }
  .kp-img-cap { font-size: .7rem; color: #78716c; margin-top: .35rem; font-style: italic; }

  /* single image */
  .kp-img-single { border-radius: .75rem; overflow: hidden; margin-top: .85rem; }
  .kp-img-single img {
    width: 100%; display: block; border-radius: .75rem;
    box-shadow: 0 4px 16px rgba(0,0,0,.1);
  }

  /* ── BEFORE / AFTER GRID ── */
  .kp-ba-grid { display: grid; grid-template-columns: 1fr 1fr; gap: .75rem; }
  @media(max-width: 480px) { .kp-ba-grid { grid-template-columns: 1fr; } }
  .kp-ba-card { border-radius: .75rem; overflow: hidden; }
  .kp-ba-card img {
    width: 100%; aspect-ratio: 4/3; display: block;
    object-fit: cover; border-radius: .75rem;
    box-shadow: 0 2px 8px rgba(0,0,0,.08);
  }
  .kp-ba-label {
    font-size: .63rem; font-weight: 700; letter-spacing: .12em; text-transform: uppercase;
    color: #d97706; margin-top: .3rem; display: block;
  }

  /* ── ALERT BOXES ── */
  .kp-alert { border-radius: .75rem; padding: 1rem 1.1rem; }
  .kp-alert--info { background: #fffbeb; border: 1px solid #fef3c7; }
  .kp-alert--warn { background: #fff7e6; border: 1px solid #fcd34d; }
  .kp-alert--ok   { background: #f0fdf4; border: 1px solid #bbf7d0; }
  .kp-alert-title { font-size: .82rem; font-weight: 700; margin-bottom: .3rem; color: #0f172a; }
  .kp-alert--warn .kp-alert-title { color: #92400e; }
  .kp-alert--ok   .kp-alert-title { color: #166534; }
  .kp-alert-text { font-size: .875rem; color: #334155; line-height: 1.7; }
  .kp-alert-text strong { color: #0f172a; }

  /* ── VIDEO LINK BUTTON ── */
  .kp-video-link {
    display: inline-flex; align-items: center; gap: .5rem;
    background: #d97706; color: #fff;
    padding: .55rem 1.25rem; border-radius: 999px;
    font-size: .82rem; font-weight: 700; text-decoration: none;
    transition: background .2s, transform .2s;
  }
  .kp-video-link:hover { background: #b45309; transform: translateY(-1px); }

  /* ── COMMUNITY IMPACT BANNER ── */
  .kp-community {
    background: linear-gradient(135deg, #d97706 0%, #b45309 100%);
    border-radius: 1.25rem; padding: 1.75rem 2rem; color: #fff; margin-bottom: 1.25rem;
  }
  .kp-community-title {
    font-family: Georgia, serif; font-size: 1.1rem; font-weight: 700;
    margin-bottom: .5rem; color: #fff;
  }
  .kp-community-text { font-size: .9rem; color: rgba(255,255,255,.9); line-height: 1.75; }

  /* ── CONTACT BOX ── */
  .kp-contact {
    display: flex; align-items: flex-start; gap: 1rem;
    background: #fffbeb; border: 1.5px solid #fef3c7;
    border-radius: 1rem; padding: 1.25rem;
    margin-bottom: 1.25rem;
  }
  .kp-contact-icon {
    width: 44px; height: 44px; background: #d97706; border-radius: .75rem;
    display: flex; align-items: center; justify-content: center;
    font-size: 1.25rem; flex-shrink: 0;
  }
  .kp-contact-title { font-family: Georgia,serif; font-weight: 700; color: #0f172a; margin-bottom: .3rem; font-size: 1rem; }
  .kp-contact-text { font-size: .875rem; color: #334155; line-height: 1.65; }
`;

// ── COMPONENT ─────────────────────────────────────────────────────────────────
const KovilDetailsPage = () => {
  const [activeTabId, setActiveTabId] = useState<string>(temples[0].id);

  const renderContent = () => {
    switch (activeTabId) {
      case "gnanambal-samedha-kalahasteeswarar": return <GnanambalContent />;
      case "aathangarai-pillayar":               return <AathangaraiContent />;
      case "lakshmi-narayanar-temple":           return <LakshmiNarayanarContent />;
      case "mangala-azhagar-ayyanar-koil":       return <AyyanarContent />;
      default: return null;
    }
  };

  return (
    <>
      <style>{CSS_STYLES}</style>
      <div className="kp">
        <PublicSiteHeader />

        {/* ── Page Header ── */}
        <header className="kp-pg-hdr">
          <div className="kp-wrap">
            {/* English / Tamil Toggle — top right */}
            <div className="kp-toggle-topright">
              <EnglishTamilToggle />
            </div>

            <h1 className="kp-pg-title">Sacred <em>Kovils</em></h1>
            <p className="kp-pg-desc">
              Four ancient temples that have sheltered the faith, rituals, and stories of
              Kakkalani Agraharam across generations.
            </p>
          </div>
        </header>

        {/* ── Pill Tab Navigation ── */}
        <div className="kp-wrap kp-tabs-wrap">
          <nav className="kp-tabs">
            {temples.map((t, i) => (
              <button
                key={t.id}
                type="button"
                className={`kp-tab${activeTabId === t.id ? " kp-tab--active" : ""}`}
                onClick={() => setActiveTabId(t.id)}
              >
                <span className="kp-tab-tag">T{i + 1}</span>
                {t.name}
              </button>
            ))}
          </nav>
        </div>

        {/* ── Content ── */}
        <main className="kp-content">
          <div className="kp-wrap">
            {/* key forces re-mount so reveal animations replay on tab switch */}
            <div key={activeTabId}>
              {renderContent()}
            </div>
          </div>
        </main>
      </div>
    </>
  );
};

// ── LAKSHMI NARAYANAR ─────────────────────────────────────────────────────────
const LakshmiNarayanarContent = () => (
  <section className="kp-temple-sections">
    {/* Header Banner */}
    <div className="kp-temple-hdr">
      <span className="kp-temple-type">Vishnu Temple</span>
      <h2 className="kp-temple-name">Lakshmi Narayanar Temple</h2>
      <p className="kp-temple-desc">
        Located at the west end of Agraharam — the road in front of the gopuram allows villagers
        to see deeparadhanai (lamp ceremony) from their own doorstep.
      </p>
    </div>

    {/* Image Slideshow */}
    <ImageSlideshow
      images={[
        { src: "/images/kovi/lakshmi-narayanar/lakshmi-narayanar.png", alt: "Main deity — Lakshmi Narayanar", caption: "Main deity — Lakshmi Narayanar" },
        { src: "/images/kovi/lakshmi-narayanar/lakshmi-narayanar-1.png", alt: "Gopuram and temple entrance — view 1", caption: "Gopuram and temple entrance — view 1" },
        { src: "/images/kovi/lakshmi-narayanar/lakshmi-narayanar-2.png", alt: "Gopuram and temple entrance — view 2", caption: "Gopuram and temple entrance — view 2" },
      ]}
    />

    {/* History in Progress */}
    <div className="kp-sec">
      <div className="kp-hl">
        <div className="kp-hl-title">History in Progress</div>
        <div className="kp-hl-text">
          We are still in the process of collecting history about this temple.
        </div>
      </div>
    </div>

    {/* Timeline */}
    <div className="kp-sec">
      <div className="kp-sec-hdr">
        <span className="kp-sec-eyebrow">History</span>
        <h3 className="kp-sec-title">Temple Timeline</h3>
        <div className="kp-rule" />
      </div>
      <div className="kp-timeline">
        <div className="kp-tl-item">
          <div className="kp-tl-left">
            <div className="kp-tl-year">2018</div>
            <div className="kp-tl-line" />
          </div>
          <div className="kp-tl-body">
            <div className="kp-tl-title">Last Kumbabishekam</div>
            <div className="kp-tl-text">
              The last Kumbabishekam was performed in the year <strong>2018</strong>.
            </div>
          </div>
        </div>
        <div className="kp-tl-item">
          <div className="kp-tl-left">
            <div className="kp-tl-year">2019</div>
            <div className="kp-tl-line" />
          </div>
          <div className="kp-tl-body">
            <div className="kp-tl-title">Loss of Traditional Pattachari</div>
            <div className="kp-tl-text">
              For ages, <strong>Pattachari</strong> who lived in this village used to take care of pooja.
              When he expired in the year <strong>2019</strong>, his younger generation left to the city.
            </div>
            <div className="kp-hl" style={{ marginTop: ".65rem" }}>
              <div className="kp-hl-title">Challenge</div>
              <div className="kp-hl-text">
                The temple faced a period without traditional caretakers after the Pattachari's passing.
              </div>
            </div>
          </div>
        </div>
        <div className="kp-tl-item">
          <div className="kp-tl-left">
            <div className="kp-tl-year">2022</div>
          </div>
          <div className="kp-tl-body">
            <div className="kp-tl-title">Revival Through Community</div>
            <div className="kp-tl-text">
              After this group started in <strong>2022</strong>, daily pooja is now being taken care of by the community.
            </div>
            <div className="kp-hl" style={{ marginTop: ".65rem" }}>
              <div className="kp-hl-title">Community Effort</div>
              <div className="kp-hl-text">
                The temple's daily rituals are now maintained through the collective efforts of devoted
                members, ensuring the continuation of sacred traditions.
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    {/* Location & Architecture */}
    <div className="kp-sec">
      <div className="kp-sec-hdr">
        <span className="kp-sec-eyebrow">Location & Structure</span>
        <h3 className="kp-sec-title">Temple Location & Architecture</h3>
        <div className="kp-rule" />
      </div>
      <div className="kp-deity-row">
        <div className="kp-deity-dot" />
        <div>
          <div className="kp-deity-name">Location — West End of Agraharam</div>
          <div className="kp-deity-desc">
            The temple is located at the <strong>west end of Agraharam</strong>. The road in front of
            the gopuram passes through Agraharam, allowing villagers to see deeparadhanai (lamp ceremony)
            standing at the door step of their house.
          </div>
        </div>
      </div>
      <div className="kp-deity-row">
        <div className="kp-deity-dot" />
        <div>
          <div className="kp-deity-name">Temple Structure</div>
          <div className="kp-deity-desc">
            The temple features a <strong>beautiful gopuram</strong> and has a{" "}
            <strong>vast area around the main sannidhi</strong> inside the temple compound.
          </div>
        </div>
      </div>
    </div>

    {/* Special Features */}
    <div className="kp-sec">
      <div className="kp-sec-hdr">
        <span className="kp-sec-eyebrow">Sacred Features</span>
        <h3 className="kp-sec-title">Special Features</h3>
        <div className="kp-rule" />
      </div>
      <div className="kp-deity-row">
        <div className="kp-deity-dot" />
        <div>
          <div className="kp-deity-name">Sacred Snake Hole</div>
          <div className="kp-deity-desc">
            As you enter the temple, on the <strong>left back corner</strong> there is a{" "}
            <strong>"Snake Hole"</strong> that has been existing for so many years.
          </div>
          <div className="kp-hl" style={{ marginTop: ".65rem" }}>
            <div className="kp-hl-title">Living Tradition</div>
            <div className="kp-hl-text">
              Even today the snake is there, and villagers worship by offering milk here.
            </div>
          </div>
        </div>
      </div>
      <div className="kp-deity-row">
        <div className="kp-deity-dot" />
        <div>
          <div className="kp-deity-name">Ayyan Kulam — Temple Pond</div>
          <div className="kp-deity-desc">
            On the <strong>right corner, on the back side</strong> of this temple is{" "}
            <strong>"Ayyan Kulam"</strong> (pond).
          </div>
        </div>
      </div>
    </div>
  </section>
);

// ── AATHANGARAI PILLAYAR ──────────────────────────────────────────────────────
const AathangaraiContent = () => (
  <section className="kp-temple-sections">
    {/* Header Banner */}
    <div className="kp-temple-hdr">
      <span className="kp-temple-type">Riverside Temple</span>
      <h2 className="kp-temple-name">Aathangarai Pillayar Koil</h2>
      <p className="kp-temple-desc">
        A beautiful Pillayar temple located on the banks of the Kaduvaiyaru river,
        serving the devotees of Kakkalani village.
      </p>
    </div>

    {/* Image Slideshow */}
    <ImageSlideshow
      images={[
        { src: "/images/kovi/pillayar/pillayar-hd.jpg", alt: "Aathangarai Pillayar Koil", caption: "Aathangarai Pillayar Koil" },
        { src: "/images/kovi/pillayar/after-kumbabishekam1.png", alt: "After Kumbabishekam", caption: "After Kumbabishekam — view 1" },
        { src: "/images/kovi/pillayar/after-kumbabishekam2.png", alt: "After Kumbabishekam view 2", caption: "After Kumbabishekam — view 2" },
      ]}
    />

    {/* Timeline */}
    <div className="kp-sec">
      <div className="kp-sec-hdr">
        <span className="kp-sec-eyebrow">History</span>
        <h3 className="kp-sec-title">Historical Timeline</h3>
        <div className="kp-rule" />
      </div>
      <div className="kp-timeline">
        <div className="kp-tl-item">
          <div className="kp-tl-left">
            <div className="kp-tl-year">1990s</div>
            <div className="kp-tl-line" />
          </div>
          <div className="kp-tl-body">
            <div className="kp-tl-title">Origins Under Peepal Tree</div>
            <div className="kp-tl-text">
              In the 1990s, the Pillayar idol was situated under a Peepal Tree along the riverbank.
            </div>
          </div>
        </div>
        <div className="kp-tl-item">
          <div className="kp-tl-left">
            <div className="kp-tl-year">95–98</div>
            <div className="kp-tl-line" />
          </div>
          <div className="kp-tl-body">
            <div className="kp-tl-title">Temple Construction</div>
            <div className="kp-tl-text">
              Somewhere between 1995 to 1998, <strong>Shri Suppuni Anna</strong> from Pichu Iyer family
              took initiative to build a small temple for this Pillayar on the banks of Kaduvaiyaru river.
            </div>
          </div>
        </div>
        <div className="kp-tl-item">
          <div className="kp-tl-left">
            <div className="kp-tl-year">2010</div>
            <div className="kp-tl-line" />
          </div>
          <div className="kp-tl-body">
            <div className="kp-tl-title">First Kumbabishekam</div>
            <div className="kp-tl-text">
              In the year 2010, Kumbabishekam was done by <strong>Mr. Rajendran</strong>, with help of{" "}
              <strong>Mr. Sivaraman Kurukkal</strong>.
            </div>
          </div>
        </div>
        <div className="kp-tl-item">
          <div className="kp-tl-left">
            <div className="kp-tl-year">2022</div>
          </div>
          <div className="kp-tl-body">
            <div className="kp-tl-title">Grand Kumbabishekam & Renovation</div>
            <div className="kp-tl-text">
              In the year 2022, the next Kumbabishekam was due and the temple structure was due for major repair.
            </div>
            <div className="kp-hl" style={{ marginTop: ".65rem" }}>
              <div className="kp-hl-title">Community Effort</div>
              <div className="kp-hl-text">
                This group just started their activity and this temple kumbabishekam was a big project.
                Same was conducted in grand manner with support of all donors in this group.{" "}
                <strong>Naga Bhagwan</strong> was also installed near this temple at the river bank.
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    {/* Before & After */}
    <div className="kp-sec">
      <div className="kp-sec-hdr">
        <span className="kp-sec-eyebrow">Renovation</span>
        <h3 className="kp-sec-title">Before & After Kumbabishekam</h3>
        <div className="kp-rule" />
      </div>
      <ImageSlideshow
        images={[
          { src: "/images/kovi/pillayar/before-kumbabishekam1.png", alt: "Before Kumbabishekam", caption: "Before Kumbabishekam" },
          { src: "/images/kovi/pillayar/before-kumbabishekam2.png", alt: "Before Kumbabishekam view 2", caption: "Before Kumbabishekam — view 2" },
          { src: "/images/kovi/pillayar/after-kumbabishekam1.png", alt: "After Kumbabishekam", caption: "After Kumbabishekam" },
          { src: "/images/kovi/pillayar/after-kumbabishekam2.png", alt: "After Kumbabishekam view 2", caption: "After Kumbabishekam — view 2" },
        ]}
      />
    </div>

    {/* Infrastructure */}
    <div className="kp-sec">
      <div className="kp-sec-hdr">
        <span className="kp-sec-eyebrow">Infrastructure</span>
        <h3 className="kp-sec-title">Bridge Infrastructure Development</h3>
        <div className="kp-rule" />
      </div>
      <div className="kp-alert kp-alert--warn">
        <div className="kp-alert-title">The Challenge</div>
        <div className="kp-alert-text">
          Approach to this temple was a big challenge, as we have to cross a{" "}
          <strong>Canal 32 ft wide</strong> and reach temple at river bank. Only option was to walk on
          the shutter gate at this Canal, which was in broken condition, not suitable for us to walk safely.
        </div>
      </div>

      <ImageSlideshow
        images={[
          { src: "/images/kovi/pillayar/before-project-1.png", alt: "Broken canal shutter gate", caption: "Broken Shutter Gate — Before" },
          { src: "/images/kovi/pillayar/before-project-2.png", alt: "Broken canal gate view 2", caption: "Broken Shutter Gate — Before (view 2)" },
          { src: "/images/kovi/pillayar/after-project-1.png", alt: "New GI bridge view 1", caption: "New GI Bridge — After" },
          { src: "/images/kovi/pillayar/after-project-2.png", alt: "New GI bridge view 2", caption: "New GI Bridge — After (view 2)" },
        ]}
      />

      <div className="kp-alert kp-alert--info" style={{ marginTop: "1rem" }}>
        <div className="kp-alert-title">Temporary Solution (2022–2024)</div>
        <div className="kp-alert-text">
          During Kumbabishekam, we built a <strong>temporary Bamboo bridge</strong>, which lasted for
          about <strong>2½ years</strong>.
        </div>
      </div>
      <div className="kp-alert kp-alert--ok" style={{ marginTop: ".75rem" }}>
        <div className="kp-alert-title">Permanent Solution</div>
        <div className="kp-alert-text">
          We have now replaced the bamboo bridge with a{" "}
          <strong>permanent Galvanized Iron structure</strong>. This has helped local residents to visit
          daily river bank to take bath and on way back have darshan at Pillayar koil.
        </div>
      </div>
    </div>

    <div className="kp-community">
      <div className="kp-community-title">Community Impact</div>
      <div className="kp-community-text">
        The temple and bridge infrastructure now serve as a vital spiritual and physical connection for
        villagers, enabling daily rituals and worship. The permanent bridge ensures safe access for all
        devotees visiting both the river and the sacred Pillayar temple.
      </div>
    </div>
  </section>
);

// ── GNANAMBAL SAMEDHA KALAHASTEESWARAR ───────────────────────────────────────
const GnanambalContent = () => (
  <section className="kp-temple-sections">
    {/* Header Banner */}
    <div className="kp-temple-hdr">
      <span className="kp-temple-type">Ancient Heritage Temple · 400+ Years Old</span>
      <h2 className="kp-temple-name">Gnanambal Samedha Kalahasteeswarar Koil</h2>
      <p className="kp-temple-desc">
        Located at the Eastern end of Agraharam, on the way to Thevur via Retta madagadi.
        One of 48 Shiva temples built by the Chozha Kings.
      </p>
    </div>

    {/* Image Slideshow */}
    <ImageSlideshow
      images={[
        { src: "/images/kovi/kalahasteeswarar/kalahasteeswarar-hd.png", alt: "Kalahasteeswarar Temple", caption: "Gnanambal Samedha Kalahasteeswarar Koil" },
        { src: "/images/kovi/kalahasteeswarar/kalahasteeswarar-2.png", alt: "Temple entrance", caption: "Temple Entrance" },
        { src: "/images/kovi/kalahasteeswarar/kalahasteeswarar-1.png", alt: "Side view with gopuram", caption: "Side View & Gopuram" },
        { src: "/images/kovi/kalahasteeswarar/murugan-hd.png", alt: "Lord Subramanya (Murugan)", caption: "Lord Subramanya (Murugan)" },
      ]}
    />

    {/* Heritage */}
    <div className="kp-sec">
      <div className="kp-sec-hdr">
        <span className="kp-sec-eyebrow">Living Heritage</span>
        <h3 className="kp-sec-title">Temple Heritage & History</h3>
        <div className="kp-rule" />
      </div>
      <div className="kp-hl">
        <div className="kp-hl-title">5th Generation Caretakers</div>
        <div className="kp-hl-text">
          Pooja activities are currently carried out by{" "}
          <strong>Shri Manikandan Kurukkal (alias Sridhar)</strong>, who is from the 5th generation
          in his family to take care of poojas here — placing this temple at{" "}
          <strong>400+ years old</strong>.
        </div>
      </div>
      <div className="kp-hl" style={{ marginTop: ".75rem" }}>
        <div className="kp-hl-title">One of 48 Chozha Shiva Temples</div>
        <div className="kp-hl-text">
          This temple is one among <strong>48 Shiva temples</strong> built by the Chozha King.
          Shri Manikandan Kurukkal conducted Kumbabishekam at Thiruvarur Thyagaraja Swamy temple.
          Post kumbabishekam of Thiruvarur temple in mandala period of 48 days, every day kumbabishekam
          to each of these 48 Shiva temples were conducted. This temple at our village is one among them.
        </div>
      </div>
    </div>

    {/* Architecture */}
    <div className="kp-sec">
      <div className="kp-sec-hdr">
        <span className="kp-sec-eyebrow">Architecture</span>
        <h3 className="kp-sec-title">Temple Architecture & Features</h3>
        <div className="kp-rule" />
      </div>
      <div className="kp-deity-row">
        <div className="kp-deity-dot" />
        <div>
          <div className="kp-deity-name">1. Temple Entrance</div>
          <div className="kp-deity-desc">
            On the top of the entrance, you can see idols of Lord Shiva & Goddess Parvathi along with
            Lord Murugan & Lord Ganapathy.
          </div>
          <div className="kp-img-single">
            <img src="/images/kovi/kalahasteeswarar/kalahasteeswarar-2.png" alt="Temple entrance" loading="lazy" />
          </div>
        </div>
      </div>
      <div className="kp-deity-row">
        <div className="kp-deity-dot" />
        <div>
          <div className="kp-deity-name">2. Side View & Gopuram</div>
          <div className="kp-deity-desc">
            The side view shows the gopuram above Lord Shiva. You can see the wall of Mandapam in front
            of Lord Shiva sannidhanam, and a small structure attached to the wall — the Lord Dakshinamoorthy Sannidhi.
          </div>
          <div className="kp-img-single">
            <img src="/images/kovi/kalahasteeswarar/kalahasteeswarar-1.png" alt="Side view with gopuram" loading="lazy" />
          </div>
        </div>
      </div>
      <div className="kp-deity-row">
        <div className="kp-deity-dot" />
        <div>
          <div className="kp-deity-name">3. Gnanambal Sannidhi — Following Aagama Sasthram</div>
          <div className="kp-deity-desc">
            Right in front of the main entrance is Gnanambal Sannidhi. As per aagama sasthram, when
            you visit a Lord Shiva temple, first you should take darshan of Lord Ganapathy, then have
            darshan of Ambal before taking darshan of Lord Shiva.
          </div>
          <div className="kp-hl" style={{ marginTop: ".65rem" }}>
            <div className="kp-hl-title">Divine Power</div>
            <div className="kp-hl-text">
              Gnanambal is a very powerful deity. When you sincerely pray with devotion, she fulfils
              your prayer. This is experienced by few donors of the current younger generation in this group.
            </div>
          </div>
        </div>
      </div>
      <div className="kp-deity-row">
        <div className="kp-deity-dot" />
        <div>
          <div className="kp-deity-name">4. Lord Ganapathy Sannadhi</div>
          <div className="kp-deity-desc">
            Matching the aagama sasthram, this temple is built perfectly. Close to Lord Dakshinamoorthy
            Sannadhi, we have Lord Ganapathy Sannadhi. As soon as you enter the temple and look to your
            left, you can have darshan of Lord Ganapathy, climb steps & right in front you take darshan
            of Ambal, and when you turn to your left you take darshan of Lord Shiva. On your right you
            can have darshan of Nandi.
          </div>
          <div className="kp-img-single">
            <img
              src="/images/kovi/kalahasteeswarar/kalahasteeswarar-hd.png"
              alt="Lord Ganapathy Sannadhi"
              loading="lazy"
              style={{ objectFit: "contain", background: "#faf5eb" }}
            />
          </div>
        </div>
      </div>
    </div>

    {/* Outer Praharam */}
    <div className="kp-sec">
      <div className="kp-sec-hdr">
        <span className="kp-sec-eyebrow">Outer Praharam</span>
        <h3 className="kp-sec-title">Outer Praharam Deities</h3>
        <div className="kp-rule" />
      </div>
      <div className="kp-deity-row">
        <div className="kp-deity-dot" />
        <div>
          <div className="kp-deity-name">5. Lord Dakshinamoorthy</div>
          <div className="kp-deity-desc">
            In outer praharam, when you visit Lord Ganapathy sannadhi, to your right you can have darshan of Lord Dakshinamoorthy.
          </div>
        </div>
      </div>
      <div className="kp-deity-row">
        <div className="kp-deity-dot" />
        <div>
          <div className="kp-deity-name">6. Lord Kasi Viswanathar with Goddess Visalakshi</div>
          <div className="kp-deity-desc">
            Just behind Lord Shiva sannidhanam is Lord Kasi Viswanathar with Goddess Visalakshi.
            This idol was brought by Koorakattu family from Kasi and installed here.
          </div>
          <div className="kp-hl" style={{ marginTop: ".65rem" }}>
            <div className="kp-hl-title">Unique Feature</div>
            <div className="kp-hl-text">
              Here Lord Shiva is facing West. It is said you take darshan of Lord Shiva facing west you
              attain path to moksha. In our village it is unique to have Lord Shiva facing east as well as west.
            </div>
          </div>
        </div>
      </div>
      <div className="kp-deity-row">
        <div className="kp-deity-dot" />
        <div>
          <div className="kp-deity-name">7. Lord Subramanya (Murugan)</div>
          <div className="kp-deity-desc">As you move further, you can have darshan of Lord Subramanya (Murugan).</div>
          <div className="kp-img-single">
            <img
              src="/images/kovi/kalahasteeswarar/murugan-hd.png"
              alt="Lord Subramanya (Murugan)"
              loading="lazy"
              style={{ objectFit: "contain", background: "#faf5eb", maxHeight: "320px" }}
            />
          </div>
          <div className="kp-hl" style={{ marginTop: ".65rem" }}>
            <div className="kp-hl-title">Speciality</div>
            <div className="kp-hl-text">
              The peacock on which Lord Murugan is seated is facing north. It is said, peacock facing
              north are Devargal group and one facing south is Asurargal group.
            </div>
          </div>
        </div>
      </div>
      <div className="kp-deity-row">
        <div className="kp-deity-dot" />
        <div>
          <div className="kp-deity-name">8. Chandikeswarar</div>
          <div className="kp-deity-desc">Located just close to Dhara outlet from Lord Shiva sannidhanam.</div>
        </div>
      </div>
      <div className="kp-deity-row">
        <div className="kp-deity-dot" />
        <div>
          <div className="kp-deity-name">9. Temple Well</div>
          <div className="kp-deity-desc">
            The well inside the temple from where water is used for temple activities.
            See the Sacred Story (Point 13) below to know more about this well and how this village got the name "Kakkalani".
          </div>
        </div>
      </div>
      <div className="kp-deity-row">
        <div className="kp-deity-dot" />
        <div>
          <div className="kp-deity-name">10. Navagraha Sannadhi</div>
          <div className="kp-deity-desc">Located just in front of the temple well.</div>
        </div>
      </div>
      <div className="kp-deity-row">
        <div className="kp-deity-dot" />
        <div>
          <div className="kp-deity-name">11. Lord Suryan, Lord Saneeswaran and Lord Kalabhairavar</div>
          <div className="kp-deity-desc">
            Adjacent to Navagraha sannadhi, there are 3 idols — Lord Suryan, Lord Saneeswaran and Lord Kalabhairavar.
          </div>
        </div>
      </div>
      <div className="kp-deity-row">
        <div className="kp-deity-dot" />
        <div>
          <div className="kp-deity-name">12. Vastu Alignment</div>
          <div className="kp-deity-desc">
            Both the well inside temple and Kadugayar river behind the temple are to the North East of
            main idol in temple. As per vastu, water flowing towards North East is always good.
            This is another positive feature of this temple placement.
          </div>
        </div>
      </div>
    </div>

    {/* Sacred Story */}
    <div className="kp-sec">
      <div className="kp-sec-hdr">
        <span className="kp-sec-eyebrow">Point 13 · Sacred Story</span>
        <h3 className="kp-sec-title">How Kakkalani Got Its Name</h3>
        <div className="kp-rule" />
      </div>
      <div className="kp-sacred">
        <div className="kp-sacred-title">The Divine Worship</div>
        <div className="kp-sacred-text">
          As advised by devas, the negatively afflicted (dosham petra) Rahu and Ketu worshiped Lord Shiva
          at Srikalahasti and got salvation. Devas who worshiped Lord Shiva obtained nectar and wisdom, and
          told Rahu and Ketu that if they worship Lord Shiva they would be granted the status of planets
          and placed alongside the other seven planets to form Navagrahas.
        </div>
      </div>
      <div className="kp-sacred">
        <div className="kp-sacred-title">Temple Significance</div>
        <div className="kp-sacred-text">
          As Rahu, Ketu and Sanishwara Bhagavan worshiped Lord Shiva in our village, Lord Shiva and Goddess
          Parvati were sacredly named as{" "}
          <strong>SriGnanambika Sameda SriKalahastheeswarar</strong> who is bestowing graces. Inside
          prakaram, Sri Visalakshi Vishvanathar temple is also there.
        </div>
      </div>
      <div className="kp-sacred">
        <div className="kp-sacred-title">The Divine Intervention</div>
        <div className="kp-sacred-text">
          While Rahu, Ketu and Sanishwara Bhagavan were worshiping Lord Shiva, Lord Shiva appeared before
          them and told them to perform puja with Gangai water for redemption of sins and also free this
          village from shortage of water.
        </div>
      </div>
      <div className="kp-sacred">
        <div className="kp-sacred-title">Mazhai Mariamman's Help</div>
        <div className="kp-sacred-text">
          Even though there were lot of hurdles to bring Gangai water, Lord Surya with the help of our
          village Goddess Mariamman Ambal brought Ganges water through the sky and poured Ganges water
          into a well (Kenni) dug inside the temple and then pujas were performed.
        </div>
      </div>
      <div
        className="kp-hl"
        style={{ borderColor: "#d97706", borderWidth: "2px", background: "linear-gradient(to right,#fffbeb,#fff7e6)", marginTop: ".75rem" }}
      >
        <div className="kp-hl-title" style={{ color: "#92400e", fontSize: "1rem" }}>
          Origin of the Name "Kakkalani"
        </div>
        <div className="kp-hl-text">
          As Gangai water was brought and filled into the well, this village was named as{" "}
          <strong>Gangaikenni</strong> which over a period of time changed to <strong>Kakkazhani</strong>.
        </div>
        <div className="kp-hl-text" style={{ marginTop: ".5rem" }}>
          As our village Goddess Sri Mariamman Ambal helped Lord Surya in bringing Ganges water, she is
          named as <strong>Mazhai Mariamman</strong>, the deity of fertility and rain, guardian against evil energies.
        </div>
      </div>
    </div>
  </section>
);

// ── MANGALA AZHAGAR AYYANAR KOIL ──────────────────────────────────────────────
const AyyanarContent = () => (
  <section className="kp-temple-sections">
    {/* Header Banner */}
    <div className="kp-temple-hdr">
      <span className="kp-temple-type">Village Guardian Deity</span>
      <h2 className="kp-temple-name">Mangala Azhagar Ayyanar Koil</h2>
      <p className="kp-temple-desc">
        Beautifully situated opposite to Gnanambal Samedha Kalahasteeswarar temple,
        surrounded by beautiful trees and a serene pond.
      </p>
    </div>

    {/* Image Slideshow */}
    <ImageSlideshow
      images={[
        { src: "/images/kovi/ayyanar/ayyanar.png", alt: "Mangala Azhagar Ayyanar", caption: "Mangala Azhagar Ayyanar Koil" },
        { src: "/images/kovi/ayyanar/ayyanar-1.png", alt: "Temple exterior with surrounding trees", caption: "Temple exterior with surrounding trees" },
        { src: "/images/kovi/ayyanar/ayyanar-2.png", alt: "Main entrance and gate", caption: "Main entrance and gate" },
        { src: "/images/kovi/ayyanar/ayyanar-hd.jpg", alt: "Sacred Saptakanni with offerings", caption: "Sacred Saptakanni with offerings" },
        { src: "/images/kovi/ayyanar/ayyanar-kovi-river.png", alt: "Temple pond visible from approach", caption: "Temple pond visible from approach" },
      ]}
    />

    {/* Location */}
    <div className="kp-sec">
      <div className="kp-sec-hdr">
        <span className="kp-sec-eyebrow">Location</span>
        <h3 className="kp-sec-title">Temple Location & Surroundings</h3>
        <div className="kp-rule" />
      </div>
      <div className="kp-deity-row">
        <div className="kp-deity-dot" />
        <div>
          <div className="kp-deity-name">Natural Setting</div>
          <div className="kp-deity-desc">
            The temple is surrounded by <strong>beautiful trees</strong>, creating a serene and natural
            atmosphere for worship.
          </div>
        </div>
      </div>
      <div className="kp-deity-row">
        <div className="kp-deity-dot" />
        <div>
          <div className="kp-deity-name">Water Tank / Pond</div>
          <div className="kp-deity-desc">
            When you go towards the temple, on your <strong>right</strong> you can see the{" "}
            <strong>water tank / pond</strong>. This small pond is located in front of the temple.
          </div>
        </div>
      </div>
    </div>

    {/* Video */}
    <div className="kp-sec">
      <div className="kp-sec-hdr">
        <span className="kp-sec-eyebrow">Video Documentation</span>
        <h3 className="kp-sec-title">Detailed Temple Video</h3>
        <div className="kp-rule" />
      </div>
      <div className="kp-hl">
        <div className="kp-hl-title">JK33 Channel — Kakkalani Village Member</div>
        <div className="kp-hl-text">
          To see a live video, created by one of the <strong>Kakkalani village member</strong>, part of{" "}
          <strong>JK33 channel</strong>. He has explained beautifully about this temple, which he says
          is <strong>kuladeivam</strong> (family deity).
        </div>
        <div style={{ marginTop: "1rem" }}>
          <a
            href="https://youtu.be/p1KJxF3cvzg"
            target="_blank"
            rel="noopener noreferrer"
            className="kp-video-link"
          >
            Watch Temple Video
          </a>
        </div>
        <div className="kp-hl-text" style={{ marginTop: ".65rem", fontSize: ".8rem", color: "#78716c" }}>
          Thanks to his effort & sharing the video documentation of this sacred temple.
        </div>
      </div>
    </div>

    {/* Features */}
    <div className="kp-sec">
      <div className="kp-sec-hdr">
        <span className="kp-sec-eyebrow">Temple Features</span>
        <h3 className="kp-sec-title">Sacred Features</h3>
        <div className="kp-rule" />
      </div>
      <div className="kp-deity-row">
        <div className="kp-deity-dot" />
        <div>
          <div className="kp-deity-name">Saptakanni</div>
          <div className="kp-deity-desc">
            In the video you can see <strong>Saptakanni</strong> inside the temple. This is a sacred
            feature of the temple.
          </div>
        </div>
      </div>
    </div>

    {/* Poojas */}
    <div className="kp-sec">
      <div className="kp-sec-hdr">
        <span className="kp-sec-eyebrow">Rituals</span>
        <h3 className="kp-sec-title">Important Poojas & Rituals</h3>
        <div className="kp-rule" />
      </div>
      <div className="kp-deity-row">
        <div className="kp-deity-dot" />
        <div>
          <div className="kp-deity-name">1. Chandana Kappu for Ayyanar</div>
          <div className="kp-deity-desc">One of the important poojas conducted at this temple.</div>
        </div>
      </div>
      <div className="kp-deity-row">
        <div className="kp-deity-dot" />
        <div>
          <div className="kp-deity-name">2. Palayam (Special Pooja)</div>
          <div className="kp-deity-desc">
            The more important special pooja called <strong>"Palayam"</strong>. You can contact the temple
            management to know more about this sacred ritual.
          </div>
        </div>
      </div>
    </div>

    {/* Contact */}
    <div className="kp-contact">
      <div className="kp-contact-icon">📞</div>
      <div>
        <div className="kp-contact-title">Contact for More Information</div>
        <div className="kp-contact-text">
          For detailed information about special poojas like "Palayam" and to schedule worship services,
          please contact the temple authorities or the community group managing the temple activities.
        </div>
      </div>
    </div>
  </section>
);

export default KovilDetailsPage;