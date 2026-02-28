import PublicSiteHeader from "../components/PublicSiteHeader";
import EnglishTamilToggle from "../components/EnglishTamilToggle";

const WhyVisitNativeVillage = () => (
  <div className="min-h-screen bg-amber-50">
    <PublicSiteHeader variant="amber" />

    <main className="relative overflow-x-hidden senior-readable-content">
      {/* English / Tamil Toggle — top right, matching About Kovil style */}
      <div className="absolute top-5 right-4 sm:top-6 sm:right-[5%] z-10">
        <EnglishTamilToggle />
      </div>

      {/* Decorative background elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 right-10 w-32 h-32 sm:w-64 sm:h-64 bg-amber-200/20 rounded-full blur-3xl" />
        <div className="absolute bottom-20 left-10 w-48 h-48 sm:w-96 sm:h-96 bg-amber-200/20 rounded-full blur-3xl" />
      </div>

      <div className="relative min-h-[70vh] px-4 pt-14 pb-8 sm:px-6 sm:pt-16 sm:pb-10 md:pt-16 md:pb-12 lg:px-8">
        <div className="max-w-5xl mx-auto space-y-6 sm:space-y-8 md:space-y-10">

          {/* Header Section */}
          <header className="space-y-3 sm:space-y-4 text-center px-2">
            {/* Main Heading */}
            <h1 className="font-serif text-xl sm:text-2xl md:text-3xl lg:text-4xl font-bold text-slate-900 leading-tight break-words">
              Vijayam of Kanchi Shri Mahaperiyava to Kakkalani Village
            </h1>

            <div className="h-1 w-16 sm:w-20 rounded-full mx-auto mt-3" style={{ background: "linear-gradient(to right, #d97706, #b45309)" }} />
          </header>

          {/* First Vijayam Section */}
          <section className="group bg-white rounded-2xl sm:rounded-3xl border border-amber-100 shadow-sm hover:shadow-xl hover:border-amber-300 transition-all duration-500 p-4 sm:p-6 md:p-8 relative overflow-hidden">
            {/* Decorative corner */}
            <div className="absolute top-0 right-0 w-16 h-16 sm:w-24 sm:h-24 bg-gradient-to-br from-amber-50 to-transparent rounded-bl-full opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

            {/* Icon badge */}
            <div className="flex items-start gap-3 sm:gap-4 mb-4 sm:mb-5">
              <div className="flex-shrink-0 w-10 h-10 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl flex items-center justify-center text-xl sm:text-2xl group-hover:scale-110 transition-transform duration-300" style={{ background: "#fef3c7" }}>
                🙏
              </div>
              <div className="flex-1 min-w-0">
                <h2 className="font-serif text-lg sm:text-xl md:text-2xl font-bold text-slate-900 mb-1.5 sm:mb-2 break-words">
                  First Vijayam (around 1920)
                </h2>
                <div className="h-1 w-12 sm:w-16 rounded-full" style={{ background: "linear-gradient(to right, #d97706, #b45309)" }} />
              </div>
            </div>

            <div className="space-y-3 sm:space-y-4 text-slate-700">
              <p className="text-sm sm:text-base md:text-lg leading-relaxed break-words">
                Kanchi Shri Mahaperiyava&apos;s vijayam to our village was around the year 1920.
                He visited the Pichu Iyer family during the upanayanam of Shri Mahalingam
                (grandfather of Dr. Sabesan), stayed in the house, and performed pooja.
              </p>

              <p className="text-sm sm:text-base md:text-lg leading-relaxed break-words">
                Details about this event were shared in an audio by Dr. Sabesan
                (son of late Mr. Swaminathan alias Balu, Psychology Professor in Annamalai University,
                and grandson of Mr. Mahalingam).
              </p>

              <div className="mt-4 sm:mt-5 p-3 sm:p-4 bg-amber-50/60 rounded-xl border border-amber-100">
                <p className="text-xs sm:text-sm font-medium text-slate-600 flex items-start gap-2 mb-2 sm:mb-3">
                  <svg className="w-4 h-4 sm:w-5 sm:h-5 text-amber-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15.536a5 5 0 001.414 1.414m2.828-9.9a9 9 0 012.828 2.828" />
                  </svg>
                  <span className="break-all">
                    <span className="font-semibold text-slate-700">Audio reference:</span>{" "}
                    <span className="font-mono">AUD-20240518-WA0003.ogx</span>
                  </span>
                </p>
                <audio controls className="w-full" style={{ height: "36px" }}>
                  <source src="/audio/AUD-20240518-WA0003.ogx" type="audio/ogg" />
                  Your browser does not support the audio element.
                </audio>
              </div>
            </div>
          </section>

          {/* Second Vijayam Section */}
          <section className="group bg-white rounded-2xl sm:rounded-3xl border border-amber-100 shadow-sm hover:shadow-xl hover:border-amber-300 transition-all duration-500 p-4 sm:p-6 md:p-8 relative overflow-hidden">
            {/* Decorative corner */}
            <div className="absolute top-0 right-0 w-16 h-16 sm:w-24 sm:h-24 bg-gradient-to-br from-amber-50 to-transparent rounded-bl-full opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

            {/* Icon badge */}
            <div className="flex items-start gap-3 sm:gap-4 mb-4 sm:mb-5">
              <div className="flex-shrink-0 w-10 h-10 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl flex items-center justify-center text-xl sm:text-2xl group-hover:scale-110 transition-transform duration-300" style={{ background: "#fef3c7" }}>
                🕉️
              </div>
              <div className="flex-1 min-w-0">
                <h2 className="font-serif text-lg sm:text-xl md:text-2xl font-bold text-slate-900 mb-1.5 sm:mb-2 break-words">
                  Second Vijayam (1954)
                </h2>
                <div className="h-1 w-12 sm:w-16 rounded-full" style={{ background: "linear-gradient(to right, #d97706, #b45309)" }} />
              </div>
            </div>

            <div className="space-y-3 sm:space-y-4 text-slate-700">
              <p className="text-sm sm:text-base md:text-lg leading-relaxed break-words">
                Kanchi Shri Mahaperiyava&apos;s second vijayam to our village was through the
                Pannai family in 1954.
              </p>

              <p className="text-sm sm:text-base md:text-lg leading-relaxed break-words">
                While elaborate details are not available, Shri R. Vaithyanathan (the senior-most
                available member from the Pannai family) shared what he could recollect.
              </p>

              <p className="text-sm sm:text-base md:text-lg leading-relaxed break-words">
                During this vijayam, Shri Mahaperiyava stayed for a few days on the plot next to
                Mangalam Periamma&apos;s house, where special hut-type arrangements were made.
              </p>

              <div className="mt-4 sm:mt-5 p-3 sm:p-4 bg-amber-50/60 rounded-xl border border-amber-100">
                <p className="text-xs sm:text-sm text-slate-600 flex items-start gap-2">
                  <svg className="w-4 h-4 sm:w-5 sm:h-5 text-amber-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  <span className="break-words">
                    The location is referenced in the website home page.
                  </span>
                </p>
              </div>
            </div>
          </section>

          {/* Call to Action */}
          <div className="mt-8 sm:mt-10 md:mt-12 p-4 sm:p-6 md:p-8 rounded-2xl sm:rounded-3xl shadow-lg text-center relative overflow-hidden" style={{ background: "linear-gradient(135deg, #d97706 0%, #b45309 100%)" }}>
            {/* Decorative circles */}
            <div className="absolute -bottom-8 -right-8 w-24 h-24 sm:w-32 sm:h-32 rounded-full bg-white/10" />
            <div className="absolute -top-4 -left-4 w-16 h-16 sm:w-24 sm:h-24 rounded-full bg-white/10" />

            <div className="relative z-10">
              <h3 className="font-serif text-lg sm:text-xl md:text-2xl font-bold text-white mb-3 sm:mb-4 break-words px-2">
                Explore the Sacred Temples of Kakkalani
              </h3>
              <p className="text-sm sm:text-base text-white/90 mb-4 sm:mb-6 max-w-2xl mx-auto break-words px-2">
                Discover the ancient kovils and their stories — from Lakshmi Narayanar Perumal Koil to Kalahastiswarar
              </p>
              <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center items-stretch sm:items-center max-w-md sm:max-w-none mx-auto px-2">
                <a
                  href="/kovi-details"
                  className="px-5 py-2.5 sm:px-6 sm:py-3 md:px-8 md:py-4 rounded-xl sm:rounded-2xl bg-white text-amber-700 font-semibold text-sm sm:text-base shadow-lg hover:shadow-xl hover:scale-105 transition-all duration-300 w-full sm:w-auto text-center"
                >
                  About Kovil
                </a>
                <a
                  href="/"
                  className="px-5 py-2.5 sm:px-6 sm:py-3 md:px-8 md:py-4 rounded-xl sm:rounded-2xl bg-transparent border-2 border-white text-white font-semibold text-sm sm:text-base hover:bg-white hover:text-amber-700 transition-all duration-300 w-full sm:w-auto text-center"
                >
                  Return Home
                </a>
              </div>
            </div>
          </div>

        </div>
      </div>
    </main>

    <style>{`
      .senior-readable-content :where(p, li, td) {
        font-weight: 500;
      }

      /* Prevent horizontal overflow on mobile */
      @media (max-width: 640px) {
        * {
          word-wrap: break-word;
          overflow-wrap: break-word;
        }
      }
    `}</style>
  </div>
);

export default WhyVisitNativeVillage;
