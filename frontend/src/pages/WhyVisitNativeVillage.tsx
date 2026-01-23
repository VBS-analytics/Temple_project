import PublicSiteHeader from "../components/PublicSiteHeader";

const WhyVisitNativeVillage = () => (
  <div className="bg-slate-50">
    <PublicSiteHeader />
    <main className="min-h-[70vh]">
      <div className="responsive-layout flex min-h-[70vh] flex-col items-center justify-center gap-4 py-16 text-center">
        <p className="text-sm font-semibold uppercase tracking-[0.3em] text-amber-600">
          Why we should visit our Native village
        </p>
        <h1 className="text-3xl font-semibold text-slate-900 sm:text-4xl">
          Story coming soon
        </h1>
        <p className="max-w-2xl text-base text-slate-500">
          We are working on content that highlights the importance of reconnecting with Kakkalani village.
        </p>
      </div>
    </main>
  </div>
);

export default WhyVisitNativeVillage;
