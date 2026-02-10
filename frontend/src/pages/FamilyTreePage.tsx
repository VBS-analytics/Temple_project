import React, { useState } from "react";

// --- Types ---

type FamilyTreeInfo = {
  id: string;
  name: string;
  subtitle: string;
  image?: string;
  download?: string;
  description?: string;
  isAvailable?: boolean;
};

// --- Data (copied from About page) ---

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

// --- Components ---

function SectionHeader({
  title,
  subtitle,
}: {
  title: string;
  subtitle?: string;
}) {
  return (
    <div className="mb-8 text-center">
      <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight text-gray-900">
        {title}
      </h2>
      {subtitle && <p className="mt-2 text-gray-600">{subtitle}</p>}
    </div>
  );
}

function FamilyTreeSection() {
  const [activeTreeId, setActiveTreeId] = useState(familyTrees[0]?.id);
  const [zoomLevel, setZoomLevel] = useState(1);
  const activeTree =
    familyTrees.find((tree) => tree.id === activeTreeId) ?? familyTrees[0];

  const zoomIn = () => setZoomLevel((prev) => Math.min(prev + 0.25, 3));
  const zoomOut = () => setZoomLevel((prev) => Math.max(prev - 0.25, 0.5));
  const resetZoom = () => setZoomLevel(1);

  return (
    <section id="family-tree" className="space-y-6">
      <SectionHeader
        title="Kakkalani Gramam Family Tree"
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
                resetZoom();
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

      <div className="flex justify-center gap-2">
        <button
          onClick={zoomOut}
          disabled={zoomLevel <= 0.5}
          className="px-3 py-1 bg-sky-100 text-sky-700 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
          aria-label="Zoom out"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-5 w-5"
            viewBox="0 0 20 20"
            fill="currentColor"
          >
            <path
              fillRule="evenodd"
              d="M5 10a1 1 0 011-1h8a1 1 0 110 2H6a1 1 0 01-1-1z"
              clipRule="evenodd"
            />
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
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-5 w-5"
            viewBox="0 0 20 20"
            fill="currentColor"
          >
            <path
              fillRule="evenodd"
              d="M10 5a1 1 0 011 1v3h3a1 1 0 110 2h-3v3a1 1 0 11-2 0v-3H6a1 1 0 110-2h3V6a1 1 0 011-1z"
              clipRule="evenodd"
            />
          </svg>
        </button>
      </div>

      <figure className="rounded-2xl border border-sky-100 bg-white shadow-sm">
        {activeTree?.isAvailable && activeTree.image ? (
          <>
            <div className="max-h-[560px] overflow-auto rounded-t-2xl border-b border-sky-50 bg-slate-50/40 p-4">
              <div
                className="mx-auto w-full max-w-4xl transition-transform duration-300 ease-in-out"
                style={{
                  transform: `scale(${zoomLevel})`,
                  transformOrigin: "top center",
                }}
              >
                <img
                  src={activeTree.image}
                  alt={`Family tree diagram for the ${activeTree.subtitle.toLowerCase()}.`}
                  className="h-auto max-h-[520px] w-full object-contain"
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
            add, please share them with the team.
          </div>
        )}
      </figure>
    </section>
  );
}

const FamilyTreePage = () => {
  return (
    <div className="relative overflow-x-clip">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 bg-gradient-to-b from-slate-50 via-white to-slate-50"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-[-8rem] -z-10 h-[28rem] w-[56rem] -translate-x-1/2 rounded-full bg-sky-100 blur-3xl opacity-40"
      />

      <div className="responsive-layout space-y-12 py-10 lg:py-14">
        <FamilyTreeSection />
      </div>
    </div>
  );
};

export default FamilyTreePage;