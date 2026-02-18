import { useState, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import PublicSiteHeader from "../components/PublicSiteHeader";
import api, { extractResults } from "../lib/api";
import { resolveMediaUrl } from "../lib/media";

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
    primary: "Kakkalani Gramam Busstop: 12 km",
    secondary: "",
    cta: "View location on map →",
    href: "#hero-map",
    icon: "📍",
  },
] as const;


const LandingPage = () => {
  return (
    <div id="top" className="bg-slate-50 text-slate-800">
      <PublicSiteHeader variant="overlay" />

      <main>
        {/* HERO */}
        <section
          id="hero-map"
          className="relative pt-24 sm:pt-28 md:pt-32 text-white min-h-screen"
        >
          <div className="absolute inset-0 z-0 bg-slate-900">
            <img
              src="/images/landing-page-image.jpg"
              alt="Kakkalani Village Landscape Plan"
              className="h-full w-full object-contain"
            />
            <div className="absolute inset-0 bg-gradient-to-r from-[#05091f]/85 via-[#05091f]/60 to-[#05091f]/10" />
          </div>
        </section>

        {/* TIMINGS */}
        <section
          id="timings"
          className="relative z-20 pb-12 sm:pb-16 pt-6 sm:pt-8 mt-12 sm:mt-16"
        >
          <div className="responsive-layout md:px-10">
            <div className="grid grid-cols-1 gap-4 sm:gap-6 md:grid-cols-2 lg:grid-cols-4">
              {heroHighlights.map((item) => (
                <div
                  key={item.title}
                  className="flex flex-col gap-2 sm:gap-3 rounded-[1.75rem] border border-[#f5d5d5] bg-white p-4 sm:p-6 shadow-[0_25px_45px_-20px_rgba(12,16,43,0.25)]"
                >
                  <div className="flex items-center gap-2 sm:gap-3">
                    <span className="text-xl sm:text-2xl">{item.icon}</span>
                    <p className="text-xs sm:text-sm font-semibold uppercase tracking-[0.26em] text-[#b10026]">
                      {item.title}
                    </p>
                  </div>
                  <p className="text-sm font-medium text-slate-700">
                    {item.primary}
                  </p>
                  <p className="text-xs sm:text-sm text-slate-500">{item.secondary}</p>
                  {item.href.startsWith("/") ? (
                    <Link
                      to={item.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-auto text-xs sm:text-sm font-semibold text-[#b10026] hover:text-[#8e001c]"
                    >
                      {item.cta}
                    </Link>
                  ) : (
                    <a
                      href={item.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-auto text-xs sm:text-sm font-semibold text-[#b10026] hover:text-[#8e001c]"
                    >
                      {item.cta}
                    </a>
                  )}
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* SUPPORT */}
        <section id="support" className="bg-gradient-to-r from-red-800 to-red-600 py-12 sm:py-14 text-white">
          <div className="responsive-layout flex flex-col gap-6 sm:gap-8 md:flex-row md:items-center md:justify-between md:px-10">
            <div className="max-w-2xl space-y-3 sm:space-y-4">
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-amber-300">Support the Temple</p>
              <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold">Preserve the legacy of Kakkalani Gramam Temple's</h2>
              <p className="text-base text-amber-100">
                Contributions maintain daily poojas, heritage conservation, annadanam, and cultural outreach. Join hands to
                safeguard centuries of devotion and artistry.
              </p>
            </div>
            <div className="flex flex-wrap gap-3 sm:gap-4 text-sm font-semibold uppercase tracking-wide">
              <a href="#" className="rounded-full bg-white px-4 sm:px-6 py-2 sm:py-3 text-red-700 transition hover:bg-amber-100">Donate Now</a>
              <a href="#" className="rounded-full border border-white px-4 sm:px-6 py-2 sm:py-3 transition hover:bg-white/10">Become a Patron</a>
            </div>
          </div>
        </section>
      </main>

      {/* FOOTER */}
      <footer id="contact" className="bg-slate-950 py-10 sm:py-12 text-slate-300">
        <div className="responsive-layout grid grid-cols-1 gap-6 sm:gap-8 md:grid-cols-2 lg:grid-cols-4 md:px-10">
          <div className="space-y-2 sm:space-y-3">
            <p className="text-base sm:text-lg font-semibold text-white">Kakkalani Gramam Temple</p>
            <p className="text-sm text-slate-400">Kakkalani Gramam, Agraharam, Tamil Nadu 625001</p>
            <p className="text-sm text-slate-400">Phone: +91 9999900000</p>
            <p className="text-sm text-slate-400">Email: crgrpkakkalany@gmail.com</p>
          </div>

          <div className="space-y-2 sm:space-y-3 text-sm">
            <p className="font-semibold text-white">Temple Hours</p>
            <p>Morning Darshan: 5:00 AM – 12:30 PM</p>
            <p>Evening Darshan: 4:00 PM – 10:00 PM</p>
            <p>Friday Special Abhishekam: 7:00 PM</p>
          </div>

          <div className="space-y-2 sm:space-y-3 text-sm">
            <p className="font-semibold text-white">Quick Links</p>
            <a href="#visit" className="block text-slate-400 transition hover:text-white">Plan Your Visit</a>
            <a href="#architecture" className="block text-slate-400 transition hover:text-white">Architecture</a>
            <a href="#darshan" className="block text-slate-400 transition hover:text-white">Pooja Schedule</a>
            <a href="#news" className="block text-slate-400 transition hover:text-white">Blog</a>
          </div>

          <div className="space-y-2 sm:space-y-3 text-sm">
            <p className="font-semibold text-white">Stay Connected</p>
            <p>Follow us on Facebook, Instagram, and YouTube for live updates and festival highlights.</p>
            <p className="text-xs text-slate-500">
              © {new Date().getFullYear()} Kakkalani Gramam Temple, Agraharam. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;