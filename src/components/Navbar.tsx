// bank-portal/bank-a/frontend/src/components/Navbar.tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation"; // Import the usePathname hook

export default function Navbar() {
  const pathname = usePathname(); // Get the current path

  const navLinks = [
    { href: "/", label: "KYC Requests" },
    { href: "/profile-ids", label: "User Profiles" },
    { href: "/check-blockchain", label: "Check on Blockchain" },
  ];

  return (
    <nav className="bg-amber-700 text-white shadow-md">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-start h-16">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              {/* You can add a logo here if you have one */}
              <span className="font-bold text-xl">Bank A Portal</span>
            </div>
            <div className="hidden md:block">
              <div className="ml-10 flex items-baseline space-x-4">
                {navLinks.map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    className={`px-3 py-2 rounded-md text-sm font-medium transition-colors duration-150 ${
                      pathname === link.href
                        ? "bg-amber-800 text-white shadow-inner" // Active link style
                        : "text-amber-100 hover:bg-amber-600 hover:text-white" // Inactive link style
                    }`}
                  >
                    {link.label}
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </nav>
  );
}
