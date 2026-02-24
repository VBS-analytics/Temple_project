import React, { useState } from "react";
import PublicSiteHeader from "../components/PublicSiteHeader";
import EnglishTamilToggle from "../components/EnglishTamilToggle";

type Tab = {
  id: string;
  tag: string;
  label: string;
};

const tabs: Tab[] = [
  {
    id: "lakshmi-narayanar-temple",
    tag: "T1",
    label: "Lakshmi Narayanar Temple",
  },
  {
    id: "aathangarai-pillayar",
    tag: "T2",
    label: "Aathangarai Pillayar Koil",
  },
  {
    id: "gnanambal-samedha-kalahasteeswarar",
    tag: "T3",
    label: "Gnanambal Samedha Kalahasteeswarar Koil",
  },
  {
    id: "mangala-azhagar-ayyanar-koil",
    tag: "T4",
    label: "Mangala Azhagar Ayyanar Koil",
  },
];

const KovilDetailsPage = () => {
  const [activeTabId, setActiveTabId] = useState<string>(tabs[0].id);

  const renderContent = () => {
    switch (activeTabId) {
      case "gnanambal-samedha-kalahasteeswarar":
        return <GnanambalContent />;
      case "aathangarai-pillayar":
        return <AathangaraiPillayarContent />;
      case "lakshmi-narayanar-temple":
        return <LakshmiNarayanarTempleContent />;
      case "mangala-azhagar-ayyanar-koil":
        return <MangalaAzhagarAyyanarKoilContent />;
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-blue-50 text-slate-900">
      <PublicSiteHeader />

      <div className="relative overflow-x-clip">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 -z-10 bg-gradient-to-br from-purple-50 via-white to-blue-50"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute left-1/2 top-[-9rem] -z-10 h-[24rem] w-[52rem] -translate-x-1/2 rounded-full bg-purple-200 blur-3xl opacity-30"
        />

        <div className="responsive-layout senior-readable-content space-y-6 pt-4 pb-10 lg:pt-6 lg:pb-14">
          <EnglishTamilToggle />

          <div className="flex justify-center">
            <div className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-blue-100 to-blue-100 px-3 py-1.5 sm:px-4 sm:py-2">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                <span className="relative inline-flex h-2 w-2 rounded-full bg-blue-500"></span>
              </span>
              <span className="text-[10px] sm:text-xs font-semibold tracking-[0.2em] sm:tracking-[0.3em] uppercase text-blue-800">
                About Kovil
              </span>
            </div>
          </div>

          <nav className="flex flex-wrap justify-center gap-2 sm:gap-3">
            {tabs.map((tab) => {
              const isActive = tab.id === activeTabId;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTabId(tab.id)}
                  className={`inline-flex min-h-[44px] items-center gap-2 rounded-full px-3 py-2 text-[13px] font-semibold leading-tight transition-all duration-300 sm:px-4 sm:py-2.5 sm:text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-1 ${
                    isActive
                      ? "bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-lg shadow-blue-500/30"
                      : "border-2 border-slate-200 bg-white text-slate-700 hover:border-blue-300 hover:bg-blue-50"
                  }`}
                >
                  <span
                    className={`inline-flex h-6 w-6 items-center justify-center rounded-full border text-[11px] font-bold ${
                      isActive
                        ? "border-white/40 bg-white/20 text-white"
                        : "border-blue-200 bg-blue-100 text-blue-700"
                    }`}
                  >
                    {tab.tag}
                  </span>
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </nav>

          {renderContent()}
        </div>
      </div>

      <style>{`
        .senior-readable-content :where(p, li, td) {
          font-weight: 500;
        }
      `}</style>
    </div>
  );
};

const GnanambalContent = () => {
  return (
    <section className="space-y-6">
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="space-y-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-600">
              Ancient Heritage Temple
            </p>
            <h2 className="mt-2 text-3xl font-serif font-bold text-slate-900">
              Gnanambal Samedha Kalahasteeswarar Koil
            </h2>
          </div>

          <div className="prose prose-slate max-w-none">
            <p className="text-slate-700 leading-relaxed">
              This temple is located in Kakkalani Village on the Eastern end of Agraharam,
              on way to Thevur, via Retta madagadi.
            </p>

            <div className="mt-4 rounded-lg bg-blue-50 border border-blue-200 p-4">
              <p className="text-sm text-blue-900">
                <strong>Temple Heritage:</strong> Currently, pooja activities are carried out by
                Shri Manikandan Kurukkal (alias Sridhar). He is from the 5th generation in his family
                taking care of poojas here. From this, it is estimated that this temple is
                <strong> 400+ years old</strong>.
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h3 className="text-xl font-serif font-bold text-slate-900 mb-4">Historical Significance</h3>
        <div className="space-y-4 text-slate-700 leading-relaxed">
          <p>
            It is learned from his grandparents that this temple is one among <strong>48 Shiva temples</strong> built
            by our Chozha King. Shri Manikandan Kurukkal conducted Kumbabishekam at Thiruvarur Thyagaraja
            Swamy temple. Post kumbabishekam of Thiruvarur temple in mandala period of 48 days, every day
            kumbabishekam to each of these 48 Shiva temples were conducted. This temple at our village
            is one among them.
          </p>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h3 className="text-xl font-serif font-bold text-slate-900 mb-4">Temple Architecture & Features</h3>

        <div className="space-y-6">
          <div className="grid md:grid-cols-2 gap-4">
            <div className="rounded-lg bg-gradient-to-br from-purple-50 to-indigo-50 p-4 border border-purple-200">
              <div className="flex items-start gap-3">
                <span className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-purple-500 text-white font-bold text-sm">1</span>
                <div>
                  <h4 className="font-semibold text-slate-900 mb-2">Temple Entrance</h4>
                  <p className="text-sm text-slate-700">
                    On the top of the entrance, you can see idols of Lord Shiva & Goddess Parvathi
                    along with Lord Murugan & Lord Ganapathy.
                  </p>
                  <div className="mt-3 p-3 bg-white/60 rounded border border-purple-200">
                    <img
                      src="/images/kovi/kalahasteeswarar/kalahasteeswarar-2.png"
                      alt="Temple entrance view - Gnanambal Samedha Kalahasteeswarar Koil"
                      className="w-full rounded-md border border-purple-100 object-cover"
                      loading="lazy"
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="rounded-lg bg-gradient-to-br from-blue-50 to-cyan-50 p-4 border border-blue-200">
              <div className="flex items-start gap-3">
                <span className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-500 text-white font-bold text-sm">2</span>
                <div>
                  <h4 className="font-semibold text-slate-900 mb-2">Side View & Gopuram</h4>
                  <p className="text-sm text-slate-700">
                    The side view shows the gopuram above Lord Shiva. You can see the wall of Mandapam
                    in front of Lord Shiva sannidhanam, and a small structure attached to the wall -
                    the Lord Dakshinamoorthy Sannidhi.
                  </p>
                  <div className="mt-3 p-3 bg-white/60 rounded border border-blue-200">
                    <img
                      src="/images/kovi/kalahasteeswarar/kalahasteeswarar-1.png"
                      alt="Side view with gopuram - Gnanambal Samedha Kalahasteeswarar Koil"
                      className="w-full rounded-md border border-blue-100 object-cover"
                      loading="lazy"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-lg bg-gradient-to-br from-rose-50 to-pink-50 p-4 border border-rose-200">
            <div className="flex items-start gap-3">
              <span className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-rose-500 text-white font-bold text-sm">3</span>
              <div className="flex-1">
                <h4 className="font-semibold text-slate-900 mb-2">Gnanambal Sannidhi - Following Aagama Sasthram</h4>
                <p className="text-sm text-slate-700 mb-3">
                  Right in front of the main entrance is Gnanambal Sannidhi. As per aagama sasthram,
                  when you visit a Lord Shiva temple, first you should take darshan of Lord Ganapathy,
                  then have darshan of Ambal before we take darshan of Lord Shiva.
                </p>
                <div className="p-3 bg-rose-100 rounded border border-rose-300">
                  <p className="text-sm text-rose-900">
                    <strong>Divine Power:</strong> Gnanambal is a very powerful deity. When you
                    sincerely pray with devotion, she fulfils your prayer. This is experienced by
                    few donors of current younger generation in this group.
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-lg bg-gradient-to-br from-emerald-50 to-teal-50 p-4 border border-emerald-200">
            <div className="flex items-start gap-3">
              <span className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-white font-bold text-sm">4</span>
              <div>
                <h4 className="font-semibold text-slate-900 mb-2">Lord Ganapathy Sannadhi</h4>
                <p className="text-sm text-slate-700">
                  Matching the aagama sasthram, this temple is built perfectly. Close to Lord
                  Dakshinamoorthy Sannadhi, we have Lord Ganapathy Sannadhi. As soon as you enter
                  the temple and look to your left, you can have darshan of Lord Ganapathy, climb
                  steps & right in front you take darshan of Ambal, and when you turn to your left
                  you take darshan of Lord Shiva. On your right you can have darshan of Nandi.
                </p>
                <div className="mt-3 p-3 bg-white/60 rounded border border-emerald-200">
                  <img
                    src="/images/kovi/kalahasteeswarar/kalahasteeswarar-hd.png"
                    alt="Lord Ganapathy Sannadhi - Gnanambal Samedha Kalahasteeswarar Koil"
                    className="w-full rounded-md border border-emerald-100 object-cover"
                    loading="lazy"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h3 className="text-xl font-serif font-bold text-slate-900 mb-4">Outer Praharam Deities</h3>

        <div className="grid gap-4">
          <div className="flex items-start gap-3 rounded-lg border border-slate-200 bg-slate-50 p-4">
            <span className="mt-1 h-2.5 w-2.5 rounded-full bg-gradient-to-r from-indigo-500 to-purple-600 shrink-0" />
            <div>
              <h4 className="font-semibold text-slate-900">Lord Dakshinamoorthy (Point 5)</h4>
              <p className="text-sm text-slate-700 mt-1">
                In outer praharam, when you visit Lord Ganapathy sannadhi, to your right you can
                have darshan of Lord Dakshinamoorthy.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3 rounded-lg border border-slate-200 bg-slate-50 p-4">
            <span className="mt-1 h-2.5 w-2.5 rounded-full bg-gradient-to-r from-indigo-500 to-purple-600 shrink-0" />
            <div>
              <h4 className="font-semibold text-slate-900">Lord Kasi Viswanathar with Goddess Visalakshi (Point 6)</h4>
              <p className="text-sm text-slate-700 mt-1">
                Just behind Lord Shiva sannidhanam is Lord Kasi Viswanathar with goddess Visalakshi.
                This idol was brought by Koorakattu family from Kasi and installed here.
              </p>
              <div className="mt-2 p-3 bg-blue-50 rounded border border-blue-200">
                <p className="text-sm text-blue-900">
                  <strong>Unique Feature:</strong> Here Lord Shiva is facing West. It is said you
                  take darshan of Lord Shiva facing west you attain path to moksha. In our village
                  it is unique to have Lord Shiva facing east as well as west.
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-start gap-3 rounded-lg border border-slate-200 bg-slate-50 p-4">
            <span className="mt-1 h-2.5 w-2.5 rounded-full bg-gradient-to-r from-indigo-500 to-purple-600 shrink-0" />
            <div>
              <h4 className="font-semibold text-slate-900">Lord Subramanya (Murugan) (Point 7)</h4>
              <p className="text-sm text-slate-700 mt-1">
                As you move further, you can have darshan of Lord Subramanya (Murugan).
              </p>
              <div className="mt-3">
                <img
                  src="/images/kovi/kalahasteeswarar/murugan-hd.png"
                  alt="Lord Subramanya (Murugan) Sannadhi"
                  className="w-full max-w-md rounded-md border border-blue-100 object-cover"
                  loading="lazy"
                />
              </div>
              <div className="mt-2 p-3 bg-blue-50 rounded border border-blue-200">
                <p className="text-sm text-blue-900">
                  <strong>Speciality:</strong> The peacock on which Lord Murugan is seated is facing
                  north. It is said, peacock facing north are Devargal group and one facing south
                  is Asurargal group.
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-start gap-3 rounded-lg border border-slate-200 bg-slate-50 p-4">
            <span className="mt-1 h-2.5 w-2.5 rounded-full bg-gradient-to-r from-indigo-500 to-purple-600 shrink-0" />
            <div>
              <h4 className="font-semibold text-slate-900">Chandikeswarar (Point 8)</h4>
              <p className="text-sm text-slate-700 mt-1">
                Located just close to Dhara outlet from Lord Shiva sannidhanam.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3 rounded-lg border border-slate-200 bg-slate-50 p-4">
            <span className="mt-1 h-2.5 w-2.5 rounded-full bg-gradient-to-r from-indigo-500 to-purple-600 shrink-0" />
            <div>
              <h4 className="font-semibold text-slate-900">Temple Well (Point 9)</h4>
              <p className="text-sm text-slate-700 mt-1">
                The well inside the temple from where water is used for temple activities.
                See note 13 below to know more about this well and how this village got the
                name "Kakkalani".
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3 rounded-lg border border-slate-200 bg-slate-50 p-4">
            <span className="mt-1 h-2.5 w-2.5 rounded-full bg-gradient-to-r from-indigo-500 to-purple-600 shrink-0" />
            <div>
              <h4 className="font-semibold text-slate-900">Navagraha Sannadhi (Point 10)</h4>
              <p className="text-sm text-slate-700 mt-1">
                Located just in front of the temple well.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3 rounded-lg border border-slate-200 bg-slate-50 p-4">
            <span className="mt-1 h-2.5 w-2.5 rounded-full bg-gradient-to-r from-indigo-500 to-purple-600 shrink-0" />
            <div>
              <h4 className="font-semibold text-slate-900">Lord Suryan, Lord Saneeswaran and Lord Kalabhairavar (Point 11)</h4>
              <p className="text-sm text-slate-700 mt-1">
                Adjacent to Navagraha sannadhi, there are 3 idols - Lord Suryan, Lord Saneeswaran
                and Lord Kalabhairavar.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3 rounded-lg border border-slate-200 bg-slate-50 p-4">
            <span className="mt-1 h-2.5 w-2.5 rounded-full bg-gradient-to-r from-indigo-500 to-purple-600 shrink-0" />
            <div>
              <h4 className="font-semibold text-slate-900">Vastu Alignment (Point 12)</h4>
              <p className="text-sm text-slate-700 mt-1">
                Both the well inside temple and Kadugayar river behind the temple are to the North
                east of main idol in temple. As per vastu, water flowing towards North east is
                always good. This is another positive feature of this temple placement.
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-blue-200 bg-gradient-to-br from-blue-50 to-blue-50 p-6 shadow-sm">
        <h3 className="text-xl font-serif font-bold text-blue-900 mb-4">
          🕉️ Sacred Story: How Kakkalani Got Its Name (Point 13)
        </h3>

        <div className="space-y-4 text-slate-800 leading-relaxed">
          <div className="rounded-lg bg-white/70 p-4 border border-blue-200">
            <h4 className="font-semibold text-blue-900 mb-2">The Divine Worship</h4>
            <p className="text-sm">
              As advised by devas, the negatively afflicted (dosham petra) Rahu and Ketu worshiped
              Lord Shiva at Srikalahasti and got salvation. Devas who worshiped Lord Shiva obtained
              nectar and wisdom, and told Rahu and Ketu that if they worship Lord Shiva they would
              be granted the status of planets and placed alongside the other seven planets to form
              Navagrahas.
            </p>
          </div>

          <div className="rounded-lg bg-white/70 p-4 border border-blue-200">
            <h4 className="font-semibold text-blue-900 mb-2">Temple Significance</h4>
            <p className="text-sm">
              As Rahu, Ketu and Sanishwara Bhagavan worshiped Lord Shiva in our village, Lord Shiva
              and Goddess Parvati were sacredly named as <strong>SriGnanambika Sameda SriKalahastheeswarar</strong> who
              is bestowing graces. Inside prakaram, Sri Visalakshi Vishvanathar temple is also there.
            </p>
          </div>

          <div className="rounded-lg bg-white/70 p-4 border border-blue-200">
            <h4 className="font-semibold text-blue-900 mb-2">The Divine Intervention</h4>
            <p className="text-sm">
              While Rahu, Ketu and Sanishwara Bhagavan were worshiping Lord Shiva, Lord Shiva appeared
              before them and told them to perform puja with Gangai water for redemption of sins and
              also free this village from shortage of water.
            </p>
          </div>

          <div className="rounded-lg bg-white/70 p-4 border border-blue-200">
            <h4 className="font-semibold text-blue-900 mb-2">Mazhai Mariamman's Help</h4>
            <p className="text-sm">
              Even though there were lot of hurdles to bring Gangai water, Lord Surya with the help
              of our village Goddess Mariamman Ambal brought Ganges water through the sky and poured
              Ganges water into a well (Kenni) dug inside the temple and then pujas were performed.
            </p>
          </div>

          <div className="rounded-lg bg-gradient-to-r from-blue-100 to-blue-100 p-4 border-2 border-blue-300">
            <h4 className="font-bold text-blue-900 mb-2">🌟 Origin of the Name</h4>
            <p className="text-sm font-medium">
              As gangai water was brought and filled into the well, this village was named as
              <strong> Gangaikenni</strong> which over a period of time changed to <strong>Kakkazhani</strong>.
            </p>
            <p className="text-sm mt-2">
              As our village Goddess Sri Mariamman Ambal helped Lord Surya in bringing Ganges water,
              she is named as <strong>Mazhai Mariamman</strong>, the deity of fertility and rain,
              guardian against evil energies.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
};

const AathangaraiPillayarContent = () => {
  return (
    <section className="space-y-6">
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="space-y-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-600">
              Riverside Temple
            </p>
            <h2 className="mt-2 text-3xl font-serif font-bold text-slate-900">
              Aathangarai Pillayar Koil
            </h2>
          </div>

          <div className="prose prose-slate max-w-none">
            <p className="text-slate-700 leading-relaxed">
              A beautiful Pillayar temple located on the banks of the Kaduvaiyaru river,
              serving the devotees of Kakkalani village.
            </p>
          </div>

          <div className="mt-3 p-3 bg-white/60 rounded border border-emerald-200">
            <img
              src="/images/kovi/pillayar/pillayar-hd.jpg"
              alt="Aathangarai Pillayar Koil"
              className="w-full rounded-md border border-emerald-100 object-cover"
              loading="lazy"
            />
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h3 className="text-xl font-serif font-bold text-slate-900 mb-4">Historical Timeline</h3>

        <div className="space-y-4">
          <div className="flex gap-4">
            <div className="flex flex-col items-center">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-purple-500 text-white font-bold">
                90s
              </div>
              <div className="w-0.5 grow bg-gradient-to-b from-purple-500 to-blue-500"></div>
            </div>
            <div className="pb-8">
              <h4 className="font-semibold text-slate-900">Origins Under Peepal Tree</h4>
              <p className="text-sm text-slate-700 mt-1">
                In the 1990s, the Pillayar idol was situated under a Peepal Tree along the
                riverbank.
              </p>
            </div>
          </div>

          <div className="flex gap-4">
            <div className="flex flex-col items-center">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-500 text-white font-bold text-xs">
                95-98
              </div>
              <div className="w-0.5 grow bg-gradient-to-b from-blue-500 to-green-500"></div>
            </div>
            <div className="pb-8">
              <h4 className="font-semibold text-slate-900">Temple Construction</h4>
              <p className="text-sm text-slate-700 mt-1">
                Somewhere between 1995 to 1998, <strong>Shri Suppuni Anna</strong> from Pichu Iyer
                family took initiative to build a small temple for this Pillayar on the banks of
                Kaduvaiyaru river.
              </p>
            </div>
          </div>

          <div className="flex gap-4">
            <div className="flex flex-col items-center">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-green-500 text-white font-bold text-xs">
                2010
              </div>
              <div className="w-0.5 grow bg-gradient-to-b from-green-500 to-blue-500"></div>
            </div>
            <div className="pb-8">
              <h4 className="font-semibold text-slate-900">First Kumbabishekam</h4>
              <p className="text-sm text-slate-700 mt-1">
                In the year 2010, Kumbabishekam was done by <strong>Mr. Rajendran</strong>, with
                help of <strong>Mr. Sivaraman Kurukkal</strong>.
              </p>
            </div>
          </div>

          <div className="flex gap-4">
            <div className="flex flex-col items-center">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-500 text-white font-bold text-xs">
                2022
              </div>
            </div>
            <div>
              <h4 className="font-semibold text-slate-900">Grand Kumbabishekam & Renovation</h4>
              <p className="text-sm text-slate-700 mt-1">
                In the year 2022, the next Kumbabishekam was due and the temple structure was due
                for major repair.
              </p>
              <div className="mt-3 p-4 bg-gradient-to-r from-blue-50 to-blue-50 rounded-lg border border-blue-200">
                <p className="text-sm text-blue-900">
                  <strong>Community Effort:</strong> This group just started their activity and this
                  temple kumbabishekam was a big project. Same was conducted in grand manner with
                  support of all donors in this group. <strong>Naga Bhagwan</strong> was also installed
                  near this temple at the river bank.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h3 className="text-xl font-serif font-bold text-slate-900 mb-4">Temple Today</h3>

        <div className="rounded-lg bg-gradient-to-br from-indigo-50 to-purple-50 p-4 border border-indigo-200">
          <p className="text-sm text-slate-700 mb-3">
            Post 2022 Kumbabishekam, the temple stands beautifully renovated and blessed,
            serving the devotees with divine grace.
          </p>
          <div className="p-3 bg-white/60 rounded border border-indigo-200">
            <div className="grid md:grid-cols-2 gap-3 mb-3">
              <img
                src="/images/kovi/pillayar/before-kumbabishekam1.png"
                alt="Aathangarai Pillayar Koil renovated structure after kumbabishekam - view 1"
                className="w-full rounded-md border border-indigo-100 object-cover"
                loading="lazy"
              />
              <img
                src="/images/kovi/pillayar/before-kumbabishekam2.png"
                alt="Aathangarai Pillayar Koil renovated structure after kumbabishekam - view 2"
                className="w-full rounded-md border border-indigo-100 object-cover"
                loading="lazy"
              />
              <img
                src="/images/kovi/pillayar/after-kumbabishekam1.png"
                alt="Aathangarai Pillayar Koil completed project view 1"
                className="w-full rounded-md border border-indigo-100 object-cover"
                loading="lazy"
              />
              <img
                src="/images/kovi/pillayar/after-kumbabishekam2.png"
                alt="Aathangarai Pillayar Koil completed project view 2"
                className="w-full rounded-md border border-indigo-100 object-cover"
                loading="lazy"
              />
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h3 className="text-xl font-serif font-bold text-slate-900 mb-4">Infrastructure Development</h3>

        <div className="space-y-4">
          <div className="rounded-lg bg-red-50 border border-red-200 p-4">
            <h4 className="font-semibold text-red-900 mb-2">⚠️ The Challenge</h4>
            <p className="text-sm text-slate-700">
              Approach to this temple was a big challenge, as we have to cross a <strong>Canal 32 ft wide</strong> and
              reach temple at river bank. Only option was to walk on the shutter gate at this Canal,
              which was in broken condition, not suitable for us to walk safely.
            </p>
            <div className="mt-3 p-3 bg-white/60 rounded border border-red-200">
              <div className="grid md:grid-cols-2 gap-3 mb-3">
                <img
                  src="/images/kovi/pillayar/before-project-1.png"
                  alt="Broken canal shutter gate condition - view 1"
                  className="w-full rounded-md border border-red-100 object-cover"
                  loading="lazy"
                />
                <img
                  src="/images/kovi/pillayar/before-project-2.png"
                  alt="Broken canal shutter gate condition - view 2"
                  className="w-full rounded-md border border-red-100 object-cover"
                  loading="lazy"
                />
              </div>
            </div>
          </div>

          <div className="rounded-lg bg-yellow-50 border border-yellow-200 p-4">
            <h4 className="font-semibold text-yellow-900 mb-2">🌉 Temporary Solution (2022-2024)</h4>
            <p className="text-sm text-slate-700">
              During Kumbabishekam, we built a <strong>temporary Bamboo bridge</strong>, which lasted
              for about <strong>2½ years</strong>.
            </p>
          </div>

          <div className="rounded-lg bg-green-50 border border-green-200 p-4">
            <h4 className="font-semibold text-green-900 mb-2">✅ Permanent Solution</h4>
            <p className="text-sm text-slate-700 mb-3">
              We have now replaced the bamboo bridge with a <strong>permanent Galvanized Iron structure</strong>.
              This has helped local residents to visit daily river bank to take bath and on way back
              have darshan at Pillayar koil.
            </p>
            <div className="mt-3 p-3 bg-white/60 rounded border border-green-200">
              <div className="grid md:grid-cols-2 gap-3 mb-3">
                <img
                  src="/images/kovi/pillayar/after-project-1.png"
                  alt="New permanent GI bridge structure - view 1"
                  className="w-full rounded-md border border-green-100 object-cover"
                  loading="lazy"
                />
                <img
                  src="/images/kovi/pillayar/after-project-2.png"
                  alt="New permanent GI bridge structure - view 2"
                  className="w-full rounded-md border border-green-100 object-cover"
                  loading="lazy"
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-indigo-200 bg-gradient-to-br from-indigo-50 to-purple-50 p-6 shadow-sm">
        <h3 className="text-xl font-serif font-bold text-indigo-900 mb-3">🙏 Community Impact</h3>
        <p className="text-slate-700 leading-relaxed">
          The temple and bridge infrastructure now serve as a vital spiritual and physical connection
          for villagers, enabling daily rituals and worship. The permanent bridge ensures safe access
          for all devotees visiting both the river and the sacred Pillayar temple.
        </p>
      </div>
    </section>
  );
};

const LakshmiNarayanarTempleContent = () => {
  return (
    <section className="space-y-6">
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="space-y-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-600">
              Vishnu Temple
            </p>
            <h2 className="mt-2 text-3xl font-serif font-bold text-slate-900">
              Lakshmi Narayanar Temple
            </h2>
          </div>

          <div className="prose prose-slate max-w-none">
            <div className="rounded-lg bg-blue-50 border border-blue-200 p-4">
              <p className="text-sm text-blue-900">
                <strong>📚 History in Progress:</strong> We are still in the process of collecting history about this temple.
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h3 className="text-xl font-serif font-bold text-slate-900 mb-4">Temple Timeline</h3>

        <div className="space-y-4">
          <div className="flex gap-4">
            <div className="flex flex-col items-center">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-500 text-white font-bold text-xs">
                2018
              </div>
              <div className="w-0.5 grow bg-gradient-to-b from-blue-500 to-red-500"></div>
            </div>
            <div className="pb-8">
              <h4 className="font-semibold text-slate-900">Last Kumbabishekam</h4>
              <p className="text-sm text-slate-700 mt-1">
                The last Kumbabishekam was performed in the year <strong>2018</strong>.
              </p>
            </div>
          </div>

          <div className="flex gap-4">
            <div className="flex flex-col items-center">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-500 text-white font-bold text-xs">
                2019
              </div>
              <div className="w-0.5 grow bg-gradient-to-b from-red-500 to-purple-500"></div>
            </div>
            <div className="pb-8">
              <h4 className="font-semibold text-slate-900">Loss of Traditional Pattachari</h4>
              <p className="text-sm text-slate-700 mt-1">
                For ages, <strong>Pattachari</strong> who lived in this village used to take care of pooja. When he expired in the year <strong>2019</strong>, his younger generation left to the city.
              </p>
              <div className="mt-3 p-3 bg-red-50 rounded border border-red-200">
                <p className="text-sm text-red-900">
                  <strong>Challenge:</strong> The temple faced a period without traditional caretakers after the Pattachari's passing.
                </p>
              </div>
            </div>
          </div>

          <div className="flex gap-4">
            <div className="flex flex-col items-center">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-purple-500 text-white font-bold text-xs">
                2022
              </div>
            </div>
            <div>
              <h4 className="font-semibold text-slate-900">Revival Through Community</h4>
              <p className="text-sm text-slate-700 mt-1">
                After this group started in <strong>2022</strong>, daily pooja is now being taken care of by the community.
              </p>
              <div className="mt-3 p-3 bg-gradient-to-r from-purple-50 to-indigo-50 rounded border border-purple-200">
                <p className="text-sm text-purple-900">
                  <strong>🙏 Community Effort:</strong> The temple's daily rituals are now maintained through the collective efforts of devoted members, ensuring the continuation of sacred traditions.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h3 className="text-xl font-serif font-bold text-slate-900 mb-4">Temple Location & Architecture</h3>

        <div className="space-y-4">
          <div className="rounded-lg bg-gradient-to-br from-blue-50 to-cyan-50 p-4 border border-blue-200">
            <div className="flex items-start gap-3">
              <span className="text-2xl">📍</span>
              <div>
                <h4 className="font-semibold text-blue-900 mb-2">Location</h4>
                <p className="text-sm text-slate-700">
                  The temple is located at the <strong>west end of Agraharam</strong>. The road in front of the gopuram passes through Agraharam, allowing villagers to see deeparadhanai (lamp ceremony) standing at the door step of their house.
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-lg bg-gradient-to-br from-purple-50 to-indigo-50 p-4 border border-purple-200">
            <div className="flex items-start gap-3">
              <span className="text-2xl">🏛️</span>
              <div>
                <h4 className="font-semibold text-purple-900 mb-2">Temple Structure</h4>
                <p className="text-sm text-slate-700">
                  The temple features a <strong>beautiful gopuram</strong> and has a <strong>vast area around the main sannidhi</strong> inside the temple compound.
                </p>
                <div className="mt-3 p-3 bg-white/60 rounded border border-purple-200">
                  <div className="grid md:grid-cols-2 gap-3 mb-3">
                    <img
                      src="/images/kovi/lakshmi-narayanar/lakshmi-narayanar-1.png"
                      alt="Beautiful gopuram and temple entrance - Lakshmi Narayanar Temple view 1"
                      className="w-full rounded-md border border-purple-100 object-cover"
                      loading="lazy"
                    />
                    <img
                      src="/images/kovi/lakshmi-narayanar/lakshmi-narayanar-2.png"
                      alt="Beautiful gopuram and temple entrance - Lakshmi Narayanar Temple view 2"
                      className="w-full rounded-md border border-purple-100 object-cover"
                      loading="lazy"
                    />
                  </div>
                  <p className="text-xs text-purple-700 italic">📷 Beautiful gopuram and temple entrance visible in the images</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h3 className="text-xl font-serif font-bold text-slate-900 mb-4">Special Features</h3>

        <div className="space-y-4">
          <div className="rounded-lg bg-gradient-to-br from-green-50 to-emerald-50 p-4 border border-green-200">
            <div className="flex items-start gap-3">
              <span className="text-2xl">🐍</span>
              <div className="flex-1">
                <h4 className="font-semibold text-green-900 mb-2">Sacred Snake Hole</h4>
                <p className="text-sm text-slate-700">
                  As you enter the temple, on the <strong>left back corner</strong> there is a <strong>"Snake Hole"</strong> that has been existing for so many years.
                </p>
                <div className="mt-3 p-3 bg-green-100 rounded border border-green-300">
                  <p className="text-sm text-green-900">
                    <strong>Living Tradition:</strong> Even today the snake is there, and villagers worship by offering milk here.
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-lg bg-gradient-to-br from-cyan-50 to-blue-50 p-4 border border-cyan-200">
            <div className="flex items-start gap-3">
              <span className="text-2xl">💧</span>
              <div>
                <h4 className="font-semibold text-cyan-900 mb-2">Ayyan Kulam (Temple Pond)</h4>
                <p className="text-sm text-slate-700">
                  On the <strong>right corner, on the back side</strong> of this temple is <strong>"Ayyan Kulam"</strong> (pond).
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-indigo-200 bg-gradient-to-br from-indigo-50 to-purple-50 p-6 shadow-sm">
        <div className="flex items-start gap-3">
          <span className="text-3xl">🕉️</span>
          <div>
            <h3 className="text-lg font-serif font-bold text-indigo-900 mb-2">Temple Images</h3>
            <p className="text-sm text-slate-700 leading-relaxed mb-3">
              The temple showcases beautiful architecture with its impressive gopuram, the sacred deity inside, and the serene temple compound that provides a peaceful atmosphere for devotees.
            </p>
            <div className="grid md:grid-cols-2 gap-3">
              <div className="p-3 bg-white/60 rounded border border-indigo-200">
                <img
                  src="/images/kovi/lakshmi-narayanar/lakshmi-narayanar-2.png"
                  alt="Lakshmi Narayanar Temple gopuram and entrance"
                  className="w-full rounded-md border border-indigo-100 object-cover mb-2"
                  loading="lazy"
                />
                <p className="text-xs text-indigo-700 italic">📷 Gopuram and temple entrance</p>
              </div>
              <div className="p-3 bg-white/60 rounded border border-indigo-200">
                <img
                  src="/images/kovi/lakshmi-narayanar/lakshmi-narayanar.png"
                  alt="Main deity - Lakshmi Narayanar"
                  className="w-full rounded-md border border-indigo-100 object-cover mb-2"
                  loading="lazy"
                />
                <p className="text-xs text-indigo-700 italic">📷 Main deity - Lakshmi Narayanar</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

const MangalaAzhagarAyyanarKoilContent = () => {
  return (
    <section className="space-y-6">
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="space-y-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-600">
              Village Guardian Deity
            </p>
            <h2 className="mt-2 text-3xl font-serif font-bold text-slate-900">
              Mangala Azhagar Ayyanar Koil
            </h2>
          </div>

          <div className="prose prose-slate max-w-none">
            <p className="text-slate-700 leading-relaxed">
              This temple is beautifully situated <strong>opposite to Gnanambal Samedha Kalhasteeswarar temple</strong>, surrounded by beautiful trees.
            </p>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h3 className="text-xl font-serif font-bold text-slate-900 mb-4">Temple Location & Surroundings</h3>

        <div className="space-y-4">
          <div className="rounded-lg bg-gradient-to-br from-green-50 to-emerald-50 p-4 border border-green-200">
            <div className="flex items-start gap-3">
              <span className="text-2xl">🌳</span>
              <div>
                <h4 className="font-semibold text-green-900 mb-2">Natural Setting</h4>
                <p className="text-sm text-slate-700">
                  The temple is surrounded by <strong>beautiful trees</strong>, creating a serene and natural atmosphere for worship.
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-lg bg-gradient-to-br from-cyan-50 to-blue-50 p-4 border border-cyan-200">
            <div className="flex items-start gap-3">
              <span className="text-2xl">💧</span>
              <div>
                <h4 className="font-semibold text-cyan-900 mb-2">Water Tank / Pond</h4>
                <p className="text-sm text-slate-700">
                  When you go towards the temple, on your <strong>right</strong> you can see the <strong>water tank / pond</strong>. This small pond is located in front of the temple.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-purple-200 bg-white p-6 shadow-sm">
        <h3 className="text-xl font-serif font-bold text-purple-900 mb-4">🎥 Video Documentation</h3>

        <div className="rounded-lg bg-gradient-to-br from-purple-50 to-indigo-50 p-4 border border-purple-200">
          <div className="flex items-start gap-3">
            <span className="text-2xl">📹</span>
            <div className="flex-1">
              <h4 className="font-semibold text-purple-900 mb-2">Detailed Temple Video</h4>
              <p className="text-sm text-slate-700 mb-3">
                To see a live video, created by one of the <strong>Kakkalani village member</strong>, part of <strong>JK33 channel</strong>.
                He has explained beautifully about this temple, which he says is <strong>kuladeivam</strong> (family deity).
              </p>
              <div className="mt-3 p-3 bg-white/70 rounded border border-purple-200">
                <p className="text-xs text-purple-700 font-mono break-all">
                  🔗 Video Link:{" "}
                  <a
                    href="https://youtu.be/p1KJxF3cvzg"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline hover:text-purple-900"
                  >
                    https://youtu.be/p1KJxF3cvzg
                  </a>
                </p>
              </div>
              <p className="text-xs text-purple-800 mt-3 italic">
                Thanks to his effort & sharing the video documentation of this sacred temple.
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h3 className="text-xl font-serif font-bold text-slate-900 mb-4">Temple Features</h3>

        <div className="space-y-4">
          <div className="rounded-lg bg-gradient-to-br from-blue-50 to-blue-50 p-4 border border-blue-200">
            <div className="flex items-start gap-3">
              <span className="text-2xl">🪔</span>
              <div>
                <h4 className="font-semibold text-blue-900 mb-2">Saptakanni</h4>
                <p className="text-sm text-slate-700">
                  In the video you can see <strong>Saptakanni</strong> inside the temple. This is a sacred feature of the temple.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-indigo-200 bg-white p-6 shadow-sm">
        <h3 className="text-xl font-serif font-bold text-slate-900 mb-4">Important Poojas & Rituals</h3>

        <div className="space-y-4">
          <div className="rounded-lg bg-gradient-to-br from-indigo-50 to-purple-50 p-4 border border-indigo-200">
            <div className="flex items-start gap-3">
              <span className="text-2xl">🙏</span>
              <div className="flex-1">
                <h4 className="font-semibold text-indigo-900 mb-3">Special Pooja Services</h4>

                <div className="space-y-3">
                  <div className="p-3 bg-white/70 rounded border border-indigo-200">
                    <h5 className="font-semibold text-indigo-800 mb-1">1. Chandana Kappu for Ayyanar</h5>
                    <p className="text-sm text-slate-700">
                      One of the important poojas conducted at this temple.
                    </p>
                  </div>

                  <div className="p-3 bg-white/70 rounded border border-indigo-200">
                    <h5 className="font-semibold text-indigo-800 mb-1">2. Palayam (Special Pooja)</h5>
                    <p className="text-sm text-slate-700">
                      The more important special pooja called <strong>"Palayam"</strong>. You can contact the temple
                      management to know more about this sacred ritual.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-green-200 bg-gradient-to-br from-green-50 to-emerald-50 p-6 shadow-sm">
        <div className="flex items-start gap-3">
          <span className="text-3xl">📸</span>
          <div>
            <h3 className="text-lg font-serif font-bold text-green-900 mb-2">Temple Gallery</h3>
            <p className="text-sm text-slate-700 leading-relaxed mb-3">
              The temple images showcase the beautiful structure with its distinctive entrance, the sacred deities,
              the surrounding natural environment, and the pond that adds to the temple's serene atmosphere.
            </p>
            <div className="grid md:grid-cols-2 gap-3">
              <div className="p-3 bg-white/60 rounded border border-green-200">
                <img
                  src="/images/kovi/ayyanar/ayyanar-1.png"
                  alt="Temple exterior with surrounding trees"
                  className="w-full rounded-md border border-green-100 object-cover mb-2"
                  loading="lazy"
                />
                <p className="text-xs text-green-700 italic">📷 Temple exterior with surrounding trees</p>
              </div>
              <div className="p-3 bg-white/60 rounded border border-green-200">
                <img
                  src="/images/kovi/ayyanar/ayyanar-2.png"
                  alt="Main entrance and gate"
                  className="w-full rounded-md border border-green-100 object-cover mb-2"
                  loading="lazy"
                />
                <p className="text-xs text-green-700 italic">📷 Main entrance and gate</p>
              </div>
              <div className="p-3 bg-white/60 rounded border border-green-200">
                <img
                  src="/images/kovi/ayyanar/ayyanar-hd.jpg"
                  alt="Sacred Saptakanni with offerings"
                  className="w-full rounded-md border border-green-100 object-cover mb-2"
                  loading="lazy"
                />
                <p className="text-xs text-green-700 italic">📷 Sacred Saptakanni with offerings</p>
              </div>
              <div className="p-3 bg-white/60 rounded border border-green-200">
                <img
                  src="/images/kovi/ayyanar/ayyanar-kovi-river.png"
                  alt="Temple pond visible from approach"
                  className="w-full rounded-md border border-green-100 object-cover mb-2"
                  loading="lazy"
                />
                <p className="text-xs text-green-700 italic">📷 Temple pond visible from approach</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-blue-200 bg-gradient-to-br from-blue-50 to-blue-50 p-6 shadow-sm">
        <div className="flex items-center gap-3 mb-3">
          <span className="text-3xl">📞</span>
          <h3 className="text-lg font-serif font-bold text-blue-900">Contact for More Information</h3>
        </div>
        <p className="text-sm text-slate-700 leading-relaxed">
          For detailed information about special poojas like "Palayam" and to schedule worship services,
          please contact the temple authorities or the community group managing the temple activities.
        </p>
      </div>
    </section>
  );
};

export default KovilDetailsPage;
