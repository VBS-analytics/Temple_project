import React, { useEffect } from "react";
import { useLocation } from "react-router-dom";

import PublicSiteHeader from "../components/PublicSiteHeader";

/**
 * Kakkalani Gramam – About Page
 * ------------------------------------------------------
 * • Single-file React component ready to drop into a Vite/CRA app
 * • TailwindCSS styling, responsive, a11y-friendly
 * • Sections: Hero, Story, Founder Members, Managing Committee, Stats, FAQ, CTA
 * • Image fallback + lazy loading + small hover interactions
 *
 * • REVISION: Changed color theme from teal to sky (light blue).
 * • REVISION: Updated StatCard design to be bordered/white bg.
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
        <stop offset='0%' stop-color='#f0f9ff'/>
        <stop offset='100%' stop-color='#e0f2fe'/>
      </linearGradient>
    </defs>
    <rect width='64' height='64' fill='url(#g)'/>
    <circle cx='32' cy='24' r='12' fill='#7dd3fc'/>
    <rect x='14' y='40' width='36' height='18' rx='9' fill='#7dd3fc'/>
  </svg>`);

// --- Data ----------------------------------------------------------------

// ... (All your data arrays like founderMembers, managingCommitteeMembers, etc. remain unchanged) ...
const founderMembers: Member[] = [
  {
    name: "Smt. Alamelu (Bharani) Venkateswaran (Appapalu)",
    detail: "Joint account holder with Smt. Saroja (HDC account)",
    image: "images/Kakkalany-Gramam-Founder-Members-images/Alamelu.jpg",
  },
  {
    name: "Smt. Lakshmi Anand",
    detail: "Daughter of Smt. Alamelu (Appapalu)",
    image: "images/Kakkalany-Gramam-Founder-Members-images/Lakshmi_Anand.jpg",
  },
  {
    name: "Shri. Radhakrishnan (Radhu mama)",
    image: "images/Kakkalany-Gramam-Founder-Members-images/Radhakrishnan.jpg",
  },
  {
    name: "Smt. Nalini Ganesan",
    image: "images/Kakkalany-Gramam-Founder-Members-images/Nalini_Ganesan.jpg",
  },
  {
    name: "Shri. R.S. Mani",
    image: "images/Kakkalany-Gramam-Founder-Members-images/R.S. Mani.jpg",
  },
  {
    name: "Shri. Radhachandran",
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
    name: "Shri. Manikanda Gurukkal (Indhur)",
    detail: "Priest",
    image: "images/Kakkalany-Gramam-Founder-Members-images/Sridhar.png",
  },
];

const managingCommitteeMembers: Member[] = [
  {
    name: "Shri. Radhakrishnan Suriyai",
    detail: "President",
    image:
      "images/Kakkalany Gramam-Managing-Committee-Members-images/Radhakrishnan_Sastrigal.png",
  },
  {
    name: "Shri. Srinivasan Natarajan",
    detail: "Secretary",
    image:
      "images/Kakkalany Gramam-Managing-Committee-Members-images/Sriramkumar_Natarajan.jpg",
  },
  {
    name: "Shri. R.S. Mani",
    detail: "Member",
    image:
      "images/Kakkalany Gramam-Managing-Committee-Members-images/R S Mani.jpg",
  },
  {
    name: "Smt. Lakshmi Anand",
    detail: "Member",
    image:
      "images/Kakkalany Gramam-Managing-Committee-Members-images/Lakshmi_Ananad.jpg",
  },
  {
    name: "Shri. Radhakrishnan (Radhu mama)",
    detail: "Member",
    image:
      "images/Kakkalany Gramam-Managing-Committee-Members-images/Radhakrishnan.jpg",
  },
  {
    name: "Smt. Latha Mani",
    detail: "Member",
    image:
      "images/Kakkalany Gramam-Managing-Committee-Members-images/Latha_Murali.png",
  },
  {
    name: "Shri. Radhachandran",
    detail: "Member",
    image:
      "images/Kakkalany Gramam-Managing-Committee-Members-images/Ravichandran.png",
  },
  {
    name: "Shri. Venkataramani",
    detail: "Member",
    image:
      "images/Kakkalany Gramam-Managing-Committee-Members-images/Venkatramani J.jpg",
  },
  {
    name: "Shri. Swaminathan",
    detail: "Member",
    image:
      "images/Kakkalany Gramam-Managing-Committee-Members-images/Swaminathan.jpg",
  },
  {
    name: "Shri. Madhusudanan (Madhu)",
    detail: "Member",
    image:
      "images/Kakkalany Gramam-Managing-Committee-Members-images/Madhusudanan.jpg",
  },
  {
    name: "Shri. Rajendran",
    detail: "Member",
    image:
      "images/Kakkalany Gramam-Managing-Committee-Members-images/Rajendran.png",
  },
  {
    name: "Shri. Manikanda Gurukkal (Indhur)",
    detail: "Priest",
    image:
      "images/Kakkalany Gramam-Managing-Committee-Members-images/Sridhar.png",
  },
];

// --- Reusable UI ---------------------------------------------------------

function SectionHeader({
  title,
  subtitle,
  langSubtitle,
}: {
  title: string;
  subtitle?: string;
  langSubtitle?: string;
}) {
  return (
    <div className="text-center max-w-2xl mx-auto mb-10">
      <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight text-gray-900">
        {title}
      </h2>
      {subtitle && <p className="mt-2 text-gray-600">{subtitle}</p>}
      {langSubtitle && (
        <p className="mt-1 text-sm text-gray-500">{langSubtitle}</p>
      )}
    </div>
  );
}

function Avatar({ src, alt }: { src?: string; alt: string }) {
  return (
    <span className="w-14 h-14 rounded-full overflow-hidden border border-gray-200 shadow-sm flex-shrink-0 bg-white">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src ? `/${encodeURI(src)}` : AVATAR_PLACEHOLDER}
        alt={alt}
        loading="lazy"
        className="w-full h-full object-cover"
        onError={(e) => {
          const target = e.currentTarget as HTMLImageElement;
          target.src = AVATAR_PLACEHOLDER;
        }}
      />
    </span>
  );
}

function MemberRow({ member, index }: { member: Member; index: number }) {
  return (
    <li className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-gray-100 pb-4 last:border-b-0 last:pb-0">
      <div className="flex items-center gap-4">
        <span className="text-sm font-semibold text-sky-600 tabular-nums">
          {index + 1}.
        </span>
        <Avatar src={member.image} alt={member.name} />
        <div>
          <p className="text-lg font-medium text-gray-900">{member.name}</p>
          <p className="sm:hidden text-sm text-gray-600">{member.detail}</p>
        </div>
      </div>
      {member.detail && (
        <span className="hidden sm:block text-sm text-gray-600 sm:text-right">
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
  after,
  id,
}: {
  title: string;
  langSubtitle?: string;
  members: Member[];
  after?: React.ReactNode;
  id?: string;
}) {
  return (
    <section
      id={id}
      className="bg-white/80 backdrop-blur shadow rounded-2xl p-8 lg:self-start border border-gray-100"
    >
      <SectionHeader title={title} langSubtitle={langSubtitle} />
      <ol className="space-y-6">
        {members.map((m, i) => (
          <MemberRow key={`${m.name}-${i}`} member={m} index={i} />
        ))}
      </ol>
      {after && <div className="mt-8">{after}</div>}
    </section>
  );
}

// --- MODIFIED DESIGN ---
function StatCard({ value, label }: { value: string; label: string }) {
  return (
    <div className="rounded-2xl border border-sky-200 bg-white p-6 text-center shadow-lg shadow-sky-500/10">
      <p className="text-3xl font-semibold text-sky-700">{value}</p>
      <p className="mt-1 text-sm text-sky-900/80">{label}</p>
    </div>
  );
}

// --- Page ----------------------------------------------------------------

type AboutPageProps = {
  embedded?: boolean;
};

export default function AboutPage({ embedded = false }: AboutPageProps) {
  const location = useLocation();

  useEffect(() => {
    if (!location.hash) return;
    const targetId = location.hash.replace("#", "");
    const el = document.getElementById(targetId);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [location.hash]);

  const containerClasses = embedded
    ? "space-y-14 py-4 sm:py-6"
    : "responsive-layout space-y-16 py-12 lg:py-16";

  const wrapperClass = embedded ? "bg-transparent" : "min-h-screen bg-slate-50";

  return (
    <div className={wrapperClass}>
      {!embedded && <PublicSiteHeader />}
      <main className="relative overflow-x-clip">
        {/* Soft background */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 -z-10 bg-gradient-to-b from-slate-50 via-white to-slate-50"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute left-1/2 top-[-8rem] -z-10 h-[28rem] w-[56rem] -translate-x-1/2 rounded-full bg-sky-100 blur-3xl opacity-40"
        />

        {/* Container */}
        <div className={containerClasses}>
          {/* Hero */}
          <header className="space-y-4 text-center">
            <h1 className="text-4xl font-bold tracking-tight text-gray-900 sm:text-5xl">
              Kakkalani Gramam
            </h1>
            <p className="mx-auto max-w-2xl text-gray-600">
              Honouring the people who laid the foundation and continue to guide
              the Kakkalani Gramam community.
            </p>
          </header>

          {/* Stats */}
          <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <StatCard value="9" label="Founder Members" />
            <StatCard value="12" label="Committee Members" />
            <StatCard value="2021" label="Initiative Began" />
          </section>

          <MemberCard
            id="founder-members"
            title="Kakkalani Gramam Group Founder Members"
            langSubtitle="கக்காழணி கிராமம் குழு நிறுவனர் உறுப்பினர்கள்"
            members={founderMembers}
            after={
              <div className="rounded-2xl border border-sky-100 bg-sky-50 p-4 sm:p-6 shadow-sm">
                <div className="flex items-center gap-4">
                  <span className="w-28 h-28 rounded-xl overflow-hidden shadow-sm border border-sky-100 flex-shrink-0 bg-white">
                    <img
                      src="/images/Kakkalany-Gramam-Founder-Members-images/RS_Mani_family.png"
                      alt="RS Mani family meeting at Kakkalani village"
                      className="w-full h-full object-cover"
                      loading="lazy"
                      onError={(e) => {
                        (e.currentTarget as HTMLImageElement).src =
                          AVATAR_PLACEHOLDER;
                      }}
                    />
                  </span>
                  <div>
                    <h3 className="text-sm font-semibold text-sky-800 uppercase tracking-wide">
                      Brief note about this group
                    </h3>
                    <p className="mt-1 text-sm text-sky-900">
                      R.S. Mani family, Radhachandran / Sriram family, Rema
                      &amp; Lakshmi met Srichu &amp; Rajendran at Kakkalani
                      village in Jan 2021 when the thought process to collect
                      the family tree began.
                    </p>
                  </div>
                </div>
              </div>
            }
          />

          <MemberCard
            id="committee-members"
            title="Kakkalani Gramam Managing Committee Members"
            langSubtitle="கக்காழணி கிராமம் நிர்வாக குழு உறுப்பினர்கள்"
            members={managingCommitteeMembers}
          />

          {/* Footer */}
          <footer className="text-center text-xs text-gray-500">
            <p>
              © {new Date().getFullYear()} Kakkalani Gramam. Built with ❤ for
              the community.
            </p>
          </footer>
        </div>
      </main>
    </div>
  );
}
