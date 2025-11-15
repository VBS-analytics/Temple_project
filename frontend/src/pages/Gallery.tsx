import React from 'react';

import PublicSiteHeader from '../components/PublicSiteHeader';

const Gallery: React.FC = () => {
  const images = [
    { id: 1, src: '/images/Kalabhairavar.jpeg', title: 'Kalabhairavar Temple' },
    { id: 2, src: '/images/Navagraha-Pooja.jpeg', title: 'Navagraha Pooja' },
    { id: 3, src: '/images/Nitya-Neivedhyam.jpg', title: 'Nitya Neivedhyam' },
    { id: 4, src: '/images/pradosha_pooja.jpg', title: 'Pradosha Pooja' },
    { id: 5, src: '/images/Gau-Samrakshana-Seva.jpg', title: 'Gau Samrakshana Seva' }
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      <PublicSiteHeader />
      <main className="mx-auto w-full max-w-screen-2xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="text-center">
          <h1 className="mb-4 text-4xl font-bold text-gray-900">Temple Gallery</h1>
          <p className="mb-12 text-gray-600">
            Experience the divine beauty and sacred moments captured within our temple premises.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {images.map((image) => (
            <figure
              key={image.id}
              className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm transition hover:shadow-md"
            >
              <img src={image.src} alt={image.title} className="h-64 w-full object-cover" loading="lazy" />
              <figcaption className="px-4 py-3 text-center text-sm font-semibold text-gray-700">
                {image.title}
              </figcaption>
            </figure>
          ))}
        </div>
      </main>
    </div>
  );
};

export default Gallery;
