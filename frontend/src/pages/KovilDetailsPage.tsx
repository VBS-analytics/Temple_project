import React, { useState } from "react";
type Tab = {
  id: string;
  label: string;
};
const tabs: Tab[] = [
  {
    id: "gnanambal-samedha-kalahasteeswarar",
    label: "Gnanambal Samedha Kalahasteeswarar Koil",
  },
  {
    id: "aathangarai-pillayar",
    label: "Aathangarai Pillayar Koil",
  },
  {
    id: "lakshmi-narayanar-temple",
    label: "Lakshmi Narayanar Temple",
  },
  {
    id: "mangala-azhagar-ayyanar-koil",
    label: "Mangala Azhagar Ayyanar Koil",
  },
  {
    id: "cow-samrakshana-seva",
    label: "Cow Samrakshana Seva",
  },
  {
    id: "pooja-sevas",
    label: "Pooja Sevas",
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
      case "cow-samrakshana-seva":
        return <CowSamrakshanaContent />;
      case "pooja-sevas":
        return <PoojaSevasContent />;
      default:
        return null;
    }
  };
  return (
    <div className="relative overflow-x-clip">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 bg-gradient-to-b from-sky-50 via-white to-slate-50"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-[-9rem] -z-10 h-[24rem] w-[52rem] -translate-x-1/2 rounded-full bg-sky-100 blur-3xl opacity-45"
      />
      <div className="responsive-layout space-y-6 pt-1 pb-10 lg:pt-2 lg:pb-14">
        <nav className="flex flex-wrap justify-center gap-2">
          {tabs.map((tab) => {
            const isActive = tab.id === activeTabId;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTabId(tab.id)}
                className={`rounded-full px-4 py-2 text-sm font-semibold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-1 ${
                  isActive
                    ? "bg-gradient-to-r from-indigo-500 to-purple-600 text-white shadow-[0_10px_18px_-12px_rgba(79,70,229,0.6)]"
                    : "text-slate-700 hover:bg-slate-100"
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </nav>
        {renderContent()}
      </div>
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
            <h2 className="mt-2 text-3xl font-bold text-slate-900">
              Gnanambal Samedha Kalahasteeswarar Koil
            </h2>
          </div>
          
          <div className="prose prose-slate max-w-none">
            <p className="text-slate-700 leading-relaxed">
              This temple is located in Kakkalani Village on the Eastern end of Agraharam, 
              on way to Thevur, via Retta madagadi.
            </p>
            
            <div className="mt-4 rounded-lg bg-amber-50 border border-amber-200 p-4">
              <p className="text-sm text-amber-900">
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
        <h3 className="text-xl font-bold text-slate-900 mb-4">Historical Significance</h3>
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
        <h3 className="text-xl font-bold text-slate-900 mb-4">Temple Architecture & Features</h3>
        
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
        <h3 className="text-xl font-bold text-slate-900 mb-4">Outer Praharam Deities</h3>
        
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
              <div className="mt-2 p-3 bg-amber-50 rounded border border-amber-200">
                <p className="text-sm text-amber-900">
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
      <div className="rounded-2xl border border-orange-200 bg-gradient-to-br from-orange-50 to-amber-50 p-6 shadow-sm">
        <h3 className="text-xl font-bold text-orange-900 mb-4">
          🕉️ Sacred Story: How Kakkalani Got Its Name (Point 13)
        </h3>
        
        <div className="space-y-4 text-slate-800 leading-relaxed">
          <div className="rounded-lg bg-white/70 p-4 border border-orange-200">
            <h4 className="font-semibold text-orange-900 mb-2">The Divine Worship</h4>
            <p className="text-sm">
              As advised by devas, the negatively afflicted (dosham petra) Rahu and Ketu worshiped 
              Lord Shiva at Srikalahasti and got salvation. Devas who worshiped Lord Shiva obtained 
              nectar and wisdom, and told Rahu and Ketu that if they worship Lord Shiva they would 
              be granted the status of planets and placed alongside the other seven planets to form 
              Navagrahas.
            </p>
          </div>
          <div className="rounded-lg bg-white/70 p-4 border border-orange-200">
            <h4 className="font-semibold text-orange-900 mb-2">Temple Significance</h4>
            <p className="text-sm">
              As Rahu, Ketu and Sanishwara Bhagavan worshiped Lord Shiva in our village, Lord Shiva 
              and Goddess Parvati were sacredly named as <strong>SriGnanambika Sameda SriKalahastheeswarar</strong> who 
              is bestowing graces. Inside prakaram, Sri Visalakshi Vishvanathar temple is also there.
            </p>
          </div>
          <div className="rounded-lg bg-white/70 p-4 border border-orange-200">
            <h4 className="font-semibold text-orange-900 mb-2">The Divine Intervention</h4>
            <p className="text-sm">
              While Rahu, Ketu and Sanishwara Bhagavan were worshiping Lord Shiva, Lord Shiva appeared 
              before them and told them to perform puja with Gangai water for redemption of sins and 
              also free this village from shortage of water.
            </p>
          </div>
          <div className="rounded-lg bg-white/70 p-4 border border-orange-200">
            <h4 className="font-semibold text-orange-900 mb-2">Mazhai Mariamman's Help</h4>
            <p className="text-sm">
              Even though there were lot of hurdles to bring Gangai water, Lord Surya with the help 
              of our village Goddess Mariamman Ambal brought Ganges water through the sky and poured 
              Ganges water into a well (Kenni) dug inside the temple and then pujas were performed.
            </p>
          </div>
          <div className="rounded-lg bg-gradient-to-r from-orange-100 to-amber-100 p-4 border-2 border-orange-300">
            <h4 className="font-bold text-orange-900 mb-2">🌟 Origin of the Name</h4>
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
            <h2 className="mt-2 text-3xl font-bold text-slate-900">
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
        <h3 className="text-xl font-bold text-slate-900 mb-4">Historical Timeline</h3>
        
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
              <div className="w-0.5 grow bg-gradient-to-b from-green-500 to-orange-500"></div>
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
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-orange-500 text-white font-bold text-xs">
                2022
              </div>
            </div>
            <div>
              <h4 className="font-semibold text-slate-900">Grand Kumbabishekam & Renovation</h4>
              <p className="text-sm text-slate-700 mt-1">
                In the year 2022, the next Kumbabishekam was due and the temple structure was due 
                for major repair.
              </p>
              <div className="mt-3 p-4 bg-gradient-to-r from-orange-50 to-amber-50 rounded-lg border border-orange-200">
                <p className="text-sm text-orange-900">
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
        <h3 className="text-xl font-bold text-slate-900 mb-4">Temple Today</h3>
        
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
        <h3 className="text-xl font-bold text-slate-900 mb-4">Infrastructure Development</h3>
        
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
        <h3 className="text-xl font-bold text-indigo-900 mb-3">🙏 Community Impact</h3>
        <p className="text-slate-700 leading-relaxed">
          The temple and bridge infrastructure now serve as a vital spiritual and physical connection 
          for villagers, enabling daily rituals and worship. The permanent bridge ensures safe access 
          for all devotees visiting both the river and the sacred Pillayar temple.
        </p>
      </div>
    </section>
  );
};
const CowSamrakshanaContent = () => {
  return (
    <section className="space-y-6">
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="space-y-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-600">
              Divine Service
            </p>
            <h2 className="mt-2 text-3xl font-bold text-slate-900">
              Cow Samrakshana Seva
            </h2>
            <h3 className="mt-1 text-xl text-slate-600">
              கோ சம்ரக்ஷண சேவா
            </h3>
          </div>
          
          <div className="prose prose-slate max-w-none">
            <p className="text-slate-700 leading-relaxed">
              A sacred initiative to protect and care for elderly, non-milking cows, honoring 
              their divine significance and ensuring their dignity in old age.
            </p>
          </div>
        </div>
      </div>
      <div className="rounded-2xl border border-amber-200 bg-gradient-to-br from-amber-50 to-orange-50 p-6 shadow-sm">
        <h3 className="text-xl font-bold text-amber-900 mb-4">🐄 Spiritual Significance of Go Maatha</h3>
        
        <div className="space-y-4">
          <div className="rounded-lg bg-white/70 p-4 border border-amber-200">
            <h4 className="font-semibold text-amber-900 mb-2">Divine Presence</h4>
            <p className="text-sm text-slate-700">
              We all are aware "Cow" is a Holy animal where we see all Devas from Devalokam are 
              residing in. We pray her as <strong>"Go Maatha"</strong>. All 14 lokhas are there inside 
              cow and its 4 legs represents 4 Vedas.
            </p>
          </div>
          <div className="rounded-lg bg-white/70 p-4 border border-amber-200">
            <h4 className="font-semibold text-amber-900 mb-2">Tamil - ஆன்மீக முக்கியத்துவம்</h4>
            <p className="text-sm text-slate-700" lang="ta">
              தேவலோகத்தில் இருக்கும் அனைத்து தேவர்களும் கூட்டமாக பூலோகத்தில் காணப்படும்
              அற்புதமான ஜீவன் பசு. பசுவை கோமாதா என்று அழைக்கிறோம். 14 உலகங்களும் பசுவில்
              உள்ளன. பசுவின் நான்கு கால்கள் நான்கு வேதங்களை குறிக்கின்றன.
            </p>
          </div>
          <div className="rounded-lg bg-gradient-to-r from-amber-100 to-orange-100 p-4 border-2 border-amber-300">
            <h4 className="font-bold text-amber-900 mb-2">🕉️ Sacred Merit</h4>
            <p className="text-sm text-slate-800 font-medium">
              Praying and taking care of Go Maatha is equivalent to pleasing all Devargal. 
              In our Shastras it is explained how to take care of Cow.
            </p>
            <p className="text-sm text-slate-700 mt-2" lang="ta">
              பசுவை வணங்கினால் பாபங்கள் நீங்கும். அப்படிப்பட்ட பசுவை சம்ரக்ஷணம் செய்தால்
              அனைத்து தெய்வங்களையும் வழிபட்ட புண்ணியம் கிடைக்கும்.
            </p>
          </div>
        </div>
      </div>
      <div className="rounded-2xl border border-red-200 bg-white p-6 shadow-sm">
        <h3 className="text-xl font-bold text-slate-900 mb-4">😢 The Problem We Address</h3>
        
        <div className="space-y-3">
          <div className="rounded-lg bg-red-50 border border-red-200 p-4">
            <p className="text-sm text-slate-700">
              <strong>English:</strong> We can see at many places once Cow stops milking at old age, 
              not able to take care & maintain, many sell it off or leave it stranded. Some are taken 
              away to slaughter house, which is one of biggest Sin.
            </p>
          </div>
          <div className="rounded-lg bg-red-50 border border-red-200 p-4">
            <p className="text-sm text-slate-700" lang="ta">
              <strong>தமிழ்:</strong> வயதான பசுக்களை பராமரிப்பதில் மக்கள் பல்வேறு சிரமங்களை
              சந்திக்கின்றனர். அதனால் வயதான பசுக்களை சிலர் கைவிட்டு விடுகின்றனர்; சில
              பசுக்கள் இறைச்சிக்கூடங்களுக்கு கொண்டு செல்லப்படுகின்றன.
            </p>
          </div>
        </div>
      </div>
      <div className="rounded-2xl border border-green-200 bg-white p-6 shadow-sm">
        <h3 className="text-xl font-bold text-slate-900 mb-4">✨ Our Mission & Objectives</h3>
        
        <div className="space-y-4">
          <div className="rounded-lg bg-green-50 border border-green-200 p-4">
            <h4 className="font-semibold text-green-900 mb-2">English</h4>
            <p className="text-sm text-slate-700">
              Keeping all these in mind, our managing committee has planned to start 
              <strong> COW SAMRAKSHANA SEVA</strong>. In this seva we have planned to take care of 
              Old age Cow (non-milking one), take care of their health and feed them till their 
              last breath.
            </p>
          </div>
          <div className="rounded-lg bg-green-50 border border-green-200 p-4">
            <h4 className="font-semibold text-green-900 mb-2">தமிழ்</h4>
            <p className="text-sm text-slate-700" lang="ta">
              இவற்றை மனதில் கொண்டு "கோ சம்ரக்ஷண சேவா" என்ற அமைப்பை தொடங்க நிர்வாக
              குழு தீர்மானித்துள்ளது. இந்த சேவையின் நோக்கம் கைவிடப்பட்ட, உடல்நலக்
              குறைபாடு உள்ள, வயதான மற்றும் பால் தராத பசுக்களுக்கு அடைக்கலம், உணவு,
              மருத்துவ பராமரிப்பு வழங்கி அவற்றின் இறுதி வரை பாதுகாப்பதாகும்.
            </p>
          </div>
          <div className="grid md:grid-cols-3 gap-3 mt-4">
            <div className="rounded-lg bg-blue-50 border border-blue-200 p-3 text-center">
              <div className="text-2xl mb-2">🏠</div>
              <h5 className="font-semibold text-blue-900 text-sm">Shelter</h5>
              <p className="text-xs text-slate-700 mt-1">Safe haven for abandoned elderly cows</p>
            </div>
            <div className="rounded-lg bg-purple-50 border border-purple-200 p-3 text-center">
              <div className="text-2xl mb-2">🏥</div>
              <h5 className="font-semibold text-purple-900 text-sm">Healthcare</h5>
              <p className="text-xs text-slate-700 mt-1">Medical care and treatment</p>
            </div>
            <div className="rounded-lg bg-orange-50 border border-orange-200 p-3 text-center">
              <div className="text-2xl mb-2">🌾</div>
              <h5 className="font-semibold text-orange-900 text-sm">Nutrition</h5>
              <p className="text-xs text-slate-700 mt-1">Daily feeding till last breath</p>
            </div>
          </div>
        </div>
      </div>
      <div className="rounded-2xl border border-blue-200 bg-white p-6 shadow-sm">
        <h3 className="text-xl font-bold text-slate-900 mb-4">📍 Current Operations</h3>
        
        <div className="space-y-4">
          <div className="rounded-lg bg-blue-50 border border-blue-200 p-4">
            <h4 className="font-semibold text-blue-900 mb-2">Cows Under Care</h4>
            <p className="text-sm text-slate-700">
              <strong>English:</strong> As of now we have identified one Cow at our village.
            </p>
            <p className="text-sm text-slate-700 mt-2" lang="ta">
              <strong>தமிழ்:</strong> தற்போது காக்கழனி கிராமத்தில் வயதான, பால் தர இயலாத
              மற்றும் நோய்வாய்ப்பட்ட ஒரு பசு பராமரிப்பில் உள்ளது.
            </p>
          </div>
          <div className="rounded-lg bg-purple-50 border border-purple-200 p-4">
            <h4 className="font-semibold text-purple-900 mb-2">Caretakers</h4>
            <p className="text-sm text-slate-700">
              <strong>English:</strong> Day to day feeding, bathing and coordinate medical aid facility 
              at our village will be taken care by <strong>Mrs. Kovindammal (Rajendran's sister)</strong> and 
              her husband.
            </p>
            <p className="text-sm text-slate-700 mt-2" lang="ta">
              <strong>தமிழ்:</strong> இந்த பசுவை தினசரி பராமரிக்கும் பொறுப்பை திரு.
              இராஜேந்திரன் அவர்களின் சகோதரி திருமதி கோவிந்தம்மாள் மற்றும் அவர்களின்
              கணவர் ஏற்றுக்கொண்டுள்ளனர்.
            </p>
          </div>
          <div className="rounded-lg bg-gradient-to-r from-green-100 to-emerald-100 p-4 border-2 border-green-300">
            <h4 className="font-bold text-green-900 mb-2">💰 Daily Expenses</h4>
            <p className="text-lg font-bold text-green-900">
              Rs 200/day per cow
            </p>
            <p className="text-sm text-slate-700 mt-2">
              <strong>English:</strong> Daily total expense is estimated to be Rs 200/day per cow.
            </p>
            <p className="text-sm text-slate-700 mt-1" lang="ta">
              <strong>தமிழ்:</strong> மாட்டிற்கு தினசரி செலவு ரூ.200/- என மதிப்பிடப்படுகிறது.
              இதற்கு கூடுதலாக மருத்துவச் செலவுகளும் இருக்கும்.
            </p>
          </div>
        </div>
      </div>
      <div className="rounded-2xl border border-indigo-200 bg-gradient-to-br from-indigo-50 to-purple-50 p-6 shadow-sm">
        <h3 className="text-xl font-bold text-indigo-900 mb-4">🙏 How You Can Participate</h3>
        
        <div className="space-y-4">
          <div className="rounded-lg bg-white/70 p-4 border border-indigo-200">
            <h4 className="font-semibold text-indigo-900 mb-2">Monthly Contribution</h4>
            <p className="text-sm text-slate-700">
              <strong>English:</strong> Our earnest APPEAL to all our Donors who wish to participate 
              in this Seva can share their monthly contribution (starting min <strong>Rs 100 p.m. or above</strong> - 
              any amount as per your wish) to same ICICI account where you share your monthly contribution.
            </p>
            <p className="text-sm text-slate-700 mt-2" lang="ta">
              <strong>தமிழ்:</strong> இந்த கோ சம்ரக்ஷண சேவையில் தாங்கள் இணைந்து கொள்ள
              அன்புடன் வரவேற்கிறோம். இந்த சேவையை தொடர்ந்து நடத்த தங்களின் ஈடுபாடு,
              ஒத்துழைப்பு மற்றும் நிதி உதவி அவசியம். தங்களால் இயன்ற மாதாந்திர
              நன்கொடையை மனமுவந்து வழங்குமாறு தாழ்மையுடன் கேட்டுக்கொள்கிறோம்.
            </p>
          </div>
          <div className="rounded-lg bg-gradient-to-r from-indigo-100 to-purple-100 p-4 border-2 border-indigo-300">
            <div className="flex items-center gap-3 mb-3">
              <span className="text-3xl">🤝</span>
              <h4 className="font-bold text-indigo-900">Join This Sacred Seva</h4>
            </div>
            <ul className="space-y-2 text-sm text-slate-700">
              <li className="flex items-start gap-2">
                <span className="text-indigo-600 mt-1">✓</span>
                <span>Minimum contribution: Rs 100 per month</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-indigo-600 mt-1">✓</span>
                <span>Contribute any amount as per your capacity</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-indigo-600 mt-1">✓</span>
                <span>Use the same ICICI account for contributions</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-indigo-600 mt-1">✓</span>
                <span>Contact for account details if needed</span>
              </li>
            </ul>
            <p className="text-xs text-indigo-800 mt-3 italic">
              Looking forward to your participation and support 🙏🙏
            </p>
          </div>
        </div>
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
            <h2 className="mt-2 text-3xl font-bold text-slate-900">
              Lakshmi Narayanar Temple
            </h2>
          </div>
          
          <div className="prose prose-slate max-w-none">
            <div className="rounded-lg bg-amber-50 border border-amber-200 p-4">
              <p className="text-sm text-amber-900">
                <strong>📚 History in Progress:</strong> We are still in the process of collecting history about this temple.
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h3 className="text-xl font-bold text-slate-900 mb-4">Temple Timeline</h3>
        
        <div className="space-y-4">
          <div className="flex gap-4">
            <div className="flex flex-col items-center">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-orange-500 text-white font-bold text-xs">
                2018
              </div>
              <div className="w-0.5 grow bg-gradient-to-b from-orange-500 to-red-500"></div>
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
        <h3 className="text-xl font-bold text-slate-900 mb-4">Temple Location & Architecture</h3>
        
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
        <h3 className="text-xl font-bold text-slate-900 mb-4">Special Features</h3>
        
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
            <h3 className="text-lg font-bold text-indigo-900 mb-2">Temple Images</h3>
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
            <h2 className="mt-2 text-3xl font-bold text-slate-900">
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
        <h3 className="text-xl font-bold text-slate-900 mb-4">Temple Location & Surroundings</h3>
        
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
        <h3 className="text-xl font-bold text-purple-900 mb-4">🎥 Video Documentation</h3>
        
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
        <h3 className="text-xl font-bold text-slate-900 mb-4">Temple Features</h3>
        
        <div className="space-y-4">
          <div className="rounded-lg bg-gradient-to-br from-orange-50 to-amber-50 p-4 border border-orange-200">
            <div className="flex items-start gap-3">
              <span className="text-2xl">🪔</span>
              <div>
                <h4 className="font-semibold text-orange-900 mb-2">Saptakanni</h4>
                <p className="text-sm text-slate-700">
                  In the video you can see <strong>Saptakanni</strong> inside the temple. This is a sacred feature of the temple.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-indigo-200 bg-white p-6 shadow-sm">
        <h3 className="text-xl font-bold text-slate-900 mb-4">Important Poojas & Rituals</h3>
        
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
            <h3 className="text-lg font-bold text-green-900 mb-2">Temple Gallery</h3>
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

      <div className="rounded-2xl border border-amber-200 bg-gradient-to-br from-amber-50 to-orange-50 p-6 shadow-sm">
        <div className="flex items-center gap-3 mb-3">
          <span className="text-3xl">📞</span>
          <h3 className="text-lg font-bold text-amber-900">Contact for More Information</h3>
        </div>
        <p className="text-sm text-slate-700 leading-relaxed">
          For detailed information about special poojas like "Palayam" and to schedule worship services, 
          please contact the temple authorities or the community group managing the temple activities.
        </p>
      </div>
    </section>
  );
};
const PoojaSevasContent = () => {
  return (
    <section className="space-y-6">
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="space-y-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-600">
              Temple Services
            </p>
            <h2 className="mt-2 text-3xl font-bold text-slate-900">
              Sevas at Our Kakkalany Village Temples
            </h2>
          </div>
          
          <div className="prose prose-slate max-w-none">
            <p className="text-slate-700 leading-relaxed">
              Various pooja services available at our village temples. Participate in sacred rituals 
              and seek divine blessings through these traditional sevas.
            </p>
          </div>
        </div>
      </div>
      {/* General Pooja */}
      <div className="rounded-2xl border border-purple-200 bg-white p-6 shadow-sm">
        <h3 className="text-xl font-bold text-purple-900 mb-4 flex items-center gap-2">
          <span className="text-2xl">🪔</span>
          General Pooja
        </h3>
        
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b-2 border-purple-200 bg-purple-50">
                <th className="text-left p-3 font-semibold text-purple-900">Pooja Description</th>
                <th className="text-right p-3 font-semibold text-purple-900">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              <tr className="hover:bg-purple-50/50">
                <td className="p-3 text-slate-700">Till Oil for Lamps</td>
                <td className="p-3 text-right font-semibold text-slate-900">Rs 100 to 4000 p.m</td>
              </tr>
              <tr className="hover:bg-purple-50/50">
                <td className="p-3 text-slate-700">2 Pradosha Pooja per month</td>
                <td className="p-3 text-right font-semibold text-slate-900">Rs 100 to 3000 p.m</td>
              </tr>
              <tr className="hover:bg-purple-50/50">
                <td className="p-3 text-slate-700">4 Saturday Navagraha pooja per month</td>
                <td className="p-3 text-right font-semibold text-slate-900">Rs 100 to 1500 p.m</td>
              </tr>
              <tr className="hover:bg-purple-50/50">
                <td className="p-3 text-slate-700">Gau Samrakshana Seva</td>
                <td className="p-3 text-right font-semibold text-slate-900">Rs 100 to 5000 p.m</td>
              </tr>
              <tr className="hover:bg-purple-50/50">
                <td className="p-3 text-slate-700">Nitya Neivedhyam in all temples</td>
                <td className="p-3 text-right font-semibold text-slate-900">Rs 100 to 10000 p.m</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
      {/* One Day Archana */}
      <div className="rounded-2xl border border-blue-200 bg-white p-6 shadow-sm">
        <h3 className="text-xl font-bold text-blue-900 mb-4 flex items-center gap-2">
          <span className="text-2xl">🙏</span>
          One Day Archana
        </h3>
        
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b-2 border-blue-200 bg-blue-50">
                <th className="text-left p-3 font-semibold text-blue-900">Pooja Description</th>
                <th className="text-right p-3 font-semibold text-blue-900">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              <tr className="hover:bg-blue-50/50">
                <td className="p-3 text-slate-700">Pillayar Koil</td>
                <td className="p-3 text-right font-semibold text-slate-900">Rs 100 p.m</td>
              </tr>
              <tr className="hover:bg-blue-50/50">
                <td className="p-3 text-slate-700">Pillayar Koil on Chaturthi day</td>
                <td className="p-3 text-right font-semibold text-slate-900">Rs 100 p.m</td>
              </tr>
              <tr className="hover:bg-blue-50/50">
                <td className="p-3 text-slate-700">Pillayar Koil on Sankatachaturthi day</td>
                <td className="p-3 text-right font-semibold text-slate-900">Rs 100 p.m</td>
              </tr>
              <tr className="hover:bg-blue-50/50">
                <td className="p-3 text-slate-700">Shivan Koil (for Lord Shiva + Ambal)</td>
                <td className="p-3 text-right font-semibold text-slate-900">Rs 200 p.m</td>
              </tr>
              <tr className="hover:bg-blue-50/50">
                <td className="p-3 text-slate-700">Kalabhairavar 1 day archana</td>
                <td className="p-3 text-right font-semibold text-slate-900">Rs 100 p.m</td>
              </tr>
              <tr className="hover:bg-blue-50/50">
                <td className="p-3 text-slate-700">Kalabhairavar archana on 2 ashtami</td>
                <td className="p-3 text-right font-semibold text-slate-900">Rs 200 p.m</td>
              </tr>
              <tr className="hover:bg-blue-50/50">
                <td className="p-3 text-slate-700">Kasi Viswanathar 1 day archana</td>
                <td className="p-3 text-right font-semibold text-slate-900">Rs 100 p.m</td>
              </tr>
              <tr className="hover:bg-blue-50/50">
                <td className="p-3 text-slate-700">Subramanya swamy 1 day archana</td>
                <td className="p-3 text-right font-semibold text-slate-900">Rs 100 p.m</td>
              </tr>
              <tr className="hover:bg-blue-50/50">
                <td className="p-3 text-slate-700">Ayyanar 1 day archana</td>
                <td className="p-3 text-right font-semibold text-slate-900">Rs 100 p.m</td>
              </tr>
              <tr className="hover:bg-blue-50/50">
                <td className="p-3 text-slate-700">Saptakanni 1 day archana at Ayyanar koil</td>
                <td className="p-3 text-right font-semibold text-slate-900">Rs 100 p.m</td>
              </tr>
              <tr className="hover:bg-blue-50/50">
                <td className="p-3 text-slate-700">Perumal Koil 1 day archana</td>
                <td className="p-3 text-right font-semibold text-slate-900">Rs 100 p.m</td>
              </tr>
              <tr className="hover:bg-blue-50/50">
                <td className="p-3 text-slate-700">Aanjaneyar archana 1st Tue of month at perumal koil</td>
                <td className="p-3 text-right font-semibold text-slate-900">Rs 100 p.m</td>
              </tr>
              <tr className="hover:bg-blue-50/50">
                <td className="p-3 text-slate-700">Aanjaneyar archana last Sat of month at perumal koil</td>
                <td className="p-3 text-right font-semibold text-slate-900">Rs 100 p.m</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
      {/* One Day Abishekam */}
      <div className="rounded-2xl border border-green-200 bg-white p-6 shadow-sm">
        <h3 className="text-xl font-bold text-green-900 mb-4 flex items-center gap-2">
          <span className="text-2xl">💧</span>
          One Day Abishekam
        </h3>
        
        <div className="grid md:grid-cols-2 gap-4">
          <div className="rounded-lg bg-green-50 border border-green-200 p-4">
            <div className="flex items-start gap-3">
              <span className="mt-1 h-2.5 w-2.5 rounded-full bg-green-600 shrink-0" />
              <div>
                <h4 className="font-semibold text-green-900">Pillayar Koil 1 day abishekam</h4>
              </div>
            </div>
          </div>
          <div className="rounded-lg bg-green-50 border border-green-200 p-4">
            <div className="flex items-start gap-3">
              <span className="mt-1 h-2.5 w-2.5 rounded-full bg-green-600 shrink-0" />
              <div>
                <h4 className="font-semibold text-green-900">Shivan Koil (for Lord Shiva + Ambal)</h4>
              </div>
            </div>
          </div>
          <div className="rounded-lg bg-green-50 border border-green-200 p-4">
            <div className="flex items-start gap-3">
              <span className="mt-1 h-2.5 w-2.5 rounded-full bg-green-600 shrink-0" />
              <div>
                <h4 className="font-semibold text-green-900">Kasi Viswanathar 1 day abishekam</h4>
              </div>
            </div>
          </div>
          <div className="rounded-lg bg-green-50 border border-green-200 p-4">
            <div className="flex items-start gap-3">
              <span className="mt-1 h-2.5 w-2.5 rounded-full bg-green-600 shrink-0" />
              <div>
                <h4 className="font-semibold text-green-900">Subramanya swamy 1 day abishekam</h4>
              </div>
            </div>
          </div>
          <div className="rounded-lg bg-green-50 border border-green-200 p-4">
            <div className="flex items-start gap-3">
              <span className="mt-1 h-2.5 w-2.5 rounded-full bg-green-600 shrink-0" />
              <div>
                <h4 className="font-semibold text-green-900">Ayyanar 1 day abishekam</h4>
              </div>
            </div>
          </div>
          <div className="rounded-lg bg-green-50 border border-green-200 p-4">
            <div className="flex items-start gap-3">
              <span className="mt-1 h-2.5 w-2.5 rounded-full bg-green-600 shrink-0" />
              <div>
                <h4 className="font-semibold text-green-900">Perumal Koil 1 day abishekam</h4>
              </div>
            </div>
          </div>
        </div>
      </div>
      {/* Special Poojas */}
      <div className="rounded-2xl border border-orange-200 bg-white p-6 shadow-sm">
        <h3 className="text-xl font-bold text-orange-900 mb-4 flex items-center gap-2">
          <span className="text-2xl">⭐</span>
          Special Poojas
        </h3>
        
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b-2 border-orange-200 bg-orange-50">
                <th className="text-left p-3 font-semibold text-orange-900">Pooja Description</th>
                <th className="text-right p-3 font-semibold text-orange-900">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              <tr className="hover:bg-orange-50/50">
                <td className="p-3 text-slate-700">1 day pooja during Navarathri</td>
                <td className="p-3 text-right font-semibold text-slate-900">Rs 1500</td>
              </tr>
              <tr className="hover:bg-orange-50/50">
                <td className="p-3 text-slate-700">Aarudhra darsanam pooja</td>
                <td className="p-3 text-right font-semibold text-slate-900">Min 200 up to 2500</td>
              </tr>
              <tr className="hover:bg-orange-50/50">
                <td className="p-3 text-slate-700">Mahashivratri pooja - 1 kaala pooja out of 4 kaalam</td>
                <td className="p-3 text-right font-semibold text-slate-900">Min 100 to Rs 1500</td>
              </tr>
              <tr className="hover:bg-orange-50/50">
                <td className="p-3 text-slate-700">Vastra seva on Diwali day <span className="text-xs text-slate-500">(actual to be checked before Diwali)</span></td>
                <td className="p-3 text-right font-semibold text-slate-900">Approx. Rs 6000</td>
              </tr>
              <tr className="hover:bg-orange-50/50">
                <td className="p-3 text-slate-700">Natarajar Abishekam</td>
                <td className="p-3 text-right font-semibold text-slate-900">Rs 500</td>
              </tr>
              <tr className="hover:bg-orange-50/50">
                <td className="p-3 text-slate-700">Chandana Kappu to Ayyanar</td>
                <td className="p-3 text-right font-semibold text-slate-900">On actual</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
      <div className="rounded-2xl border border-indigo-200 bg-gradient-to-br from-indigo-50 to-purple-50 p-6 shadow-sm">
        <div className="flex items-start gap-3">
          <span className="text-3xl">📝</span>
          <div>
            <h3 className="text-lg font-bold text-indigo-900 mb-2">How to Participate</h3>
            <p className="text-sm text-slate-700 leading-relaxed">
              To participate in any of these sevas, please contact the temple management. 
              Contributions can be made through the designated ICICI account. For specific pooja 
              bookings and scheduling, please reach out to the temple authorities.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
};
export default KovilDetailsPage;
