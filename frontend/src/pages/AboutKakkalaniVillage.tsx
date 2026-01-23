import React from 'react';
import PublicSiteHeader from "../components/PublicSiteHeader";

// Types for the content structure
interface Section {
  title: string;
  paragraphs: string[];
}

// Data Source
const sections: Section[] = [
  {
    title: 'History & Foundations',
    paragraphs: [
      'Kakkalani is a beautiful village located 10km southeast of Thiruvarur, a town famous for the Thyagaraja Swamy temple that houses a Maragadam Shiva Lingam believed to have once been worshipped by Lord Indiran.',
      'According to earlier generations, the Chozha king consecrated 48 Shiva temples around Thyagaraja Swamy temple during the mandalam period, and Kakkalani is home to one of those temples—Gnanambal Sametha Kalahastiswarar. Prior to our forefathers moving in four to five generations ago, Rayar families were said to have settled here.',
      'Kakkalani Agraharam was laid out with the Kadugayar river (a branch of the Kaveri) running along the northern edge. On the riverbank, the Pillayar under the Peepal tree was later relocated into the Aathagarai Pillayar Koil inside the temple compound.',
    ],
  },
  {
    title: 'Temples & Sacred Sites',
    paragraphs: [
      'The western edge of the agraharam features the Lakshmi Narayanar Perumal Koil, anchored by a striking gopuram and aligned between two rows of houses so residents can witness deeparadhana from their doorsteps.',
      'Inside the temple, Pambu Puttru (the snake hole) in the southwest corner still shelters snakes that villagers feed with milk, while a pond named Ayyan Kulam sits just northwest of the shrine.',
      'On the eastern end stands the Gnanambika Samedha Kalahastiswarar Koil with the Poorna Pushkala Samedha Ayyanar Koil opposite; another pond lies before the Ayyanar shrine. A short walk east reveals the well-maintained Mazhai Marriamman Koil, and about 1 km further on the village edge is the Damodara Pillayar Koil established by the Pannai family.',
    ],
  },
  {
    title: 'Blessings & Legacy',
    paragraphs: [
      'Shri Shri Kanchi Mahaperiyava graced the village twice, an honor even once would be rare, and Shri Shri Ramana Maharishi offered his blessings through a sevaka from our Pannai family who served since childhood before spending his final years back in the agraharam.',
      'The village has produced leaders recognized by the government with top honors, and our family tree stretches three to four generations above and below us, tying us together as a lineage with shared stories and responsibilities.',
    ],
  },
];

const AboutKakkalaniVillage: React.FC = () => {
  return (
    <div className="bg-stone-50 font-sans text-slate-800 antialiased selection:bg-amber-200 selection:text-amber-900">
      <PublicSiteHeader />
      <main>
      
      {/* --- Header Section --- */}
      <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <header className="mx-auto max-w-3xl text-center">
          <span className="inline-block text-xs font-bold tracking-[0.2em] uppercase text-amber-700 mb-4">
            About Kakkalani Village
          </span>
          <h1 className="font-serif text-4xl font-medium leading-tight text-slate-900 sm:text-5xl lg:text-6xl">
            A resilient heritage of faith, rivers, and temples
          </h1>
          <p className="mt-6 text-lg leading-relaxed text-slate-600">
            Kakkalani Agraharam has grown around sacred shrines, ancestral homes, and nourishing water: every pond, temple, and tree has its own story of guardianship and service from the families that still call this village home.
          </p>
        </header>
      </div>

      {/* --- Main Content Layout --- */}
      <div className="mx-auto max-w-7xl px-4 pb-16 sm:px-6 lg:px-8">
        <div className="grid gap-12 lg:grid-cols-12 lg:items-start">
          
          {/* LEFT COLUMN: Reading Content (8 cols) */}
          <div className="lg:col-span-8">
            <div className="space-y-12">
              {sections.map((section) => (
                <article key={section.title} className="animate-in fade-in slide-in-from-bottom-4 duration-700">
                  <h2 className="font-serif text-2xl font-semibold text-slate-900 border-b border-amber-200/50 pb-2 inline-block mb-4">
                    {section.title}
                  </h2>
                  <div className="space-y-4">
                    {section.paragraphs.map((paragraph) => (
                      <p key={paragraph} className="text-base leading-relaxed text-slate-600 text-justify">
                        {paragraph}
                      </p>
                    ))}
                  </div>
                </article>
              ))}
            </div>
          </div>

          {/* RIGHT COLUMN: Sticky Sidebar (4 cols) */}
          <aside className="lg:col-span-4 lg:sticky lg:top-24 space-y-8">
            
            {/* Snapshot Card */}
            <div className="overflow-hidden rounded-2xl bg-white border border-slate-200 shadow-sm p-6 transition-shadow hover:shadow-md">
              <span className="text-xs font-bold tracking-[0.2em] uppercase text-amber-700">
                Snapshot
              </span>
              <p className="mt-3 text-sm leading-relaxed text-slate-500">
                Kadugayar river, gopurams, snake holes, and community ponds are woven into the day-to-day life; the village invites you to witness the temples, participate in upkeep, and carry the legacy forward.
              </p>
            </div>

            {/* Portrait Image 1 (Elder with Staff) */}
            <div className="group relative overflow-hidden rounded-2xl border border-amber-200 bg-amber-50/30 shadow-sm">
              <div className="aspect-[3/4] overflow-hidden">
                <img
                  src="/images/kakkalani-000.jpg" // Using your existing path, or swap to a portrait path
                  alt="Guardian of Tradition"
                  className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
                />
              </div>
              <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-4">
                <p className="text-xs font-medium text-white/90 uppercase tracking-widest">
                  Guardian of Tradition
                </p>
              </div>
            </div>

            {/* Portrait Image 2 (Seated Elder) */}
            <div className="group relative overflow-hidden rounded-2xl border border-amber-200 bg-amber-50/30 shadow-sm">
              <div className="aspect-[3/4] overflow-hidden">
                <img
                  src="/images/kakkalani-001.jpg" // Using your existing path, or swap to a portrait path
                  alt="Ancestral Wisdom"
                  className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
                />
              </div>
              <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-4">
                <p className="text-xs font-medium text-white/90 uppercase tracking-widest">
                  Ancestral Wisdom
                </p>
              </div>
            </div>

          </aside>
        </div>
      </div>

      {/* --- Call To Action Section --- */}
      <section className="bg-amber-50 border-y border-amber-100 py-16">
        <div className="mx-auto max-w-4xl px-4 text-center sm:px-6 lg:px-8">
          <h3 className="font-serif text-2xl font-semibold text-amber-900">
            Stay connected to Kakkalani
          </h3>
          <p className="mx-auto mt-4 max-w-2xl text-base leading-relaxed text-amber-800/80">
            Login to explore detailed genealogy, learn about our temples, and find ways to support upkeep. Every visit, recollection, and act of service helps us honor the ancestors who established this agraharam and inspires the next generations to keep Kakkalani thriving.
          </p>
        </div>
      </section>

    </main>
    </div>
  );
};

export default AboutKakkalaniVillage;
