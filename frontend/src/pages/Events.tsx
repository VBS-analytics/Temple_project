import React from 'react';

const Events: React.FC = () => {
  const upcomingEvents = [
    {
      id: 1,
      title: 'Diwali Celebrations',
      date: 'November 12, 2025',
      time: '6:00 AM - 9:00 PM',
      description: 'Join us for the grand Diwali celebrations with special pujas, cultural programs, and prasadam distribution.',
    },
    {
      id: 2,
      title: 'Monthly Pradosham',
      date: 'October 25, 2025',
      time: '4:30 PM - 7:30 PM',
      description: 'Special abhishekam and archana for Lord Shiva during the auspicious Pradosham time.',
    },
    {
      id: 3,
      title: 'Navaratri Festival',
      date: 'October 15-24, 2025',
      time: 'All Day Event',
      description: 'Nine days of spiritual and cultural celebrations with special alankaram for the deity each day.',
    },
    {
      id: 4,
      title: 'Gau Puja',
      date: 'Every Saturday',
      time: '9:00 AM - 10:30 AM',
      description: 'Weekly cow worship ceremony and feeding program.',
    },
  ];

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        <div className="text-center">
          <h1 className="text-4xl font-bold text-gray-900 mb-8">Temple Events</h1>
          <p className="text-gray-600 mb-8">
            Join us in celebrating our rich cultural heritage through various events and festivals.
          </p>
        </div>

      </div>
    </div>
  );
};

export default Events;