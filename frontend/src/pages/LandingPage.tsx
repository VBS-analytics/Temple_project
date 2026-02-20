import { useState, useEffect, useRef } from "react";
import PublicSiteHeader from "../components/PublicSiteHeader";
import api, { extractResults } from "../lib/api";
import { resolveMediaUrl } from "../lib/media";

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

        {/* HOW TO REACH */}
        <section
          id="how-to-reach"
          className="relative z-20 pb-12 sm:pb-16 pt-6 sm:pt-8 mt-12 sm:mt-16"
        >
          <div className="responsive-layout md:px-10">
            <div className="mb-4 sm:mb-6 flex items-center gap-3">
              <span className="text-xl">📍</span>
              <p className="text-sm font-semibold uppercase tracking-[0.26em] text-[#b10026]">
                How to Reach
              </p>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:gap-6 md:grid-cols-2 xl:grid-cols-3">
              {howToReachRoutes.map((route) => (
                <div
                  key={route.route}
                  className="flex flex-col gap-2 sm:gap-3 rounded-[1.75rem] border border-[#f5d5d5] bg-white p-4 sm:p-6 shadow-[0_25px_45px_-20px_rgba(12,16,43,0.25)]"
                >
                  <p className="text-xs sm:text-sm font-semibold uppercase tracking-[0.2em] text-[#b10026]">
                    {route.route}
                  </p>
                  <p className="text-sm font-medium text-slate-700">
                    {route.title}
                  </p>
                  <p className="text-sm text-slate-600">{route.distance}</p>
                  {route.href ? (
                    <a
                      href={route.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-auto text-xs sm:text-sm font-semibold text-[#b10026] hover:text-[#8e001c]"
                    >
                      Open route in Google Maps →
                    </a>
                  ) : (
                    <p className="mt-auto text-xs sm:text-sm font-semibold text-slate-500">
                      Map link will be updated.
                    </p>
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
              <a
                href="/donation"
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-full bg-white px-4 sm:px-6 py-2 sm:py-3 text-red-700 transition hover:bg-amber-100"
              >
                Donate Now
              </a>
              <a href="#" className="rounded-full border border-white px-4 sm:px-6 py-2 sm:py-3 transition hover:bg-white/10">Contact to Become a Patron</a>
            </div>
          </div>
        </section>
      </main>

      {/* FOOTER */}
      <footer id="contact" className="bg-slate-950 py-6 sm:py-8 text-slate-300">
        <div className="responsive-layout md:px-10">
          <p className="text-center text-sm sm:text-base">
            © 2026 Kakkalani Gramam Temple, Agraharam. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;
