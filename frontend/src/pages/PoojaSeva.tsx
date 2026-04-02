import React from "react";

const PoojaSeva = () => {
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
        <PoojaSevasContent />
      </div>
    </div>
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
            <h2 className="mt-2 text-2xl font-bold text-slate-900 sm:text-3xl">
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

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b-2 border-green-200 bg-green-50">
                <th className="text-left p-3 font-semibold text-green-900">Pooja Description</th>
                <th className="text-right p-3 font-semibold text-green-900">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              <tr className="hover:bg-green-50/50">
                <td className="p-3 text-slate-700">Pillayar Koil 1 day abishekam</td>
                <td className="p-3 text-right font-semibold text-slate-900">Rs 500</td>
              </tr>
              <tr className="hover:bg-green-50/50">
                <td className="p-3 text-slate-700">Shivan Koil (for Lord Shiva + Ambal)</td>
                <td className="p-3 text-right font-semibold text-slate-900">Rs 1000</td>
              </tr>
              <tr className="hover:bg-green-50/50">
                <td className="p-3 text-slate-700">Kasi Viswanathar 1 day abishekam</td>
                <td className="p-3 text-right font-semibold text-slate-900">Rs 500</td>
              </tr>
              <tr className="hover:bg-green-50/50">
                <td className="p-3 text-slate-700">Subramanya swamy 1 day abishekam</td>
                <td className="p-3 text-right font-semibold text-slate-900">Rs 500</td>
              </tr>
              <tr className="hover:bg-green-50/50">
                <td className="p-3 text-slate-700">Ayyanar 1 day abishekam</td>
                <td className="p-3 text-right font-semibold text-slate-900">Rs 500</td>
              </tr>
              <tr className="hover:bg-green-50/50">
                <td className="p-3 text-slate-700">Perumal Koil 1 day abishekam</td>
                <td className="p-3 text-right font-semibold text-slate-900">Rs 500</td>
              </tr>
            </tbody>
          </table>
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

export default PoojaSeva;
