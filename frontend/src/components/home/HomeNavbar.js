import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { LogOut, Menu, Shield, X } from 'lucide-react';
import LanguageToggle from '../LanguageToggle';
import BrandMark from '../landing/BrandMark';
import { useScrolled } from '../landing/motion';
import { scrollToSection } from './icons';

const iconButton =
  'grid h-9 w-9 place-items-center rounded-full text-sdt-muted transition-colors duration-200 hover:bg-white/[0.06] hover:text-sdt-fg';

/**
 * Sticky top bar: transparent over the hero, glass once the page scrolls.
 * Below md the page links move into a menu; the account controls stay.
 */
export default function HomeNavbar({ t, user, onLogout }) {
  const scrolled = useScrolled(12);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (event) => {
      if (event.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  const links = [
    { to: '/methodology', label: t.nav.methodology },
    { to: '/checklist', label: t.nav.checklist },
    { to: '/generate-dataset', label: t.nav.generate },
  ];

  const solid = scrolled || open;

  return (
    <header
      className={`sticky top-0 z-50 transition-[background-color,border-color,box-shadow,backdrop-filter] duration-500 ${
        solid
          ? 'glass-strong border-x-0 border-t-0 shadow-[0_12px_40px_-24px_rgba(0,0,0,0.9)]'
          : 'border-b border-transparent'
      }`}
    >
      <div className="section-container flex h-16 items-center justify-between gap-4 md:h-[4.5rem]">
        <a href="#inicio" onClick={(event) => scrollToSection(event, 'inicio')} className="rounded-xl">
          <BrandMark />
        </a>

        <nav aria-label={t.nav.main} className="hidden items-center gap-1 md:flex">
          <a
            href="#inicio"
            aria-current="page"
            onClick={(event) => scrollToSection(event, 'inicio')}
            className="rounded-full bg-white/[0.06] px-3.5 py-2 text-sm font-medium text-sdt-fg"
          >
            {t.nav.home}
          </a>
          {links.map((link) => (
            <Link
              key={link.to}
              to={link.to}
              className="rounded-full px-3.5 py-2 text-sm text-sdt-muted transition-colors duration-200 hover:bg-white/[0.04] hover:text-sdt-fg"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-1.5 sm:gap-2.5">
          <div className="hidden sm:block">
            <LanguageToggle size="sm" variant="glass" />
          </div>
          <span className="mx-1 hidden h-6 w-px bg-white/10 sm:block" aria-hidden="true" />
          <span className="flex items-center gap-2.5">
            <span className="grid h-9 w-9 flex-shrink-0 place-items-center rounded-full bg-gradient-to-br from-violet-500 to-pink-500 text-xs font-bold text-white ring-2 ring-white/10">
              {user?.avatar || '?'}
            </span>
            <span className="hidden max-w-[10rem] truncate text-sm font-medium text-sdt-fg lg:block">{user?.name}</span>
          </span>
          {user?.isAdmin && (
            <Link to="/admin" title={t.admin} aria-label={t.admin} className={`${iconButton} hover:text-sdt-violet-strong`}>
              <Shield className="h-4 w-4" aria-hidden="true" />
            </Link>
          )}
          <button
            type="button"
            onClick={onLogout}
            title={t.logout}
            aria-label={t.logout}
            className={`${iconButton} hover:text-rose-300`}
          >
            <LogOut className="h-4 w-4" aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={() => setOpen((value) => !value)}
            aria-expanded={open}
            aria-controls="home-mobile-nav"
            aria-label={open ? t.nav.closeMenu : t.nav.openMenu}
            className={`${iconButton} md:hidden`}
          >
            {open ? <X className="h-5 w-5" aria-hidden="true" /> : <Menu className="h-5 w-5" aria-hidden="true" />}
          </button>
        </div>
      </div>

      {open && (
        <nav id="home-mobile-nav" aria-label={t.nav.main} className="border-t border-white/[0.06] md:hidden">
          <div className="section-container flex animate-fade-up flex-col gap-1 py-4">
            <a
              href="#modulos"
              onClick={(event) => {
                setOpen(false);
                scrollToSection(event, 'modulos');
              }}
              className="rounded-xl px-3 py-3 text-base font-medium text-sdt-fg hover:bg-white/[0.04]"
            >
              {t.nav.modules}
            </a>
            {links.map((link) => (
              <Link
                key={link.to}
                to={link.to}
                onClick={() => setOpen(false)}
                className="rounded-xl px-3 py-3 text-base text-sdt-muted-strong hover:bg-white/[0.04] hover:text-sdt-fg"
              >
                {link.label}
              </Link>
            ))}
            <div className="px-3 pt-3 sm:hidden">
              <LanguageToggle size="sm" variant="glass" />
            </div>
          </div>
        </nav>
      )}
    </header>
  );
}
