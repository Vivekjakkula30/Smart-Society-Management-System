import React from 'react';
import { Link, useNavigate } from 'react-router-dom';

const Home = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gray-50">
      <section id="home">
        <section className="bg-gradient-to-br from-blue-600 to-purple-700 text-white pt-24 pb-20">
          <div className="container mx-auto px-4 text-center">
            <h1 className="text-5xl font-bold mb-6">Welcome to Smart Society Management</h1>
            <p className="text-xl mb-8 max-w-2xl mx-auto">
              Transform your residential society with our comprehensive digital management platform
            </p>
            <Link 
              to="/signup" 
              className="bg-red-500 hover:bg-red-600 text-white px-8 py-4 rounded-full text-lg font-semibold transition-all transform hover:scale-105 inline-block shadow-lg"
            >
              Get Started Today
            </Link>
          </div>
        </section>
      </section>

      <section id="why-choose-us" className="py-20 bg-white">
        <div className="container mx-auto px-4">
          <h2 className="text-4xl font-bold text-center text-gray-800 mb-12">Why Choose Smart Society?</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="bg-gradient-to-br from-blue-50 to-blue-100 p-8 rounded-xl shadow-lg hover:shadow-xl transition-shadow border border-blue-200">
              <div className="text-4xl mb-4 text-center">📋</div>
              <h3 className="text-2xl font-semibold text-gray-800 mb-4 text-center">Easy Complaint Management</h3>
              <p className="text-gray-600 text-center">
                Submit, track, and resolve maintenance issues in real-time with automated escalation.
              </p>
            </div>
            <div className="bg-gradient-to-br from-green-50 to-green-100 p-8 rounded-xl shadow-lg hover:shadow-xl transition-shadow border border-green-200">
              <div className="text-4xl mb-4 text-center">💰</div>
              <h3 className="text-2xl font-semibold text-gray-800 mb-4 text-center">Secure Online Payments</h3>
              <p className="text-gray-600 text-center">
                Safe online payment gateway for maintenance fees with automated receipts and history.
              </p>
            </div>
            <div className="bg-gradient-to-br from-purple-50 to-purple-100 p-8 rounded-xl shadow-lg hover:shadow-xl transition-shadow border border-purple-200">
              <div className="text-4xl mb-4 text-center">📢</div>
              <h3 className="text-2xl font-semibold text-gray-800 mb-4 text-center">Instant Notifications</h3>
              <p className="text-gray-600 text-center">
                Get immediate alerts for announcements, emergencies, and important notices.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mt-12">
            <div className="text-center p-4">
              <div className="text-3xl mb-2">👥</div>
              <h4 className="font-semibold text-gray-800">Visitor Management</h4>
              <p className="text-sm text-gray-600">Digital visitor logs</p>
            </div>
            <div className="text-center p-4">
              <div className="text-3xl mb-2">📅</div>
              <h4 className="font-semibold text-gray-800">Event Calendar</h4>
              <p className="text-sm text-gray-600">Society events schedule</p>
            </div>
            <div className="text-center p-4">
              <div className="text-3xl mb-2">🏊</div>
              <h4 className="font-semibold text-gray-800">Facility Booking</h4>
              <p className="text-sm text-gray-600">Book common areas</p>
            </div>
            <div className="text-center p-4">
              <div className="text-3xl mb-2">🛡️</div>
              <h4 className="font-semibold text-gray-800">Security</h4>
              <p className="text-sm text-gray-600">Incident reporting</p>
            </div>
          </div>
        </div>
      </section>

      <section id="about" className="py-20 bg-gray-100">
        <div className="container mx-auto px-4">
          <h2 className="text-4xl font-bold text-center text-gray-800 mb-12">About Smart Society</h2>
          
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div>
              <h3 className="text-3xl font-bold text-gray-800 mb-6">Revolutionizing Society Management</h3>
              <p className="text-lg text-gray-600 mb-6 leading-relaxed">
                Smart Society Management System is a comprehensive digital platform designed to transform 
                how residential communities operate.
              </p>
              <p className="text-lg text-gray-600 mb-6 leading-relaxed">
                Our platform serves as the central system for residential societies, connecting 
                residents, management committees, and security personnel.
              </p>
              <div className="bg-blue-50 border-l-4 border-blue-500 p-4 rounded">
                <p className="text-blue-800 font-semibold">
                  "We believe technology should simplify community living, not complicate it."
                </p>
              </div>
            </div>
            <div className="bg-white p-8 rounded-2xl shadow-lg">
              <h4 className="text-2xl font-semibold text-gray-800 mb-6 text-center">Our Achievements</h4>
              <div className="grid grid-cols-2 gap-6 text-center">
                <div className="bg-blue-50 p-4 rounded-lg">
                  <div className="text-2xl font-bold text-blue-600 mb-1">50+</div>
                  <div className="text-sm text-gray-600">Societies</div>
                </div>
                <div className="bg-green-50 p-4 rounded-lg">
                  <div className="text-2xl font-bold text-green-600 mb-1">10K+</div>
                  <div className="text-sm text-gray-600">Residents</div>
                </div>
                <div className="bg-purple-50 p-4 rounded-lg">
                  <div className="text-2xl font-bold text-purple-600 mb-1">24/7</div>
                  <div className="text-sm text-gray-600">Support</div>
                </div>
                <div className="bg-red-50 p-4 rounded-lg">
                  <div className="text-2xl font-bold text-red-600 mb-1">99%</div>
                  <div className="text-sm text-gray-600">Uptime</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="Rules" className="py-20 bg-white">
        <div className="container mx-auto px-4">
          <h2 className="text-4xl font-bold text-center text-gray-800 mb-12">Society Rules & Policies</h2>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <div className="bg-white border-l-4 border-blue-500 rounded-xl shadow-lg p-6">
              <h3 className="text-xl font-semibold text-gray-800 mb-4">🔧 Maintenance</h3>
              <ul className="space-y-2 text-gray-600">
                <li>• Fees due by 10th of month</li>
                <li>• ₹50/day late charges</li>
                <li>• Saturday maintenance</li>
              </ul>
            </div>
            <div className="bg-white border-l-4 border-green-500 rounded-xl shadow-lg p-6">
              <h3 className="text-xl font-semibold text-gray-800 mb-4">👥 Visitors</h3>
              <ul className="space-y-2 text-gray-600">
                <li>• Register at security</li>
                <li>• No entry after 10 PM</li>
                <li>• Max 4 visitors</li>
              </ul>
            </div>
            <div className="bg-white border-l-4 border-purple-500 rounded-xl shadow-lg p-6">
              <h3 className="text-xl font-semibold text-gray-800 mb-4">🏊 Common Areas</h3>
              <ul className="space-y-2 text-gray-600">
                <li>• Pool: 6 AM - 9 PM</li>
                <li>• Gym for 16+ only</li>
                <li>• Book facilities online</li>
              </ul>
            </div>
            <div className="bg-white border-l-4 border-red-500 rounded-xl shadow-lg p-6">
              <h3 className="text-xl font-semibold text-gray-800 mb-4">🚗 Parking</h3>
              <ul className="space-y-2 text-gray-600">
                <li>• One space per flat</li>
                <li>• No fire lane parking</li>
                <li>• Guest parking: 4 hrs</li>
              </ul>
            </div>
            <div className="bg-white border-l-4 border-orange-500 rounded-xl shadow-lg p-6">
              <h3 className="text-xl font-semibold text-gray-800 mb-4">🔇 Noise</h3>
              <ul className="space-y-2 text-gray-600">
                <li>• Quiet after 10 PM</li>
                <li>• No loud music at night</li>
                <li>• ₹1000 noise fine</li>
              </ul>
            </div>
            <div className="bg-white border-l-4 border-teal-500 rounded-xl shadow-lg p-6">
              <h3 className="text-xl font-semibold text-gray-800 mb-4">🌿 Environment</h3>
              <ul className="space-y-2 text-gray-600">
                <li>• Waste segregation</li>
                <li>• No littering</li>
                <li>• Save water</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      <section id="contact" className="py-20 bg-gray-100">
        <div className="container mx-auto px-4">
          <h2 className="text-4xl font-bold text-center text-gray-800 mb-12">Contact Us</h2>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 max-w-6xl mx-auto">
            <div className="space-y-6">
              <div className="bg-white p-6 rounded-xl shadow-lg">
                <h3 className="text-xl font-semibold text-red-600 mb-4">📞 Phone Numbers</h3>
                <p className="text-gray-700"><strong>Office:</strong> +91-22-1234-5678</p>
                <p className="text-gray-700"><strong>Emergency:</strong> +91-98765-43210</p>
                <p className="text-gray-700"><strong>Maintenance:</strong> +91-98765-43211</p>
              </div>
              <div className="bg-white p-6 rounded-xl shadow-lg">
                <h3 className="text-xl font-semibold text-blue-600 mb-4">📧 Email</h3>
                <p className="text-gray-700"><strong>General:</strong> info@smartsociety.com</p>
                <p className="text-gray-700"><strong>Support:</strong> support@smartsociety.com</p>
                <p className="text-gray-700"><strong>Admin:</strong> admin@smartsociety.com</p>
              </div>
              <div className="bg-white p-6 rounded-xl shadow-lg">
                <h3 className="text-xl font-semibold text-green-600 mb-4">🏢 Office</h3>
                <p className="text-gray-700">Smart Society Management</p>
                <p className="text-gray-700">Block A, First Floor</p>
                <p className="text-gray-700">Mumbai, Maharashtra - 400071</p>
                <p className="text-gray-700 mt-2"><strong>Hours:</strong> 9:00 AM - 6:00 PM</p>
              </div>
            </div>
            <div className="bg-white p-8 rounded-xl shadow-lg">
              <h3 className="text-2xl font-semibold text-gray-800 mb-6">Send us a Message</h3>
              <div className="space-y-4">
                <input type="text" placeholder="Your Name" className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
                <input type="email" placeholder="Your Email" className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
                <select className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent">
                  <option>Select Department</option>
                  <option>Maintenance</option>
                  <option>Billing</option>
                  <option>Security</option>
                </select>
                <textarea placeholder="Your Message" rows="4" className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"></textarea>
                <button
                  type="button"
                  onClick={() => navigate('/signup')}
                  className="w-full bg-green-600 hover:bg-green-700 text-white py-3 rounded-lg font-semibold transition-colors"
                >
                  Send Message
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

export default Home;