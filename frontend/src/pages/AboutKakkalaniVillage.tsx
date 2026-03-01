import React from 'react';
import PublicSiteHeader from "../components/PublicSiteHeader";
import EnglishTamilToggle from "../components/EnglishTamilToggle";

// Types for the content structure
interface Section {
  title: string;
  paragraphs: string[];
  icon?: string;
}

type CornerImageCardProps = {
  src: string;
  alt: string;
  title: string;
  subtitle: string;
  compact?: boolean;
  className?: string;
};

// Data Source
const sections: Section[] = [
  {
    title: 'History & Foundations',
    icon: '🏛️',
    paragraphs: [
      'Kakkalani is a beautiful village located 10km southeast of Thiruvarur, a town famous for the Thyagaraja Swamy temple that houses a Maragadam Shiva Lingam believed to have once been worshipped by Lord Indiran.',
      'According to earlier generations, the Chozha king consecrated 48 Shiva temples around Thyagaraja Swamy temple during the mandalam period, and Kakkalani is home to one of those temples—Gnanambal Sametha Kalahastiswarar. Prior to our forefathers moving in four to five generations ago, Rayar families were said to have settled here.',
      'Kakkalani Agraharam was laid out with the Kadugayar river (a branch of the Kaveri) running along the northern edge. On the riverbank, the Pillayar under the Peepal tree was later relocated into the Aathagarai Pillayar Koil inside the temple compound.',
    ],
  },
  {
    title: 'Temples & Sacred Sites',
    icon: '🕉️',
    paragraphs: [
      'The western edge of the agraharam features the Lakshmi Narayanar Perumal Koil, anchored by a striking gopuram and aligned between two rows of houses so residents can witness deeparadhana from their doorsteps.',
      'Inside the temple, Pambu Puttru (the snake hole) in the southwest corner still shelters snakes that villagers feed with milk, while a pond named Ayyan Kulam sits just northwest of the shrine.',
      'On the eastern end stands the Gnanambika Samedha Kalahastiswarar Koil with the Poorna Pushkala Samedha Ayyanar Koil opposite; another pond lies before the Ayyanar shrine. A short walk east reveals the well-maintained Mazhai Marriamman Koil, and about 1 km further on the village edge is the Damodara Pillayar Koil established by the Pannai family.',
    ],
  },
  {
    title: 'Blessings & Legacy',
    icon: '🙏',
    paragraphs: [
      'Shri Shri Kanchi Mahaperiyava graced the village twice, an honor even once would be rare, and Shri Shri Ramana Maharishi offered his blessings through a sevaka from our Pannai family who served since childhood before spending his final years back in the agraharam.',
      'The village has produced leaders recognized by the government with top honors, and our family tree stretches three to four generations above and below us, tying us together as a lineage with shared stories and responsibilities.',
    ],
  },
];

const CornerImageCard: React.FC<CornerImageCardProps> = ({
  src,
  alt,
  title,
  subtitle,
  compact = false,
  className = '',
}) => (
  <div className={`group relative overflow-hidden rounded-3xl bg-white shadow-lg transition-all duration-500 hover:shadow-2xl ${className}`}>
    <div className="aspect-[4/5] overflow-hidden">
      <img
        src={src}
        alt={alt}
        className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-110"
        loading="lazy"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent opacity-70 transition-opacity duration-500 group-hover:opacity-85" />
    </div>
    <div className="absolute bottom-0 left-0 right-0 p-3 sm:p-4">
      <div className="space-y-1">
        <div className="inline-block rounded-full bg-white/25 px-3 py-1 backdrop-blur-md">
          <p className="text-[10px] font-bold uppercase tracking-widest text-white sm:text-xs">
            {title}
          </p>
        </div>
        {!compact && <p className="text-xs leading-relaxed text-white/90">{subtitle}</p>}
      </div>
    </div>
  </div>
);

const AboutKakkalaniVillage: React.FC = () => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-blue-50">
      <PublicSiteHeader />
      
      <main className="relative overflow-x-hidden senior-readable-content">
        <div className="relative z-10 pt-2 sm:pt-3">
          <EnglishTamilToggle className="mb-1 sm:mb-2" />
        </div>

        {/* Decorative Elements - Hidden on mobile to prevent overflow */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-20 right-10 w-32 h-32 sm:w-64 sm:h-64 bg-blue-200/20 rounded-full blur-3xl" />
          <div className="absolute bottom-20 left-10 w-48 h-48 sm:w-96 sm:h-96 bg-blue-200/20 rounded-full blur-3xl" />
        </div>

        {/* Hero Section */}
        <section className="relative px-4 pt-1 pb-8 sm:px-6 sm:pt-2 sm:pb-10 lg:px-8 lg:pt-3 lg:pb-12">
          <div className="mx-auto max-w-7xl">
            <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,220px)_minmax(0,1fr)_minmax(0,220px)] xl:gap-10 xl:grid-cols-[minmax(0,260px)_minmax(0,1fr)_minmax(0,260px)]">
              {/* Image Card 1 - top left */}
              <div className="hidden lg:block">
                <CornerImageCard
                  src="/images/kakkalani-000.jpg"
                  alt="Guardian of Tradition"
                  title="Guardian of Tradition"
                  subtitle="Preserving wisdom through generations"
                />
              </div>

              <div className="mx-auto max-w-4xl text-center">
              {/* Eyebrow */}
              <div className="mb-4 sm:mb-6 inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-blue-100 to-blue-100 px-3 py-1.5 sm:px-4 sm:py-2">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
                </span>
                <span className="text-[10px] sm:text-xs font-semibold tracking-wider uppercase text-blue-800">
                  Our Village Heritage
                </span>
              </div>

              {/* Main Heading - Responsive text sizes */}
              <h1 className="font-serif text-2xl sm:text-4xl md:text-5xl lg:text-6xl font-bold text-slate-900 leading-tight mb-4 sm:mb-6 px-2">
                A Resilient Heritage of{' '}
                <span className="bg-gradient-to-r from-blue-600 to-blue-600 bg-clip-text text-transparent">
                  Faith, Rivers & Temples
                </span>
              </h1>

              {/* Description - Responsive padding and text size */}
              <p className="text-sm sm:text-base md:text-lg lg:text-xl text-slate-600 leading-relaxed max-w-3xl mx-auto px-2">
                Kakkalani Agraharam has grown around sacred shrines, ancestral homes, and nourishing water. 
                Every pond, temple, and tree has its own story of guardianship and service from the families 
                that still call this village home.
              </p>

              {/* Mobile/Tablet image cards */}
              <div className="mt-6 grid grid-cols-2 gap-3 sm:gap-4 lg:hidden">
                <CornerImageCard
                  src="/images/kakkalani-000.jpg"
                  alt="Guardian of Tradition"
                  title="Guardian of Tradition"
                  subtitle="Preserving wisdom through generations"
                  compact
                />
                <CornerImageCard
                  src="/images/kakkalani-001.jpg"
                  alt="Ancestral Wisdom"
                  title="Ancestral Wisdom"
                  subtitle="Stories that connect past and future"
                  compact
                />
              </div>

              {/* Quick Stats - Fully responsive grid */}
              <div className="mt-8 sm:mt-10 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 md:gap-6 max-w-5xl mx-auto">
                {[
                  { label: 'Location', value: '10km SE Thiruvarur' },
                  { label: 'Temples', value: '5+ Sacred Sites' },
                  { label: 'Heritage', value: '4-5 Generations' },
                  { label: 'Blessings', value: 'Mahaperiyava & Ramana Maharishi' },
                ].map((stat) => (
                  <div key={stat.label} className="group w-full">
                    <div className="p-3 sm:p-4 rounded-xl sm:rounded-2xl bg-white/60 backdrop-blur-sm border border-blue-100 shadow-sm hover:shadow-md transition-all duration-300 hover:scale-105">
                      <p className="text-[10px] sm:text-xs font-medium text-blue-600 uppercase tracking-wider mb-1">
                        {stat.label}
                      </p>
                      <p className="text-xs sm:text-sm font-semibold text-slate-900 break-words hyphens-auto">
                        {stat.value}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

              {/* Image Card 2 - top right */}
              <div className="hidden lg:block">
                <CornerImageCard
                  src="/images/kakkalani-001.jpg"
                  alt="Ancestral Wisdom"
                  title="Ancestral Wisdom"
                  subtitle="Stories that connect past and future"
                />
              </div>
            </div>
          </div>
        </section>

        {/* Main Content Section */}
        <section className="relative px-4 py-8 sm:px-6 sm:py-12 lg:px-8 lg:py-16">
          <div className="mx-auto max-w-7xl">
            <div className="grid lg:grid-cols-12 gap-6 sm:gap-8 lg:gap-12">
              
              {/* Main Content Area */}
              <div className="lg:col-span-8 space-y-6 sm:space-y-8">
                {sections.map((section, index) => (
                  <article 
                    key={section.title}
                    className="group relative bg-white rounded-2xl sm:rounded-3xl p-5 sm:p-8 md:p-10 shadow-sm border border-slate-100 hover:shadow-xl transition-all duration-500 hover:border-blue-200"
                    style={{
                      animation: `fadeInUp 0.6s ease-out ${index * 0.1}s both`
                    }}
                  >
                    {/* Section Icon & Title */}
                    <div className="flex items-start gap-3 sm:gap-4 mb-4 sm:mb-6">
                      <div className="flex-shrink-0 w-10 h-10 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl bg-gradient-to-br from-blue-100 to-blue-100 flex items-center justify-center text-xl sm:text-2xl group-hover:scale-110 transition-transform duration-300">
                        {section.icon}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h2 className="font-serif text-xl sm:text-2xl md:text-3xl font-bold text-slate-900 mb-2 break-words">
                          {section.title}
                        </h2>
                        <div className="h-1 w-12 sm:w-16 bg-gradient-to-r from-blue-500 to-blue-500 rounded-full" />
                      </div>
                    </div>

                    {/* Content */}
                    <div className="space-y-3 sm:space-y-4">
                      {section.paragraphs.map((paragraph, pIndex) => (
                        <p 
                          key={pIndex} 
                          className="text-sm sm:text-base md:text-lg leading-relaxed text-slate-600 break-words"
                        >
                          {paragraph}
                        </p>
                      ))}
                    </div>

                    {/* Decorative Corner - Hidden on mobile */}
                    <div className="hidden sm:block absolute top-0 right-0 w-16 h-16 sm:w-24 sm:h-24 bg-gradient-to-br from-blue-50 to-transparent rounded-bl-full opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                  </article>
                ))}
              </div>

              {/* Sidebar */}
              <aside className="lg:col-span-4 space-y-4 sm:space-y-6">
                <div className="lg:sticky lg:top-24 space-y-4 sm:space-y-6">
                  
                  {/* Village Snapshot Card */}
                  <div className="relative overflow-hidden rounded-2xl sm:rounded-3xl bg-gradient-to-br from-blue-600 to-blue-600 p-6 sm:p-8 text-white shadow-lg">
                    <div className="relative z-10">
                      <div className="flex items-center gap-2 mb-3 sm:mb-4">
                        <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-white/20 backdrop-blur-sm flex items-center justify-center flex-shrink-0">
                          <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                        </div>
                        <h3 className="text-xs sm:text-sm font-bold tracking-wider uppercase">
                          Village Snapshot
                        </h3>
                      </div>
                      <p className="text-xs sm:text-sm leading-relaxed text-white/90">
                        Kadugayar river, gopurams, snake holes, and community ponds are woven into day-to-day life. 
                        The village invites you to witness the temples, participate in upkeep, and carry the legacy forward.
                      </p>
                    </div>
                    {/* Decorative circles */}
                    <div className="absolute -bottom-8 -right-8 w-24 h-24 sm:w-32 sm:h-32 rounded-full bg-white/10" />
                    <div className="absolute -top-4 -left-4 w-16 h-16 sm:w-24 sm:h-24 rounded-full bg-white/10" />
                  </div>

                  {/* Quick Links - Fully responsive */}
                  <div className="rounded-2xl sm:rounded-3xl bg-white border border-slate-100 p-4 sm:p-6 shadow-sm">
                    <h3 className="font-semibold text-sm sm:text-base text-slate-900 mb-3 sm:mb-4 flex items-center gap-2">
                      <svg className="w-4 h-4 sm:w-5 sm:h-5 text-blue-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                      </svg>
                      <span className="truncate">Explore More</span>
                    </h3>
                    <div className="space-y-1.5 sm:space-y-2">
                      {[
                        { label: 'Temple History', href: '/history-of-kakkalani' },
                        { label: 'Visit Our Village', href: '/why-visit' },
                        { label: 'Family Tree', href: '/family-tree' },
                        { label: 'Photo Gallery', href: '/gallery' },
                      ].map((link) => (
                        <a
                          key={link.label}
                          href={link.href}
                          className="block px-3 py-2 sm:px-4 sm:py-2 rounded-lg sm:rounded-xl text-xs sm:text-sm font-medium text-slate-700 hover:bg-blue-50 hover:text-blue-700 transition-colors duration-200 truncate"
                        >
                          {link.label}
                        </a>
                      ))}
                    </div>
                  </div>
                </div>
              </aside>
            </div>
          </div>
        </section>

        {/* CTA Section - Fully responsive */}
        <section className="relative py-12 sm:py-16 md:py-20 overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-r from-blue-600 to-blue-600" />
          <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGRlZnM+PHBhdHRlcm4gaWQ9ImdyaWQiIHdpZHRoPSI2MCIgaGVpZ2h0PSI2MCIgcGF0dGVyblVuaXRzPSJ1c2VyU3BhY2VPblVzZSI+PHBhdGggZD0iTSAxMCAwIEwgMCAwIDAgMTAiIGZpbGw9Im5vbmUiIHN0cm9rZT0id2hpdGUiIHN0cm9rZS1vcGFjaXR5PSIwLjEiIHN0cm9rZS13aWR0aD0iMSIvPjwvcGF0dGVybj48L2RlZnM+PHJlY3Qgd2lkdGg9IjEwMCUiIGhlaWdodD0iMTAwJSIgZmlsbD0idXJsKCNncmlkKSIvPjwvc3ZnPg==')] opacity-20" />
          
          <div className="relative mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 text-center">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 sm:px-4 sm:py-2 rounded-full bg-white/20 backdrop-blur-sm mb-4 sm:mb-6">
              <span className="text-[10px] sm:text-xs font-bold tracking-wider uppercase text-white">
                Join Our Community
              </span>
            </div>
            
            <h2 className="font-serif text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold text-white mb-4 sm:mb-6 px-2">
              Stay Connected to Kakkalani
            </h2>
            
            <p className="text-sm sm:text-base md:text-lg lg:text-xl text-white/90 leading-relaxed max-w-2xl mx-auto mb-6 sm:mb-8 md:mb-10 px-2">
              Login to explore detailed genealogy, learn about our temples, and find ways to support upkeep. 
              Every visit, recollection, and act of service helps honor our ancestors and inspire future generations.
            </p>

            <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center items-stretch sm:items-center max-w-md sm:max-w-none mx-auto px-2">
              <a 
                href="/login"
                className="group px-6 py-3 sm:px-8 sm:py-4 rounded-xl sm:rounded-2xl bg-white text-blue-600 font-semibold text-sm sm:text-base md:text-lg shadow-lg hover:shadow-2xl hover:scale-105 transition-all duration-300 flex items-center justify-center gap-2 w-full sm:w-auto"
              >
                Get Started
                <svg className="w-4 h-4 sm:w-5 sm:h-5 group-hover:translate-x-1 transition-transform flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                </svg>
              </a>
              <a 
                href="/history-of-kakkalani"
                className="px-6 py-3 sm:px-8 sm:py-4 rounded-xl sm:rounded-2xl bg-transparent border-2 border-white text-white font-semibold text-sm sm:text-base md:text-lg hover:bg-white hover:text-blue-600 transition-all duration-300 w-full sm:w-auto text-center"
              >
                Learn More
              </a>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="text-center pt-6 pb-8 border-t border-amber-100 mt-8">
        <p className="text-xs sm:text-sm text-slate-500 px-4">
          © {new Date().getFullYear()} Kakkalani Gramam. Built with{" "}
          <span className="text-red-500">❤</span> for the community.
        </p>
      </footer>

      {/* Custom CSS for animations */}
      <style>{`
        .senior-readable-content :where(p, li, td) {
          font-weight: 500;
        }

        @keyframes fadeInUp {
          from {
            opacity: 0;
            transform: translateY(30px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
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
};

export default AboutKakkalaniVillage;
