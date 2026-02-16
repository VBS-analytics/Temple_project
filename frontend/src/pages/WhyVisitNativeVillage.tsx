import PublicSiteHeader from "../components/PublicSiteHeader";

const WhyVisitNativeVillage = () => (
  <div className="bg-slate-50">
    <PublicSiteHeader />
    <main className="min-h-[70vh] py-10 sm:py-12">
      <div className="responsive-layout space-y-8">
        <header className="space-y-3 text-center">
          <p className="text-sm font-semibold uppercase tracking-[0.3em] text-amber-600">
            Why we should visit our Native village
          </p>
          <h1 className="text-3xl font-semibold text-slate-900 sm:text-4xl">
            Vijayam of Kanchi Shri Mahaperiyava to Kakkalani Village
          </h1>
        </header>

        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-xl font-semibold text-slate-900">First Vijayam (around 1920)</h2>
          <p className="mt-3 text-slate-700 leading-relaxed">
            Kanchi Shri Mahaperiyava&apos;s vijayam to our village was around the year 1920.
            He visited the Pichu Iyer family during the upanayanam of Shri Mahalingam
            (grandfather of Dr. Sabesan), stayed in the house, and performed pooja.
          </p>
          <p className="mt-3 text-slate-700 leading-relaxed">
            Details about this event were shared in an audio by Dr. Sabesan
            (son of late Mr. Swaminathan alias Balu, Psychology Professor in Annamalai University,
            and grandson of Mr. Mahalingam).
          </p>
          <p className="mt-3 text-sm font-medium text-slate-600">
            Audio reference: <span className="font-mono">AUD-20240518-WA0003.opus</span>
          </p>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-xl font-semibold text-slate-900">Second Vijayam (1954)</h2>
          <p className="mt-3 text-slate-700 leading-relaxed">
            Kanchi Shri Mahaperiyava&apos;s second vijayam to our village was through the
            Pannai family in 1954.
          </p>
          <p className="mt-3 text-slate-700 leading-relaxed">
            While elaborate details are not available, Shri R. Vaithyanathan (the senior-most
            available member from the Pannai family) shared what he could recollect.
          </p>
          <p className="mt-3 text-slate-700 leading-relaxed">
            During this vijayam, Shri Mahaperiyava stayed for a few days on the plot next to
            Mangalam Periamma&apos;s house, where special hut-type arrangements were made.
          </p>
          <p className="mt-3 text-sm text-slate-600">
            The location is referenced in the website home page.
          </p>
        </section>
      </div>
    </main>
  </div>
);

export default WhyVisitNativeVillage;
