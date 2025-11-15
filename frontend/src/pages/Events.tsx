import React from 'react';

import PublicSiteHeader from '../components/PublicSiteHeader';

const Events: React.FC = () => {
  const upcomingEvents = [
    {
      id: 1,
      title: 'Diwali Celebrations',
      date: 'November 12, 2025',
      time: '6:00 AM – 9:00 PM',
      description: 'Grand Diwali celebrations with special pujas, cultural programs, fireworks, and prasadam distribution.'
    },
    {
      id: 2,
      title: 'Monthly Pradosham',
      date: 'October 25, 2025',
      time: '4:30 PM – 7:30 PM',
      description: 'Special abhishekam and archana for Lord Shiva during the auspicious Pradosham period.'
    },
    {
      id: 3,
      title: 'Navaratri Festival',
      date: 'October 15 – 24, 2025',
      time: 'All day',
      description: 'Nine days of spiritual celebrations, unique alankarams, and cultural performances every evening.'
    },
    {
      id: 4,
      title: 'Gau Puja',
      date: 'Every Saturday',
      time: '9:00 AM – 10:30 AM',
      description: 'Weekly cow worship ceremony and feeding program supporting the goshala.'
    }
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      <PublicSiteHeader />
      <main className="mx-auto w-full max-w-screen-2xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="text-center">
          <h1 className="mb-4 text-4xl font-bold text-gray-900">Temple Events</h1>
          <p className="mb-12 text-gray-600">
            Join us in celebrating our vibrant cultural heritage through year-round festivals and seva opportunities.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          {upcomingEvents.map((event) => (
            <article key={event.id} className="rounded-2xl border border-orange-100 bg-white p-6 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-wider text-orange-500">{event.date}</p>
              <h2 className="mt-2 text-2xl font-bold text-gray-900">{event.title}</h2>
              <p className="mt-1 text-sm font-medium text-gray-500">{event.time}</p>
              <p className="mt-4 text-gray-600">{event.description}</p>
              <div className="mt-6 flex flex-wrap gap-3 text-sm font-semibold text-orange-600">
                <span className="rounded-full bg-orange-50 px-3 py-1">Reserve Seva</span>
                <span className="rounded-full bg-orange-50 px-3 py-1">Volunteer</span>
              </div>
            </article>
          ))}
        </div>
      </main>
    </div>
  );
};

export default Events;
