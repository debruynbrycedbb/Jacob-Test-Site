import { useEffect, useRef } from 'react';
import { navLinks, designYourProduct, contact, social } from '../menuData.js';
import {
  PhoneIcon,
  MailIcon,
  MapIcon,
  ClockIcon,
  SlidersIcon,
  InstagramIcon,
  ThreadsIcon,
} from './Icons.jsx';

const socialIcons = { Instagram: InstagramIcon, Threads: ThreadsIcon };

export default function Menu({ open, onClose, id }) {
  const panelRef = useRef(null);

  // Close on Escape, move focus into the panel when it opens
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    const first = panelRef.current?.querySelector('a');
    first?.focus({ preventScroll: true });
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  return (
    <>
      <div className={`menu-scrim ${open ? 'is-open' : ''}`} onClick={onClose} aria-hidden="true" />
      <nav
        id={id}
        ref={panelRef}
        className={`menu ${open ? 'is-open' : ''}`}
        aria-label="Main menu"
        aria-hidden={!open}
        inert={open ? undefined : ''}
      >
        <ul className="menu__links">
          {navLinks.map((l, i) => (
            <li key={l.label} style={{ '--i': i }}>
              <a href={l.href} onClick={onClose}>
                {l.label}
              </a>
            </li>
          ))}
        </ul>

        <hr className="menu__rule" />

        <a className="menu__design" href={designYourProduct.href} onClick={onClose}>
          {designYourProduct.label}
          <SlidersIcon />
        </a>

        <hr className="menu__rule" />

        <ul className="menu__contact">
          <li>
            <PhoneIcon />
            <a href={contact.phone.href}>{contact.phone.display}</a>
          </li>
          <li>
            <MailIcon />
            <a href={contact.email.href}>{contact.email.display}</a>
          </li>
          <li>
            <MapIcon />
            <a href={contact.studio.href} target="_blank" rel="noreferrer">
              {contact.studio.lines.map((line) => (
                <span key={line}>{line}</span>
              ))}
            </a>
          </li>
          <li>
            <ClockIcon />
            <span>{contact.hours}</span>
          </li>
        </ul>

        <ul className="menu__social">
          {social.map((s) => {
            const Icon = socialIcons[s.name];
            return (
              <li key={s.name}>
                <a href={s.href} aria-label={s.name}>
                  <Icon />
                </a>
              </li>
            );
          })}
        </ul>
      </nav>
    </>
  );
}
