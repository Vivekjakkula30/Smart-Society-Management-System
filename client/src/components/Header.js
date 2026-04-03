// client/src/components/Header.js
import React from "react";
import { useLocation, useNavigate } from "react-router-dom";
import NotificationBell from "./NotificationBell";
import { isLoggedIn } from "../utils/auth";

const Header = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const scrollToSection = (id) => {
    const headerOffset = 80;
    const element = document.getElementById(id);
    if (element) {
      const elementPosition = element.getBoundingClientRect().top + window.scrollY;
      const offsetPosition = elementPosition - headerOffset;
      window.scrollTo({ top: offsetPosition, behavior: "smooth" });
    }
  };

  const handleNavClick = (sectionId) => {
    if (location.pathname !== "/") {
      navigate("/");
      setTimeout(() => scrollToSection(sectionId), 100);
    } else {
      scrollToSection(sectionId);
    }
  };

  return (
    <header className="bg-white shadow-md fixed top-0 left-0 right-0 z-50">
      <div className="container mx-auto px-6 py-4 flex justify-between items-center">
        {/* Logo */}
        <button
          onClick={() => {
            if (location.pathname !== "/") navigate("/");
            else scrollToSection("home");
          }}
          className="text-2xl font-bold text-indigo-600 cursor-pointer"
        >
          🏢 Smart Society
        </button>

        {/* Navigation Menu */}
        <nav className="space-x-8 text-gray-700 font-medium hidden md:block">
          <button
            onClick={() => handleNavClick("home")}
            className="hover:text-indigo-600 transition"
          >
            Home
          </button>
          <button
            onClick={() => handleNavClick("why-choose-us")}
            className="hover:text-indigo-600 transition"
          >
            Why to choose us?
          </button>
          <button
            onClick={() => handleNavClick("Rules")}
            className="hover:text-indigo-600 transition"
          >
            Rules
          </button>
          <button
            onClick={() => handleNavClick("contact")}
            className="hover:text-indigo-600 transition"
          >
            Contact
          </button>
        </nav>

        {/* Right side — Bell (only when logged in) */}
        <div className="flex items-center gap-3">
          {isLoggedIn() && location.pathname !== "/" && <NotificationBell />}
        </div>

      </div>
    </header>
  );
};

export default Header;