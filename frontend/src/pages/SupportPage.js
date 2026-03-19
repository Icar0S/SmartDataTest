import React from 'react';
import { motion } from 'framer-motion';
import { Book, MessageCircle } from 'react-feather';
import ChatWindow from '../components/ChatWindow';
import { fadeIn, slideIn } from '../styles/animations';

const SupportPage = () => {
  return (
    <motion.div
      initial="initial"
      animate="animate"
      className="min-h-screen bg-gradient-to-br from-[#1a1a2e] via-[#16213e] to-[#1a1a2e] text-white overflow-x-hidden"
    >
      {/* Hero Section */}
      <motion.div
        variants={fadeIn}
        className="relative pt-12 pb-8 px-6"
      >
        <div className="max-w-7xl mx-auto text-center">
          <motion.h1
            variants={slideIn}
            className="text-4xl md:text-5xl font-bold mb-6 bg-clip-text text-transparent bg-gradient-to-r from-purple-400 to-pink-600"
          >
            SmartDataTest Support
          </motion.h1>
          <motion.p
            variants={fadeIn}
            className="text-lg md:text-xl text-purple-300 mb-8"
          >
            Get help with your data quality testing setup using our AI-powered documentation assistant
          </motion.p>
        </div>

        {/* Floating Badges */}
        <div className="absolute top-20 left-10 animate-float-slow">
          <div className="bg-purple-900/30 backdrop-blur-sm p-3 rounded-lg border border-purple-700/30">
            <Book className="w-6 h-6 text-purple-400" />
          </div>
        </div>
        <div className="absolute top-40 right-20 animate-float-slower">
          <div className="bg-pink-900/30 backdrop-blur-sm p-3 rounded-lg border border-pink-700/30">
            <MessageCircle className="w-6 h-6 text-pink-400" />
          </div>
        </div>
      </motion.div>

      {/* Chat Container */}
      <motion.div
        variants={fadeIn}
        className="max-w-7xl mx-auto px-6 pb-12"
      >
        <div className="bg-gray-800/50 backdrop-blur-sm rounded-2xl shadow-2xl border border-gray-700/50 h-[70vh]">
          <ChatWindow onClose={() => window.history.back()} />
        </div>
      </motion.div>
    </motion.div>
  );
};

export default SupportPage;