import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import PublicSiteHeader from "../components/PublicSiteHeader";

// ── DATA ─────────────────────────────────────────────────────────────────────

const howToReachRoutes = [
  { route: "Route 1", title: "Thiruvarur Railway Junction to Kakkalani Lakshmi Narayana Perumal Temple", distance: "10 km",
    href: "https://www.google.com/maps/dir/Thiruvarur+Railway+Junction,+QJ7M%2BXP6,+Santhamangalam,+KTR+Nagar,+Thiruvarur,+Tamil+Nadu+610001/Kakkalani+Lakshmi+Narayana+Perumal+Temple,+PMJM%2B2C5,+Thappalanpuliyur+II,+Tamil+Nadu+610106/@10.7475922,79.6428365,8026m/data=!3m1!1e3!4m15!4m14!1m5!1m1!1s0x3a5547f68962cfab:0x748b80cb3811bfbd!2m2!1d79.6342509!2d10.7649169!1m5!1m1!1s0x3a55416ffc6238d3:0x75bc85e1ff87c819!2m2!1d79.6835975!2d10.730005!3e0!5i1?entry=ttu&g_ep=EgoyMDI2MDIxNi4wIKXMDSoASAFQAw%3D%3D" },
  { route: "Route 2", title: "Thiruvarur Railway Junction to Kakkalani Lakshmi Narayana Perumal Temple", distance: "14 km",
    href: "https://www.google.com/maps/dir/Thiruvarur+Railway+Junction,+QJ7M%2BXP6,+Santhamangalam,+KTR+Nagar,+Thiruvarur,+Tamil+Nadu+610001/Kakkalani+Lakshmi+Narayana+Perumal+Temple,+PMJM%2B2C5,+Thappalanpuliyur+II,+Tamil+Nadu+610106/@10.7475922,79.6428365,8026m/data=!3m1!1e3!4m14!4m13!1m5!1m1!1s0x3a5547f68962cfab:0x748b80cb3811bfbd!2m2!1d79.6342509!2d10.7649169!1m5!1m1!1s0x3a55416ffc6238d3:0x75bc85e1ff87c819!2m2!1d79.6835975!2d10.730005!3e0?entry=ttu&g_ep=EgoyMDI2MDIxNi4wIKXMDSoASAFQAw%3D%3D" },
  { route: "Route 3", title: "Thiruvarur Railway Junction to Kakkalani Lakshmi Narayana Perumal Temple", distance: "Distance to be updated", href: "" },
  { route: "Route 4", title: "Kumbakonam Railway Station to Kakkalani Lakshmi Narayana Perumal Temple", distance: "60 km",
    href: "https://www.google.com/maps/dir/Kumbakonam+Railway+Station,+C2,+North+St,+Rajapondy+Nagar,+Kumbakonam,+Tamil+Nadu+612001/Kakkalani+Lakshmi+Narayana+Perumal+Temple,+PMJM%2B2C5,+Thappalanpuliyur+II,+Tamil+Nadu+610106/@10.8283533,79.4658279,32097m/data=!3m1!1e3!4m14!4m13!1m5!1m1!1s0x3a5533ad521f7f57:0x1ad5b98c064ad97d!2m2!1d79.3896086!2d10.9537712!1m5!1m1!1s0x3a55416ffc6238d3:0x75bc85e1ff87c819!2m2!1d79.6835975!2d10.730005!3e0?entry=ttu&g_ep=EgoyMDI2MDIxNi4wIKXMDSoASAFQAw%3D%3D" },
  { route: "Route 5", title: "Nagapattinam to Kakkalani Lakshmi Narayana Perumal Temple", distance: "22 km",
    href: "https://www.google.com/maps/dir/Nagapattinam,+Tamil+Nadu/Kakkalani+Lakshmi+Narayana+Perumal+Temple,+PMJM%2B2C5,+Thappalanpuliyur+II,+Tamil+Nadu+610106/@10.7454277,79.7324732,19649m/data=!3m1!1e3!4m14!4m13!1m5!1m1!1s0x3a556c9797ef6927:0xc869efbb726e6072!2m2!1d79.8448512!2d10.7672313!1m5!1m1!1s0x3a55416ffc6238d3:0x75bc85e1ff87c819!2m2!1d79.6835975!2d10.730005!3e0?entry=ttu&g_ep=EgoyMDI2MDIxNi4wIKXMDSoASAFQAw%3D%3D" },
];

type TempleImage = { src: string; deity: string; name: string; contain?: boolean; templeTabId: string };

type StatIcon = "location" | "temple" | "heritage" | "blessings";

const quickStats: Array<{ icon: StatIcon; label: string; value: string; targetId: string }> = [
  { icon: "temple",    label: "Sacred Temples",   value: "5+ Temple & Sacred Sites", targetId: "temples-sacred-sites" },
  { icon: "blessings", label: "Divine Blessings", value: "Mahaperiyava & Ramana Maharishi", targetId: "mahaperiyava-ramana-maharishi" },
  { icon: "location",  label: "Location",         value: "How to Reach Kakkalani", targetId: "how-to-reach-kakkalani" },
];

const templeImages: TempleImage[] = [
  { src: "/images/kovi/lakshmi-narayanar/lakshmi-narayanar.png", deity: "", name: "Perumal Koil", templeTabId: "lakshmi-narayanar-temple", contain: true  },
  { src: "/images/kovi/pillayar/pillayar-hd.jpg", deity: "", name: "Pillayar Koil", templeTabId: "aathangarai-pillayar", contain: false },
  { src: "/images/kovi/kalahasteeswarar/kalahasteeswarar-hd.png", deity: "", name: "Kalahasteeswarar Koil", templeTabId: "gnanambal-samedha-kalahasteeswarar", contain: true  },
  { src: "/images/kovi/ayyanar/ayyanar.png", deity: "", name: "Ayyanar Koil", templeTabId: "mangala-azhagar-ayyanar-koil", contain: true  },
];

const landingTempleMarqueeSlides = [
  { src: "/images/kovi/lakshmi-narayanar/lakshmi-narayanar.png", alt: "Lakshmi Narayanar temple deity", fit: "contain" as const },
  { src: "/images/kovi/pillayar/pillayar-hd.jpg", alt: "Aathagarai Pillayar temple deity", fit: "contain" as const },
  { src: "/images/kovi/kalahasteeswarar/kalahasteeswarar-hd.png", alt: "Kalahasteeswarar temple deity", fit: "contain" as const },
  { src: "/images/kovi/ayyanar/ayyanar-hd.jpg", alt: "Ayyanar temple deity", fit: "contain" as const },
  { src: "/images/kovi/Damodara-Pillayar-Temple.png", alt: "Damodara Pillayar temple deity", fit: "contain" as const },
  { src: "/images/kovi/Mazhai-Mariamman.png", alt: "Mazhai Mariamman temple deity", fit: "contain" as const },
];

const landingMapHero = {
  src: "/images/new-landing-page.jpg",
  alt: "Kakkalani Village map, Tamil Nadu",
};

// ── ICONS ────────────────────────────────────────────────────────────────────

const ArrowRight = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" />
  </svg>
);
const MapPinIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" />
  </svg>
);
const ChevronDown = ({ flip }: { flip?: boolean }) => (
  <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
    style={{ transition: "transform .3s", transform: flip ? "rotate(180deg)" : "none" }}>
    <polyline points="6 9 12 15 18 9" />
  </svg>
);

const LocationStatIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M12 21s6-5.4 6-11a6 6 0 1 0-12 0c0 5.6 6 11 6 11Z" />
    <circle cx="12" cy="10" r="2.2" />
  </svg>
);

const TempleStatIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.85" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M12 3l2.3 2.2L12 7.4 9.7 5.2 12 3Z" />
    <path d="M8.2 8.2h7.6l-.9 2.2h-5.8l-.9-2.2Z" />
    <path d="M7.2 12h9.6v8H7.2z" />
    <path d="M10.5 20v-4h3v4" />
  </svg>
);

const HeritageStatIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="8" cy="8" r="2.2" />
    <circle cx="16" cy="8.5" r="2" />
    <path d="M4.8 18.5c.2-2.7 2-4.3 4.4-4.3 2.3 0 4.1 1.7 4.3 4.3" />
    <path d="M13.5 18.5c.2-2 1.5-3.2 3.3-3.2 1.7 0 3 1.2 3.2 3.2" />
  </svg>
);

const BlessingsStatIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M8.1 8.8l1.9 2.1 2-2.1" />
    <path d="M6.3 10.6L4.6 16c-.4 1.3.5 2.6 1.9 2.6h2.2" />
    <path d="M17.7 10.6l1.7 5.4c.4 1.3-.5 2.6-1.9 2.6h-2.2" />
    <path d="M10 11.1V19h4v-7.9" />
  </svg>
);

const renderStatIcon = (icon: StatIcon) => {
  if (icon === "location") return <LocationStatIcon />;
  if (icon === "temple") return <TempleStatIcon />;
  if (icon === "heritage") return <HeritageStatIcon />;
  return <BlessingsStatIcon />;
};

const HistorySectionIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.85" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M5 20V9.5L12 5l7 4.5V20" />
    <path d="M9.2 20v-5.5h5.6V20" />
    <path d="M3.8 20h16.4" />
    <path d="M12 5V3.2" />
  </svg>
);

// ── COMPONENT ─────────────────────────────────────────────────────────────────

type LandingPageProps = {
  showHeader?: boolean;
  showHero?: boolean;
};

const LandingPage = ({ showHeader = true, showHero = true }: LandingPageProps) => {
  const [routesExpanded, setRoutesExpanded] = useState(false);
  const [showScrollTop, setShowScrollTop] = useState(false);
  const location = useLocation();

  const scrollToSection = (targetId: string) => {
    const section = document.getElementById(targetId);
    if (!section) return;
    const headerOffset = showHeader ? 110 : 28;
    const targetY = section.getBoundingClientRect().top + window.scrollY - headerOffset;
    window.scrollTo({ top: Math.max(targetY, 0), behavior: "smooth" });
    window.history.replaceState(null, "", `${location.pathname}${location.search}#${targetId}`);
  };

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  useEffect(() => {
    if (!location.hash) return;
    const targetId = location.hash.replace("#", "");

    const scrollToHashSection = () => {
      const section = document.getElementById(targetId);
      if (!section) return;
      const headerOffset = showHeader ? 110 : 28;
      const targetY = section.getBoundingClientRect().top + window.scrollY - headerOffset;
      window.scrollTo({ top: Math.max(targetY, 0), behavior: "smooth" });
    };

    const raf = requestAnimationFrame(scrollToHashSection);
    return () => cancelAnimationFrame(raf);
  }, [location.hash, showHeader]);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => entries.forEach((e) => { if (e.isIntersecting) e.target.classList.add("lv"); }),
      { threshold: 0.08 }
    );
    document.querySelectorAll(".lr:not(.lv)").forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [routesExpanded]);

  useEffect(() => {
    const handleScroll = () => setShowScrollTop(window.scrollY > 560);
    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const visibleRoutes = routesExpanded ? howToReachRoutes : howToReachRoutes.slice(0, 2);
  return (
    <>
      <style>{`
        /* ── Same font stack as About Kakkalani Village page ── */
        :root {
          /* text — earth tone scale */
          --t1: #2e2018;   /* dark earth: headings                  */
          --t2: #4a3326;   /* medium earth: sub-headings            */
          --t3: #5f4636;   /* body text                             */
          --t4: #7a5e4b;   /* muted labels                          */
          /* accent — temple wall (sendooram) */
          --ac:  #a33a2b;  /* temple red                            */
          --ac2: #7e2a20;  /* deep red hover                        */
          --acl: #efd9cf;  /* pale lime-wash red tint               */
          --acm: #f8eee2;  /* light tile bg                         */
          /* backgrounds — sunnambu / lime wash */
          --bg:  #f7f1e6;  /* page background                        */
          --bg2: #fffdf8;  /* card white                             */
          --bg3: #fbf5ea;  /* alternate warm white                   */
          --bg-earth-mist: rgba(126,42,32,.09);
          /* border */
          --bd:  rgba(163,58,43,.22); /* muted temple red border   */
          /* footer */
          --ft:  #5c1f17;  /* deep temple red                       */
        }

        /* ── BASE — same font as About page (system serif + sans) ── */
        /*
          Temple background: subtle Shatkona (sacred hexagram) tile —
          the union of Shiva and Shakti, a sacred geometric symbol
          found on temple walls and ceilings across South India.
        */
        .lp {
          font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;
          color:var(--t1); overflow-x:hidden; position:relative; isolation:isolate;
          background-color:var(--bg);
          background-image:
            radial-gradient(circle at 12% 18%, rgba(255,255,255,.42) 0%, rgba(255,255,255,0) 34%),
            radial-gradient(circle at 86% 12%, var(--bg-earth-mist) 0%, rgba(126,42,32,0) 30%),
            radial-gradient(circle at 18% 84%, rgba(163,58,43,.06) 0%, rgba(163,58,43,0) 28%),
            radial-gradient(circle at 82% 78%, rgba(255,255,255,.36) 0%, rgba(255,255,255,0) 34%),
            linear-gradient(to bottom, rgba(255,255,255,.26), rgba(255,255,255,0));
          background-attachment: fixed;
        }
        .lp::before {
          content:"";
          position:absolute; inset:0; z-index:0; pointer-events:none;
          background:
            linear-gradient(to right, rgba(255,255,255,.18), rgba(255,255,255,0) 30%, rgba(255,255,255,.12) 55%, rgba(255,255,255,0) 100%);
          opacity:.3;
        }
        .lp::after {
          content:"";
          position:absolute; inset:0; z-index:0; pointer-events:none;
          background:
            radial-gradient(circle at 1px 1px, rgba(126,42,32,.15) 1px, transparent 0);
          background-size: 22px 22px;
          opacity:.04;
        }
        .lp > * { position:relative; z-index:1; }
        .lp *, .lp *::before, .lp *::after { box-sizing:border-box; }

        /* ── REVEAL ── */
        .lr  { opacity:0; transform:translateY(22px); transition:opacity .7s cubic-bezier(.22,1,.36,1),transform .7s cubic-bezier(.22,1,.36,1); }
        .lr.lv { opacity:1; transform:translateY(0); }
        .ld1{transition-delay:.07s} .ld2{transition-delay:.15s} .ld3{transition-delay:.23s} .ld4{transition-delay:.31s}

        /* ── LAYOUT ── */
        .wrap { width:100%; padding:0 5%; }

        /* plain section backgrounds — no vector pattern */
        .t-bg       { background:var(--bg); }
        .t-bg-white { background:var(--bg2); }

        /* ── SHARED TYPOGRAPHY ── */
        .eyebrow {
          display:inline-flex; align-items:center; gap:.55rem;
          font-size:.72rem; font-weight:700; letter-spacing:.3em; text-transform:uppercase;
          color:var(--ac); margin-bottom:.75rem;
        }
        .eyebrow::before,.eyebrow::after { content:''; display:inline-block; width:24px; height:1.5px; background:var(--ac); opacity:.4; }

        .sec-title {
          font-family:Georgia,'Times New Roman',serif; font-size:clamp(1.75rem,3.6vw,3rem);
          color:var(--t1); line-height:1.15; margin:0 0 .65rem; font-weight:700;
        }
        .sec-title em { color:var(--ac); font-style:normal; }

        .sec-desc {
          font-size:clamp(1rem,1.8vw,1.18rem);
          color:var(--t3); line-height:1.85;
        }

        /* ornament */
        .orn { display:flex; align-items:center; justify-content:center; gap:.5rem; margin:1.25rem 0; }
        .orn-ln { height:1.5px; width:48px; background:linear-gradient(to right,transparent,var(--ac)); opacity:.5; }
        .orn-ln.r { background:linear-gradient(to left,transparent,var(--ac)); }
        .orn-gm { width:6px; height:6px; background:var(--ac); border-radius:1px; transform:rotate(45deg); opacity:.6; }

        /* section divider line */
        .top-stripe { position:relative; border-top:none; }
        .top-stripe::before {
          content:"";
          position:absolute;
          left:5%;
          right:5%;
          top:0;
          height:6px;
          border-top:1px solid #efd9cf;
          border-bottom:1px solid #efd9cf;
          background:repeating-linear-gradient(90deg, #a33a2b 0 8px, #fffdf8 8px 16px);
        }

        /* ═══════════════════════════════════════
           HERO
        ═══════════════════════════════════════ */
        .landing-hero {
          width:100%;
          overflow:hidden;
          position:relative;
          margin-bottom:1.5rem;
          background:var(--bg2);
        }
        .temple-marquee-bar {
          width:100%;
          height:153px;
          overflow:hidden;
          border-top:1px solid #efd9cf;
          border-bottom:1px solid #efd9cf;
          background:#fffdf8;
          display:flex;
          align-items:center;
        }
        .temple-marquee-track {
          display:flex;
          align-items:center;
          width:max-content;
          height:100%;
          gap:.55rem;
          padding:.35rem .2rem;
          will-change:transform;
          animation:temple-marquee-scroll 30s linear infinite;
        }
        .temple-marquee-item {
          flex:0 0 auto;
          height:calc(100% - .7rem);
          aspect-ratio:.9 / 1;
          border-radius:.15rem;
          border:1px solid var(--bd);
          background:var(--bg2);
          overflow:hidden;
          box-shadow:0 1px 4px rgba(0,0,0,.1);
          display:flex;
          align-items:center;
          justify-content:center;
        }
        .temple-marquee-image {
          width:100%;
          height:100%;
          display:block;
          object-fit:cover;
        }
        .landing-map-frame {
          width:100%;
          background:#f4eadc;
        }
        .landing-map-image {
          width:100%;
          height:auto;
          display:block;
          object-fit:contain;
          object-position:center top;
        }
        @keyframes temple-marquee-scroll {
          from { transform:translateX(0); }
          to { transform:translateX(-50%); }
        }
        @media (prefers-reduced-motion: reduce) {
          .temple-marquee-track { animation:none; }
        }

        /* ═══════════════════════════════════════
           STATS
        ═══════════════════════════════════════ */
        .stats { padding:3rem 0 1.5rem; }
        .stats-grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(185px,1fr)); gap:1.2rem; }
        .stat-card {
          background:var(--bg2); border:1px solid var(--bd); border-radius:1.1rem;
          padding:1.75rem 1.4rem; text-align:center;
          box-shadow:0 2px 14px rgba(0,0,0,.06); position:relative; overflow:hidden;
          transition:transform .3s, box-shadow .3s;
        }
        .stat-card-btn {
          width:100%;
          border:1px solid var(--bd);
          cursor:pointer;
          font:inherit;
          appearance:none;
        }
        .stat-card-btn:focus-visible {
          outline:2px solid var(--ac);
          outline-offset:2px;
        }
        .stat-card::before { content:''; position:absolute; top:0; left:0; right:0; height:3px; background:linear-gradient(to right,var(--ac),var(--ac2)); }
        .stat-card:hover { transform:translateY(-4px); box-shadow:0 12px 36px rgba(0,0,0,.1); }
        .stat-icon {
          width:48px; height:48px; margin:0 auto .75rem;
          display:flex; align-items:center; justify-content:center;
          border-radius:.85rem; background:var(--acm); color:var(--ac);
          border:1px solid var(--acl);
        }
        .stat-val { font-family:Georgia,serif; font-size:1.18rem; font-weight:700; color:var(--t1); line-height:1.3; margin-bottom:.35rem; }
        .stat-lbl { font-size:.65rem; font-weight:700; letter-spacing:.22em; text-transform:uppercase; color:var(--ac); }

        /* ═══════════════════════════════════════
           HERITAGE section wrapper
        ═══════════════════════════════════════ */
        .heritage { padding:2.25rem 0 4rem; }
        /* Om (ॐ) symbol watermark — faint temple backdrop behind section header */
        .heritage-hdr {
          text-align:center; margin-bottom:3rem;
        }
        .heritage-hdr > * { position:relative; z-index:1; }

        /* shared row styling */
        .h-section {
          position:relative;
          padding:2.75rem 0;
          border-bottom:none;
        }
        .h-section::after {
          content:"";
          position:absolute;
          left:0;
          right:0;
          bottom:0;
          height:6px;
          border-top:1px solid #efd9cf;
          border-bottom:1px solid #efd9cf;
          background:repeating-linear-gradient(90deg, #a33a2b 0 8px, #fffdf8 8px 16px);
        }
        .h-section:last-child { padding-bottom:0; }
        .h-section:last-child::after { display:none; }

        /* icon + title bar — matches About page article header */
        .h-title-bar { display:flex; align-items:center; gap:.8rem; margin-bottom:.5rem; }
        .h-icon {
          width:46px; height:46px; border-radius:.75rem; background:var(--acl);
          display:flex; align-items:center; justify-content:center;
          font-size:1.4rem; flex-shrink:0;
          transition:transform .3s;
        }
        .h-icon svg { width:24px; height:24px; color:var(--ac); }
        .h-section:hover .h-icon { transform:scale(1.1); }
        .h-sec-title {
          font-family:Georgia,'Times New Roman',serif; font-size:clamp(1.25rem,2.4vw,1.9rem);
          font-weight:700; color:var(--t1); margin:0; line-height:1.2;
        }
        .h-rule { width:48px; height:4px; background:linear-gradient(to right,var(--ac),var(--ac2)); border-radius:2px; margin:.55rem 0 1rem 54px; }
        @media(max-width:480px){ .h-rule { margin-left:0; } }

        .h-para {
          font-size:clamp(.95rem,1.75vw,1.1rem);
          line-height:1.9; color:var(--t3); margin-bottom:.85rem;
        }
        .h-para:last-child { margin-bottom:0; }

        /* ── BLESSINGS: text left | images right ── */
        .bless-cols {
          display:grid;
          grid-template-columns:1fr clamp(220px,26%,320px);
          gap:2rem; align-items:start;
        }
        @media(max-width:820px){
          .bless-cols { grid-template-columns:1fr; }
          .bless-imgs { max-width:260px; }
        }

        .bless-imgs { display:flex; flex-direction:column; gap:.9rem; }
        .bless-img-wrap {
          border-radius:1.5rem; overflow:hidden; aspect-ratio:4/3.06; position:relative;
          box-shadow:0 5px 22px rgba(0,0,0,.14); flex-shrink:0;
        }
        .bless-img-wrap img { width:100%; height:100%; object-fit:cover; display:block; transition:transform .55s; }
        .bless-img-wrap:hover img { transform:scale(1.05); }
        .bless-img-cap { position:absolute; bottom:0; left:0; right:0; padding:.7rem .9rem; background:linear-gradient(to top,rgba(0,0,0,.7),transparent); }
        .bless-img-cap span { font-size:.64rem; font-weight:700; letter-spacing:.14em; text-transform:uppercase; color:#fff; }

        /* honour highlight tiles inside Blessings */
        .bless-honours { display:flex; flex-direction:column; gap:.65rem; margin-top:1.25rem; }
        .bless-honour {
          display:flex; align-items:flex-start; gap:.75rem;
          background:var(--acm); border:1px solid var(--acl);
          border-radius:.75rem; padding:.75rem 1rem;
        }
        .bless-honour-icon {
          width:36px; height:36px; border-radius:.5rem; background:var(--acl);
          display:flex; align-items:center; justify-content:center;
          font-size:1.1rem; flex-shrink:0;
        }
        .bless-honour-title { font-size:.82rem; font-weight:700; color:var(--t1); margin-bottom:.2rem; }
        .bless-honour-desc  { font-size:.92rem; color:var(--t3); line-height:1.5; }

        /* ── HISTORY: snapshot left | text right ── */
        .hist-cols {
          display:grid; grid-template-columns:1fr 300px;
          gap:2.5rem; align-items:start;
        }
        @media(max-width:820px){ .hist-cols { grid-template-columns:1fr; } }

        /* Village Snapshot card */
        .snapshot-card {
          border-radius:1.5rem; overflow:hidden;
          background:linear-gradient(135deg,var(--ac) 0%,var(--ac2) 100%);
          padding:1.75rem; color:#fff; position:relative;
          box-shadow:0 8px 32px rgba(163,58,43,.32);
        }
        .snapshot-card::before, .snapshot-card::after {
          content:''; position:absolute; border-radius:50%;
          background:rgba(255,255,255,.1); pointer-events:none;
        }
        .snapshot-card::before { width:130px; height:130px; bottom:-40px; right:-40px; }
        .snapshot-card::after  { width:80px;  height:80px;  top:-25px;   left:-25px;  }
        .snap-head { display:flex; align-items:center; gap:.55rem; margin-bottom:.9rem; }
        .snap-head-icon {
          width:32px; height:32px; border-radius:.5rem; background:rgba(255,255,255,.2);
          display:flex; align-items:center; justify-content:center; flex-shrink:0;
        }
        .snap-title { font-size:.7rem; font-weight:700; letter-spacing:.22em; text-transform:uppercase; color:rgba(255,255,255,.9); }
        .snap-desc { font-size:1rem; line-height:1.75; color:rgba(255,255,255,.88); margin-bottom:1.2rem; }
        .snap-stats { display:grid; grid-template-columns:1fr 1fr; gap:.65rem; position:relative; z-index:1; }
        .snap-stat {
          background:rgba(255,255,255,.15); border-radius:.6rem; padding:.65rem .75rem;
          border:1px solid rgba(255,255,255,.2);
        }
        .snap-stat-val { font-family:Georgia,serif; font-size:.95rem; font-weight:700; color:#fff; line-height:1.2; margin-bottom:.2rem; }
        .snap-stat-lbl { font-size:.58rem; font-weight:700; letter-spacing:.15em; text-transform:uppercase; color:rgba(255,255,255,.7); }

        /* ── TEMPLES & SACRED SITES: images left | text right ── */
        .temple-cols {
          display:grid;
          grid-template-columns:clamp(240px,38%,400px) 1fr;
          gap:2rem; align-items:start;
        }
        @media(max-width:820px){ .temple-cols { grid-template-columns:1fr; } }

        .temple-img-grid {
          display:grid; grid-template-columns:1fr 1fr;
          gap:.6rem;
        }

        .t-card {
          border-radius:.75rem; overflow:hidden; aspect-ratio:1/1; position:relative;
          box-shadow:0 3px 14px rgba(0,0,0,.12); border:1px solid var(--bd);
          background:var(--bg3);
        }
        .t-card-link { display:block; text-decoration:none; color:inherit; }
        .t-card.t-cover img { width:100%; height:100%; object-fit:cover; display:block; transition:transform .6s; }
        .t-card.t-contain img { width:100%; height:100%; object-fit:contain; padding:.3rem; display:block; transition:transform .5s; }
        .t-card:hover img { transform:scale(1.05); }
        .t-card-overlay {
          position:absolute; inset:0;
          background:linear-gradient(to top, rgba(0,0,0,.82) 0%, rgba(0,0,0,.0) 50%);
          pointer-events:none;
        }
        .t-card.t-contain .t-card-overlay { background:linear-gradient(to top, rgba(0,0,0,.6) 0%, transparent 38%); }
        .t-card::after {
          content:''; position:absolute; top:0; left:0; right:0; height:3px;
          background:linear-gradient(to right,var(--ac),var(--ac2));
          transform:scaleX(0); transform-origin:left; transition:transform .35s; z-index:2;
        }
        .t-card:hover::after { transform:scaleX(1); }
        .t-info { position:absolute; bottom:0; left:0; right:0; padding:1rem; z-index:1; }
        .t-deity { font-size:.58rem; font-weight:700; letter-spacing:.25em; text-transform:uppercase; color:#ffe9e3; margin-bottom:.3rem; }
        .t-name { font-family:Georgia,serif; font-size:.95rem; font-weight:600; color:#fff; line-height:1.25; }

        /* ═══════════════════════════════════════
           HOW TO REACH — compact & simple
        ═══════════════════════════════════════ */
        .reach { padding:3.5rem 0 4rem; }
        .reach-hdr {
          display:flex; align-items:center; gap:.6rem;
          margin-bottom:1.6rem; padding-bottom:1rem;
          border-bottom:2px solid var(--acl);
        }
        .reach-hdr-icon {
          width:36px; height:36px; background:var(--ac); border-radius:.55rem;
          display:flex; align-items:center; justify-content:center; color:#fff; flex-shrink:0;
        }
        .reach-hdr-title { font-family:Georgia,'Times New Roman',serif; font-size:clamp(1.4rem,3vw,2rem); color:var(--t1); font-weight:700; margin:0; }
        .reach-hdr-sub { font-size:.95rem; color:var(--t4); margin:0; line-height:1.5; }

        .route-list { display:flex; flex-direction:column; gap:.75rem; margin-bottom:1.25rem; }

        .route-row {
          display:grid; grid-template-columns:auto 1fr auto;
          align-items:center; gap:1rem;
          background:var(--bg2); border:1px solid var(--bd); border-radius:.85rem;
          padding:1rem 1.25rem; transition:box-shadow .2s, border-color .2s;
        }
        .route-row:hover { box-shadow:0 4px 20px rgba(0,0,0,.09); border-color:var(--ac); }
        .route-badge {
          font-size:.6rem; font-weight:700; letter-spacing:.2em; text-transform:uppercase;
          color:var(--ac); background:var(--acm); border:1px solid var(--acl);
          padding:.25rem .6rem; border-radius:999px; white-space:nowrap;
        }
        .route-text { min-width:0; }
        .route-title-txt { font-size:.9rem; font-weight:600; color:var(--t1); line-height:1.4; margin:0 0 .2rem; }
        .route-dist-pill {
          display:inline-flex; align-items:center; gap:.3rem; font-size:.75rem; font-weight:600;
          color:var(--t4); background:var(--acm); border:1px solid var(--acl);
          padding:.15rem .55rem; border-radius:999px;
        }
        .route-action { flex-shrink:0; }
        .route-map-btn {
          display:inline-flex; align-items:center; gap:.35rem;
          padding:.4rem .85rem; background:var(--ac); color:#fff;
          font-size:.75rem; font-weight:700; letter-spacing:.05em;
          border-radius:999px; text-decoration:none; white-space:nowrap;
          transition:background .2s, transform .2s;
        }
        .route-map-btn:hover { background:var(--ac2); transform:translateY(-1px); }
        .route-coming { font-size:.78rem; font-weight:600; color:var(--t4); white-space:nowrap; }

        @media(max-width:640px){
          .route-row { grid-template-columns:1fr; gap:.5rem; }
          .route-action { align-self:flex-start; }
        }

        /* expand button */
        .expand-btn {
          display:flex; align-items:center; justify-content:center; gap:.5rem;
          margin:0; padding:.7rem 2rem;
          background:transparent; border:2px solid var(--ac); border-radius:999px;
          font-size:.82rem; font-weight:700;
          letter-spacing:.06em; text-transform:uppercase; color:var(--ac);
          cursor:pointer; transition:background .22s, color .22s;
        }
        .expand-btn:hover { background:var(--ac); color:#fff; }

        /* scroll to top button */
        .scroll-top-btn {
          position:fixed;
          right:clamp(14px,2.2vw,28px);
          bottom:calc(env(safe-area-inset-bottom, 0px) + clamp(18px,2.6vw,34px));
          width:46px; height:46px;
          border:none; border-radius:999px;
          background:linear-gradient(135deg,var(--ac),var(--ac2));
          color:#fff; cursor:pointer;
          display:flex; align-items:center; justify-content:center;
          box-shadow:0 10px 24px rgba(126,42,32,.35);
          transition:transform .2s, box-shadow .2s;
          z-index:85;
        }
        .scroll-top-btn:hover { transform:translateY(-2px); box-shadow:0 14px 28px rgba(126,42,32,.42); }
        .scroll-top-btn:focus-visible { outline:2px solid #fff; outline-offset:2px; }
        @media(max-width:640px){
          .scroll-top-btn {
            width:54px; height:54px;
            right:14px;
            bottom:calc(env(safe-area-inset-bottom, 0px) + 20px);
            border:2px solid rgba(255,255,255,.9);
            box-shadow:0 12px 28px rgba(126,42,32,.45);
          }
          .scroll-top-btn svg { width:22px; height:22px; }
          .scroll-top-btn--embedded {
            bottom:calc(env(safe-area-inset-bottom, 0px) + clamp(260px, 32vh, 360px));
          }
        }

        /* ═══════════════════════════════════════
           FOOTER
        ═══════════════════════════════════════ */
        .lp-ft { background:var(--ft); padding:2.25rem 0 1.75rem; }
        .lp-ft-in {
          width:100%; padding:0 1.5rem;
          display:flex; flex-direction:column; align-items:center; text-align:center; gap:.3rem;
        }
        .ft-brand { font-family:Georgia,serif; font-size:1.3rem; font-weight:700; color:var(--acl); letter-spacing:.08em; }
        .ft-rule { width:55px; height:1px; background:linear-gradient(to right,transparent,var(--ac),transparent); margin:.45rem auto; }
        .ft-copy { font-size:.7rem; color:rgba(247,241,230,.72); letter-spacing:.05em; }

        /* ═══════════════════════════════════════
           RESPONSIVE MISC
        ═══════════════════════════════════════ */
        @media(max-width:640px){
          .temple-marquee-bar { height:124px; }
          .temple-marquee-track {
            gap:.4rem;
            padding:.25rem .15rem;
          }
          .temple-marquee-item { height:calc(100% - .5rem); }
          .stats-grid { grid-template-columns:1fr 1fr; }
          .bless-imgs { flex-direction:row; }
          .bless-img-wrap { flex:1; aspect-ratio:4/5.1; }
        }
        @media(max-width:420px){
          .stats-grid { grid-template-columns:1fr; }
          .bless-imgs { flex-direction:column; }
          .bless-img-wrap { flex:none; width:38%; align-self:center; aspect-ratio:4/5.74; }
          .temple-img-grid { grid-template-columns:1fr 1fr; }
        }
      `}</style>

      <div className="lp">
        {showHeader && <PublicSiteHeader variant="amber" templeWallBorder />}

        <main>

          {showHero && (
            <section className="landing-hero" aria-label="Temple marquee and village map">
              <div className="temple-marquee-bar" aria-label="Temple images right to left marquee">
                <div className="temple-marquee-track">
                  {[...landingTempleMarqueeSlides, ...landingTempleMarqueeSlides].map((slide, index) => {
                    const isDuplicate = index >= landingTempleMarqueeSlides.length;
                    return (
                      <div key={`${slide.src}-${index}`} className="temple-marquee-item" aria-hidden={isDuplicate}>
                        <img
                          src={slide.src}
                          alt={isDuplicate ? "" : slide.alt}
                          className="temple-marquee-image"
                          loading={index < 2 ? "eager" : "lazy"}
                          style={{ objectFit: slide.fit === "contain" ? "contain" : "cover" }}
                        />
                      </div>
                    );
                  })}
                </div>
              </div>
              <div className="landing-map-frame">
                <img
                  src={landingMapHero.src}
                  alt={landingMapHero.alt}
                  className="landing-map-image"
                  loading="eager"
                />
              </div>
              {/* Hidden image preloads keep transitions smooth. */}
              <div className="hidden" aria-hidden="true">
                {landingTempleMarqueeSlides.map((slide) => (
                  <img key={`preload-${slide.src}`} src={slide.src} alt="" loading="lazy" />
                ))}
                <img src={landingMapHero.src} alt="" loading="lazy" />
              </div>
            </section>
          )}

          {/* ── STATS ── */}
          <section className="stats">
            <div className="wrap">
              <div className="stats-grid">
                {quickStats.map((s, i) => (
                  <button
                    key={s.label}
                    type="button"
                    className={`stat-card stat-card-btn lr ld${i + 1}`}
                    onClick={() => scrollToSection(s.targetId)}
                    aria-label={`Go to ${s.value} section`}
                  >
                    <span className="stat-icon">{renderStatIcon(s.icon)}</span>
                    <div className="stat-val">{s.value}</div>
                    <div className="stat-lbl">{s.label}</div>
                  </button>
                ))}
              </div>
            </div>
          </section>

          {/* ═══ OUR VILLAGE HERITAGE ═══ */}
          <section id="significance-of-kakkalani-village" className="heritage">
            <div className="wrap">

              {/* Section header */}
              <div className="heritage-hdr lr">
                <div className="eyebrow">SIGNIFICANCE OF KAKKALANI VILLAGE</div>
                <h2 className="sec-title">
                  A Resilient Heritage of <em>Faith, Rivers & Temples</em>
                </h2>
                <p className="sec-desc">
                  Kakkalani Agraharam has grown around sacred shrines, ancestral homes, and nourishing water —
                  every pond, temple, and tree carries its own story of guardianship and service from the families that still call this village home.
                </p>
              </div>

              <div className="orn lr">
                <div className="orn-ln r" /><div className="orn-gm" /><div className="orn-gm" style={{ opacity:.45 }} /><div className="orn-gm" /><div className="orn-ln" />
              </div>

              {/* ── 1. HISTORY & FOUNDATIONS — snapshot left, text right ── */}
              <div className="h-section lr ld1">
                <div className="h-title-bar">
                  <div className="h-icon"><HistorySectionIcon /></div>
                  <h3 className="h-sec-title">History & Foundations</h3>
                </div>
                <div className="h-rule" />

                <div className="hist-cols">
                  {/* LEFT — text */}
                  <div>
                    <p className="h-para">
                      Kakkalani is a beautiful village located 10 km southeast of Thiruvarur, a town famous for the
                      Thyagaraja Swamy temple that houses a Maragadam Shiva Lingam believed to have once been
                      worshipped by Lord Indiran.
                    </p>
                    <p className="h-para">
                      According to earlier generations, the Chozha king consecrated 48 Shiva temples around Thyagaraja
                      Swamy temple during the mandalam period, and Kakkalani is home to one of those temples —
                      Gnanambal Sametha Kalahastiswarar. Prior to our forefathers moving in four to five generations
                      ago, Rayar families were said to have settled here.
                    </p>
                    <p className="h-para">
                      Kakkalani Agraharam was laid out with the Kadugayar river (a branch of the Kaveri) running along
                      the northern edge. On the riverbank, the Pillayar under the Peepal tree was later relocated into
                      the Aathagarai Pillayar Koil inside the temple compound.
                    </p>
                  </div>

                  {/* RIGHT — Village Snapshot card */}
                  <div className="snapshot-card">
                    <div className="snap-head">
                      <div className="snap-head-icon">
                        <svg width="16" height="16" fill="none" stroke="#fff" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      </div>
                      <span className="snap-title">Village Snapshot</span>
                    </div>
                    <p className="snap-desc">
                      Kadugayar river, gopurams, snake holes, and community ponds are woven
                      into day-to-day life. The village invites you to witness the temples,
                      participate in upkeep, and carry the legacy forward.
                    </p>
                  </div>
                </div>
              </div>

              {/* ── 2. TEMPLES & SACRED SITES — full width text + image grid ── */}
              <div id="temples-sacred-sites" className="h-section lr ld2">
                <div className="h-title-bar">
                  <div className="h-icon"><TempleStatIcon /></div>
                  <h3 className="h-sec-title">Temples & Sacred Sites</h3>
                </div>
                <div className="h-rule" />

                {/* images LEFT, text RIGHT */}
                <div className="temple-cols">
                  {/* LEFT — 2×2 image grid */}
                  <div className="temple-img-grid">
                    {templeImages.map((t) => (
                      <Link
                        key={t.src}
                        to={`/kovi-details?temple=${encodeURIComponent(t.templeTabId)}`}
                        className="t-card-link"
                        aria-label={`Open ${t.name} details`}
                      >
                        <div className={`t-card ${t.contain ? "t-contain" : "t-cover"}`}>
                          <img src={t.src} alt={t.name} loading="lazy" />
                          <div className="t-card-overlay" />
                          <div className="t-info">
                            <div className="t-deity">{t.deity}</div>
                            <div className="t-name">{t.name}</div>
                          </div>
                        </div>
                      </Link>
                    ))}
                  </div>
                  {/* RIGHT — text content */}
                  <div>
                    <p className="h-para">
                      The western edge of the agraharam features the Lakshmi Narayanar Perumal Koil, anchored by a
                      striking gopuram and aligned between two rows of houses so residents can witness deeparadhana
                      from their doorsteps.
                    </p>
                    <p className="h-para">
                      Inside the temple, Pambu Puttru (the snake hole) in the southwest corner still shelters snakes
                      that villagers feed with milk, while a pond named Ayyan Kulam sits just northwest of the shrine.
                    </p>
                    <p className="h-para">
                      On the eastern end stands the Gnanambika Samedha Kalahastiswarar Koil with the Poorna Pushkala
                      Samedha Ayyanar Koil opposite. A short walk east reveals the well-maintained Mazhai Marriamman
                      Koil, and about 1 km further on the village edge is the Damodara Pillayar Koil established by
                      the Pannai family.
                    </p>
                  </div>
                </div>
              </div>

              {/* ── 3. BLESSINGS & LEGACY — text left, images right ── */}
              <div id="mahaperiyava-ramana-maharishi" className="h-section lr ld3">
                <div className="h-title-bar">
                  <div className="h-icon"><BlessingsStatIcon /></div>
                  <h3 className="h-sec-title">Mahaperiyava & Ramana Maharishi</h3>
                </div>
                <div className="h-rule" />

                <div className="bless-cols">
                  {/* LEFT — text */}
                  <div>
                    <p className="h-para">
                      Shri Shri Kanchi Mahaperiyava graced the village twice — an honour even once would be rare — and
                      Shri Shri Ramana Maharishi offered his blessings through a sevaka from our Pannai family who
                      served since childhood before spending his final years back in the agraharam.
                    </p>
                    <p className="h-para">
                      The village has produced leaders recognised by the government with top honours, and our family
                      tree stretches three to four generations above and below us, tying us together as a lineage
                      with shared stories and responsibilities.
                    </p>
                    <div className="bless-honours">
                      <div className="bless-honour">
                        <div className="bless-honour-icon">🙏</div>
                        <div>
                          <div className="bless-honour-title">Twice Blessed by Kanchi Mahaperiyava</div>
                          <div className="bless-honour-desc">An extraordinary grace — Shri Shri Kanchi Mahaperiyava personally visited Kakkalani twice, an honour rare even once in a village's history.</div>
                        </div>
                      </div>
                      <div className="bless-honour">
                        <div className="bless-honour-icon">🏅</div>
                        <div>
                          <div className="bless-honour-title">Government-Recognised Leaders</div>
                          <div className="bless-honour-desc">Sons of this village have been honoured by the government with top state and national awards for distinguished service.</div>
                        </div>
                      </div>
                      <div className="bless-honour">
                        <div className="bless-honour-icon">🌳</div>
                        <div>
                          <div className="bless-honour-title">3–4 Generations of Shared Lineage</div>
                          <div className="bless-honour-desc">Families here trace their roots three to four generations deep, carrying forward stories, rituals, and responsibilities as one community.</div>
                        </div>
                      </div>
                    </div>
                  </div>
                  {/* RIGHT — images */}
                  <div className="bless-imgs">
                    <div className="bless-img-wrap">
                      <img src="/images/kakkalani-000.jpg" alt="Guardian of Tradition" loading="lazy" />
                      <div className="bless-img-cap"><span>Guardian of Tradition</span></div>
                    </div>
                    <div className="bless-img-wrap">
                      <img src="/images/kakkalani-001.jpg" alt="Ancestral Wisdom" loading="lazy" />
                      <div className="bless-img-cap"><span>Ancestral Wisdom</span></div>
                    </div>
                  </div>
                </div>
              </div>

            </div>
          </section>

          {/* ═══ HOW TO REACH — compact list ═══ */}
          <section id="how-to-reach-kakkalani" className="reach top-stripe">
            <div className="wrap">

              {/* Simple inline header */}
              <div className="reach-hdr lr">
                <div className="reach-hdr-icon"><MapPinIcon /></div>
                <div>
                  <h2 className="reach-hdr-title">How to Reach Kakkalani</h2>
                  <p className="reach-hdr-sub">All roads lead to the Kakkalani Lakshmi Narayana Perumal Temple.</p>
                </div>
              </div>

              {/* Compact route rows */}
              <div className="route-list">
                {visibleRoutes.map((route) => (
                  <div key={route.route} className="route-row">
                    <span className="route-badge">{route.route}</span>
                    <div className="route-text">
                      <p className="route-title-txt">{route.title}</p>
                      <span className="route-dist-pill">🛣 {route.distance}</span>
                    </div>
                    <div className="route-action">
                      {route.href
                        ? <a href={route.href} target="_blank" rel="noopener noreferrer" className="route-map-btn">Maps <ArrowRight /></a>
                        : <span className="route-coming">⏳ Soon</span>
                      }
                    </div>
                  </div>
                ))}
              </div>

              <button className="expand-btn" onClick={() => setRoutesExpanded((p) => !p)} aria-expanded={routesExpanded}>
                <ChevronDown flip={routesExpanded} />
                {routesExpanded ? "Show fewer" : `See all ${howToReachRoutes.length} routes`}
              </button>

            </div>
          </section>

        </main>

        {/* ── FOOTER ── */}
        {showScrollTop && (
          <button
            type="button"
            className={`scroll-top-btn${!showHeader ? " scroll-top-btn--embedded" : ""}`}
            onClick={scrollToTop}
            aria-label="Scroll to top"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M18 15l-6-6-6 6" />
            </svg>
          </button>
        )}

        <footer className="lp-ft">
          <div className="lp-ft-in">
            <div className="ft-brand">Kakkalani Gramam</div>
            <div className="ft-rule" />
            <p className="ft-copy">© 2026 Kakkalani Gramam Temple, Agraharam. All rights reserved.</p>
          </div>
        </footer>
      </div>
    </>
  );
};

export default LandingPage;
