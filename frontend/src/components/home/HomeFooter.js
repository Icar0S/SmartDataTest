import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Heart, Shield, Sparkles } from 'lucide-react';
import BrandMark from '../landing/BrandMark';
import Reveal from '../landing/Reveal';
import { versionLabel } from '../../config/version';

/** Closing call to action. */
export function CtaBand({ t }) {
  return (
    <section aria-labelledby="cta-title" className="relative py-16 md:py-24">
      <div className="section-container">
        <Reveal>
          <div className="relative overflow-hidden rounded-[2rem] border border-sdt-violet/20 bg-gradient-to-br from-violet-600/25 via-fuchsia-600/10 to-pink-600/20 px-6 py-14 text-center sm:px-12 md:py-20">
            <div aria-hidden="true" className="bg-grid mask-radial absolute inset-0 opacity-70" />
            <div
              aria-hidden="true"
              className="absolute -top-28 left-1/2 h-72 w-[38rem] max-w-full -translate-x-1/2 rounded-full bg-[radial-gradient(circle,rgba(232,121,249,0.35),transparent_65%)] blur-2xl"
            />
            <div className="relative">
              <h2 id="cta-title" className="mx-auto max-w-2xl font-display text-3xl font-bold tracking-tight text-sdt-fg sm:text-5xl">
                {t.cta.title}
              </h2>
              <p className="mx-auto mt-4 max-w-xl text-sdt-muted-strong md:text-lg">{t.cta.subtitle}</p>
              <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
                <Link
                  to="/qa-checklist"
                  className="group relative inline-flex items-center justify-center gap-2 overflow-hidden rounded-full bg-white px-6 py-3 text-sm font-semibold text-gray-900 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_0_44px_-6px_rgba(196,181,253,0.8)]"
                >
                  <span aria-hidden="true" className="shine" />
                  <span className="relative">{t.cta.primary}</span>
                  <ArrowRight className="relative h-4 w-4" aria-hidden="true" />
                </Link>
                <Link
                  to="/generate-dataset"
                  className="inline-flex items-center justify-center gap-2 rounded-full px-6 py-3 text-sm font-medium text-sdt-fg glass transition-all duration-300 hover:-translate-y-0.5 hover:border-sdt-violet/40"
                >
                  <Sparkles className="h-4 w-4 text-sdt-pink" aria-hidden="true" />
                  {t.cta.secondary}
                </Link>
              </div>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

export default function HomeFooter({ t }) {
  const items = t.modules.items;
  const columns = [
    {
      title: t.footer.product,
      links: [
        { to: '/qa-checklist', label: items.pyspark.title },
        { to: '/data-accuracy', label: items.accuracy.title },
        { to: '/generate-dataset', label: items.synthetic.title },
      ],
    },
    {
      title: t.footer.resources,
      links: [
        { to: '/methodology', label: items.methodology.title },
        { to: '/checklist', label: items.checklist.title },
        { to: '/support-rag', label: items.rag.title },
      ],
    },
  ];

  return (
    <footer className="relative border-t border-white/[0.06]">
      <div className="section-container py-14">
        <div className="grid gap-10 md:grid-cols-[1.5fr_1fr_1fr]">
          <div>
            <BrandMark />
            <p className="mt-4 max-w-xs text-sm leading-relaxed text-sdt-muted">{t.footer.tagline}</p>
          </div>
          {columns.map((column) => (
            <nav key={column.title} aria-label={column.title}>
              <h3 className="font-code text-[11px] uppercase tracking-[0.2em] text-sdt-muted">{column.title}</h3>
              <ul className="mt-4 space-y-2.5">
                {column.links.map((link) => (
                  <li key={link.to}>
                    <Link to={link.to} className="text-sm text-sdt-muted-strong transition-colors hover:text-sdt-violet-strong">
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>

        <div className="mt-12 flex flex-col items-center justify-between gap-3 border-t border-white/[0.06] pt-6 text-xs text-sdt-muted md:flex-row">
          <div className="flex items-center gap-2">
            <Shield className="h-4 w-4 text-sdt-violet" aria-hidden="true" />
            <span>{t.footer.copyright}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span>{t.footer.builtWith}</span>
            <Heart className="h-3 w-3 fill-pink-500 text-pink-500" aria-hidden="true" />
            <span className="font-code">{t.footer.tech}</span>
          </div>
          <span className="font-code">{versionLabel()} · 2026</span>
        </div>
        <p className="mt-3 text-center text-xs text-sdt-muted/70 md:text-left">{t.footer.rights}</p>
      </div>
    </footer>
  );
}
