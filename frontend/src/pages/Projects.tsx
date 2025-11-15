import React from 'react';

import PublicSiteHeader from '../components/PublicSiteHeader';

const Projects: React.FC = () => {
  const projects = [
    {
      id: 1,
      title: 'Temple Renovation Project',
      status: 'In Progress',
      completion: 75,
      description:
        'Comprehensive renovation of the temple premises including structural improvements and aesthetic enhancements.',
      timeline: 'Expected completion: December 2025'
    },
    {
      id: 2,
      title: 'Community Kitchen Expansion',
      status: 'Planning Phase',
      completion: 30,
      description:
        'Expanding our kitchen facilities to serve more devotees and support community feeding programs.',
      timeline: 'Expected completion: March 2026'
    },
    {
      id: 3,
      title: 'Vedic Education Center',
      status: 'Upcoming',
      completion: 0,
      description:
        'Establishing a center for Vedic education and cultural studies to preserve and promote ancient wisdom.',
      timeline: 'Starting: January 2026'
    },
    {
      id: 4,
      title: 'Green Temple Initiative',
      status: 'Active',
      completion: 60,
      description:
        'Implementation of solar power and sustainable practices throughout the temple premises.',
      timeline: 'Ongoing project'
    }
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      <PublicSiteHeader />
      <main className="mx-auto w-full max-w-screen-2xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="text-center">
          <h1 className="mb-4 text-4xl font-bold text-gray-900">Temple Projects</h1>
          <p className="mb-12 text-gray-600">
            Discover our ongoing initiatives and future plans for temple development and community service.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          {projects.map((project) => (
            <article key={project.id} className="rounded-2xl border border-emerald-100 bg-white p-6 shadow-sm">
              <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold text-gray-900">{project.title}</h2>
                <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-emerald-600">
                  {project.status}
                </span>
              </div>
              <p className="mt-4 text-gray-600">{project.description}</p>
              <p className="mt-3 text-sm font-semibold text-emerald-600">{project.timeline}</p>
              <div className="mt-6">
                <div className="flex items-center justify-between text-sm font-semibold text-gray-700">
                  <span>Completion</span>
                  <span>{project.completion}%</span>
                </div>
                <div className="mt-2 h-2 rounded-full bg-emerald-100">
                  <div
                    className="h-full rounded-full bg-emerald-500 transition-all"
                    style={{ width: `${project.completion}%` }}
                  />
                </div>
              </div>
            </article>
          ))}
        </div>
      </main>
    </div>
  );
};

export default Projects;
