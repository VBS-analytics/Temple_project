import React, { useState } from "react";
import { useLocation } from "react-router-dom";

/**
 * Kakkazhany Gramam – About Page
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

type CoreGroupFamily = {
  tabNo: number;
  family: string;
  contacts: string[];
};

type CoreGroupNote = {
  text: string;
  highlightEmail?: boolean;
  suffix?: string;
};

type FamilyTreeInfo = {
  id: string;
  name: string;
  subtitle: string;
  image?: string;
  download?: string;
  description?: string;
  isAvailable?: boolean;
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
    image:
      "images/Kakkalany-Gramam-Founder-Members-images/Alamelu.jpg",
  },
  {
    name: "Smt. Lakshmi Anand",
    detail: "Daughter of Smt. Alamelu (Appapalu)",
    image:
      "images/Kakkalany-Gramam-Founder-Members-images/Lakshmi_Anand.jpg",
  },
  {
    name: "Shri. Radhakrishnan (Radhu mama)",
    image:
      "images/Kakkalany-Gramam-Founder-Members-images/Radhakrishnan.jpg",
  },
  {
    name: "Smt. Nalini Ganesan",
    image:
      "images/Kakkalany-Gramam-Founder-Members-images/Nalini_Ganesan.jpg",
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

const coreGroupFamilies: CoreGroupFamily[] = [
  {
    tabNo: 1,
    family: "Arunachalam - Sambasiva Iyer family",
    contacts: ["Mr. R.S. Mani"],
  },
  {
    tabNo: 2,
    family: "Kadaikara Subbu Iyer family / Venkuttuswamy family",
    contacts: ["Mr. Radhakrishnan Sastrigal"],
  },
  {
    tabNo: 3,
    family: "Sundaresa Iyer + Pannai + Balu Iyer family",
    contacts: ["Mr. Radhakrishnan (Radhu)"],
  },
  {
    tabNo: 4,
    family: "Narayanaswamy family",
    contacts: ["Mr. Srinivasan"],
  },
  {
    tabNo: 5,
    family: "Mangalam Periyamma family",
    contacts: ["Mr. Venkataraman (Ramani)"],
  },
  {
    tabNo: 6,
    family: "Koorakattu Natesa Iyer family",
    contacts: [
      "Mr. B.K. Subramanian",
      "Mrs. Banu V (Alamelu V)",
      "Mrs. Lakshmi Anand",
    ],
  },
  {
    tabNo: 7,
    family: "Ramani Sastrigal family",
    contacts: ["Mr. Babu"],
  },
  {
    tabNo: 8,
    family: "Pichu Iyer family",
    contacts: ["Mr. Ravichandran", "Mr. Sriramkumar Natarajan"],
  },
  {
    tabNo: 9,
    family: "Pattamani Iyer family",
    contacts: ["Mr. G. Ramachandran"],
  },
  {
    tabNo: 10,
    family: "Contact at Kakkalany",
    contacts: ["Gurukkal Manikantan (Sridhar Rajendran)"],
  },
];

const coreGroupEmail = "gpkakkalany@gmail.com";

const coreGroupNotes: CoreGroupNote[] = [
  { text: "We have initially identified the above core group members." },
  { text: "As needed, we can add a few more youngsters." },
  {
    text: "All members are requested to communicate via",
    highlightEmail: true,
    suffix: "so that every core group member can view the updates.",
  },
  {
    text: "The core group WhatsApp group is already active, and the email password is shared there.",
  },
];

const familyTrees: FamilyTreeInfo[] = [
  {
    id: "arunachalam-sambasiva-iyr",
    name: "Arunachalam-Sambasiva Iyr",
    subtitle: "Arunachalam - Sambasiva Iyer family",
    image: "/assets/family-trees/arunachalam-sambasiva-family-tree.svg",
    download: "/assets/family-trees/arunachalam-sambasiva-iyr.xlsx",
    description:
      "Diagram generated from the latest Arunachalam – Sambasiva Iyer family tree records.",
    isAvailable: true,
  },
  {
    id: "kadakarar-subramani-iyr",
    name: "Kadakarar Subramani Iyr",
    subtitle: "Kadakarar Subramani Iyer family",
    image: "/assets/family-trees/kadakarar-subramani-iyr-family-tree.svg",
    download: "/assets/family-trees/kadakarar-subramani-iyr.xlsx",
    description:
      "Diagram generated from the latest Kadakarar Subramani Iyer family tree records.",
    isAvailable: true,
  },
  {
    id: "sundaresa-iyr-pannai-balu",
    name: "Sundaresa Iyr+ Pannai+Balu Fmly",
    subtitle: "Sundaresa Iyer, Pannai, and Balu family lineage",
    image: "/assets/family-trees/sundaresa-iyr-pannai-balu-family-tree.svg",
    download: "/assets/family-trees/sundaresa-iyr-pannai-balu.xlsx",
    description:
      "Diagram generated from the latest Sundaresa Iyer, Pannai, and Balu family lineage records.",
    isAvailable: true,
  },
  {
    id: "narayanaswamy-family",
    name: "Narayanswamy fmly",
    subtitle: "Narayanswamy family",
    image: "/assets/family-trees/narayanaswamy-fmly-family-tree.svg",
    download: "/assets/family-trees/narayanaswamy-fmly.xlsx",
    description:
      "Diagram generated from the latest Narayanswamy family tree records.",
    isAvailable: true,
  },
  {
    id: "mangalam-periyamma-family",
    name: "Mangalam Periyamma Fmly",
    subtitle: "Mangalam Periyamma family",
    image: "/assets/family-trees/mangalam-periyamma-fmly-family-tree.svg",
    download: "/assets/family-trees/mangalam-periyamma-fmly.xlsx",
    description:
      "Diagram generated from the latest Mangalam Periyamma family tree records.",
    isAvailable: true,
  },
  {
    id: "koorakattu-family",
    name: "Koorakattu Fmly",
    subtitle: "Koorakattu family",
    image: "/assets/family-trees/koorakattu-fmly-family-tree.svg",
    download: "/assets/family-trees/koorakattu-fmly.xlsx",
    description:
      "Diagram generated from the latest Koorakattu family tree records.",
    isAvailable: true,
  },
  {
    id: "ramanisasti-fmly",
    name: "RamaniSastri Fmly",
    subtitle: "Ramani Sastrigal family",
    image: "/assets/family-trees/ramanisasti-fmly-family-tree.svg",
    download: "/assets/family-trees/ramanisasti-fmly.xlsx",
    description:
      "Diagram generated from the latest Ramani Sastrigal family tree records.",
    isAvailable: true,
  },
  {
    id: "pichu-iyr-family",
    name: "Pichu Iyr Fmly",
    subtitle: "Pichu Iyer family",
    image: "/assets/family-trees/pichu-iyr-fmly-family-tree.svg",
    download: "/assets/family-trees/pichu-iyr-fmly.xlsx",
    description:
      "Diagram generated from the latest Pichu Iyer family tree records.",
    isAvailable: true,
  },
  {
    id: "pattamani-iyr-family",
    name: "Pattamani Iyr Fmly",
    subtitle: "Pattamani Iyer family",
    image: "/assets/family-trees/pattamani-iyr-fmly-family-tree.svg",
    download: "/assets/family-trees/pattamani-iyr-fmly.xlsx",
    description:
      "Diagram generated from the latest Pattamani Iyer family tree records.",
    isAvailable: true,
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
      {subtitle && (
        <p className="mt-2 text-gray-600">
          {subtitle}
        </p>
      )}
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
    <li
      className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-gray-100 pb-4 last:border-b-0 last:pb-0"
    >
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

function CoreGroupSection() {
  return (
    <section className="space-y-6">
      <SectionHeader
        title="Core Group Families & Contacts"
        subtitle="Coordinators representing each core family for Kakkazhany Gramam."
      />
      <div className="overflow-x-auto rounded-2xl border border-sky-100 bg-white shadow-sm">
        <table className="min-w-full divide-y divide-sky-100 text-left text-sm text-gray-700">
          <thead className="bg-sky-50 text-xs font-semibold uppercase tracking-wide text-sky-900">
            <tr>
              <th className="px-4 py-3">Tab No.</th>
              <th className="px-4 py-3">Family Name</th>
              <th className="px-4 py-3">Representative(s)</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-sky-50">
            {coreGroupFamilies.map((family) => (
              <tr
                key={family.tabNo}
                className="transition hover:bg-sky-50/60"
              >
                <td className="px-4 py-3 font-semibold text-sky-600">
                  {family.tabNo}
                </td>
                <td className="px-4 py-3">{family.family}</td>
                <td className="px-4 py-3">
                  <ul className="space-y-1">
                    {family.contacts.map((contact) => (
                      <li key={contact}>{contact}</li>
                    ))}
                  </ul>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-sm text-amber-900 shadow-sm">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-amber-800">
          Notes
        </h3>
        <ul className="mt-3 space-y-2 list-disc pl-5">
          {coreGroupNotes.map((note) => (
            <li key={note.text}>
              {note.text}
              {note.highlightEmail && (
                <>
                  {" "}
                  <a
                    href={`mailto:${coreGroupEmail}`}
                    className="font-medium text-amber-900 underline decoration-amber-400 underline-offset-4"
                  >
                    {coreGroupEmail}
                  </a>
                  {note.suffix ? ` ${note.suffix}` : null}
                </>
              )}
              {!note.highlightEmail && note.suffix ? ` ${note.suffix}` : null}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

function FamilyTreeSection() {
  const [activeTreeId, setActiveTreeId] = useState(familyTrees[0]?.id);
  const [zoomLevel, setZoomLevel] = useState(1); // 添加缩放状态
  const activeTree =
    familyTrees.find((tree) => tree.id === activeTreeId) ?? familyTrees[0];

  // 缩放控制函数
  const zoomIn = () => setZoomLevel(prev => Math.min(prev + 0.25, 3));
  const zoomOut = () => setZoomLevel(prev => Math.max(prev - 0.25, 0.5));
  const resetZoom = () => setZoomLevel(1);

  return (
    <section id="family-tree" className="space-y-6">
      <SectionHeader
        title="Kakkazhany Gramam Family Tree"
        subtitle={activeTree?.subtitle}
      />
      <div className="flex flex-wrap justify-center gap-3">
        {familyTrees.map((tree) => {
          const isActive = tree.id === activeTreeId;
          return (
            <button
              key={tree.id}
              type="button"
              onClick={() => {
                setActiveTreeId(tree.id);
                resetZoom(); // 切换家族树时重置缩放
              }}
              className={`rounded-full border px-4 py-2 text-sm font-medium transition focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2 ${
                isActive
                  ? "border-sky-600 bg-sky-600 text-white shadow"
                  : "border-sky-200 bg-white text-sky-700 hover:border-sky-400"
              }`}
            >
              {tree.name}
            </button>
          );
        })}
      </div>
      
      {/* 缩放控制按钮 */}
      <div className="flex justify-center gap-2">
        <button
          onClick={zoomOut}
          disabled={zoomLevel <= 0.5}
          className="px-3 py-1 bg-sky-100 text-sky-700 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
          aria-label="Zoom out"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M5 10a1 1 0 011-1h8a1 1 0 110 2H6a1 1 0 01-1-1z" clipRule="evenodd" />
          </svg>
        </button>
        <button
          onClick={resetZoom}
          className="px-3 py-1 bg-sky-100 text-sky-700 rounded-lg"
        >
          {zoomLevel === 1 ? "100%" : `${Math.round(zoomLevel * 100)}%`}
        </button>
        <button
          onClick={zoomIn}
          disabled={zoomLevel >= 3}
          className="px-3 py-1 bg-sky-100 text-sky-700 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
          aria-label="Zoom in"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M10 5a1 1 0 011 1v3h3a1 1 0 110 2h-3v3a1 1 0 11-2 0v-3H6a1 1 0 110-2h3V6a1 1 0 011-1z" clipRule="evenodd" />
          </svg>
        </button>
      </div>
      
      <figure className="rounded-2xl border border-sky-100 bg-white shadow-sm">
        {activeTree?.isAvailable && activeTree.image ? (
          <>
            <div className="max-h-[560px] overflow-auto rounded-t-2xl border-b border-sky-50 bg-slate-50/40 p-4">
              <div 
                className="mx-auto transition-transform duration-300 ease-in-out"
                style={{ transform: `scale(${zoomLevel})`, transformOrigin: 'top center' }}
              >
                <img
                  src={activeTree.image}
                  alt={`Family tree diagram for the ${activeTree.subtitle.toLowerCase()}.`}
                  className="max-h-[520px] min-w-[720px] w-auto object-contain"
                  loading="lazy"
                />
              </div>
            </div>
            <figcaption className="px-6 py-4 text-sm text-sky-900/80">
              {activeTree.description ??
                "Diagram generated from the latest family records."}
            </figcaption>
          </>
        ) : (
          <div className="px-6 py-12 text-center text-sm text-sky-900/70">
            Family tree visual coming soon. If you have details or records to
            add, please share them with the core group.
          </div>
        )}
      </figure>
    </section>
  );
}

// --- Page ----------------------------------------------------------------

export default function AboutPage() {
  const location = useLocation();
  const sectionKey = (location.hash?.replace("#", "") ?? "").toLowerCase();

  let sectionContent: React.ReactNode;
  switch (sectionKey) {
    case "family-tree":
      sectionContent = <FamilyTreeSection />;
      break;
    case "founder-members":
      sectionContent = (
        <MemberCard
          id="founder-members"
          title="Kakkazhany Gramam Group Founder Members"
          langSubtitle="கக்காழணி கிராமம் குழு நிறுவனர் உறுப்பினர்கள்"
          members={founderMembers}
          after={
            <div className="rounded-2xl border border-sky-100 bg-sky-50 p-4 sm:p-6 shadow-sm">
              <div className="flex items-center gap-4">
                <span className="w-28 h-28 rounded-xl overflow-hidden shadow-sm border border-sky-100 flex-shrink-0 bg-white">
                  <img
                    src="/images/Kakkalany-Gramam-Founder-Members-images/RS_Mani_family.png"
                    alt="RS Mani family meeting at Kakkazhany village"
                    className="w-full h-full object-cover"
                    loading="lazy"
                    onError={(e) => {
                      (e.currentTarget as HTMLImageElement).src = AVATAR_PLACEHOLDER;
                    }}
                  />
                </span>
                <div>
                  <h3 className="text-sm font-semibold text-sky-800 uppercase tracking-wide">
                    Brief note about this group
                  </h3>
                  <p className="mt-1 text-sm text-sky-900">
                    R.S. Mani family, Radhachandran / Sriram family, Rema &amp; Lakshmi met
                    Srichu &amp; Rajendran at Kakkazhany village in Jan 2021 when the thought
                    process to collect the family tree began.
                  </p>
                </div>
              </div>
            </div>
          }
        />
      );
      break;
    case "committee-members":
      sectionContent = (
        <MemberCard
          id="committee-members"
          title="Kakkazhany Gramam Managing Committee Members"
          langSubtitle="கக்காழணி கிராமம் நிர்வாக குழு உறுப்பினர்கள்"
          members={managingCommitteeMembers}
        />
      );
      break;
    default:
      sectionContent = <CoreGroupSection />;
  }

  return (
    <main className="min-h-screen relative overflow-x-clip">
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
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-12 lg:py-16 space-y-16">
        {/* Hero */}
        <header className="text-center space-y-4">
          <h1 className="text-4xl sm:text-5xl font-bold tracking-tight text-gray-900">
            Kakkazhany Gramam
          </h1>
          <p className="mx-auto max-w-2xl text-gray-600">
            Honouring the people who laid the foundation and continue to guide
            the Kakkazhany Gramam community.
          </p>
        </header>

        {/* Stats */}
        <section className="grid grid-cols-3 gap-4">
          <StatCard value="9" label="Founder Members" />
          <StatCard value="12" label="Committee Members" />
          <StatCard value="2021" label="Initiative Began" />
        </section>

        {sectionContent}

        {/* CTA */}
        <section className="text-center">
          <div className="inline-flex items-center gap-3 rounded-2xl border border-sky-200 bg-sky-50/70 px-6 py-4 shadow-sm">
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-white border border-sky-100 text-sky-600">ℹ️</span>
            <p className="text-sm text-sky-900">
              Have a photo or detail to add? Email us and we'll include it in the
              next update.
            </p>
          </div>
        </section>

        {/* Footer */}
        <footer className="text-center text-xs text-gray-500">
          <p>
            © {new Date().getFullYear()} Kakkazhany Gramam. Built with ❤ for the
            community.
          </p>
        </footer>
      </div>
    </main>
  );
}