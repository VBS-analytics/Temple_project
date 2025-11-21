const CombinePaymentPage = () => (
  <div className="space-y-6">
    <section className="rounded-lg bg-white p-6 shadow-sm">
      <h1 className="text-xl font-semibold text-slate-800">Combine Payment</h1>
      <p className="mt-2 text-sm text-slate-600">
        Placeholder view for merging multiple commitments into a single payment. Replace with actual combine logic later.
      </p>

      <div className="mt-8 grid gap-4 md:grid-cols-2">
        <div className="flex h-32 items-center justify-center rounded-lg border border-dashed border-slate-200 bg-slate-50 text-sm text-slate-500">
          Selected commitments summary
        </div>
        <div className="flex h-32 items-center justify-center rounded-lg border border-dashed border-slate-200 bg-slate-50 text-sm text-slate-500">
          Combined payment action panel
        </div>
      </div>
    </section>
  </div>
);

export default CombinePaymentPage;
