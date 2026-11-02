import { useCallback, useEffect, useState } from 'react';
import JacketReveal from './components/JacketReveal.jsx';
import EarthSection from './components/EarthSection.jsx';
import WaterSection from './components/WaterSection.jsx';
import Co2Section from './components/Co2Section.jsx';
import StudioSection from './components/StudioSection.jsx';
import Menu from './components/Menu.jsx';
import plainJacket from './assets/jacket-plain.webp';
import designJacket from './assets/jacket-sagrada.webp';
import skyline1600 from './assets/barcelona-skyline-1600.jpg';
import skyline3200 from './assets/barcelona-skyline-3200.jpg';

export default function App() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [touch, setTouch] = useState(false);
  const closeMenu = useCallback(() => setMenuOpen(false), []);

  const [lightBar, setLightBar] = useState(false);

  useEffect(() => {
    setTouch(window.matchMedia('(hover: none)').matches);
  }, []);

  // Switch the fixed bar to dark ink while a light section sits under it
  useEffect(() => {
    let raf = 0;
    const check = () => {
      raf = 0;
      const y = 40;
      const light = [...document.querySelectorAll('[data-theme="light"]')].some((el) => {
        const r = el.getBoundingClientRect();
        return r.top <= y && r.bottom > y;
      });
      setLightBar(light);
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(check);
    };
    check();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
    };
  }, []);

  return (
    <>
      <header className={`topbar ${lightBar ? 'is-light' : ''}`}>
        <button
          type="button"
          className={`menu-toggle ${menuOpen ? 'is-open' : ''}`}
          aria-expanded={menuOpen}
          aria-controls="site-menu"
          onClick={() => setMenuOpen((o) => !o)}
        >
          <span className="menu-toggle__lines" aria-hidden="true">
            <span />
            <span />
          </span>
          <span className="menu-toggle__label">{menuOpen ? 'Close' : 'Menu'}</span>
        </button>

        <a className="topbar__brand" href="#" aria-label="Jackob Buczynski, home page">
          Jackob Buczynski
        </a>

        <a className="topbar__store" href="#store">
          Store
        </a>

        <Menu id="site-menu" open={menuOpen} onClose={closeMenu} />
      </header>

      <main>
        <section className="hero" aria-labelledby="hero-title">
          <img
            className="hero__bg"
            src={skyline1600}
            srcSet={`${skyline1600} 1600w, ${skyline3200} 3200w`}
            sizes="100vw"
            alt=""
            fetchpriority="high"
          />
          <div className="hero__grade" aria-hidden="true" />

          <h1 id="hero-title" className="hero__title">
            <span>Remade</span>
            <span>Barcelona</span>
          </h1>

          <div className="hero__stage">
            <JacketReveal
              plainSrc={plainJacket}
              designSrc={designJacket}
              label="Grey denim jacket seen from the back. Hovering reveals a hand-painted Sagrada Família on the back panel."
            />
          </div>

          <p className="hero__hint">
            <span className="hero__hint-dot" aria-hidden="true" />
            {touch ? 'Touch the jacket to reveal the back piece' : 'Hover over the jacket to reveal the back piece'}
          </p>
        </section>

        <EarthSection />
        <WaterSection />
        <Co2Section />
        <StudioSection />
      </main>
    </>
  );
}
