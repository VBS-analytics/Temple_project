import React, { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import PublicSiteHeader from "../components/PublicSiteHeader";
import FamilyTreePage from "./FamilyTreePage";

/**
 * Kakkalani Gramam – About Page
 * Themed to match the orange/amber design of AboutKakkalaniVillage
 */

// --- Types ---------------------------------------------------------------
type Member = {
  name: string;
  detail?: string;
  image?: string;
};

// --- Assets --------------------------------------------------------------
const AVATAR_PLACEHOLDER =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(`
  <svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'>
    <defs>
      <linearGradient id='g' x1='0' x2='1' y1='0' y2='1'>
        <stop offset='0%' stop-color='#fff7ed'/>
        <stop offset='100%' stop-color='#fed7aa'/>
      </linearGradient>
    </defs>
    <rect width='64' height='64' fill='url(#g)'/>
    <circle cx='32' cy='24' r='12' fill='#fb923c'/>
    <rect x='14' y='40' width='36' height='18' rx='9' fill='#fb923c'/>
  </svg>`);

// --- Data ----------------------------------------------------------------
const founderMembers: Member[] = [
  {
    name: "Smt. Alamelu (Bharani) Venkateswaran (Appapalu)",
    detail: "Joint account holder with Smt. Saroja (HDC account)",
    image: "images/Kakkalany-Gramam-Founder-Members-images/Alamelu.jpg",
  },
  {
    name: "Smt. Lakshmi Ananad",
    detail: "Daughter of Smt. Alamelu (Appapalu)",
    image: "images/Kakkalany-Gramam-Founder-Members-images/Lakshmi_Anand.jpg",
  },
  {
    name: "Shri. Radhakrishnan (Radhu anna)",
    image: "images/Kakkalany-Gramam-Founder-Members-images/Radhakrishnan.jpg",
  },
  {
    name: "Smt. Nalini Ganesan",
    image: "images/Kakkalany-Gramam-Founder-Members-images/Nalini_Ganesan.jpg",
  },
  {
    name: "R S Mani",
    image: "images/Kakkalany-Gramam-Founder-Members-images/R.S. Mani.jpg",
  },
  {
    name: "Shri. Ravichandran",
    image: "images/Kakkalany-Gramam-Founder-Members-images/Ravichandran.png",
  },
  {
    name: "Shri. Sriram Rajk",
    detail: "Spouse account holder with Smt. Alamelu (HDC account)",
    image: "images/Kakkalany-Gramam-Founder-Members-images/Sriram_Raju.jpg",
  },
  {
    name: "Shri. Rajendran",
    detail: "Spouse Ananthi & Rajendran to send prasadam",
    image: "images/Kakkalany-Gramam-Founder-Members-images/Rajendran.png",
  },
  {
    name: "Shri. Manikanda Gurukkal (Sridhar)",
    detail: "Priest",
    image: "images/Kakkalany-Gramam-Founder-Members-images/Sridhar.png",
  },
];

const managingCommitteeMembers: Member[] = [
  {
    name: "Shri. Radhakrishnan Sastrigal",
    detail: "President",
    image: "images/Kakkalany Gramam-Managing-Committee-Members-images/Radhakrishnan_Sastrigal.png",
  },
  {
    name: "Shri. Sriramkumar Natarajan",
    detail: "Secretary",
    image: "images/Kakkalany Gramam-Managing-Committee-Members-images/Sriramkumar_Natarajan.jpg",
  },
  {
    name: "R.S. Mani",
    detail: "Member",
    image: "images/Kakkalany Gramam-Managing-Committee-Members-images/R S Mani.jpg",
  },
  {
    name: "Smt. Lakshmi Ananad",
    detail: "Member",
    image: "images/Kakkalany Gramam-Managing-Committee-Members-images/Lakshmi_Ananad.jpg",
  },
  {
    name: "Shri. Radhakrishnan (Radhu anna)",
    detail: "Member",
    image: "images/Kakkalany Gramam-Managing-Committee-Members-images/Radhakrishnan.jpg",
  },
  {
    name: "Smt. Latha Murali",
    detail: "Member",
    image: "images/Kakkalany Gramam-Managing-Committee-Members-images/Latha_Murali.png",
  },
  {
    name: "Shri. Ravichandran",
    detail: "Member",
    image: "images/Kakkalany Gramam-Managing-Committee-Members-images/Ravichandran.png",
  },
  {
    name: "Shri. Venkatramani J",
    detail: "Member",
    image: "images/Kakkalany Gramam-Managing-Committee-Members-images/Venkatramani J.jpg",
  },
  {
    name: "Shri. Swaminathan",
    detail: "Member",
    image: "images/Kakkalany Gramam-Managing-Committee-Members-images/Swaminathan.jpg",
  },
  {
    name: "Shri. Madhusudanan (Madhu)",
    detail: "Member",
    image: "images/Kakkalany Gramam-Managing-Committee-Members-images/Madhusudanan.jpg",
  },
  {
    name: "Shri. Rajendran",
    detail: "Member",
    image: "images/Kakkalany Gramam-Managing-Committee-Members-images/Rajendran.png",
  },
  {
    name: "Shri. Manikanda Gurukkal (Sridhar)",
    detail: "Priest",
    image: "images/Kakkalany Gramam-Managing-Committee-Members-images/Sridhar.png",
  },
];

const aboutUsIntroParagraphs: string[] = [
  "In Sep 2022, a small group of members, RS Mani, Mrs Banu, Ms Lakshmi, Manikantan Kurukkal and Radhakrishnan (Radhu anna), over a discussion on a cup of coffee, laid the seed for this group. Mrs Nalini Ganesan from Pattamani Iyer family added fuel to energise this group to gain momentum.",
  "The current committee consists of experienced and responsible members from our family and the local community, who actively contribute their time and effort towards temple management, rituals, and development activities.",
  "Every member of the Core Committee serves with devotion, integrity, and selfless service, treating this responsibility not as a position, but as a sacred duty entrusted by our ancestors and the deity.",
  "Together, the Core Committee strives to safeguard the heritage of these temples and pass on the spiritual legacy to future generations.",
];

const aboutUsObjectives: string[] = [
  "To reconnect all Agraharam family members.",
  "To preserve spiritual, cultural and traditional values handed down by our ancestors.",
  "To bring back good habits inculcated by our ancestors, including regular pooja to our village deities.",
  "To ensure poojas, festivals, and annual functions are performed as per Agama and customary procedures based on devotees'/members' requests.",
  "To support devotees, coordinate festivals, and encourage community participation in temple activities.",
  "Devotee and community coordination.",
  "To ensure all participants receive prasadam from our village temple.",
  "To maintain and further improve cleanliness and infrastructure facilities at our temple.",
  "To improve facilities to access the temple and nearby areas around the temple.",
  "To help younger generations know about religious activities, slokas and prayers, and encourage regular temple visits.",
  "Gau samrakshana.",
];

const aboutUsAcknowledgements: string[] = [
  "Mr Sridhar Kurukkal, from the 5th generation in his family, for his continued service at our village temples and for carrying out pooja at Lord Shiva temple and Ayyanar koil.",
  "Mr Rajendran for joining hands to do honorary work coordinating non-pooja activities and ensuring members receive prasadam for poojas performed at the temple.",
  "All honorary committee members for their commitment to the above objectives.",
  "All members whose support made these efforts possible in practice and not just on paper.",
  "Shri Radhakrishna Sastrigal from our village, for bringing 20 known contacts from outside Kakkalani village families as regular members in our group.",
];

// --- Reusable UI Components ----------------------------------------------
function SectionHeader({
  title,
  langSubtitle,
}: {
  title: string;
  langSubtitle?: string;
}) {
  return (
    <div className="text-center max-w-3xl mx-auto mb-10">
      <h2 className="font-serif text-3xl sm:text-4xl font-bold tracking-tight text-slate-900 mb-2">
        {title}
      </h2>
      <div className="h-1 w-20 bg-gradient-to-r from-orange-500 to-amber-500 rounded-full mx-auto mt-3 mb-3" />
      {langSubtitle && (
        <p className="mt-2 text-sm sm:text-base text-orange-600 font-medium">
          {langSubtitle}
        </p>
      )}
    </div>
  );
}

function Avatar({ src, alt }: { src?: string; alt: string }) {
  return (
    <div className="relative w-14 h-14 rounded-full overflow-hidden border-2 border-orange-100 shadow-md flex-shrink-0 bg-gradient-to-br from-orange-50 to-amber-50 group-hover:border-orange-300 transition-all duration-300">
      <img
        src={src ? `/${encodeURI(src)}` : AVATAR_PLACEHOLDER}
        alt={alt}
        loading="lazy"
        className="w-full h-full object-cover transform group-hover:scale-110 transition-transform duration-300"
        onError={(e) => {
          const target = e.currentTarget as HTMLImageElement;
          target.src = AVATAR_PLACEHOLDER;
        }}
      />
    </div>
  );
}

function MemberRow({ member, index }: { member: Member; index: number }) {
  return (
    <li className="group flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 p-4 rounded-2xl hover:bg-orange-50/60 transition-all duration-200">
      <div className="flex items-center gap-4">
        <span className="flex items-center justify-center w-8 h-8 rounded-full bg-orange-100 text-orange-700 font-bold text-sm group-hover:bg-orange-200 transition-colors flex-shrink-0">
          {index + 1}
        </span>
        <Avatar src={member.image} alt={member.name} />
        <div className="flex-1">
          <p className="text-base sm:text-lg font-semibold text-slate-900 group-hover:text-orange-700 transition-colors">
            {member.name}
          </p>
          {member.detail && (
            <p className="sm:hidden mt-1 text-sm text-slate-500">
              {member.detail}
            </p>
          )}
        </div>
      </div>
      {member.detail && (
        <span className="hidden sm:block text-sm text-slate-600 bg-orange-50 px-4 py-2 rounded-full border border-orange-100 group-hover:border-orange-200 group-hover:bg-orange-100 transition-all whitespace-nowrap">
          {member.detail}
        </span>
      )}
    </li>
  );
}

function MemberCard({
  title,
  langSubtitle,
  members,
  id,
}: {
  title: string;
  langSubtitle?: string;
  members: Member[];
  id?: string;
}) {
  return (
    <section
      id={id}
      className="bg-white rounded-3xl shadow-sm border border-slate-100 hover:shadow-xl hover:border-orange-200 transition-all duration-500 p-8 lg:p-10"
    >
      <SectionHeader title={title} langSubtitle={langSubtitle} />
      <ol className="space-y-2 divide-y divide-orange-50">
        {members.map((m, i) => (
          <MemberRow key={`${m.name}-${i}`} member={m} index={i} />
        ))}
      </ol>
    </section>
  );
}

function StatCard({ value, label }: { value: string; label: string }) {
  return (
    <div className="group relative overflow-hidden rounded-2xl bg-gradient-to-br from-orange-500 to-amber-600 p-6 shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105">
      {/* Decorative circle */}
      <div className="absolute -right-4 -top-4 w-24 h-24 bg-white/10 rounded-full blur-2xl group-hover:bg-white/20 transition-all" />
      <div className="relative">
        <p className="text-4xl font-bold text-white mb-1">{value}</p>
        <p className="text-sm text-orange-50 font-medium">{label}</p>
      </div>
    </div>
  );
}

// --- Main Page Component -------------------------------------------------
type AboutPageProps = {
  embedded?: boolean;
};

export default function AboutPage({ embedded = false }: AboutPageProps) {
  const location = useLocation();
  const [activeSection, setActiveSection] = useState<
    "about" | "founder" | "committee" | "family-tree"
  >("about");

  useEffect(() => {
    const hash = location.hash.replace("#", "");
    if (hash === "founder-members") { setActiveSection("founder"); return; }
    if (hash === "committee-members") { setActiveSection("committee"); return; }
    if (hash === "family-tree") { setActiveSection("family-tree"); return; }
    setActiveSection("about");
  }, [location.hash]);

  const containerClasses = embedded
    ? "space-y-10 py-4 sm:py-6"
    : "max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-16 pt-8 pb-16 lg:pt-12 lg:pb-20";

  const wrapperClass = embedded
    ? "bg-transparent"
    : "min-h-screen bg-gradient-to-br from-orange-50 via-white to-amber-50";

  return (
    <div className={wrapperClass}>
      {!embedded && <PublicSiteHeader />}

      <main className="relative overflow-hidden">
        {/* Decorative background blobs */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute left-1/2 top-0 -z-10 h-96 w-96 -translate-x-1/2 -translate-y-1/2 rounded-full bg-gradient-to-br from-orange-200 to-amber-300 blur-3xl opacity-20"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute right-0 top-1/3 -z-10 h-80 w-80 translate-x-1/3 rounded-full bg-gradient-to-bl from-amber-200 to-orange-300 blur-3xl opacity-15"
        />

        <div className={containerClasses}>
          {/* ── Hero Stats Section ── */}
          <section className="space-y-8">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 max-w-4xl mx-auto">
              <StatCard value="9"    label="Founder Members"  />
              <StatCard value="12"   label="Committee Members" />
              <StatCard value="2021" label="Initiative Began"  />
            </div>

            {/* Navigation Tabs */}
            <div className="flex flex-wrap items-center justify-center gap-3 pt-4">
              {(
                [
                  { key: "about",       label: "About Us"          },
                  { key: "founder",     label: "Founder Members"    },
                  { key: "committee",   label: "Committee Members"  },
                  { key: "family-tree", label: "Family Tree"        },
                ] as { key: typeof activeSection; label: string }[]
              ).map(({ key, label }) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setActiveSection(key)}
                  className={`px-6 py-3 rounded-full font-semibold text-sm transition-all duration-300 ${
                    activeSection === key
                      ? "bg-gradient-to-r from-orange-500 to-amber-600 text-white shadow-lg shadow-orange-500/30 scale-105"
                      : "bg-white text-slate-700 border-2 border-slate-200 hover:border-orange-300 hover:bg-orange-50"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </section>

          {/* ── Content Sections ── */}
          <div className="animate-fadeIn">
            {/* About Us */}
            {activeSection === "about" && (
              <section className="bg-white rounded-3xl shadow-sm border border-slate-100 hover:shadow-xl hover:border-orange-200 transition-all duration-500 p-8 lg:p-12">

                {/* Introduction paragraphs */}
                <div className="space-y-5 text-slate-600 leading-relaxed mb-10">
                  {aboutUsIntroParagraphs.map((paragraph, idx) => (
                    <p key={idx} className="text-base sm:text-lg">
                      {paragraph}
                    </p>
                  ))}
                </div>

                {/* Objectives */}
                <div className="pt-8 border-t border-orange-100">
                  <h3 className="font-serif text-2xl font-bold text-slate-900 mb-6 flex items-center gap-3">
                    <span className="w-1.5 h-8 bg-gradient-to-b from-orange-500 to-amber-600 rounded-full flex-shrink-0" />
                    Objectives of this Group
                  </h3>
                  <ul className="space-y-4 mt-4">
                    {aboutUsObjectives.map((objective, idx) => (
                      <li key={idx} className="flex items-start gap-4 text-slate-600">
                        <span className="flex-shrink-0 w-6 h-6 rounded-full bg-orange-100 text-orange-700 flex items-center justify-center text-xs font-bold mt-0.5">
                          ✓
                        </span>
                        <span className="text-base leading-relaxed">{objective}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Acknowledgements */}
                <div className="mt-10 pt-8 border-t border-orange-100">
                  <h3 className="font-serif text-2xl font-bold text-slate-900 mb-6 flex items-center gap-3">
                    <span className="w-1.5 h-8 bg-gradient-to-b from-orange-500 to-amber-600 rounded-full flex-shrink-0" />
                    Sincere Thanks
                  </h3>
                  <ol className="space-y-4 mt-4">
                    {aboutUsAcknowledgements.map((acknowledgement, idx) => (
                      <li key={idx} className="flex items-start gap-4 text-slate-600">
                        <span className="flex-shrink-0 w-7 h-7 rounded-full bg-gradient-to-br from-orange-500 to-amber-600 text-white flex items-center justify-center text-xs font-bold">
                          {idx + 1}
                        </span>
                        <span className="text-base leading-relaxed flex-1">{acknowledgement}</span>
                      </li>
                    ))}
                  </ol>
                </div>
              </section>
            )}

            {activeSection === "founder" && (
              <MemberCard
                id="founder-members"
                title="Kakkalani Gramam Group Founder Members"
                langSubtitle="கக்காழணி கிராமம் குழு நிறுவனர் உறுப்பினர்கள்"
                members={founderMembers}
              />
            )}

            {activeSection === "committee" && (
              <MemberCard
                id="committee-members"
                title="Kakkalani Gramam Managing Committee Members"
                langSubtitle="கக்காழணி கிராமம் நிர்வாக குழு உறுப்பினர்கள்"
                members={managingCommitteeMembers}
              />
            )}

            {activeSection === "family-tree" && (
              <section id="family-tree">
                <FamilyTreePage embedded />
              </section>
            )}
          </div>

          {/* Footer */}
          <footer className="text-center pt-8 border-t border-orange-100">
            <p className="text-sm text-slate-500">
              © {new Date().getFullYear()} Kakkalani Gramam. Built with{" "}
              <span className="text-red-500">❤</span> for the community.
            </p>
          </footer>
        </div>
      </main>

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to   { opacity: 1; transform: translateY(0);    }
        }
        .animate-fadeIn { animation: fadeIn 0.4s ease-out; }
      `}</style>
    </div>
  );
}