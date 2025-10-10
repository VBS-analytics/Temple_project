import React from 'react';

const Gallery: React.FC = () => {
  const images = [
    { id: 1, src: '/images/Kalabhairavar.jpeg', title: 'Kalabhairavar Temple' },
    { id: 2, src: '/images/Navagraha-Pooja.jpeg', title: 'Navagraha Pooja' },
    { id: 3, src: '/images/Nitya-Neivedhyam.jpg', title: 'Nitya Neivedhyam' },
    { id: 4, src: '/images/pradosha_pooja.jpg', title: 'Pradosha Pooja' },
    { id: 5, src: '/images/Gau-Samrakshana-Seva.jpg', title: 'Gau Samrakshana Seva' },
    // Add more images as needed
  ];

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        <div className="text-center">
          <h1 className="text-4xl font-bold text-gray-900 mb-8">Temple Gallery</h1>
          <p className="text-gray-600 mb-8">
            Experience the divine beauty and sacred moments captured within our temple premises.
          </p>
        </div>

      </div>
    </div>
  );
};

export default Gallery;