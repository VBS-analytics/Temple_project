import React from 'react';

const Projects: React.FC = () => {
  const projects = [
    {
      id: 1,
      title: 'Temple Renovation Project',
      status: 'In Progress',
      completion: 75,
      description: 'Comprehensive renovation of the temple premises including structural improvements and aesthetic enhancements.',
      timeline: 'Expected completion: December 2025',
    },
    {
      id: 2,
      title: 'Community Kitchen Expansion',
      status: 'Planning Phase',
      completion: 30,
      description: 'Expanding our kitchen facilities to serve more devotees and support community feeding programs.',
      timeline: 'Expected completion: March 2026',
    },
    {
      id: 3,
      title: 'Vedic Education Center',
      status: 'Upcoming',
      completion: 0,
      description: 'Establishing a center for Vedic education and cultural studies to preserve and promote ancient wisdom.',
      timeline: 'Starting: January 2026',
    },
    {
      id: 4,
      title: 'Green Temple Initiative',
      status: 'Active',
      completion: 60,
      description: 'Implementation of solar power and sustainable practices throughout the temple premises.',
      timeline: 'Ongoing project',
    },
  ];

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        <div className="text-center">
          <h1 className="text-4xl font-bold text-gray-900 mb-8">Temple Projects</h1>
          <p className="text-gray-600 mb-8">
            Discover our ongoing initiatives and future plans for temple development and community service.
          </p>
        </div>

      </div>
    </div>
  );
};

export default Projects;