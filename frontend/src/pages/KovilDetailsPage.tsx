import React, { useMemo, useState } from "react";

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
                    <p className="text-xs text-purple-700 italic">📷 Picture 1: Temple entrance view</p>
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
                    <p className="text-xs text-blue-700 italic">📷 Picture 2: Side view with gopuram</p>
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
                  <p className="text-xs text-emerald-700 italic">📷 Picture 3: Lord Ganapathy Sannadhi</p>
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
            <p className="text-xs text-indigo-700 italic">📷 Temple images showing the renovated structure post-kumbabishekam</p>
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
              <p className="text-xs text-red-700 italic">📷 Images showing the broken canal shutter gate condition</p>
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
              <p className="text-xs text-green-700 italic">📷 Images showing the new permanent GI bridge structure</p>
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
              ேகாஸம் ர�ன ேசவா
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
              ேதவேலாகத்�ல் இ�க்�ன் ற அைனத்� ேதவர்க�ம் �ம்பமாக �ேலாகத்�ல் காண் �ன் ற
              அற்�தமான �வன் ப�. ப�ைவ ேகா மாதா என்� அைழக்�ன் ேறாம். 14 ேலாகங்க�ம்
              ப��டம் உள்ளன. ப��ன் 4 கால்க�ம் நான்� ேவதங்கள்.
            </p>
          </div>

          <div className="rounded-lg bg-gradient-to-r from-amber-100 to-orange-100 p-4 border-2 border-amber-300">
            <h4 className="font-bold text-amber-900 mb-2">🕉️ Sacred Merit</h4>
            <p className="text-sm text-slate-800 font-medium">
              Praying and taking care of Go Maatha is equivalent to pleasing all Devargal. 
              In our Shastras it is explained how to take care of Cow.
            </p>
            <p className="text-sm text-slate-700 mt-2" lang="ta">
              ப�ைவ வணங்�னால் பாபங்கள் நிவர்த்� ஆ�ம். அப்ப�பட்ட ப�ைவ ஸம்ர�ணம் 
              ெசய்தால் அைனத்� ெதய்வங்கைள�ம் வ�பட்ட �ண் யம் �ைடக்�ன் ற�.
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
              <strong>தமிழ்:</strong> வயதான ப�க்கைள பராமரிப்ப�ல் மக்கள் பல்ேவ� �ரமங்கைள 
              சந்�த்� வ��ன் றனர். அதனால் வயதான ப�க்கைள இைறச்� �டங்க�க்� �ற்����றார்கள்
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
              இைவகைள மன�ல் ெகாண் � ேகா ஸம் ர�ண ேசவா என் �ற அைமப்ைப
              ெதாடங் கலாம் என்� �ர்மானிக்கப்பட்�ள்ள�. இந்த ேசவா�ன் ஒேர ேநாக்கம்
              ைக�டப்பட்ட, உடல்ஊன�ற்ற, வயதான கரைவ நின் ற,ேநாய்வாய் பட்ட
              ப�க்கைள அைடக்கலம் ெகா�த்� அைவகளின் உ�ர்�ரி�ம் வைர நன்�ைற�ல்
              பராமரிப்ப�. �வனங் கள் ெகா�த்� த�ந்த ம�த்�வம் ெசய்� காப்ப�.
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
              <strong>தமிழ்:</strong> தற்ெபா�� காக்கழனி �ராமத்�ல் ஒ� வயதான பால் தர இயலாத 
              மா�ம் ேநாய்வாய்ப்பட்ட கன்�ம் உள்ள�.
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
              <strong>தமிழ்:</strong> இைவகைள பராமரிக்க ��. இராேஜந்�ரன் சேகாதரி �ன்வந்�ள்ளார்.
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
              <strong>தமிழ்:</strong> மாட்� �வனம் நாள் ஒன்�க்� �பாய் 200/- ஆ�ம் என்� எ�ர்பார்க்கப்ப��ற�. 
              ம�த்�வ ெசல�கள் ேவ�.
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
              <strong>தமிழ்:</strong> இந்த ேகா ஸம்ர�ணேசைவ�ல் தாங்கள் இைணந்� ெகாள்ள
              வரேவரற்�ேறாம். இந்த ஸம்ர�ணேசவாைவ நன்�ைற�ல் நடத்த தங்களின் ஈ�பா�ம்
              ஒத்�ைழப்�ம் நி� உத��ம் ேதைவ. இயன் ற நி� உத�ைய மன�வந்� வழங்�மா�
              தாழ்ைமேயா� பணிவன் �டன் ேகட்�க்ெகாள்�ேறன்
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
                <th className="text-left p-3 font-semibold text-purple-900">Code</th>
                <th className="text-left p-3 font-semibold text-purple-900">Pooja Description</th>
                <th className="text-right p-3 font-semibold text-purple-900">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              <tr className="hover:bg-purple-50/50">
                <td className="p-3 font-mono font-semibold text-purple-700">G1</td>
                <td className="p-3 text-slate-700">Till Oil for Lamps</td>
                <td className="p-3 text-right font-semibold text-slate-900">Rs 100 to 4000 p.m</td>
              </tr>
              <tr className="hover:bg-purple-50/50">
                <td className="p-3 font-mono font-semibold text-purple-700">G2</td>
                <td className="p-3 text-slate-700">2 Pradosha Pooja per month</td>
                <td className="p-3 text-right font-semibold text-slate-900">Rs 100 to 3000 p.m</td>
              </tr>
              <tr className="hover:bg-purple-50/50">
                <td className="p-3 font-mono font-semibold text-purple-700">G3</td>
                <td className="p-3 text-slate-700">4 Saturday Navagraha pooja per month</td>
                <td className="p-3 text-right font-semibold text-slate-900">Rs 100 to 1500 p.m</td>
              </tr>
              <tr className="hover:bg-purple-50/50">
                <td className="p-3 font-mono font-semibold text-purple-700">G4</td>
                <td className="p-3 text-slate-700">Gau Samrakshana Seva</td>
                <td className="p-3 text-right font-semibold text-slate-900">Rs 100 to 5000 p.m</td>
              </tr>
              <tr className="hover:bg-purple-50/50">
                <td className="p-3 font-mono font-semibold text-purple-700">G5</td>
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
                <th className="text-left p-3 font-semibold text-blue-900">Code</th>
                <th className="text-left p-3 font-semibold text-blue-900">Pooja Description</th>
                <th className="text-right p-3 font-semibold text-blue-900">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              <tr className="hover:bg-blue-50/50">
                <td className="p-3 font-mono font-semibold text-blue-700">AR</td>
                <td className="p-3 text-slate-700">Pillayar Koil</td>
                <td className="p-3 text-right font-semibold text-slate-900">Rs 100 p.m</td>
              </tr>
              <tr className="hover:bg-blue-50/50">
                <td className="p-3 font-mono font-semibold text-blue-700">AR</td>
                <td className="p-3 text-slate-700">Pillayar Koil on Chaturthi day</td>
                <td className="p-3 text-right font-semibold text-slate-900">Rs 100 p.m</td>
              </tr>
              <tr className="hover:bg-blue-50/50">
                <td className="p-3 font-mono font-semibold text-blue-700">AR</td>
                <td className="p-3 text-slate-700">Pillayar Koil on Sankatachaturthi day</td>
                <td className="p-3 text-right font-semibold text-slate-900">Rs 100 p.m</td>
              </tr>
              <tr className="hover:bg-blue-50/50">
                <td className="p-3 font-mono font-semibold text-blue-700">AR</td>
                <td className="p-3 text-slate-700">Shivan Koil (for Lord Shiva + Ambal)</td>
                <td className="p-3 text-right font-semibold text-slate-900">Rs 200 p.m</td>
              </tr>
              <tr className="hover:bg-blue-50/50">
                <td className="p-3 font-mono font-semibold text-blue-700">AR</td>
                <td className="p-3 text-slate-700">Kalabhairavar 1 day archana</td>
                <td className="p-3 text-right font-semibold text-slate-900">Rs 100 p.m</td>
              </tr>
              <tr className="hover:bg-blue-50/50">
                <td className="p-3 font-mono font-semibold text-blue-700">AR</td>
                <td className="p-3 text-slate-700">Kalabhairavar archana on 2 ashtami</td>
                <td className="p-3 text-right font-semibold text-slate-900">Rs 200 p.m</td>
              </tr>
              <tr className="hover:bg-blue-50/50">
                <td className="p-3 font-mono font-semibold text-blue-700">AR</td>
                <td className="p-3 text-slate-700">Kasi Viswanathar 1 day archana</td>
                <td className="p-3 text-right font-semibold text-slate-900">Rs 100 p.m</td>
              </tr>
              <tr className="hover:bg-blue-50/50">
                <td className="p-3 font-mono font-semibold text-blue-700">AR</td>
                <td className="p-3 text-slate-700">Subramanya swamy 1 day archana</td>
                <td className="p-3 text-right font-semibold text-slate-900">Rs 100 p.m</td>
              </tr>
              <tr className="hover:bg-blue-50/50">
                <td className="p-3 font-mono font-semibold text-blue-700">AR</td>
                <td className="p-3 text-slate-700">Ayyanar 1 day archana</td>
                <td className="p-3 text-right font-semibold text-slate-900">Rs 100 p.m</td>
              </tr>
              <tr className="hover:bg-blue-50/50">
                <td className="p-3 font-mono font-semibold text-blue-700">AR</td>
                <td className="p-3 text-slate-700">Saptakanni 1 day archana at Ayyanar koil</td>
                <td className="p-3 text-right font-semibold text-slate-900">Rs 100 p.m</td>
              </tr>
              <tr className="hover:bg-blue-50/50">
                <td className="p-3 font-mono font-semibold text-blue-700">AR</td>
                <td className="p-3 text-slate-700">Perumal Koil 1 day archana</td>
                <td className="p-3 text-right font-semibold text-slate-900">Rs 100 p.m</td>
              </tr>
              <tr className="hover:bg-blue-50/50">
                <td className="p-3 font-mono font-semibold text-blue-700">AR</td>
                <td className="p-3 text-slate-700">Aanjaneyar archana 1st Tue of month at perumal koil</td>
                <td className="p-3 text-right font-semibold text-slate-900">Rs 100 p.m</td>
              </tr>
              <tr className="hover:bg-blue-50/50">
                <td className="p-3 font-mono font-semibold text-blue-700">AR</td>
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
                <p className="text-xs text-slate-600 mt-1 font-mono">Code: AB</p>
              </div>
            </div>
          </div>
          <div className="rounded-lg bg-green-50 border border-green-200 p-4">
            <div className="flex items-start gap-3">
              <span className="mt-1 h-2.5 w-2.5 rounded-full bg-green-600 shrink-0" />
              <div>
                <h4 className="font-semibold text-green-900">Shivan Koil (for Lord Shiva + Ambal)</h4>
                <p className="text-xs text-slate-600 mt-1 font-mono">Code: AB</p>
              </div>
            </div>
          </div>
          <div className="rounded-lg bg-green-50 border border-green-200 p-4">
            <div className="flex items-start gap-3">
              <span className="mt-1 h-2.5 w-2.5 rounded-full bg-green-600 shrink-0" />
              <div>
                <h4 className="font-semibold text-green-900">Kasi Viswanathar 1 day abishekam</h4>
                <p className="text-xs text-slate-600 mt-1 font-mono">Code: AB</p>
              </div>
            </div>
          </div>
          <div className="rounded-lg bg-green-50 border border-green-200 p-4">
            <div className="flex items-start gap-3">
              <span className="mt-1 h-2.5 w-2.5 rounded-full bg-green-600 shrink-0" />
              <div>
                <h4 className="font-semibold text-green-900">Subramanya swamy 1 day abishekam</h4>
                <p className="text-xs text-slate-600 mt-1 font-mono">Code: AB</p>
              </div>
            </div>
          </div>
          <div className="rounded-lg bg-green-50 border border-green-200 p-4">
            <div className="flex items-start gap-3">
              <span className="mt-1 h-2.5 w-2.5 rounded-full bg-green-600 shrink-0" />
              <div>
                <h4 className="font-semibold text-green-900">Ayyanar 1 day abishekam</h4>
                <p className="text-xs text-slate-600 mt-1 font-mono">Code: AB</p>
              </div>
            </div>
          </div>
          <div className="rounded-lg bg-green-50 border border-green-200 p-4">
            <div className="flex items-start gap-3">
              <span className="mt-1 h-2.5 w-2.5 rounded-full bg-green-600 shrink-0" />
              <div>
                <h4 className="font-semibold text-green-900">Perumal Koil 1 day abishekam</h4>
                <p className="text-xs text-slate-600 mt-1 font-mono">Code: AB</p>
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
                <th className="text-left p-3 font-semibold text-orange-900">Code</th>
                <th className="text-left p-3 font-semibold text-orange-900">Pooja Description</th>
                <th className="text-right p-3 font-semibold text-orange-900">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              <tr className="hover:bg-orange-50/50">
                <td className="p-3 font-mono font-semibold text-orange-700">SP</td>
                <td className="p-3 text-slate-700">1 day pooja during Navarathri</td>
                <td className="p-3 text-right font-semibold text-slate-900">Rs 1500</td>
              </tr>
              <tr className="hover:bg-orange-50/50">
                <td className="p-3 font-mono font-semibold text-orange-700">SP</td>
                <td className="p-3 text-slate-700">Aarudhra darsanam pooja</td>
                <td className="p-3 text-right font-semibold text-slate-900">Min 200 up to 2500</td>
              </tr>
              <tr className="hover:bg-orange-50/50">
                <td className="p-3 font-mono font-semibold text-orange-700">SP</td>
                <td className="p-3 text-slate-700">Mahashivratri pooja - 1 kaala pooja out of 4 kaalam</td>
                <td className="p-3 text-right font-semibold text-slate-900">Min 100 to Rs 1500</td>
              </tr>
              <tr className="hover:bg-orange-50/50">
                <td className="p-3 font-mono font-semibold text-orange-700">SP</td>
                <td className="p-3 text-slate-700">Vastra seva on Diwali day <span className="text-xs text-slate-500">(actual to be checked before Diwali)</span></td>
                <td className="p-3 text-right font-semibold text-slate-900">Approx. Rs 6000</td>
              </tr>
              <tr className="hover:bg-orange-50/50">
                <td className="p-3 font-mono font-semibold text-orange-700">SP</td>
                <td className="p-3 text-slate-700">Natarajar Abishekam</td>
                <td className="p-3 text-right font-semibold text-slate-900">Rs 500</td>
              </tr>
              <tr className="hover:bg-orange-50/50">
                <td className="p-3 font-mono font-semibold text-orange-700">SP</td>
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
