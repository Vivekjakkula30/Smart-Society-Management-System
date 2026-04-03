// src/components/Footer.js
import React from 'react';

const Footer = () => {
  return (
    <footer className="bg-primary text-white py-8 mt-auto">
      <div className="container mx-auto px-4 flex flex-col md:flex-row justify-between items-center gap-4">
        <p>&copy; 2025 Smart Society Management System. All rights reserved.</p>
        <div className="flex gap-6">
          <a href="#privacy" className="text-gray-300 hover:text-white transition-colors">
            Privacy Policy
          </a>
          <a href="#terms" className="text-gray-300 hover:text-white transition-colors">
            Terms of Service
          </a>
          <a href="#contact" className="text-gray-300 hover:text-white transition-colors">
            Contact Us
          </a>
        </div>
      </div>
    </footer>
  );
};

export default Footer;