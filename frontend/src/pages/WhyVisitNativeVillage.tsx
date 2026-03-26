import { useState } from "react";
import PublicSiteHeader from "../components/PublicSiteHeader";
import EnglishTamilToggle from "../components/EnglishTamilToggle";

const BlessingIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M8.1 8.8l1.9 2.1 2-2.1" />
    <path d="M6.3 10.6L4.6 16c-.4 1.3.5 2.6 1.9 2.6h2.2" />
    <path d="M17.7 10.6l1.7 5.4c.4 1.3-.5 2.6-1.9 2.6h-2.2" />
    <path d="M10 11.1V19h4v-7.9" />
  </svg>
);

const TempleIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.85" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M12 3l2.3 2.2L12 7.4 9.7 5.2 12 3Z" />
    <path d="M8.2 8.2h7.6l-.9 2.2h-5.8l-.9-2.2Z" />
    <path d="M7.2 12h9.6v8H7.2z" />
    <path d="M10.5 20v-4h3v4" />
  </svg>
);

const VillageDutyIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M12 3v18" />
    <path d="M7 8c0-2 1.6-3.5 3.6-3.5H12v7.2h-1.8C8.4 11.7 7 10.1 7 8Z" />
    <path d="M17 12.4c0 2.1-1.4 3.6-3.2 3.6H12V9.2h1.4c2 0 3.6 1.4 3.6 3.2Z" />
  </svg>
);

type TabKey = "blessings" | "honors" | "importance";

const honorsProjectList = [
  "Rourkela Steel Plant[5]",
  "Kandla Port[6]",
  "Malaviya Bridge at Varanasi[7][8]",
  "Chittaranjan Loco Works[6]",
  "Perambur Integral Coach factory[6]",
  "Vivekananda Setu, Kolkata (as Deputy)",
  "Churchgate Railway Station and other Western Railway projects[9][10]",
];

const honorsAwardList = [
  "Railway Board Gold Medal, 1950",
  "Viceroy's Prize from Institution of Engineers India, 1953",
  "Padma Bhushan (1954)",
];

const WhyVisitNativeVillage = () => {
  const [activeTab, setActiveTab] = useState<TabKey>("blessings");

  return (
    <div className="min-h-screen bg-[#f7f1e6] village-typography">
      <PublicSiteHeader variant="amber" />

      <main className="relative overflow-x-hidden senior-readable-content">
        {/* English / Tamil Toggle — top right, matching About Kovil style */}
        <div className="absolute top-5 right-4 sm:top-6 sm:right-[5%] z-10">
          <EnglishTamilToggle />
        </div>

        {/* Decorative background elements */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-20 right-10 w-32 h-32 sm:w-64 sm:h-64 bg-[#a33a2b]/10 rounded-full blur-3xl" />
          <div className="absolute bottom-20 left-10 w-48 h-48 sm:w-96 sm:h-96 bg-[#7e2a20]/10 rounded-full blur-3xl" />
        </div>

        <div className="relative min-h-[70vh] px-4 pt-14 pb-8 sm:px-6 sm:pt-16 sm:pb-10 md:pt-16 md:pb-12 lg:px-8">
          <div className="max-w-5xl mx-auto space-y-6 sm:space-y-8 md:space-y-10">
            <div className="bg-[#fffdf8] rounded-2xl sm:rounded-3xl border border-[#efd9cf] p-2 sm:p-3 shadow-sm">
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                <button
                  type="button"
                  onClick={() => setActiveTab("blessings")}
                  className={`tab-button ${activeTab === "blessings" ? "tab-button-active" : ""}`}
                  role="tab"
                  aria-selected={activeTab === "blessings"}
                >
                  <span className="tab-button-icon"><BlessingIcon /></span>
                  <span>Blessings Of MahaPeriyava &amp; Ramana Maharishi</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab("honors")}
                  className={`tab-button ${activeTab === "honors" ? "tab-button-active" : ""}`}
                  role="tab"
                  aria-selected={activeTab === "honors"}
                >
                  <span className="tab-button-icon"><TempleIcon /></span>
                  <span>Arunachala Iyer family Honors</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab("importance")}
                  className={`tab-button ${activeTab === "importance" ? "tab-button-active" : ""}`}
                  role="tab"
                  aria-selected={activeTab === "importance"}
                >
                  <span className="tab-button-icon"><VillageDutyIcon /></span>
                  <span>Importance of visiting our village</span>
                </button>
              </div>
            </div>

            {activeTab === "blessings" && (
              <div className="space-y-6 sm:space-y-8 md:space-y-10">
                {/* Header Section */}
                <header className="space-y-3 sm:space-y-4 text-center px-2">
                  <h1 className="font-serif text-xl sm:text-2xl md:text-3xl lg:text-4xl font-bold text-[#2e2018] leading-tight break-words">
                    Vijayam of Kanchi Shri Mahaperiyava to Kakkalani Village
                  </h1>

                  <div className="h-1 w-16 sm:w-20 rounded-full mx-auto mt-3" style={{ background: "linear-gradient(to right, #a33a2b, #7e2a20)" }} />
                </header>

                {/* First Vijayam Section */}
                <section className="space-y-4 sm:space-y-5">
                  <div className="flex items-start gap-3 sm:gap-4 mb-4 sm:mb-5">
                    <div className="flex-shrink-0 w-10 h-10 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl flex items-center justify-center text-xl sm:text-2xl" style={{ background: "#efd9cf" }}>
                      <BlessingIcon />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h2 className="font-serif text-lg sm:text-xl md:text-2xl font-bold text-[#2e2018] mb-1.5 sm:mb-2 break-words">
                        First Vijayam (around 1920)
                      </h2>
                      <div className="h-1 w-12 sm:w-16 rounded-full" style={{ background: "linear-gradient(to right, #a33a2b, #7e2a20)" }} />
                    </div>
                  </div>

                  <div className="space-y-3 sm:space-y-4 text-[#5f4636]">
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

                    <div className="mt-4 sm:mt-5">
                      <p className="text-xs sm:text-sm font-medium text-[#7a5e4b] flex items-start gap-2 mb-2 sm:mb-3">
                        <svg className="w-4 h-4 sm:w-5 sm:h-5 text-[#a33a2b] flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15.536a5 5 0 001.414 1.414m2.828-9.9a9 9 0 012.828 2.828" />
                        </svg>
                        <span className="break-all">
                          <span className="font-semibold text-[#5f4636]">Audio Reference</span>
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
                <section className="space-y-4 sm:space-y-5 pt-6 border-t border-[#e7d8cc]">
                  <div className="flex items-start gap-3 sm:gap-4 mb-4 sm:mb-5">
                    <div className="flex-shrink-0 w-10 h-10 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl flex items-center justify-center text-xl sm:text-2xl" style={{ background: "#efd9cf" }}>
                      <TempleIcon />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h2 className="font-serif text-lg sm:text-xl md:text-2xl font-bold text-[#2e2018] mb-1.5 sm:mb-2 break-words">
                        Second Vijayam (1954)
                      </h2>
                      <div className="h-1 w-12 sm:w-16 rounded-full" style={{ background: "linear-gradient(to right, #a33a2b, #7e2a20)" }} />
                    </div>
                  </div>

                  <div className="space-y-3 sm:space-y-4 text-[#5f4636]">
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

                    <div className="mt-4 sm:mt-5">
                      <p className="text-xs sm:text-sm text-[#7a5e4b] flex items-start gap-2">
                        <svg className="w-4 h-4 sm:w-5 sm:h-5 text-[#a33a2b] flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
              </div>
            )}

            {activeTab === "honors" && (
              <div className="space-y-6 sm:space-y-8">
                <header className="space-y-3 sm:space-y-4 text-center px-2">
                  <h1 className="font-serif text-xl sm:text-2xl md:text-3xl lg:text-4xl font-bold text-[#2e2018] leading-tight break-words">
                    Arunachala Iyer Family Honors
                  </h1>
                  <div className="h-1 w-16 sm:w-20 rounded-full mx-auto mt-3" style={{ background: "linear-gradient(to right, #a33a2b, #7e2a20)" }} />
                </header>

                <section className="space-y-4">
                  <img
                    src="/images/WhyVisitNativeVillage/image1.png"
                    alt="Arunachalam Iyer family group photograph"
                    className="w-full rounded-xl honors-family-image"
                  />
                  <p className="text-sm sm:text-base text-[#5f4636]">
                    (Center -Mr A Sundaresan, Rigjlht side wearing angavastram Mr M Ganapathy,
                  </p>
                  <p className="text-sm sm:text-base text-[#5f4636]">
                    Left side Mr A Vaidyanathan, Behind Ganapathy Dr A Srinivasan
                  </p>
                  <p className="text-sm sm:text-base text-[#5f4636]">
                    Behind Vaidyanathan Mr Ramaswamy )
                  </p>
                </section>

                <section className="space-y-4 pt-6 border-t border-[#e7d8cc]">
                  <h2 className="font-serif text-lg sm:text-xl md:text-2xl font-bold text-[#2e2018]">
                    Mr Ganapathy Received Padma Bhushan Award in the year 1954
                  </h2>
                  <p className="text-sm sm:text-base md:text-lg text-[#5f4636] leading-relaxed">
                    Mahadeva Iyer Ganapati (known as M. Ganapati) (1903-1976)[1][2] was an Indian engineer who was well known for his accomplishments in national projects. The Rourkela Steel Plant in Orissa,[3] and many Railway projects including Churchgate railway station in Mumbai and Chittaranjan Locomotive Works (CLW) were completed under his leadership. The Indian government awarded him the inaugural Padma Bhushan in 1954. He was the president of the Institution of Engineers (India) for 1973-74.
                  </p>
                  <h3 className="font-serif text-base sm:text-lg md:text-xl font-bold text-[#2e2018]">
                    The main projects with which he was associated with are:
                  </h3>
                  <ul className="space-y-2 text-sm sm:text-base md:text-lg text-[#5f4636] list-disc pl-6">
                    {honorsProjectList.map((project) => (
                      <li key={project}>{project}</li>
                    ))}
                  </ul>
                  <h3 className="font-serif text-base sm:text-lg md:text-xl font-bold text-[#2e2018]">
                    Awards and Honors
                  </h3>
                  <ul className="space-y-2 text-sm sm:text-base md:text-lg text-[#5f4636] list-disc pl-6">
                    {honorsAwardList.map((award) => (
                      <li key={award}>{award}</li>
                    ))}
                  </ul>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <img src="/images/WhyVisitNativeVillage/image2.png" alt="Padma Bhushan award reference 1" className="w-full rounded-xl" />
                    <img src="/images/WhyVisitNativeVillage/image3.png" alt="Padma Bhushan award reference 2" className="w-full rounded-xl" />
                  </div>
                </section>

                <section className="space-y-4 pt-6 border-t border-[#e7d8cc]">
                  <h2 className="font-serif text-lg sm:text-xl md:text-2xl font-bold text-[#2e2018]">
                    Mr Arunachala Srinivasan Received Padma Bhushan Award in the year 1974
                  </h2>
                  <img
                    src="/images/WhyVisitNativeVillage/image4.png"
                    alt="Mr Arunachala Srinivasan Padma Bhushan reference"
                    className="w-full rounded-xl honors-award-image"
                  />
                </section>

                <section className="space-y-4 pt-6 border-t border-[#e7d8cc]">
                  <h2 className="font-serif text-lg sm:text-xl md:text-2xl font-bold text-[#2e2018]">
                    Mr Arunachala Sundaresan
                  </h2>
                  <p className="text-sm sm:text-base md:text-lg text-[#5f4636] leading-relaxed">
                    Mr Sundaresan was a genius in mathematics &amp; known for his sharp memory.
                  </p>
                  <p className="text-sm sm:text-base md:text-lg text-[#5f4636] leading-relaxed">
                    Among his service period, he served as &ldquo;Vadabathimangalam Estate Manager&rdquo; at Thiruvarur.
                  </p>
                  <p className="text-sm sm:text-base md:text-lg text-[#5f4636] leading-relaxed">
                    Vadabathimangalam estate was one of the biggest in Thiruvarur owned by Mr Thyagaraja Mudaliar. Thyagaraja mudaliyar was a ardent devotee of Lord Thyagaraja swamy. Periodically he reviews his asset and its value with his manager &amp; compares with asset value of Thaygaraja swamy temple. Whatever excess he finds will immediately transfer same to temple trust. His principle is his asset should never me more than that of temple.
                  </p>
                  <p className="text-sm sm:text-base md:text-lg text-[#5f4636] leading-relaxed">
                    To manage such estate he found Mr Arunachalam Sundaresan as an able person.
                  </p>
                </section>

                <section className="space-y-4 pt-6 border-t border-[#e7d8cc]">
                  <h2 className="font-serif text-lg sm:text-xl md:text-2xl font-bold text-[#2e2018]">
                    Mr Vaidhyanathan Ganesan (grandson of Mr Arunachalam)
                  </h2>
                  <p className="text-sm sm:text-base md:text-lg text-[#5f4636] leading-relaxed">
                    Mr Vaidyanathań&apos;s son Mr Ganesan made super sacrifice and received peace time Mahavirchakra award in the year 1960.
                  </p>
                  <img
                    src="/images/WhyVisitNativeVillage/image5.png"
                    alt="Mr Vaidyanathan Ganesan Mahavirchakra reference"
                    className="w-full rounded-xl honors-award-image"
                  />
                </section>
              </div>
            )}

            {activeTab === "importance" && (
              <div className="importance-content">
                <header className="importance-hero">
                  <h1 className="importance-page-title">Importance of Visiting Our Village</h1>
                  <p className="importance-page-subtitle">நமது கிராம தெய்வங்களைப் பார்ப்பதோ / சேவை செய்வதோ ஏன் முக்கியம்?</p>
                  <div className="importance-divider" />
                </header>

                <section className="importance-section">
                  <div className="importance-eyebrow">Our Sacred Duty</div>
                  <h2 className="importance-title">Importance of Visit and Offer Service to Our Village Deities</h2>
                  <p className="importance-text">
                    Just as we must never forget the sacrifices of our parents who shaped our lives, we must also remember our duty towards our <strong>Kuladeivam</strong> (Family deity) and <strong>Grama Devathas</strong> (Village deities). They are our local guardians and protectors in Hinduism. Hence, worshipping them is vital for one&apos;s good life.
                  </p>
                  <p className="importance-text">
                    Such worship and traditions must be inculcated in our children and future generations for their benefit.
                  </p>
                </section>

                <div className="importance-separator" />

                <section className="importance-section">
                  <div className="importance-eyebrow">Village Significance</div>
                  <h2 className="importance-title">Kakkalani - Its Name and Religious Significance</h2>
                  <p className="importance-text">
                    Our village is located within 10 km from the famous <strong>Thiruvarur Thyagaraja Swami Temple</strong>, where Lord Shiva blesses devotees as a <strong>Maragadha Lingam</strong> worshipped by Lord Indra himself. Nithya pooja is offered on all four kalams every day.
                  </p>
                  <p className="importance-text">
                    One of our generous donors, Shri R. Srinivasan (Vasu), was blessed with an opportunity to offer physical service at the place where daily poojas are performed to this Lingam. Our village enjoys its positive spiritual vibrations from being in close proximity.
                  </p>
                </section>

                <div className="importance-separator" />

                <section className="importance-section">
                  <div className="importance-eyebrow">Divine Grace</div>
                  <h2 className="importance-title">Blessings of Great Souls</h2>
                  <p className="importance-text">
                    Shri Kanchi Mahaperiyava came to this village twice and visited all three temples, sanctifying them with his divine presence. Both the Pichu Iyer family and the Pannai Family are blessed - and through them, the entire village is blessed.
                  </p>
                  <p className="importance-text">
                    A member of the Pannai family stayed at the Ashram of Shri Ramana Maharishi and rendered service to him. He was later brought back and stayed in the village till his last breath. Shri Kanchi Mahaperiyava acknowledged this person as being in a <em>siddha state</em> due to his association with Shri Ramana Maharishi.
                  </p>
                  <p className="importance-text">
                    Shri <strong>Arunachala Sastrigal</strong>, a renowned Sanskrit scholar and Vedic pandit from our village, was well recognised by His Holiness Kanchi Mahaperiyava.
                  </p>
                </section>

                <div className="importance-separator" />

                <section className="importance-section">
                  <div className="importance-eyebrow">Our Responsibilities</div>
                  <h2 className="importance-title">Why We Must Visit &amp; Serve</h2>
                  <div className="importance-reasons-grid">
                    <div className="importance-reason-card"><span className="importance-reason-dot" /><span>Many eminent personalities came from this small village - all possible because of Eashwara Krupai &amp; village deities&apos; blessings.</span></div>
                    <div className="importance-reason-card"><span className="importance-reason-dot" /><span>When we stand before the deities, we also receive the blessings of great souls who once worshipped there.</span></div>
                    <div className="importance-reason-card"><span className="importance-reason-dot" /><span>Ensure daily poojas and <em>Naivedhyam</em> continue in our village temples by actively participating.</span></div>
                    <div className="importance-reason-card"><span className="importance-reason-dot" /><span>For many families, the village deity also serves as their Kuladeivam, strengthening their spiritual bond.</span></div>
                    <div className="importance-reason-card importance-reason-card-wide"><span className="importance-reason-dot" /><span>If all village temples are looked after properly, the village too will become prosperous.</span></div>
                  </div>
                  <div className="importance-quote">
                    <p>&quot;Let us take this opportunity to visit our temples, offer our service, and seek the blessings of our village deities. By doing so, we preserve our traditions, honour our ancestors, and pass on this sacred heritage to our future generations.&quot;</p>
                  </div>
                </section>

                <div className="importance-separator" />

                <section className="importance-section">
                  <div className="importance-eyebrow">Tamil</div>
                  <h2 className="importance-title">நமது கிராம தெய்வங்களைப் பார்ப்பதோ / சேவை செய்வதோ ஏன் முக்கியம்?</h2>
                  <div className="importance-proverb">
                    <p>&quot;கோவில் விளங்கக் குடி விளங்கும்&quot;</p>
                  </div>
                  <p className="importance-text">
                    பல முயற்சிகள், தியாகங்கள் செய்து நம்மை வளர்த்து ஆளாக்கி இன்று இந்த உயர்ந்த நிலையில் நாம் இருப்பதற்கு காரணமான நமது பெற்றோரை அவர்களின் வயோதிக காலத்தில் பேணி காக்க நாம் எப்படி தவறக்கூடாதோ அது போல நமது குல தெய்வங்களையும், கிராம தெய்வங்களையும் வழிபடுவதையும், சேவை செய்வதையும் மறந்து விடக்கூடாது.
                  </p>
                  <p className="importance-text">
                    இங்கே நமது கிராமமான கக்கழனி இந்த பெயரையும், புகழையும் எவ்வாறு பெற்றது என்ற வரலாற்று சிறப்பை முதலில் காண்போம். இந்த கிராமம் திருவாரூர் தியாகராஜ கோயிலிலிருந்து 10 கிலோ மீட்டர் தொலைவில் உள்ளது. இந்த சிவனுக்கு தினமும் நாலு கால பூஜையும் நைவேத்யத்துடன் சிறப்பாக நடைபெறுகிறது.
                  </p>
                  <p className="importance-text">
                    பல்வேறு ஆவணங்கள் பதிவுகள் மற்றும் மூத்த தலைவர்களுடன் நடத்திய உரையாடல்கள் மூலமாக நாம் அறிய வந்த விஷயங்கள்: பல புகழுக்கு சொந்தக்காரர்களும் விருதுகளை வென்றவர்களும் இந்த மண்ணின் மைந்தர்கள்.
                  </p>
                </section>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="text-center pt-6 pb-8 border-t border-[#efd9cf] mt-8">
        <p className="text-xs sm:text-sm text-[#7a5e4b] px-4">
          © {new Date().getFullYear()} Kakkalani Gramam. Built with{" "}
          <span className="text-[#a33a2b]">❤</span> for the community.
        </p>
      </footer>

      <style>{`
        .village-typography {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
          color: #2e2018;
        }
        .village-typography h1,
        .village-typography h2,
        .village-typography h3 {
          font-family: Georgia, 'Times New Roman', serif;
          letter-spacing: 0;
          color: #2e2018;
        }
        .village-typography svg {
          color: #a33a2b;
        }
        .senior-readable-content :where(p, li, td, blockquote) {
          font-weight: 500;
        }
        .tab-button {
          border: 1px solid #efd9cf;
          border-radius: 0.9rem;
          padding: 0.7rem 0.9rem;
          color: #5f4636;
          background: #fffdf8;
          transition: all 0.25s ease;
          display: flex;
          align-items: center;
          gap: 0.6rem;
          justify-content: flex-start;
          text-align: left;
          min-height: 54px;
          font-size: 0.85rem;
          line-height: 1.25;
          font-weight: 600;
        }
        .tab-button:hover {
          border-color: #d9bfb4;
          background: #f8eee2;
        }
        .tab-button-active {
          border-color: #a33a2b;
          background: #f8eee2;
          color: #2e2018;
          box-shadow: 0 4px 14px rgba(163, 58, 43, 0.14);
        }
        .tab-button-icon {
          width: 2rem;
          height: 2rem;
          border-radius: 0.7rem;
          background: #efd9cf;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }
        .tab-button-active .tab-button-icon {
          background: #a33a2b;
        }
        .tab-button-active .tab-button-icon svg {
          color: #fff;
        }
        .honors-family-image {
          max-height: 680px;
          width: auto;
          max-width: 100%;
          margin: 0 auto;
          display: block;
          object-fit: contain;
        }
        .honors-award-image {
          max-height: 460px;
          width: auto;
          max-width: 100%;
          margin: 0 auto;
          display: block;
          object-fit: contain;
        }
        .importance-content {
          padding: 0 0.2rem;
        }
        .importance-hero {
          text-align: left;
          margin-bottom: 1rem;
        }
        .importance-page-title {
          font-family: Georgia, 'Times New Roman', serif;
          font-size: clamp(2rem, 4vw, 3.2rem);
          font-weight: 700;
          color: #2e2018;
          line-height: 1.15;
          margin: 0;
        }
        .importance-page-subtitle {
          font-size: 1.2rem;
          color: #7a5e4b;
          margin-top: 0.8rem;
          margin-bottom: 0;
        }
        .importance-divider {
          width: 2.6rem;
          height: 3px;
          border-radius: 2px;
          margin-top: 1.7rem;
          background: linear-gradient(90deg, #a33a2b, #7e2a20);
        }
        .importance-section {
          margin-bottom: 1.7rem;
        }
        .importance-eyebrow {
          font-size: 0.9rem;
          letter-spacing: 0.18em;
          text-transform: uppercase;
          font-weight: 700;
          color: #a33a2b;
          margin-bottom: 0.55rem;
        }
        .importance-title {
          font-family: Georgia, 'Times New Roman', serif;
          font-size: clamp(1.45rem, 2.6vw, 2.2rem);
          font-weight: 700;
          color: #2e2018;
          margin: 0 0 1rem 0;
          line-height: 1.25;
        }
        .importance-text {
          color: #5f4636;
          font-size: 1.1rem;
          line-height: 1.75;
          margin-bottom: 0.85rem;
        }
        .importance-separator {
          height: 1px;
          background: linear-gradient(90deg, transparent, #efd9cf, transparent);
          margin: 1.5rem 0;
        }
        .importance-reasons-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 0.8rem;
          margin-top: 0.8rem;
        }
        .importance-reason-card {
          background: #fffdf8;
          border: 1.5px solid #efd9cf;
          border-radius: 0.75rem;
          padding: 0.85rem 1rem;
          display: flex;
          gap: 0.6rem;
          align-items: flex-start;
          color: #5f4636;
          font-size: 1.05rem;
          line-height: 1.55;
        }
        .importance-reason-card-wide {
          grid-column: 1 / -1;
        }
        .importance-reason-dot {
          width: 0.4rem;
          height: 0.4rem;
          border-radius: 9999px;
          background: #a33a2b;
          flex-shrink: 0;
          margin-top: 0.55rem;
        }
        .importance-quote {
          margin-top: 1.25rem;
          padding: 1rem 1.15rem;
          border-left: 4px solid #a33a2b;
          background: linear-gradient(90deg, rgba(163, 58, 43, 0.08), transparent);
        }
        .importance-quote p {
          margin: 0;
          font-family: Georgia, 'Times New Roman', serif;
          font-style: italic;
          color: #7e2a20;
          font-size: 1.16rem;
          line-height: 1.6;
        }
        .importance-proverb {
          text-align: center;
          padding: 1rem;
          background: linear-gradient(135deg, #f8eee2, #fffdf8);
          border: 1.5px solid #efd9cf;
          border-radius: 0.75rem;
          margin: 1rem 0;
        }
        .importance-proverb p {
          margin: 0;
          font-family: Georgia, 'Times New Roman', serif;
          font-size: 1.65rem;
          font-weight: 700;
          color: #a33a2b;
        }

        /* Prevent horizontal overflow on mobile */
        @media (max-width: 640px) {
          .importance-page-title {
            font-size: 2rem;
          }
          .honors-family-image {
            max-height: 520px;
          }
          .honors-award-image {
            max-height: 320px;
          }
          .importance-page-subtitle {
            font-size: 1rem;
          }
          .importance-title {
            font-size: 1.35rem;
          }
          .importance-text {
            font-size: 1rem;
          }
          .importance-reasons-grid {
            grid-template-columns: 1fr;
          }
          .importance-reason-card {
            font-size: 0.98rem;
          }
          .importance-quote p {
            font-size: 1rem;
          }
          .importance-proverb p {
            font-size: 1.25rem;
          }
          * {
            word-wrap: break-word;
            overflow-wrap: break-word;
          }
        }
      `}</style>
    </div>
  );
};

export default WhyVisitNativeVillage;
