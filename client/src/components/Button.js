// src/components/Button.js
import React from 'react';

const Button = ({ 
  children, 
  type = 'primary', 
  onClick, 
  className = '',
  ...props 
}) => {
  const baseClasses = 'px-6 py-3 rounded-lg font-semibold transition-all duration-300 transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-opacity-50';
  
  const typeClasses = {
    primary: 'bg-blue-600 hover:bg-blue-700 text-white focus:ring-blue-500',
    success: 'bg-green-600 hover:bg-green-700 text-white focus:ring-green-500',
    danger: 'bg-red-600 hover:bg-red-700 text-white focus:ring-red-500',
    secondary: 'bg-gray-600 hover:bg-gray-700 text-white focus:ring-gray-500',
  };

  return (
    <button 
      className={`${baseClasses} ${typeClasses[type]} ${className}`}
      onClick={onClick}
      {...props}
    >
      {children}
    </button>
  );
};

export default Button;