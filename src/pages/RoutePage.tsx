import { Link } from 'react-router-dom';

import { Bus, Footprints, MapPin, Navigation, Train } from 'lucide-react';

import { SiteHeader } from '../components/SiteHeader';

export default function RoutePage() {
  return (
    <main className="route-page">
      <SiteHeader />
      <section className="route-layout">
        <div className="route-copy">
          <p className="eyebrow">LET'S CONNECT THE DOTS</p>
          <h2>
            다음 장소까지,
            <br />
            <em>얼마나 걸릴까요?</em>
          </h2>
          <p>출발지와 목적지를 고르면 이동 시간과 경로를 한눈에 확인할 수 있어요.</p>
          <div className="route-stops">
            <span>
              <i>1</i> 경복궁 <small>출발</small>
            </span>
            <div />
            <span>
              <i>2</i> 서울숲 <small>도착</small>
            </span>
          </div>
          <button className="route-search">
            <Navigation size={18} /> 다른 이동 경로 보기
          </button>
        </div>
        <div className="route-ticket">
          <div className="ticket-top">
            <span>SEOUL DAY PASS</span>
            <b>42 min</b>
          </div>
          <div className="ticket-line">
            <i />
            <i />
            <i />
            <i />
          </div>
          <div className="ticket-route">
            <strong>경복궁</strong>
            <span>
              <Train size={18} /> 3호선 → 2호선
            </span>
            <strong>서울숲</strong>
          </div>
          <ol>
            <li>
              <Footprints size={16} /> 경복궁역까지 5분 걷기
            </li>
            <li>
              <Bus size={16} /> 을지로3가에서 한 번 환승
            </li>
            <li>
              <Footprints size={16} /> 서울숲역에서 8분 걷기
            </li>
          </ol>
          <Link to="/explore" className="ticket-map">
            <MapPin size={17} /> 지도에서 장소 보기
          </Link>
        </div>
      </section>
    </main>
  );
}
