import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

import { ArrowRight, MapPinned, Navigation, Shirt } from 'lucide-react';

import { SiteHeader } from '../components/SiteHeader';

const features = [
  {
    icon: MapPinned,
    label: 'Find places',
    title: '관광명소·카페·식당을\n지도에서 찾아보세요.',
    text: '서울 곳곳의 장소를 지도에서 살펴보고, 여행에 맞는 곳을 골라보세요.',
    className: 'spot-visual',
    href: '/explore',
  },
  {
    icon: Navigation,
    label: 'Plan a route',
    title: '장소 사이 이동 시간을\n미리 확인하세요.',
    text: '출발지와 목적지를 고르면 이동 시간과 경로를 한눈에 확인할 수 있어요.',
    className: 'route-visual',
    href: '/routes',
  },
  {
    icon: Shirt,
    label: 'Check today',
    title: '서울의 날씨를\n확인해 보세요.',
    text: '서울의 현재 날씨와 시간대별 예보를 확인해 보세요.',
    className: 'weather-visual',
    href: '/weather',
  },
];

const heroSlides = [
  { src: '/images/landing/bukchon.webp', label: 'Bukchon Hanok Village' },
  { src: '/images/landing/cheonggyecheon.webp', label: 'Cheonggyecheon Stream' },
  { src: '/images/landing/ddp.webp', label: 'Dongdaemun Design Plaza' },
  { src: '/images/landing/hanriver.webp', label: 'Han River Park' },
];

const weatherOutfitSlides = [
  { src: '/images/weather-outfits/cold.png', alt: '추운 날씨에 어울리는 따뜻한 코디' },
  { src: '/images/weather-outfits/cool.png', alt: '쌀쌀한 날씨에 어울리는 겹쳐 입기 코디' },
  { src: '/images/weather-outfits/mild.png', alt: '선선한 날씨에 어울리는 가벼운 코디' },
  { src: '/images/weather-outfits/warm.png', alt: '따뜻한 날씨에 어울리는 시원한 코디' },
];

export default function HomePage() {
  const [activeSlide, setActiveSlide] = useState(0);
  const [weatherOutfitSlide] = useState(() =>
    Math.floor(Math.random() * weatherOutfitSlides.length),
  );
  const heroSlide = heroSlides[activeSlide];

  useEffect(() => {
    const timer = window.setInterval(() => {
      setActiveSlide((current) => (current + 1) % heroSlides.length);
    }, 5000);
    return () => window.clearInterval(timer);
  }, []);

  return (
    <main className="landing-page">
      <SiteHeader overlay />
      <section className="landing-hero" aria-label={heroSlide.label}>
        <div
          key={heroSlide.src}
          className="landing-hero-image"
          role="img"
          aria-label={heroSlide.label}
          style={{ backgroundImage: `url(${heroSlide.src})` }}
        />
        <div className="landing-hero-content">
          <p className="eyebrow">YOUR LITTLE SEOUL TRIP</p>
          <h2>
            <span>서울 여행을</span>
            <br />더 쉽게 준비하세요.
          </h2>
          <p>관광명소부터 이동 시간과 경로 그리고 날씨까지</p>
        </div>
      </section>
      <section className="landing-intro">
        <p className="eyebrow">ABOUT SEOUL PATH</p>
        <h2>
          서울 여행에 필요한 정보를
          <br />
          <em>한곳에 담았어요.</em>
        </h2>
        <p>
          관광명소와 카페·식당을 살펴보고, 장소 정보와 이동 시간, 날씨에 맞는 여행 복장까지 한곳에서
          확인하세요.
        </p>
      </section>
      <section className="feature-section">
        {features.map(({ icon: Icon, label, title, text, className, href }, index) => (
          <article className={`feature-row ${index % 2 === 1 ? 'reverse' : ''}`} key={label}>
            <div
              className={`feature-image ${className}`}
              aria-label={className === 'weather-visual' ? '오늘의 옷차림 참고 이미지' : `${label} image placeholder`}
              role="img"
            >
              {className === 'weather-visual' ? (
                <div className="weather-visual-frame">
                  <img
                    src={weatherOutfitSlides[weatherOutfitSlide].src}
                    alt={weatherOutfitSlides[weatherOutfitSlide].alt}
                    loading="lazy"
                  />
                </div>
              ) : (
                <></>
              )}
            </div>
            <div className="feature-copy">
              <span className="feature-icon">
                <Icon size={19} />
              </span>
              <p className="eyebrow">{label}</p>
              <h3>
                {title.split('\n').map((line) => (
                  <span key={line}>
                    {line}
                    <br />
                  </span>
                ))}
              </h3>
              <p>{text}</p>
              <Link to={href}>
                자세히 보기 <ArrowRight size={15} />
              </Link>
            </div>
          </article>
        ))}
      </section>
    </main>
  );
}
