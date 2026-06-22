import React from 'react';
import WarrantyRegistration from '../components/WarrantyRegistration';

const WarrantyPage = () => {
  return (
    <div className="min-h-screen bg-[#FFFFFF]">

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 md:py-12">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Sidebar - Info Cards */}
          <div className="lg:col-span-1 space-y-4">
            <div className="bg-white/5 backdrop-blur-sm border border-[#1A4A5E] rounded-2xl p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="bg-[#1F6E5A]/20 p-2 rounded-xl">
                  <svg className="w-5 h-5 text-[#6EAAC9]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <h3 className="text-white font-semibold">How It Works</h3>
              </div>
              <ul className="space-y-3 text-sm text-[#8BB4C9]">
                <li className="flex items-start gap-3">
                  <span className="bg-[#1F6E5A] text-white rounded-full w-5 h-5 flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5">1</span>
                  <span>Scan the QR code on your mattress or enter the serial number</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="bg-[#1F6E5A] text-white rounded-full w-5 h-5 flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5">2</span>
                  <span>Verify product details and warranty status</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="bg-[#1F6E5A] text-white rounded-full w-5 h-5 flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5">3</span>
                  <span>Complete registration to activate your warranty</span>
                </li>
              </ul>
            </div>

            <div className="bg-white/5 backdrop-blur-sm border border-[#1A4A5E] rounded-2xl p-6">
              <h3 className="text-white font-semibold mb-3">Warranty Benefits</h3>
              <div className="space-y-2 text-sm text-[#8BB4C9]">
                <div className="flex items-center gap-2">
                  <svg className="w-4 h-4 text-[#1F6E5A]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                  </svg>
                  <span>10-year limited warranty</span>
                </div>
                <div className="flex items-center gap-2">
                  <svg className="w-4 h-4 text-[#1F6E5A]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                  </svg>
                  <span>Free replacement for defects</span>
                </div>
                <div className="flex items-center gap-2">
                  <svg className="w-4 h-4 text-[#1F6E5A]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                  </svg>
                  <span>24/7 customer support</span>
                </div>
              </div>
            </div>

            <div className="bg-[#1F6E5A]/10 border border-[#1F6E5A]/30 rounded-2xl p-6">
              <div className="flex items-center gap-3">
                <svg className="w-8 h-8 text-[#6EAAC9]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
                <div>
                  <p className="text-white text-sm font-medium">Need help?</p>
                  <p className="text-[#8BB4C9] text-xs">Contact our support team</p>
                </div>
              </div>
            </div>
          </div>

          {/* Main Component */}
          <div className="lg:col-span-2">
            <WarrantyRegistration />
          </div>
        </div>
      </div>
    </div>
  );
};

export default WarrantyPage;