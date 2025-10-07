import { useState, useEffect, useRef } from "react";
import { Link } from "react-router-dom";

import LanguageToggle from "../components/LanguageToggle";
import api, { extractResults } from "../lib/api";
import { resolveMediaUrl } from "../lib/media";

const formatCurrency = (value?: string | null) => {
  if (!value) return "";
  const amountNumber = Number(value);
  if (Number.isNaN(amountNumber)) return value ?? "";
  return amountNumber.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

interface FeaturedPoojaCard {
  id: number;
  name: string;
  image: string;
  image_url?: string;
  amount: string | null;
}

const navLinks = [
  { label: "Home", href: "#top" },
  { label: "Darshan & Pooja", href: "#darshan" },
  { label: "Architecture", href: "#architecture" },
  { label: "Gallery", href: "#gallery" },
  { label: "Visit", href: "#visit" },
  { label: "Events", href: "#top" },
  { label: "Projects", href: "#top" },
  { label: "About", href: "#top" },
] as const;

const heroHighlights = [
  {
    title: "Temple Timings",
    primary: "Morning: 5:00 AM – 12:30 PM",
    secondary: "Evening: 4:00 PM – 10:00 PM",
    cta: "View full schedule →",
    href: "#timings",
    icon: "🕰️",
  },
  {
    title: "Entry Fee",
    primary: "General: Free",
    secondary: "Special Darshan: Varies",
    cta: "View fee details →",
    href: "/login",
    icon: "🎟️",
  },
  {
    title: "Best Time to Visit",
    primary: "Weekday mornings (7 – 10 AM)",
    secondary: "December to February",
    cta: "Tips to avoid crowds →",
    href: "#visit",
    icon: "📅",
  },
  {
    title: "How to Reach",
    primary: "Madurai Airport: 12 km",
    secondary: "Madurai Junction: 2 km",
    cta: "Get directions →",
    href: "#visit",
    icon: "📍",
  },
] as const;

const visitHighlights = [
  {
    title: "Guided Temple Tours",
    description:
      "Daily tours at 10:00 AM & 4:00 PM covering gopurams, mandapams, and the sacred tank.",
    icon: "🛕",
  },
  {
    title: "Special Darshan",
    description:
      "Express darshan counters available during peak festival days. Online booking recommended.",
    icon: "🙏",
  },
  {
    title: "Dress Code",
    description:
      "Traditional attire preferred. Shoulders and knees must be covered inside sanctum areas.",
    icon: "👘",
  },
] as const;

/** Architecture cards (images left). Each click updates right-side content. */
const architectureHighlights = [
  {
    image:
      "https://images.unsplash.com/photo-1507371341162-763b5e419408?auto=format&fit=crop&w=1200&q=80",
    displayTitle: "Pillayar Koil",
    displayDescription: "Pillayar Koil Details",
    alt: "Pillayar Koil",
  },
  {
    image:
      "https://images.unsplash.com/photo-1507371341162-763b5e419408?auto=format&fit=crop&w=1200&q=80",
    displayTitle: "Thousand Pillar Hall - Shivan Koil",
    displayDescription:
      "A sculptural wonder dating back to the 16th century, featuring musical pillars and murals. - Shivan Koil Details",
    alt: "Thousand Pillar Hall - Shivan Koil",
  },
  {
    image:
      "https://images.unsplash.com/photo-1507371341162-763b5e419408?auto=format&fit=crop&w=1200&q=80",
    displayTitle: "Golden Lotus Tank - Ayyanar Koil",
    displayDescription:
      "Sacred tank where poets presented their works; reflects the grandeur of the surrounding halls. - Ayyanar Koil Details",
    alt: "Golden Lotus Tank - Ayyanar Koil",
  },
  {
    image:
      "https://images.unsplash.com/photo-1507371341162-763b5e419408?auto=format&fit=crop&w=1200&q=80",
    displayTitle: "Sacred Mandapams - Perumal Koil",
    displayDescription:
      "Intricately carved mandapams hosting nightly rituals, music, and cultural celebrations. - Perumal Koil Details",
    alt: "Sacred Mandapams - Perumal Koil",
  },
] as const;

const galleryImages = [
  "https://images.unsplash.com/photo-1596265130137-02d0ed684495?auto=format&fit=crop&w=1100&q=80",
  "https://images.unsplash.com/photo-1544552866-0f474b117a30?auto=format&fit=crop&w=1100&q=80",
  "https://images.unsplash.com/photo-1517814083926-912067cec463?auto=format&fit=crop&w=1100&q=80",
  "https://images.unsplash.com/photo-1518548865246-1e2922e03e94?auto=format&fit=crop&w=1100&q=80",
] as const;

const poojaSchedule = [
  {
    name: "Tiruvananthal Pooja",
    time: "5:00 AM",
    details:
      "Opening of the sanctum, recitation of sacred hymns, and first darshan of the day.",
  },
  {
    name: "Thiruvembavai",
    time: "7:00 AM",
    details:
      "Morning prayer with Vedic chanting and traditional music inside the main sannidhi.",
  },
  {
    name: "Noon Pooja",
    time: "12:15 PM",
    details:
      "Abhishekam and alankaram performed before the temple closes for the afternoon.",
  },
  {
    name: "Evening Pooja",
    time: "7:00 PM",
    details:
      "Sandhya deepa arati with cultural programs in the mandapams.",
  },
  {
    name: "Ardhajama Pooja",
    time: "9:30 PM",
    details:
      "Sacred procession of the deities followed by the resting ceremony for the night.",
  },
] as const;

const facilities = [
  "Temple canteen open 7:00 AM – 9:00 PM with prasadam and South Indian meals.",
  "Wheelchair access and assistance available at the South Gopuram entrance.",
  "Cloak rooms for footwear and valuables located near East Tower.",
  "On-site book shop with devotional literature, souvenirs, and prasadam counters.",
  "Clean drinking water and rest areas provided across the campus.",
  "24/7 security desk and lost-and-found near the main office.",
] as const;

const newsUpdates = [
  {
    title: "Chithirai Festival At Madurai concludes with grandeur",
    excerpt:
      "A ten-day celebration featuring celestial wedding, therottam, and lakhs of devotees from across the world.",
    href: "#",
  },
  {
    title: "Renovation works begin at the sacred Golden Lotus Tank",
    excerpt:
      "Structural restoration and mural conservation initiated to preserve the heritage for future generations.",
    href: "#",
  },
  {
    title: "Temple introduces bilingual guided tours for visitors",
    excerpt:
      "Daily Tamil and English tours now available with pre-booking through the information center.",
    href: "#",
  },
] as const;

/* ---------- DATA (put near your other constants) ---------- */
const dailyPooja = [
  {
    day: "Sunday",
    text:
      "குருபூஜை திருவிழா • அபிஷேகம் • ஆதித்தன்கரை பிள்ளையார்; சிவன் கோவிலில், சுந்தரேசுவரர் அம்பாள், அய்யனார் கோவிலில்; பெரியமான் கோவிலில்",
  },
  {
    day: "Monday",
    text:
      "திங்கள்நாள் நித்யமம் அர்ச்சனை • ஆதித்தன்கரை பிள்ளையார்; சிவன் கோவிலில், அம்பாள், அய்யனார் கோவிலில்; பெரியமான் கோவிலில்",
  },
  {
    day: "Tuesday",
    text:
      "செவ்வாய்க்கிழமை • அபிஷேகம் • ஆதித்தன்கரை பிள்ளையார்; சிவன் கோவிலில், சுந்தரேசுவரர் அம்பாள், அய்யனார் கோவிலில்; பெரியமான் கோவிலில்",
  },
  {
    day: "Wednesday",
    text:
      "புதன் வழிபாடு • அபிஷேகம் • ஆதித்தன்கரை பிள்ளையார்; சிவன் கோவிலில், அம்பாள், அய்யனார் கோவிலில்; பெரியமான் கோவிலில்",
  },
  {
    day: "Thursday",
    text:
      "குருவாரம் • அர்ச்சனை • ஆதித்தன்கரை பிள்ளையார்; சிவன் கோவிலில், அம்பாள், அய்யனார் கோவிலில்; பெரியமான் கோவிலில்",
  },
  {
    day: "Friday",
    text:
      "வெள்ளி நித்யமம் • அபிஷேகம் • ஆதித்தன்கரை பிள்ளையார்; சிவன் கோவிலில், அம்பாள், அய்யனார் கோவிலில்; பெரியமான் கோவிலில்",
  },
  {
    day: "Saturday",
    text:
      "சனிக்கிழமை • அபிஷேகம் • ஆதித்தன்கரை பிள்ளையார்; சிவன் கோவிலில், அம்பாள், அய்யனார் கோவிலில்; பெரியமான் கோவிலில்",
  },
] as const;


const LandingPage = () => {
  // Selected card content (title + description) for Architecture section
  const [selected, setSelected] = useState<null | {
    title: string;
    description: string;
  }>(null);

  // Ref & click-outside to reset Architecture section to default
  const archRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (archRef.current && !archRef.current.contains(e.target as Node)) {
        setSelected(null);
      }
    };
    document.addEventListener("click", handleClickOutside);
    return () => document.removeEventListener("click", handleClickOutside);
  }, []);

  /* ---------- HOOKS (inside LandingPage component, above return) ---------- */
  const [poojaIdx, setPoojaIdx] = useState(0);
  const [poojaPaused, setPoojaPaused] = useState(false);
  const [featuredPoojas, setFeaturedPoojas] = useState<FeaturedPoojaCard[]>([]);
  const [featuredError, setFeaturedError] = useState('');

  useEffect(() => {
    const id = setInterval(() => {
      if (!poojaPaused) setPoojaIdx((i) => (i + 1) % dailyPooja.length);
    }, 4000); // auto-advance speed
    return () => clearInterval(id);
  }, [poojaPaused]);

  useEffect(() => {
    let isMounted = true;
    const fetchFeatured = async () => {
      try {
        const { data } = await api.get('/pooja/featured-poojas/');
        if (!isMounted) return;
        const cards = extractResults<FeaturedPoojaCard>(data)
          .filter((item) => Boolean(item.image))
          .slice(0, 4);
        setFeaturedPoojas(cards);
      } catch (error) {
        if (isMounted) {
          setFeaturedError('Unable to load featured poojas right now.');
        }
      }
    };
    fetchFeatured();
    return () => {
      isMounted = false;
    };
  }, []);


  return (
    <div id="top" className="bg-slate-50 text-slate-800">
      {/* HEADER */}
      <header className="absolute inset-x-0 top-0 z-20">
        <div className="bg-transparent text-white relative">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-6 py-4">
            {/* Left side (Logo/Title) */}
            <a
              href="#top"
              className="flex flex-col gap-1 text-left md:flex-shrink-0"
            >
              <p className="text-sm font-semibold uppercase tracking-[0.28em] text-amber-200">
                Agraharam Temple&apos;s
              </p>
              <p className="text-xs text-white/80">
                The Architectural Marvel of Agraharam
              </p>
            </a>

            {/* Center Nav Links */}
            <div className="hidden items-center gap-6 text-sm font-semibold text-white md:flex">
              {navLinks.map((item) => (
                <a
                  key={item.label}
                  href={item.href}
                  className="text-white transition hover:text-[#f4ba1a]"
                >
                  {item.label}
                </a>
              ))}
              <Link
                to="/login"
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-full bg-[#f06f4a] px-4 py-2 text-white transition hover:bg-[#ff8a60]"
              >
                Login
              </Link>
              <Link
                to="/register"
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-full bg-[#f06f4a] px-4 py-2 text-white transition hover:bg-[#ff8a60]"
              >
                Sign Up
              </Link>
            </div>
          </div>

          {/* Tamil Button on Top-Right */}
          <div className="absolute top-4 right-6">
            <LanguageToggle />
          </div>
        </div>
      </header>


      <main>
        {/* HERO */}
        <section className="relative pt-32 text-white">
          <div className="absolute inset-0 z-0">
            <img
              src="images/temple_gopuram.jpg"
              alt="Meenakshi Amman Temple backdrop"
              className="h-full w-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-r from-[#05091f]/85 via-[#05091f]/60 to-[#05091f]/10" />
          </div>
          <div className="relative z-10 mx-auto flex max-w-6xl flex-col px-6 py-20 md:py-28">
            <div className="max-w-2xl space-y-6">
              <span className="inline-flex items-center gap-2 rounded-full bg-white/15 px-4 py-1 text-xs font-semibold uppercase tracking-[0.4em] text-[#f3c428]">
                Experience Madurai in Houston
              </span>
              <h1 className="text-4xl font-bold leading-tight text-white md:text-5xl">
                A living temple dedicated to{" "}
                <span className="text-[#f3c428]">Goddess Meenakshi</span> & Lord
                Sundareswarar
              </h1>
              <p className="text-base text-slate-100 md:text-lg">
                A 2,500-year-old Dravidian masterpiece, renowned for its
                towering gopurams, intricate carvings, and cultural legacy.
                Plan your visit, participate in darshan & poojas, and immerse
                yourself in timeless traditions.
              </p>
              <div className="flex flex-wrap items-center gap-4 text-sm font-semibold uppercase tracking-wide">
                <a
                  href="#visit"
                  className="rounded-full bg-[#f3c428] px-6 py-3 text-slate-900 transition hover:bg-[#ffd559]"
                >
                  Plan Your Visit
                </a>
                <a
                  href="#darshan"
                  className="rounded-full border border-white/40 px-6 py-3 transition hover:border-[#f3c428] hover:text-[#f3c428]"
                >
                  View Pooja Schedule
                </a>
              </div>
            </div>
          </div>
        </section>

        {/* TIMINGS */}
        <section id="timings" className="relative -mt-16 z-20 pb-16 pt-8 md:-mt-20">
          <div className="mx-auto max-w-6xl px-6">
            <div className="grid gap-6 md:grid-cols-4">
              {heroHighlights.map((item) => (
                <div
                  key={item.title}
                  className="flex flex-col gap-3 rounded-[1.75rem] border border-[#f5d5d5] bg-white p-6 shadow-[0_25px_45px_-20px_rgba(12,16,43,0.25)]"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{item.icon}</span>
                    <p className="text-sm font-semibold uppercase tracking-[0.26em] text-[#b10026]">
                      {item.title}
                    </p>
                  </div>
                  <p className="text-sm font-medium text-slate-700">
                    {item.primary}
                  </p>
                  <p className="text-sm text-slate-500">{item.secondary}</p>
                  {item.href.startsWith("/") ? (
                    <Link
                      to={item.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-auto text-sm font-semibold text-[#b10026] hover:text-[#8e001c]"
                    >
                      {item.cta}
                    </Link>
                  ) : (
                    <a
                      href={item.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-auto text-sm font-semibold text-[#b10026] hover:text-[#8e001c]"
                    >
                      {item.cta}
                    </a>
                  )}
                </div>
              ))}
            </div>
          </div>
        </section>



        {/* ARCHITECTURE (swapped + dynamic + click-outside reset) */}
        <section id="architecture" className="bg-[#f8f4f4] py-16">
          <div
            ref={archRef}
            className="mx-auto grid max-w-6xl gap-10 px-6 md:grid-cols-[5fr_6fr] md:items-center"
          >
            {/* Images on the left */}
            <div className="grid gap-4 sm:grid-cols-2">
              {architectureHighlights.map((item) => (
                <div
                  key={item.displayTitle}
                  className="h-36 overflow-hidden rounded-3xl shadow-lg sm:h-48 cursor-pointer"
                  onClick={() => setSelected({ title: item.displayTitle, description: item.displayDescription })}
                  title={`View ${item.displayTitle}`}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      setSelected({ title: item.displayTitle, description: item.displayDescription });
                    }
                  }}
                >
                  <img
                    src={item.image}
                    alt={item.alt}
                    className="h-full w-full object-cover transition duration-500 hover:scale-105"
                  />
                </div>
              ))}
            </div>

            {/* Text on the right */}
            <div className="space-y-6">
              <span className="inline-flex items-center rounded-full bg-[#b10026]/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.4em] text-[#b10026]">
                Architecture & Heritage
              </span>
              <h2 className="text-3xl font-bold text-[#7a0e24] md:text-4xl">
                {selected ? selected.title : "Extraordinary Dravidian Architecture"}
              </h2>
              <p className="text-base text-slate-700 md:text-lg">
                {selected
                  ? selected.description
                  : "The Meenakshi Amman Temple complex spans 14 acres and celebrates Dravidian architecture through towering gopurams, intricately carved mandapams, and sacred tanks that mirror centuries of devotion."}
              </p>
              <Link
                to="/architecture"
                className="mt-6 inline-flex w-fit items-center justify-center rounded-full bg-[#7a0e24] px-6 py-3 text-sm font-semibold uppercase tracking-wide text-white shadow-lg transition hover:bg-[#8e1a34]"
              >
                Explore Architecture
              </Link>
            </div>
          </div>
        </section>



        {/* VISIT (Three Column Layout - Swapped Daily Pooja & Plan Your Visit) */}
        <section id="visit" className="py-16 bg-gradient-to-b from-slate-100 to-white">
          <div className="mx-auto grid max-w-[1400px] gap-8 px-6 md:items-start lg:grid-cols-[1.7fr_1.7fr_1.1fr]">
            
            {/* LEFT: Plan Your Visit */}
            <div className="space-y-6">
              <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-[0_25px_45px_-22px_rgba(12,16,43,0.18)]">
                <div className="flex flex-col gap-4">
                  <div>
                    <h2 className="text-3xl font-bold text-slate-900 md:text-4xl">
                      Plan Your Visit
                    </h2>
                    <p className="mt-2 text-slate-600 md:text-lg">
                      Open daily, with extended hours on festival days. Please remove
                      footwear, observe temple etiquette, and maintain silence in sanctum
                      areas.
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700 ring-1 ring-emerald-200">
                      Open Today
                    </span>
                    <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-800 ring-1 ring-amber-200">
                      Peak: 7–10 AM
                    </span>
                    <span className="rounded-full bg-sky-50 px-3 py-1 text-xs font-semibold text-sky-800 ring-1 ring-sky-200">
                      Dress Code Applies
                    </span>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-3 text-sm font-semibold uppercase tracking-wide">
                    <a
                      href="#darshan"
                      className="rounded-full bg-[#b10026] px-6 py-3 text-white transition hover:bg-[#8e001c]"
                    >
                      Book Darshan
                    </a>
                    <a
                      href="https://www.google.com/maps/place/Meenakshi+Amman+Temple"
                      target="_blank"
                      rel="noreferrer"
                      className="rounded-full border border-[#b10026] px-6 py-3 text-[#b10026] transition hover:bg-[#b10026]/10"
                    >
                      Get Directions
                    </a>
                  </div>
                </div>
              </div>
            </div>

            {/* CENTER: Highlights */}
            <aside>
              <ul className="grid gap-4 sm:grid-cols-2">
                <li className="group relative overflow-hidden rounded-3xl border border-slate-200 bg-white p-5 shadow-sm transition hover:shadow-md">
                  <div className="flex items-start gap-3">
                    <span className="text-2xl leading-none">🛕</span>
                    <div>
                      <p className="text-sm font-semibold text-slate-900">
                        Guided Temple Tours
                      </p>
                      <p className="mt-1 text-sm text-slate-600">
                        Daily tours at 10:00 AM & 4:00 PM covering gopurams, mandapams,
                        and the sacred tank.
                      </p>
                    </div>
                  </div>
                </li>
                <li className="group relative overflow-hidden rounded-3xl border border-slate-200 bg-white p-5 shadow-sm transition hover:shadow-md">
                  <div className="flex items-start gap-3">
                    <span className="text-2xl leading-none">🙏</span>
                    <div>
                      <p className="text-sm font-semibold text-slate-900">
                        Special Darshan
                      </p>
                      <p className="mt-1 text-sm text-slate-600">
                        Express darshan counters available during peak festival days.
                        Online booking recommended.
                      </p>
                    </div>
                  </div>
                </li>
                <li className="group relative overflow-hidden rounded-3xl border border-slate-200 bg-white p-5 shadow-sm transition hover:shadow-md">
                  <div className="flex items-start gap-3">
                    <span className="text-2xl leading-none">👘</span>
                    <div>
                      <p className="text-sm font-semibold text-slate-900">Dress Code</p>
                      <p className="mt-1 text-sm text-slate-600">
                        Traditional attire preferred. Shoulders and knees must be
                        covered inside sanctum areas.
                      </p>
                    </div>
                  </div>
                </li>
                <li className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                  <p className="text-sm font-semibold text-slate-900">Visitor Etiquette</p>
                  <p className="mt-1 text-sm text-slate-600">
                    No photography inside sanctum. Please queue calmly and follow
                    volunteer instructions during peak hours.
                  </p>
                </li>
                <li className="sm:col-span-2">
                  <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                    Pro tip: Weekday mornings (7–10 AM) are the most relaxed for darshan.
                    Online booking is recommended on festival days.
                  </div>
                </li>
              </ul>
            </aside>

            {/* RIGHT: Daily Pooja */}
            <aside className="space-y-5">
              <div
                className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm"
                onMouseEnter={() => setPoojaPaused(true)}
                onMouseLeave={() => setPoojaPaused(false)}
              >
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="text-base font-semibold text-slate-900">Daily Pooja</h3>
                </div>
                <div className="relative h-48 overflow-hidden rounded-2xl bg-slate-50/40 ring-1 ring-slate-200/60">
                  <div
                    className="transition-transform duration-700 ease-out"
                    style={{ transform: `translateY(-${poojaIdx * 12}rem)` }}
                  >
                    {dailyPooja.map((slot) => (
                      <div key={slot.day} className="h-48 px-4 py-3">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-rose-700">
                          {slot.day}
                        </p>
                        <p className="mt-1 text-sm text-slate-700 whitespace-pre-line leading-6">
                          {slot.text}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="mt-3 flex items-center justify-center gap-1.5">
                  {dailyPooja.map((_, i) => (
                    <button
                      key={i}
                      aria-label={`Show ${dailyPooja[i].day}`}
                      onClick={() => setPoojaIdx(i)}
                      className={`h-1.5 w-1.5 rounded-full transition ${
                        poojaIdx === i
                          ? "bg-rose-600"
                          : "bg-slate-300 hover:bg-slate-400"
                      }`}
                    />
                  ))}
                </div>
              </div>
            </aside>
          </div>
        </section>
      



        {/* DARSHAN & POOJA */}
        <section id="darshan" className="py-16">
          <div className="mx-auto max-w-6xl px-6">
            <div className="space-y-4 text-center md:text-left">
              <h2 className="text-3xl font-bold text-slate-900 md:text-4xl">Pooja Schedule</h2>
              <p className="text-base text-slate-600 md:text-lg">
                Daily rituals follow ancient Agamic traditions. Arrive 15 minutes early for sponsored sevas and archanas.<br></br>
                Plan your seva with our curated list of daily poojas. Select a pooja to know more or proceed to online booking.
              </p>
            </div>
            <div className="mt-8 overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-lg">
              <table className="min-w-full divide-y divide-slate-200 text-left">
                <thead className="bg-slate-100 text-xs uppercase tracking-[0.3em] text-slate-600">
                  <tr>
                    <th className="px-6 py-4">Pooja</th>
                    <th className="px-6 py-4">Time</th>
                    <th className="px-6 py-4">Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm text-slate-700">
                  {poojaSchedule.map((pooja) => (
                    <tr key={pooja.name} className="hover:bg-slate-50">
                      <td className="px-6 py-4 font-semibold text-slate-900">{pooja.name}</td>
                      <td className="px-6 py-4 text-red-700">{pooja.time}</td>
                      <td className="px-6 py-4">{pooja.details}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>




        {/**
         * FACILITIES
         * Thoughtfully designed amenities ensure a comfortable experience for devotees, tourists, and heritage enthusiasts alike.
         */}
        {false && (
          <section id="facilities" className="bg-slate-100 py-16">
            <div className="mx-auto grid max-w-6xl gap-10 px-6 md:grid-cols-[6fr_5fr] md:items-center">
              <div className="space-y-4">
                <h2 className="text-3xl font-bold text-slate-900 md:text-4xl">Facilities & Services</h2>
                <p className="text-base text-slate-600 md:text-lg">
                  Thoughtfully designed amenities ensure a comfortable experience for devotees, tourists, and heritage enthusiasts alike.
                </p>
                <ul className="grid gap-4 text-sm text-slate-700">
                  {facilities.map((item) => (
                    <li key={item} className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                      <span className="mt-1 text-red-600">•</span>
                      <p>{item}</p>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="overflow-hidden rounded-3xl shadow-xl">
                <img
                  src="https://images.unsplash.com/photo-1515378791036-0648a3ef77b2?auto=format&fit=crop&w=1400&q=80"
                  alt="Temple facilities"
                  className="h-full w-full object-cover"
                />
              </div>
            </div>
          </section>
        )}


        {/* NEWS */}
        <section id="news" className="py-16">
          <div className="mx-auto max-w-6xl space-y-8 px-6">
            <div className="space-y-3 text-center md:text-left">
              <h2 className="text-3xl font-bold text-slate-900 md:text-4xl">Temple Blog & Updates</h2>
              <p className="text-base text-slate-600 md:text-lg">
                Stay informed about festivals, restoration projects, and community initiatives happening every month.
              </p>
            </div>
            <div className="grid gap-6 md:grid-cols-3">
              {newsUpdates.map((item) => (
                <article key={item.title} className="flex h-full flex-col gap-4 rounded-3xl border border-slate-200 bg-white p-6 shadow-lg shadow-slate-200/70">
                  <p className="text-xs font-semibold uppercase tracking-[0.25em] text-red-700">{item.date}</p>
                  <h3 className="text-lg font-semibold text-slate-900">{item.title}</h3>
                  <p className="text-sm text-slate-600">{item.excerpt}</p>
                  <a href={item.href} className="mt-auto text-sm font-semibold text-red-700 hover:text-red-800">
                    Continue reading →
                  </a>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* SUPPORT */}
        <section id="support" className="bg-gradient-to-r from-red-800 to-red-600 py-14 text-white">
          <div className="mx-auto flex max-w-6xl flex-col gap-8 px-6 md:flex-row md:items-center md:justify-between">
            <div className="max-w-2xl space-y-4">
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-amber-300">Support the Temple</p>
              <h2 className="text-3xl font-bold md:text-4xl">Preserve the legacy of Agraharam Town Temple's</h2>
              <p className="text-base text-amber-100">
                Contributions maintain daily poojas, heritage conservation, annadanam, and cultural outreach. Join hands to
                safeguard centuries of devotion and artistry.
              </p>
            </div>
            <div className="flex flex-wrap gap-4 text-sm font-semibold uppercase tracking-wide">
              <a href="#" className="rounded-full bg-white px-6 py-3 text-red-700 transition hover:bg-amber-100">Donate Now</a>
              <a href="#" className="rounded-full border border-white px-6 py-3 transition hover:bg-white/10">Become a Patron</a>
            </div>
          </div>
        </section>
      </main>

      {/* FOOTER */}
      <footer id="contact" className="bg-slate-950 py-12 text-slate-300">
        <div className="mx-auto grid max-w-6xl gap-10 px-6 md:grid-cols-4">
          <div className="space-y-3">
            <p className="text-lg font-semibold text-white">Meenakshi Amman Temple</p>
            <p className="text-sm text-slate-400">Madurai Main, Madurai, Tamil Nadu 625001</p>
            <p className="text-sm text-slate-400">Phone: +91 452 234 4360</p>
            <p className="text-sm text-slate-400">Email: info@meenakshi.org</p>
          </div>
          <div className="space-y-3 text-sm">
            <p className="font-semibold text-white">Temple Hours</p>
            <p>Morning Darshan: 5:00 AM – 12:30 PM</p>
            <p>Evening Darshan: 4:00 PM – 10:00 PM</p>
            <p>Friday Special Abhishekam: 7:00 PM</p>
          </div>
          <div className="space-y-3 text-sm">
            <p className="font-semibold text-white">Quick Links</p>
            <a href="#visit" className="block text-slate-400 transition hover:text-white">Plan Your Visit</a>
            <a href="#architecture" className="block text-slate-400 transition hover:text-white">Architecture</a>
            <a href="#darshan" className="block text-slate-400 transition hover:text-white">Pooja Schedule</a>
            <a href="#news" className="block text-slate-400 transition hover:text-white">Blog</a>
          </div>
          <div className="space-y-3 text-sm">
            <p className="font-semibold text-white">Stay Connected</p>
            <p>Follow us on Facebook, Instagram, and YouTube for live updates and festival highlights.</p>
            <p className="text-xs text-slate-500">
              © {new Date().getFullYear()} Meenakshi Temple, Madurai. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;
