import React from 'react';
import { useAuthContext } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import useAuth from '../hooks/useAuth';
import AuroraBackground from './landing/AuroraBackground';
import ScrollProgress from './landing/ScrollProgress';
import { copy } from './home/content';
import HomeFooter, { CtaBand } from './home/HomeFooter';
import HomeHero from './home/HomeHero';
import HomeNavbar from './home/HomeNavbar';
import ModulesSection from './home/ModulesSection';
import RoadmapSection from './home/RoadmapSection';
import ScenariosSection from './home/ScenariosSection';
import StatsBand from './home/StatsBand';
import StructuresSection from './home/StructuresSection';
import WorkflowSection from './home/WorkflowSection';

/**
 * The home page: what the platform does and the way into each module.
 * Sections live in ./home, the building blocks they share in ./landing.
 */
export default function HomePage() {
  const { user } = useAuthContext();
  const { language } = useLanguage();
  const { handleLogout } = useAuth();
  const t = copy[language] ?? copy['en-US'];

  return (
    <div className="sdt-landing">
      <AuroraBackground />
      <ScrollProgress />
      <HomeNavbar t={t} user={user} onLogout={handleLogout} />
      <main>
        <HomeHero t={t} language={language} />
        <StatsBand t={t} language={language} />
        <ModulesSection t={t} />
        <WorkflowSection t={t} />
        <StructuresSection t={t} language={language} />
        <ScenariosSection t={t} language={language} />
        <RoadmapSection t={t} language={language} />
        <CtaBand t={t} />
      </main>
      <HomeFooter t={t} />
    </div>
  );
}
