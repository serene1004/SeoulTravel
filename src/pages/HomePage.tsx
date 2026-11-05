import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

import { ArrowRight, ArrowUp, CloudSun, MapPinned, Route, Shirt } from 'lucide-react';

import { SiteHeader } from '../components/SiteHeader';
import { useLocale } from '../context/useLocale';
import { getOutfitRecommendation } from '../data/weather';
import { useSeoulWeather } from '../hooks/useSeoulWeather';
import { t } from '../i18n/messages';

import type { LucideIcon } from 'lucide-react';

const publicAsset = (path: string) => `${import.meta.env.BASE_URL}${path}`;

const features: {
  icon: LucideIcon;
  label: 'findPlaces' | 'planRoute' | 'checkToday';
  title: 'featurePlaces' | 'featureRoute' | 'featureWeather';
  text: 'featurePlacesText' | 'featureRouteText' | 'featureWeatherText';
  visualImage?: {
    src: string;
    alt: 'mapPlacesIllustrationAlt' | 'routeIllustrationAlt';
  };
  visualType?: 'weather';
  href: string;
}[] = [
  {
    icon: MapPinned,
    label: 'findPlaces',
    title: 'featurePlaces',
    text: 'featurePlacesText',
    visualImage: {
      src: publicAsset('images/landing/find-places.png'),
      alt: 'mapPlacesIllustrationAlt',
    },
    href: '/explore',
  },
  {
    icon: Route,
    label: 'planRoute',
    title: 'featureRoute',
    text: 'featureRouteText',
    visualImage: {
      src: publicAsset('images/landing/plan-route.png'),
      alt: 'routeIllustrationAlt',
    },
    href: '/routes',
  },
  {
    icon: Shirt,
    label: 'checkToday',
    title: 'featureWeather',
    text: 'featureWeatherText',
    visualType: 'weather',
    href: '/weather',
  },
];

const heroSlides = [
  { src: publicAsset('images/landing/bukchon.webp'), label: 'Bukchon Hanok Village' },
  { src: publicAsset('images/landing/cheonggyecheon.webp'), label: 'Cheonggyecheon Stream' },
  { src: publicAsset('images/landing/ddp.webp'), label: 'Dongdaemun Design Plaza' },
  { src: publicAsset('images/landing/hanriver.webp'), label: 'Han River Park' },
];

export default function HomePage() {
  const [activeSlide, setActiveSlide] = useState(0);
  const [showGoTop, setShowGoTop] = useState(false);
  const { locale } = useLocale();
  const { forecast, hasError: weatherError, retry: retryWeather } = useSeoulWeather();
  const weatherOutfit = forecast ? getOutfitRecommendation(forecast, locale) : undefined;
  const heroSlide = heroSlides[activeSlide];

  useEffect(() => {
    const timer = window.setInterval(() => {
      setActiveSlide((current) => (current + 1) % heroSlides.length);
    }, 5000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const updateScrollPosition = () => setShowGoTop(window.scrollY > 480);
    updateScrollPosition();
    window.addEventListener('scroll', updateScrollPosition, { passive: true });
    return () => window.removeEventListener('scroll', updateScrollPosition);
  }, []);

  const goToTop = () => {
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    window.scrollTo({ top: 0, behavior: prefersReducedMotion ? 'auto' : 'smooth' });
  };

  return (
    <main className="landing-page">
      <SiteHeader overlay />
      <section className="landing-hero" aria-label={heroSlide.label}>
        <div
          key={heroSlide.src}
          className="landing-hero-image"
          role="img"
          aria-label={heroSlide.label}
          style={{ backgroundImage: `url("${heroSlide.src}")` }}
        />
        <div className="landing-hero-content">
          <p className="eyebrow">{t(locale, 'homeKicker')}</p>
          <h2>{t(locale, 'homeTitle')}</h2>
          <p>{t(locale, 'homeSubtitle')}</p>
        </div>
      </section>
      <section className="landing-intro">
        <p className="eyebrow">{t(locale, 'homeIntroKicker')}</p>
        <h2>{t(locale, 'homeIntroTitle')}</h2>
        <p>{t(locale, 'homeIntroText')}</p>
      </section>
      <section className="feature-section">
        {features.map(
          ({ icon: Icon, label, title, text, visualType, visualImage, href }, index) => (
            <article className={`feature-row ${index % 2 === 1 ? 'reverse' : ''}`} key={label}>
              <div
                className="feature-image"
                aria-label={
                  visualType === 'weather'
                    ? (weatherOutfit?.alt ??
                      (weatherError ? t(locale, 'weatherError') : t(locale, 'mapLoadingWeather')))
                    : visualImage
                      ? t(locale, visualImage.alt)
                      : undefined
                }
                role="img"
              >
                {visualType === 'weather' ? (
                  <div className="weather-visual-frame">
                    {weatherOutfit ? (
                      <img
                        src={publicAsset(`images/weather-outfits/${weatherOutfit.image}`)}
                        alt={weatherOutfit.alt}
                        loading="lazy"
                      />
                    ) : (
                      <div className="weather-visual-status" aria-hidden="true">
                        <CloudSun size={28} />
                        <span>
                          {weatherError
                            ? t(locale, 'mapWeatherError')
                            : t(locale, 'mapLoadingWeather')}
                        </span>
                      </div>
                    )}
                  </div>
                ) : (
                  visualImage && (
                    <img
                      className="feature-illustration"
                      src={visualImage.src}
                      alt=""
                      loading="lazy"
                    />
                  )
                )}
              </div>
              <div className="feature-copy">
                <div className="feature-kicker">
                  <span className="feature-icon">
                    <Icon size={19} />
                  </span>
                  <p className="eyebrow">{t(locale, label)}</p>
                </div>
                <h3>
                  {t(locale, title)
                    .split('\n')
                    .map((line) => (
                      <span key={line}>
                        {line}
                        <br />
                      </span>
                    ))}
                </h3>
                <p>
                  {visualType === 'weather' && weatherError
                    ? t(locale, 'weatherError')
                    : t(locale, text)}
                </p>
                {visualType === 'weather' && weatherError && (
                  <button className="weather-retry-link" type="button" onClick={retryWeather}>
                    {t(locale, 'retry')}
                  </button>
                )}
                <Link to={href}>
                  {t(locale, 'learnMore')} <ArrowRight size={15} />
                </Link>
              </div>
            </article>
          ),
        )}
      </section>
      {showGoTop && (
        <button
          className="landing-go-top"
          type="button"
          onClick={goToTop}
          aria-label={t(locale, 'backToTop')}
        >
          <ArrowUp size={20} aria-hidden="true" />
        </button>
      )}
    </main>
  );
}
