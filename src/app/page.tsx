"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, type MouseEvent, type ReactNode } from "react";
import { BrandLogoContent } from "@/components/layout/BrandLogo";
import {
  getHeaderProfileImageUrl,
  type HeaderAuthState,
  readHeaderAuthState,
} from "@/components/layout/headerAuth";
import { ProfileMenu } from "@/components/layout/ProfileMenu";
import { NotificationDropdown } from "@/components/notification/NotificationDropdown";
import { authApi } from "@/lib/api";
import { clearAuthSession, subscribeAuthChanged } from "@/lib/auth";
import { SiFigma, SiGoogle, SiNotion, SiSlack } from "react-icons/si";
import { BsChatDotsFill } from "react-icons/bs";
import {
  FiCheckCircle,
  FiClipboard,
  FiCompass,
  FiEdit3,
  FiFlag,
  FiGift,
  FiLink,
  FiPlayCircle,
  FiSettings,
  FiUserPlus,
} from "react-icons/fi";

const heroSlides = [
  {
    eyebrow: "SMART COLLABORATION",
    title: "협업을 다루는 새로운 방식",
    desc: "재능을 스마트하게 연결하고, 첫 협업의 기준을 제시합니다.",
    icon: "slack",
  },
  {
    eyebrow: "TALENT MATCHING",
    title: "필요한 도움을 한 화면에서",
    desc: "디자인, 개발, 글쓰기, 피드백까지 작은 단위로 빠르게 매칭합니다.",
    icon: "google",
  },
  {
    eyebrow: "PORTFOLIO RECORD",
    title: "경험이 결과물로 남도록",
    desc: "작업 과정과 피드백을 정리해 포트폴리오에 담을 수 있게 돕습니다.",
    icon: "notion",
  },
];

const storyCards = [
  {
    title: "대학생부터 취준생,",
    highlight: "첫 프로젝트까지",
    desc: "Baton을 도입한 사람들이 직접 쌓아가는 협업 경험",
  },
  {
    title: "작은 교환으로 시작해",
    highlight: "완성도 있는 결과까지",
    desc: "부담 없는 제안과 명확한 역할 분담으로 첫 협업을 쉽게 만듭니다.",
  },
  {
    title: "혼자 막히던 순간을",
    highlight: "함께 해결하는 방식",
    desc: "디자인 감각, 코드 구현, 문장 정리, 피드백을 필요한 만큼 연결합니다.",
  },
  {
    title: "결과물과 기록을",
    highlight: "동시에 남기는 구조",
    desc: "협업 과정이 포트폴리오 경험으로 자연스럽게 이어집니다.",
  },
];

const logos = [
  "DESIGN", "FRONTEND", "CONTENT", "REVIEW", "UI/UX", "PORTFOLIO",
  "FIGMA", "NEXT", "HTML", "CSS", "BRAND", "COPY", "TEAM", "PROJECT",
  "MENTOR", "CLASS", "BETA", "FLOW", "Baton", "MATCH"
];

const serviceCards = [
  {
    title: "협업 흐름을 한눈에",
    desc: "재능 등록부터 도움 요청, 매칭과 결과 기록까지 하나의 흐름으로 보여줍니다.",
    visual: "dark",
  },
  {
    title: "작은 단위로 제안",
    desc: "하루, 한 화면, 한 기능처럼 부담 없는 기준으로 교환을 시작합니다.",
    visual: "soft",
  },
  {
    title: "익숙한 작업 도구와 연결",
    desc: "포트폴리오, 코드, 디자인 시안 등 실제 작업물 중심으로 협업합니다.",
    visual: "tools",
  },
  {
    title: "데이터로 보는 성장",
    desc: "완료한 교환, 받은 피드백, 협업 기록을 쌓아 다음 기회로 이어갑니다.",
    visual: "chart",
  },
];

const productCards = [
  {
    label: "재능 매칭",
    title: "Rooms",
    desc: "작업 주제별로 사람과 도움을 모아 협업이 시작되는 공간을 만듭니다.",
    icon: "match",
  },
  {
    label: "협업 기록",
    title: "Desk",
    desc: "제안, 피드백, 결과물을 정리해 포트폴리오로 연결합니다.",
    icon: "desk",
  },
];

const experienceCards = [
  {
    title: "협업 컨설팅",
    desc: "처음 협업하는 사람도 쉽게 시작할 수 있도록 요청 범위를 정리합니다.",
    tone: "purple",
    icon: "consulting",
  },
  {
    title: "무료 교환 제안",
    desc: "간단한 도움부터 시작해 부담 없이 서로의 재능을 경험합니다.",
    tone: "mint",
    icon: "exchange",
  },
  {
    title: "데모 세션 진행",
    desc: "작업 방식과 결과물 형태를 미리 확인하고 방향을 맞춥니다.",
    tone: "orange",
    icon: "demo",
  },
  {
    title: "커스텀 세팅",
    desc: "내 프로젝트와 목적에 맞춰 매칭 조건을 구체화합니다.",
    tone: "blue",
    icon: "setting",
  },
];

const flowLeft = [
  {
    title: "재능 등록",
    desc: "내가 줄 수 있는 도움을 짧고 명확한 카드로 정리",
    icon: "register",
  },
  {
    title: "도움 요청",
    desc: "디자인, 구현, 글쓰기, 리뷰처럼 필요한 도움 선택",
    icon: "request",
  },
  {
    title: "작업 범위 합의",
    desc: "하루, 한 화면, 한 기능 단위로 부담 없이 조율",
    icon: "scope",
  },
];

const flowRight = [
  {
    title: "교환 매칭",
    desc: "서로 필요한 재능이 맞는 사람과 작은 협업 시작",
    icon: "matching",
  },
  {
    title: "결과 기록",
    desc: "완성물, 피드백, 협업 과정을 포트폴리오 경험으로 저장",
    icon: "record",
  },
];

const landingNavItems = [
  { href: "/talents", label: "재능 둘러보기" },
  { href: "/talents/new", label: "재능 등록" },
  { href: "/matches", label: "매칭 추천" },
  { href: "/trades", label: "거래" },
  { href: "/chats", label: "채팅" },
  { href: "/credits", label: "크레딧" },
];

const landingAdminNavItems = [
  { href: "/talents", label: "재능 둘러보기" },
  { href: "/admin", label: "관리자" },
];

export default function Home() {
  const router = useRouter();
  const [current, setCurrent] = useState(0);
  const [authState, setAuthState] = useState<HeaderAuthState>({
    isLoggedIn: false,
    nickname: null,
    profileImageUrl: null,
    role: null,
  });

  const activeSlide = useMemo(() => heroSlides[current], [current]);
  const isAdmin = authState.role === "ADMIN";
  const visibleNavItems = isAdmin ? landingAdminNavItems : landingNavItems;

  async function handleLogout(): Promise<void> {
    try {
      await authApi.logout();
    } catch {
      // 로그아웃 API 실패 여부와 관계없이 로컬 세션은 정리합니다.
    } finally {
      clearAuthSession();
      router.push("/login");
    }
  }

  // 무료 시작 버튼 스크롤 속도 조절
  function scrollToStart(event: MouseEvent<HTMLAnchorElement>) {
    event.preventDefault();

    const target = document.getElementById("start");
    if (!target) return;

    const startY = window.scrollY;
    const targetY = target.getBoundingClientRect().top + window.scrollY;
    const distance = targetY - startY;
    const duration = 1850;
    const startTime = performance.now();

    function easeInOutQuad(t: number) {
      return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
    }

    function animate(currentTime: number) {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const easedProgress = easeInOutQuad(progress);

      window.scrollTo({
        top: startY + distance * easedProgress,
        behavior: "auto",
      });

      if (progress < 1) {
        requestAnimationFrame(animate);
      }
    }

    requestAnimationFrame(animate);
  }

  useEffect(() => {
    function syncAuthState(): void {
      setAuthState(readHeaderAuthState());
    }

    const timeoutId = window.setTimeout(syncAuthState, 0);
    const unsubscribe = subscribeAuthChanged(syncAuthState);

    return () => {
      window.clearTimeout(timeoutId);
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setCurrent((prev) => (prev + 1) % heroSlides.length);
    }, 5200);

    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const revealItems = document.querySelectorAll(".reveal");

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) entry.target.classList.add("show");
        });
      },
      { threshold: 0.16 }
    );

    revealItems.forEach((item) => observer.observe(item));

    return () => {
      revealItems.forEach((item) => observer.unobserve(item));
    };
  }, []);

  return (
    <main className="handlyPage">
      <header className="siteHeader">
        <div className="headerInner">
          <Link className="brandLogo" href="/" aria-label="Baton 홈" draggable={false}>
            <BrandLogoContent />
          </Link>

          <nav className="navMenu" aria-label="메인 메뉴">
            {visibleNavItems.map((item) => (
              <Link key={item.href} href={item.href}>
                {item.label}
              </Link>
            ))}
          </nav>

          <div className="headerActions">
            {authState.isLoggedIn ? (
              <>
                <NotificationDropdown />
                <ProfileMenu
                  nickname={authState.nickname}
                  profileImageUrl={getHeaderProfileImageUrl(authState)}
                  isAdmin={isAdmin}
                  onLogout={handleLogout}
                />
              </>
            ) : (
              <>
                <Link href="/login" className="ghostBtn">
                  로그인
                </Link>
                <Link href="/signup" className="purpleBtn">
                  회원가입
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      <section className="heroSection">
        <div className="heroNoise" />
        <div className="mobileHeroCompact">
          <p className="mobileHeroEyebrow">SMART COLLABORATION</p>
          <h1>협업을 다루는 새로운 방식</h1>
          <p className="mobileHeroDesc">
            재능을 스마트하게 연결하고, 첫 협업의 기준을 제시합니다.
          </p>
          <div className="mobileHeroActions">
            <Link href="/talents" className="mobileHeroSecondary">
              재능 둘러보기
            </Link>
            <a href="#start" className="mobileHeroPrimary" onClick={scrollToStart}>
              무료 시작
            </a>
          </div>
          <div className="mobileLaptopPreview" aria-hidden="true">
            <div className="mobileLaptopScreen">
              <div className="mobileLaptopSide" />
              <div className="mobileLaptopBoard">
                <span />
                <span />
                <span />
                <span />
                <span />
                <span />
              </div>
            </div>
            <div className="mobileLaptopBase" />
          </div>
          <div className="mobileSlideDots" aria-hidden="true">
            <span className="active" />
            <span />
            <span />
          </div>
        </div>
        <FloatingIcon className="floatIcon slack" icon={<SiSlack />} />
        <FloatingIcon className="floatIcon google" icon={<SiGoogle />} />
        <FloatingIcon className="floatIcon notion" icon={<SiNotion />} />
        <FloatingIcon className="floatIcon figma" icon={<SiFigma />} />
        <FloatingIcon className="floatIcon chat" icon={<BsChatDotsFill />} />

        <div className="heroContent reveal show">
          <p className="heroEyebrow">{activeSlide.eyebrow}</p>
          <h1>{activeSlide.title}</h1>
          <p className="heroDesc">{activeSlide.desc}</p>

          <div className="heroButtons">
            <Link href="/talents" className="whitePill">
              재능 둘러보기
            </Link>
            <a href="#start" className="mainPill" onClick={scrollToStart}>
              무료 시작
            </a>
          </div>
        </div>

        <div className="laptopStage reveal show">
          <div className="laptop">
            <div className="laptopTop">
              <span />
              <span />
              <span />
            </div>
            <div className="laptopScreen">
              <div className="screenSidebar" />
              <div className="screenMain">
                <div className="calendarGrid">
                  {Array.from({ length: 18 }).map((_, index) => (
                    <i key={index} className={index % 5 === 0 ? "active" : ""} />
                  ))}
                </div>
              </div>
            </div>
          </div>

          <article className="floatingPanel panelOne">
            <strong>재능 매칭 알림</strong>
            <span>새로운 도움 요청이 도착했어요.</span>
          </article>

          <article className="floatingPanel panelTwo">
            <strong>작업 기록</strong>
            <span>피드백 3개가 업데이트되었습니다.</span>
          </article>
        </div>

        <div className="slideSwitcher" aria-label="히어로 슬라이드">
          {heroSlides.map((slide, index) => (
            <button
              key={slide.title}
              className={index === current ? "active" : ""}
              onClick={() => setCurrent(index)}
              aria-label={`${index + 1}번째 슬라이드 보기`}
            />
          ))}
        </div>
      </section>

      <section id="story" className="storySection">
        <div className="sectionTitle reveal">
          <h2>
            대학생부터 취준생,
            <br />
            첫 협업자까지
          </h2>
          <p>재능 교환으로 첫 결과물을 만든 사람들이 경험하는 변화의 이야기</p>
          <div className="symbolCube">B</div>
        </div>

        <div className="storyCards reveal">
          {storyCards.map((card) => (
            <article className="storyCard" key={card.title}>
              <div className="quoteShape" />
              <h3>
                {card.title}
                <br />
                <span>{card.highlight}</span>
              </h3>
              <p>{card.desc}</p>
            </article>
          ))}
        </div>

        <div className="clientLogos reveal">
          <p>
            실제 협업에서 <strong>검증된 과정</strong>과 다양한 프로젝트에서 축적된{" "}
            <strong>운영 노하우</strong>
          </p>
          <div className="logoMarquee">
            <div className="logoTrack">
              {[...logos, ...logos].map((logo, index) => (
                <span key={`${logo}-${index}`}>{logo}</span>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section id="service" className="serviceSection">
        <div className="sectionTitle reveal">
          <h2>
            재능 교환 서비스 Baton으로
            <br />
            <span className="purpleText">협업 생산성</span>과 포트폴리오 <span className="purpleText">완성도</span>를 높이세요
          </h2>
          <p>구성원과 초보자 모두에게 높은 만족도를 주는 매칭 흐름을 제공합니다.</p>
        </div>

        <div className="serviceGrid reveal">
          {serviceCards.map((card) => (
            <article className={`serviceCard ${card.visual}`} key={card.title}>
              <div>
                <h3>{card.title}</h3>
                <p>{card.desc}</p>
              </div>
              <CssVisual type={card.visual} />
            </article>
          ))}
        </div>
      </section>

      <section className="productSection">
        <div className="sectionTitle reveal">
          <h2>
            스마트한 협업 전환으로,
            <br />
            첫 결과물의 완성도를 높입니다
          </h2>
          <p>다양한 목적과 수준에 맞춰 가장 효율적인 재능 교환 경험을 제공합니다.</p>
        </div>

        <div className="productList">
          {productCards.map((card) => (
            <article className="productCard reveal" key={card.title}>
              <div className="productText">
                <div className="productKicker">
                  <div className={`productIcon productIcon-${card.icon}`} aria-hidden="true" />
                  <span>{card.label}</span>
                </div>
                <h3>{card.title}</h3>
                <p>{card.desc}</p>
                <a href="#start">자세히 보기 →</a>
              </div>
              <div className="isometricBox">
                <span />
                <span />
                <span />
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="deviceSection reveal">
        <h2>현장에서 바로 적용 가능한 협업 흐름</h2>
        <p>웹, 모바일, 포트폴리오 문서까지 작업 상황을 실시간으로 정리합니다.</p>
        <a href="#start" className="mainPill small">사용해보기</a>

        <div className="deviceRow">
          <div className="device tablet" />
          <div className="device phone" />
          <div className="device card" />
          <div className="device board" />
        </div>
      </section>

      <section className="experienceSection">
        <div className="sectionTitle reveal">
          <h2>직접 체험해보면 다릅니다</h2>
          <p>첫 협업에 필요한 준비, 제안, 피드백, 기록까지 자연스럽게 연결합니다.</p>
        </div>

        <div className="experienceGrid reveal">
          {experienceCards.map((card) => (
            <article className={`experienceCard ${card.tone}`} key={card.title}>
              <ExperienceIcon type={card.icon} />
              <h3>{card.title}</h3>
              <p>{card.desc}</p>
            </article>
          ))}
        </div>
      </section>

      <section id="flow" className="flowSection">
        <div className="flowIntro reveal">
          <span>WHO WE ARE</span>
          <h2>
            줄 수 있는 재능과 필요한 도움을 하나의 흐름으로 연결해요
          </h2>
          <p>
            재능 등록부터 도움 요청, 매칭과 결과 기록까지 첫 협업에 필요한 과정을 한 화면에서 이해할 수 있게 설계했습니다.
          </p>
        </div>

        <div className="flowMap reveal">

          <svg
            className="flowConnectors"
            viewBox="0 0 1160 520"
            preserveAspectRatio="none"
            aria-hidden="true"
          >
            <defs>
              <linearGradient id="flowConnectorLeft" x1="388" y1="0" x2="506" y2="0" gradientUnits="userSpaceOnUse">
                <stop offset="0%" stopColor="#62d6cf" stopOpacity="0.64" />
                <stop offset="48%" stopColor="#6fbfe9" stopOpacity="0.74" />
                <stop offset="100%" stopColor="#8c5bff" stopOpacity="0.78" />
              </linearGradient>
              <linearGradient id="flowConnectorRight" x1="772" y1="0" x2="654" y2="0" gradientUnits="userSpaceOnUse">
                <stop offset="0%" stopColor="#62d6cf" stopOpacity="0.7" />
                <stop offset="48%" stopColor="#68c5ef" stopOpacity="0.82" />
                <stop offset="100%" stopColor="#8c5bff" stopOpacity="0.84" />
              </linearGradient>
            </defs>

            <path className="flowConnectorBase flowConnectorDotted" stroke="url(#flowConnectorLeft)" d="M388 74 H442 Q464 74 464 96 V226 H506" />
            <path className="flowConnectorBase flowConnectorDotted" stroke="url(#flowConnectorLeft)" d="M388 260 H506" />
            <path className="flowConnectorBase flowConnectorDotted" stroke="url(#flowConnectorLeft)" d="M388 446 H442 Q464 446 464 424 V294 H506" />
            <path className="flowConnectorBase flowConnectorSolid" stroke="url(#flowConnectorRight)" d="M654 226 H712 Q734 226 734 204 V194 H772" />
            <path className="flowConnectorBase flowConnectorSolid" stroke="url(#flowConnectorRight)" d="M654 294 H712 Q734 294 734 316 V326 H772" />

            <circle className="flowConnectorNode flowConnectorNode-card" cx="388" cy="74" r="5" />
            <circle className="flowConnectorNode flowConnectorNode-card" cx="388" cy="260" r="5" />
            <circle className="flowConnectorNode flowConnectorNode-card" cx="388" cy="446" r="5" />
            <circle className="flowConnectorNode flowConnectorNode-card" cx="772" cy="194" r="5" />
            <circle className="flowConnectorNode flowConnectorNode-card" cx="772" cy="326" r="5" />
            <circle className="flowConnectorNode" cx="506" cy="226" r="5" />
            <circle className="flowConnectorNode" cx="506" cy="260" r="5" />
            <circle className="flowConnectorNode" cx="506" cy="294" r="5" />
            <circle className="flowConnectorNode" cx="654" cy="226" r="5" />
            <circle className="flowConnectorNode" cx="654" cy="294" r="5" />
          </svg>
          <div className="flowColumn left">
            {flowLeft.map((item) => (
              <FlowCard key={item.title} {...item} />
            ))}
          </div>

          <div className="flowHub">
            <div className="hubGlow">
              <div className="hubCore">
                <span>BATON</span>
                <strong>
                  재능 교환
                  <br />
                  허브
                </strong>
              </div>
            </div>
          </div>

          <div className="flowColumn right">
            {flowRight.map((item) => (
              <FlowCard key={item.title} {...item} />
            ))}
          </div>
        </div>
      </section>

      <section id="start" className="getStarted">
        <span className="startOrb startOrbOne" aria-hidden="true" />
        <span className="startOrb startOrbTwo" aria-hidden="true" />
        <span className="startMiniCard startMiniCardOne" aria-hidden="true">Baton</span>
        <span className="startMiniCard startMiniCardTwo" aria-hidden="true">Match</span>

        <h2>
          Get
          <br />
          Started
        </h2>
        <p>작은 재능 교환부터 바로 시작할 수 있습니다.</p>
        <Link href="/signup" className="whitePill">
          시작하기
        </Link>
        <div className="startSticker logoSticker" aria-label="Baton 로고">
          <span className="brandGlyph stickerGlyph" aria-hidden="true">
            <i />
            <i />
          </span>
        </div>
      </section>

      <footer className="pageFooter">
        <div className="footerInner">
          <div className="footerBrand">
            <Link className="footerLogo" href="/" aria-label="Baton 홈">
              <BrandLogoContent />
            </Link>
            <p className="footerTagline">재능을 교환하고 거래하는 매칭 플랫폼</p>
            <p className="footerDescription">
              본 서비스는 프로그래머스 데브코스 최종 프로젝트로 제작된 포트폴리오용 서비스입니다.
            </p>
          </div>

          <nav className="footerNav" aria-label="푸터 메뉴">
            <h2>서비스</h2>
            <Link href="#service">서비스 소개</Link>
            <span>이용약관</span>
            <span>개인정보처리방침</span>
            <span>고객지원</span>
            <a href="https://github.com/" target="_blank" rel="noreferrer">
              GitHub
            </a>
          </nav>

          <div className="footerSupport">
            <h2>고객지원</h2>
            <p>
              <span>이메일</span>
              team03@baton.dev
            </p>
            <p>
              <span>문의 가능 시간</span>
              평일 10:00 ~ 18:00
            </p>
            <p>
              <span>문의 채널</span>
              GitHub Issue 문의 가능
            </p>
          </div>
        </div>

        <div className="footerBottom">
          <p>© 2026 BATON Team. All rights reserved.</p>
          <p>Powered by Programmers Devcourse NBE9-11-final-Team03</p>
        </div>
      </footer>

      <style>{`
        * {
          box-sizing: border-box;
        }

        // 스크롤은 scrollToStart 함수에서 직접 제어합니다.
        // html {
        //   scroll-behavior: smooth;
        // }

        body {
          width: 100%;
          margin: 0;
          overflow-x: hidden;
          background: #ffffff;
          color: #15151f;
          font-family: var(--font-baton);
        }

        a {
          color: inherit;
          text-decoration: none;
        }

        .handlyPage {
          width: 100%;
          min-height: 100vh;
          padding-top: 64px;
          background: #ffffff;
          color: #15151f;
          word-break: keep-all;
        }

        .siteHeader {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          z-index: 1100;
          width: 100%;
          height: 72px;
          background: #ffffff;
          border-bottom: 1px solid rgba(15, 23, 42, 0.08);
          backdrop-filter: none;
          -webkit-backdrop-filter: none;
        }

        .headerInner {
          max-width: 1180px;
          height: 100%;
          margin: 0 auto;
          padding: 0 24px;
          display: grid;
          grid-template-columns: 1fr auto 1fr;
          align-items: center;
          gap: 24px;
        }

        .brandLogo {
          display: inline-flex;
          align-items: center;
          gap: 10px;
          font-size: 19px;
          font-weight: 900;
          letter-spacing: 0;
        }

        .brandMark {
          width: 36px;
          height: 36px;
          border-radius: 12px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          background: #15151f;
          color: #8c5bff;
          box-shadow: 0 10px 24px rgba(91, 69, 255, 0.22);
        }

        .navMenu {
          display: flex;
          align-items: center;
          gap: 24px;
          font-size: 14px;
          font-weight: 800;
          color: #15151f;
        }

        .headerActions {
          justify-self: end;
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .ghostBtn,
        .purpleBtn,
        .whitePill,
        .mainPill {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          border-radius: 999px;
          font-weight: 900;
          transition:
            transform 0.28s ease,
            box-shadow 0.28s ease,
            background 0.28s ease;
          will-change: transform;
        }

        .ghostBtn,
        .purpleBtn {
          height: 36px;
          padding: 0 16px;
          font-size: 13px;
        }

        .ghostBtn {
          background: #ffffff;
          border: 1px solid rgba(15, 23, 42, 0.12);
        }

        .purpleBtn {
          background: #8c5bff;
          color: #ffffff;
          box-shadow: 0 12px 30px rgba(140, 91, 255, 0.24);
        }

        .whitePill,
        .mainPill {
          height: 44px;
          padding: 0 24px;
          font-size: 14px;
        }

        .whitePill {
          background: #ffffff;
          color: #15151f;
          box-shadow: 0 10px 28px rgba(37, 36, 60, 0.1);
        }

        .mainPill {
          background: linear-gradient(135deg, #8c5bff, #6d7cff);
          color: #ffffff;
          box-shadow: 0 14px 34px rgba(120, 92, 255, 0.34);
        }

        .mainPill.small {
          height: 40px;
          padding: 0 22px;
          margin-top: 20px;
        }

        .ghostBtn:hover,
        .purpleBtn:hover,
        .whitePill:hover,
        .mainPill:hover {
          transform: translateY(-4px);
        }

        .heroSection {
          position: relative;
          min-height: 810px;
          padding: 105px 24px 96px;
          overflow: hidden;
          text-align: center;
          background:
            radial-gradient(circle at 18% 15%, rgba(173, 198, 255, 0.6), transparent 30%),
            radial-gradient(circle at 85% 22%, rgba(230, 219, 255, 0.72), transparent 34%),
            linear-gradient(180deg, #dfeaff 0%, #e8f0ff 54%, #ffffff 100%);
        }

        .heroNoise {
          position: absolute;
          inset: 0;
          opacity: 0.36;
          background-image:
            linear-gradient(120deg, rgba(255, 255, 255, 0.42) 0 1px, transparent 1px 100%),
            linear-gradient(60deg, rgba(255, 255, 255, 0.3) 0 1px, transparent 1px 100%);
          background-size: 60px 60px;
          pointer-events: none;
        }

        .heroContent {
          position: relative;
          z-index: 3;
          max-width: 900px;
          margin: 0 auto;
        }

        .heroEyebrow {
          margin: 0 0 14px;
          color: #6b5cff;
          font-size: 16px;
          font-weight: 900;
          letter-spacing: 0.12em;
        }

        .heroContent h1 {
          margin: 0;
          font-size: clamp(42px, 5.2vw, 68px);
          line-height: 1.12;
          letter-spacing: 0;
          font-weight: 700;
        }

        .heroDesc {
          margin: 20px auto 0;
          max-width: 610px;
          color: rgba(21, 21, 31, 0.68);
          font-size: 18px;
          line-height: 1.75;
          font-weight: 600;
        }

        .heroButtons {
          display: flex;
          justify-content: center;
          gap: 10px;
          margin-top: 30px;
          flex-wrap: wrap;
        }

        .mobileHeroCompact {
          display: none;
        }

        .laptopStage {
          position: relative;
          z-index: 2;
          width: min(940px, 90vw);
          height: 470px;
          margin: 64px auto 0;
        }

        .laptopStage::before {
          content: "";
          position: absolute;
          left: 50%;
          top: -24px;
          z-index: 0;
          width: min(900px, 84vw);
          height: 560px;
          border: 1px solid rgba(255, 255, 255, 0.58);
          border-radius: 50%;
          transform: translateX(-50%);
          pointer-events: none;
        }

        .laptopStage::after {
          content: "";
          position: absolute;
          left: 50%;
          bottom: 24px;
          z-index: 0;
          width: min(760px, 74vw);
          height: 44px;
          border-radius: 50%;
          background: radial-gradient(
            ellipse at center,
            rgba(18, 28, 48, 0.22) 0%,
            rgba(56, 70, 96, 0.12) 42%,
            transparent 74%
          );
          transform: translateX(-50%);
          filter: blur(15px);
          pointer-events: none;
        }

        .laptop {
          position: absolute;
          left: 50%;
          top: 32px;
          z-index: 2;
          width: min(720px, 74vw);
          aspect-ratio: 16 / 9.8;
          transform: translateX(-50%);
          overflow: visible;
          border-radius: 18px 18px 8px 8px;
          background:
            linear-gradient(180deg, #2f3440 0%, #11141b 9%, #05060a 100%);
          padding: 9px 9px 18px;
          box-shadow:
            inset 0 1px 0 rgba(255, 255, 255, 0.34),
            inset 0 -1px 0 rgba(255, 255, 255, 0.08),
            0 28px 56px rgba(39, 54, 92, 0.24),
            0 0 0 5px rgba(255, 255, 255, 0.42);
        }

        .laptop::before {
          content: "";
          position: absolute;
          left: 50%;
          bottom: -29px;
          z-index: 0;
          width: 118%;
          height: 30px;
          border-radius: 0 0 15px 15px;
          background:
            linear-gradient(
              90deg,
              rgba(118, 128, 148, 0.46) 0%,
              rgba(235, 240, 247, 0.92) 10%,
              rgba(213, 221, 232, 0.96) 28%,
              rgba(246, 248, 252, 0.98) 50%,
              rgba(201, 211, 224, 0.96) 72%,
              rgba(238, 242, 248, 0.92) 90%,
              rgba(103, 113, 132, 0.44) 100%
            ),
            linear-gradient(
              180deg,
              #f7f9fc 0%,
              #e5eaf1 28%,
              #c8d0dc 58%,
              #8791a1 100%
            );
          transform: translateX(-50%);
          box-shadow:
            inset 0 1px 0 rgba(255, 255, 255, 0.96),
            inset 0 -10px 18px rgba(56, 66, 84, 0.22),
            inset 16px 0 18px rgba(67, 76, 94, 0.1),
            inset -16px 0 18px rgba(67, 76, 94, 0.1),
            0 18px 30px rgba(32, 42, 68, 0.18);
        }

        .laptop::after {
          content: "";
          position: absolute;
          left: 50%;
          bottom: -17px;
          z-index: 1;
          width: 132px;
          height: 8px;
          border-radius: 0 0 30px 30px;
          background: linear-gradient(
            180deg,
            rgba(92, 101, 119, 0.3) 0%,
            rgba(225, 231, 240, 0.88) 70%,
            rgba(255, 255, 255, 0.58) 100%
          );
          transform: translateX(-50%);
          box-shadow:
            inset 0 -1px 4px rgba(45, 53, 68, 0.22),
            0 6px 12px rgba(24, 31, 48, 0.08);
        }

        .laptopTop {
          position: absolute;
          left: 50%;
          top: 9px;
          z-index: 5;
          width: 90px;
          height: 15px;
          border-radius: 0 0 5px 5px;
          background: #020307;
          transform: translateX(-50%);
          box-shadow:
            inset 0 -1px 0 rgba(255, 255, 255, 0.08),
            0 1px 2px rgba(0, 0, 0, 0.2);
        }

        .laptopTop::after {
          content: "";
          position: absolute;
          left: 50%;
          top: 6px;
          width: 4px;
          height: 4px;
          border-radius: 50%;
          background: #171b24;
          transform: translateX(-50%);
        }

        .laptopTop span {
          display: none;
        }

        .laptopScreen {
          position: relative;
          z-index: 3;
          height: 100%;
          border: 1px solid rgba(255, 255, 255, 0.12);
          border-radius: 10px 10px 5px 5px;
          background: #ffffff;
          display: grid;
          grid-template-columns: 116px 1fr;
          overflow: hidden;
          box-shadow:
            inset 0 0 0 1px rgba(8, 12, 22, 0.08),
            inset 0 16px 24px rgba(255, 255, 255, 0.85);
        }

        .screenSidebar {
          position: relative;
          background: linear-gradient(180deg, #fbfaff 0%, #f4f6ff 100%);
          border-right: 1px solid #e8ecfb;
        }

        .screenSidebar::before {
          content: "";
          position: absolute;
          left: 18px;
          top: 27px;
          width: 64px;
          height: 7px;
          border-radius: 999px;
          background: #dce3f3;
          box-shadow:
            0 25px 0 #edf1fb,
            0 50px 0 #edf1fb,
            0 75px 0 #edf1fb,
            0 100px 0 #edf1fb;
        }

        .screenSidebar::after {
          content: "";
          position: absolute;
          left: 18px;
          top: 138px;
          width: 74px;
          height: 48px;
          border-radius: 15px;
          background: linear-gradient(135deg, rgba(140, 91, 255, 0.92), rgba(87, 216, 208, 0.86));
          box-shadow: 0 18px 32px rgba(73, 88, 156, 0.18);
        }

        .screenMain {
          position: relative;
          overflow: hidden;
          padding: 54px 24px 24px;
          background:
            linear-gradient(90deg, transparent 0 53%, rgba(245, 247, 252, 0.9) 53% 70%, transparent 70%),
            linear-gradient(180deg, #ffffff 0%, #fbfcff 100%);
        }

        .screenMain::before {
          content: "";
          position: absolute;
          left: 24px;
          right: 24px;
          top: 20px;
          height: 15px;
          border-radius: 999px;
          background:
            radial-gradient(circle at 8px 50%, #8c5bff 0 4px, transparent 5px),
            linear-gradient(90deg, #dfe6f7 0 18%, transparent 18% 25%, #dfe6f7 25% 42%, transparent 42% 58%, #dfe6f7 58% 75%, transparent 75%);
          opacity: 0.92;
        }

        .screenMain::after {
          content: "";
          position: absolute;
          inset: 50px 24px 24px;
          background:
            repeating-linear-gradient(to bottom, transparent 0 32px, rgba(218, 225, 240, 0.74) 33px 34px),
            repeating-linear-gradient(to right, transparent 0 96px, rgba(229, 233, 245, 0.68) 97px 98px);
          pointer-events: none;
        }

        .calendarGrid {
          position: relative;
          z-index: 1;
          height: 100%;
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          grid-auto-rows: minmax(42px, 1fr);
          gap: 10px 13px;
        }

        .calendarGrid i {
          position: relative;
          min-height: 40px;
          border: 1px solid rgba(221, 227, 241, 0.9);
          border-radius: 10px;
          background: rgba(255, 255, 255, 0.86);
          box-shadow: 0 14px 28px rgba(41, 58, 106, 0.08);
        }

        .calendarGrid i::before {
          content: "";
          position: absolute;
          left: 12px;
          right: 22px;
          top: 13px;
          height: 6px;
          border-radius: 999px;
          background: rgba(135, 145, 169, 0.2);
        }

        .calendarGrid i.active {
          border-color: rgba(140, 91, 255, 0.2);
          background: linear-gradient(135deg, rgba(140, 91, 255, 0.94), rgba(87, 216, 208, 0.88));
        }

        .calendarGrid i.active::before {
          background: rgba(255, 255, 255, 0.74);
        }

        .calendarGrid i:nth-child(n + 11) {
          opacity: 0.42;
          box-shadow: none;
        }

        .floatingPanel {
          position: absolute;
          z-index: 4;
          width: 210px;
          padding: 18px;
          border-radius: 18px;
          background: rgba(255, 255, 255, 0.82);
          text-align: left;
          box-shadow: 0 24px 48px rgba(32, 47, 90, 0.16);
          backdrop-filter: blur(16px);
          animation: softFloat 5s ease-in-out infinite;
        }

        .floatingPanel strong {
          display: block;
          font-size: 15px;
          margin-bottom: 6px;
        }

        .floatingPanel span {
          color: rgba(21, 21, 31, 0.62);
          font-size: 13px;
          line-height: 1.5;
        }

        .panelOne {
          right: 0;
          top: 96px;
        }

        .panelTwo {
          right: -22px;
          top: 200px;
          animation-delay: 1.2s;
        }

        .floatIcon {
          position: absolute;
          z-index: 2;
          width: 42px;
          height: 42px;
          border-radius: 14px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: rgba(255, 255, 255, 0.86);
          color: #8c5bff;
          font-weight: 700;
          box-shadow: 0 16px 30px rgba(77, 81, 140, 0.16);
          animation: iconDrift 6.5s ease-in-out infinite;
        }

        .floatIcon svg {
          width: 22px;
          height: 22px;
        }

        .floatIcon.slack {
          left: 22%;
          top: 280px;
        }

        .floatIcon.google {
          right: 25%;
          top: 240px;
          animation-delay: 0.9s;
        }

        .floatIcon.notion {
          left: 20%;
          bottom: 210px;
          animation-delay: 1.5s;
        }

        .floatIcon.figma {
          right: 20%;
          bottom: 270px;
          animation-delay: 2s;
        }

        .floatIcon.chat {
          right: 17%;
          bottom: 160px;
          animation-delay: 2.4s;
        }

        .slideSwitcher {
          position: relative;
          z-index: 5;
          display: flex;
          justify-content: center;
          gap: 8px;
          margin-top: 50px;
        }

        .slideSwitcher button {
          width: 9px;
          height: 9px;
          padding: 0;
          border: 0;
          border-radius: 999px;
          background: rgba(21, 21, 31, 0.2);
          cursor: pointer;
          transition: all 0.3s ease;
        }

        .slideSwitcher button.active {
          width: 34px;
          background: #8c5bff;
        }

        .sectionTitle {
          max-width: 840px;
          margin: 0 auto;
          text-align: center;
        }

        .sectionTitle h2,
        .flowIntro h2 {
          margin: 0;
          font-size: clamp(34px, 4.3vw, 56px);
          line-height: 1.22;
          letter-spacing: 0;
          font-weight: 700;
        }

        .sectionTitle p,
        .flowIntro p {
          margin: 18px auto 0;
          max-width: 690px;
          color: rgba(21, 21, 31, 0.62);
          font-size: 17px;
          line-height: 1.78;
          font-weight: 600;
        }

        .storySection {
          padding: 100px 24px 92px;
          background: #ffffff;
        }

        .symbolCube {
          width: 76px;
          height: 76px;
          margin: 32px auto 0;
          border-radius: 22px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: linear-gradient(135deg, #79e4dd, #8c5bff);
          color: #ffffff;
          font-size: 34px;
          font-weight: 700;
          transform: rotate(12deg);
          box-shadow: 0 22px 45px rgba(140, 91, 255, 0.24);
        }

        .storyCards {
          max-width: 1080px;
          margin: 50px auto 0;
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 18px;
        }

        .storyCard {
          min-height: 185px;
          padding: 24px;
          border-radius: 24px;
          background: #ffffff;
          border: 1px solid rgba(15, 23, 42, 0.06);
          box-shadow: 0 20px 55px rgba(19, 22, 40, 0.07);
          overflow: hidden;
          position: relative;
        }

        .storyCard h3 {
          margin: 0;
          font-size: 18px;
          line-height: 1.48;
          letter-spacing: 0;
        }

        .storyCard h3 span {
          color: #6b5cff;
        }

        .storyCard p {
          margin: 14px 0 0;
          color: rgba(21, 21, 31, 0.58);
          font-size: 13px;
          line-height: 1.65;
          font-weight: 600;
        }

        .quoteShape {
          position: absolute;
          right: -20px;
          bottom: -32px;
          width: 120px;
          height: 80px;
          border-radius: 50%;
          background: rgba(140, 91, 255, 0.08);
        }

        .clientLogos {
          max-width: 1120px;
          margin: 70px auto 0;
          text-align: center;
        }

        .clientLogos p {
          margin: 0 0 30px;
          font-size: 22px;
          line-height: 1.5;
          font-weight: 900;
        }

        .clientLogos strong {
          color: #6b5cff;
        }

        .logoMarquee {
          overflow: hidden;
          mask-image: linear-gradient(90deg, transparent, black 10%, black 90%, transparent);
        }

        .logoTrack {
          display: flex;
          gap: 54px;
          width: max-content;
          animation: marquee 30s linear infinite;
        }

        .logoTrack span {
          color: rgba(21, 21, 31, 0.32);
          font-size: 17px;
          font-weight: 900;
          letter-spacing: 0.04em;
        }

        .serviceSection {
          padding: 105px 24px;
          background: linear-gradient(180deg, #eff5ff 0%, #dbe8ff 100%);
        }

        .serviceSection .sectionTitle h2 strong {
          color: #6b5cff;
        }

        .serviceGrid {
          max-width: 860px;
          margin: 54px auto 0;
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 18px;
        }

        .serviceCard {
          min-height: 250px;
          padding: 26px;
          border-radius: 24px;
          background: rgba(255, 255, 255, 0.78);
          box-shadow: 0 18px 48px rgba(72, 86, 140, 0.12);
          overflow: hidden;
          position: relative;
          transition:
            transform 0.32s ease,
            box-shadow 0.32s ease;
          will-change: transform;
        }

        .serviceCard:hover {
          transform: translateY(-8px);
          box-shadow: 0 26px 62px rgba(72, 86, 140, 0.18);
        }

        .serviceCard h3 {
          margin: 0;
          font-size: 22px;
          letter-spacing: 0;
          font-weight: 700;
        }

        .serviceCard p {
          margin: 10px 0 0;
          max-width: 320px;
          color: rgba(21, 21, 31, 0.62);
          font-size: 14px;
          line-height: 1.65;
          font-weight: 600;
        }

        .cssVisual {
          position: absolute;
          right: 22px;
          bottom: 18px;
          width: 180px;
          height: 126px;
          border-radius: 20px;
        }

        .cssVisual.dark {
          background: #11131d;
          box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.08);
        }

        .cssVisual.dark::before {
          content: "";
          position: absolute;
          left: 18px;
          top: 18px;
          width: 100px;
          height: 10px;
          border-radius: 999px;
          background: #79e4dd;
          box-shadow: 0 24px 0 #8c5bff, 0 48px 0 rgba(255, 255, 255, 0.22);
        }

        .cssVisual.soft {
          background: linear-gradient(135deg, #f4f0ff, #e9ffff);
        }

        .cssVisual.soft::before,
        .cssVisual.soft::after {
          content: "";
          position: absolute;
          border-radius: 18px;
          background: #ffffff;
          box-shadow: 0 12px 30px rgba(35, 55, 120, 0.12);
        }

        .cssVisual.soft::before {
          width: 70px;
          height: 70px;
          left: 20px;
          top: 22px;
        }

        .cssVisual.soft::after {
          width: 70px;
          height: 70px;
          right: 20px;
          top: 36px;
        }

        .cssVisual.tools {
          background: #ffffff;
        }

        .cssVisual.tools::before {
          content: "";
          position: absolute;
          inset: 22px;
          border-radius: 20px;
          background:
            radial-gradient(circle at 18px 20px, #8c5bff 0 9px, transparent 10px),
            radial-gradient(circle at 68px 46px, #79e4dd 0 12px, transparent 13px),
            radial-gradient(circle at 112px 30px, #ffb782 0 10px, transparent 11px),
            linear-gradient(135deg, #f4f0ff, #e9ffff);
        }

        .cssVisual.chart {
          background: #ffffff;
        }

        .cssVisual.chart::before {
          content: "";
          position: absolute;
          left: 28px;
          right: 28px;
          bottom: 28px;
          height: 74px;
          border-radius: 16px;
          background:
            linear-gradient(90deg, #8c5bff 0 18%, transparent 18% 28%, #79e4dd 28% 50%, transparent 50% 60%, #6d7cff 60% 78%, transparent 78%),
            linear-gradient(180deg, transparent 0 25%, rgba(17, 19, 29, 0.08) 25% 26%, transparent 26% 50%, rgba(17, 19, 29, 0.08) 50% 51%, transparent 51%);
        }

        .productSection {
          padding: 100px 24px;
          background: #ffffff;
        }

        .productList {
          max-width: 860px;
          margin: 52px auto 0;
          display: grid;
          gap: 22px;
        }

        .productCard {
          min-height: 230px;
          padding: 38px;
          border-radius: 24px;
          background: linear-gradient(135deg, #f5f0ff, #edf7ff);
          display: grid;
          grid-template-columns: 1fr 260px;
          align-items: center;
          overflow: hidden;
          position: relative;
        }

        .productCard:nth-child(2) {
          background: linear-gradient(135deg, #ecffff, #eff3ff);
        }

        .productKicker {
          display: inline-flex;
          align-items: center;
          gap: 14px;
          margin-bottom: 24px;
        }

        .productKicker span {
          color: #15151f;
          font-size: 18px;
          font-weight: 900;
          letter-spacing: 0;
        }

        .productIcon {
          position: relative;
          width: 58px;
          height: 58px;
          border-radius: 20px;
          flex: 0 0 auto;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          overflow: hidden;
          box-shadow:
            inset 0 1px 0 rgba(255, 255, 255, 0.82),
            0 18px 36px rgba(91, 69, 255, 0.14);
        }

        .productIcon-match {
          background: linear-gradient(135deg, #eaf2ff 0%, #eff7ff 100%);
        }

        .productIcon-match::before {
          content: "";
          position: absolute;
          width: 28px;
          height: 30px;
          border-radius: 10px;
          background: linear-gradient(180deg, #3b82ff 0%, #6d7cff 100%);
          box-shadow:
            -8px 8px 0 rgba(59, 130, 255, 0.16),
            8px -7px 0 rgba(140, 91, 255, 0.14);
        }

        .productIcon-match::after {
          content: "";
          position: absolute;
          left: 18px;
          bottom: 15px;
          width: 22px;
          height: 10px;
          border-radius: 999px;
          background:
            radial-gradient(circle at 5px 50%, #ffffff 0 2px, transparent 2.5px),
            radial-gradient(circle at 12px 50%, #ffffff 0 2px, transparent 2.5px),
            radial-gradient(circle at 19px 50%, #ffffff 0 2px, transparent 2.5px);
          opacity: 0.9;
        }

        .productIcon-desk {
          background: linear-gradient(135deg, #e9fbff 0%, #eef4ff 100%);
        }

        .productIcon-desk::before {
          content: "";
          position: absolute;
          width: 34px;
          height: 24px;
          left: 13px;
          top: 21px;
          border-radius: 7px;
          background: linear-gradient(180deg, #64748b 0%, #334155 100%);
          box-shadow:
            inset 0 2px 0 rgba(255, 255, 255, 0.34),
            0 10px 18px rgba(51, 65, 85, 0.18);
        }

        .productIcon-desk::after {
          content: "";
          position: absolute;
          left: 15px;
          top: 16px;
          width: 22px;
          height: 11px;
          border-radius: 6px 6px 2px 2px;
          background: linear-gradient(180deg, #cbd5e1 0%, #94a3b8 100%);
        }

        .productText h3 {
          margin: 0;
          font-size: 42px;
          line-height: 1;
          letter-spacing: 0;
          font-weight: 700;
        }

        .productText p {
          margin: 14px 0 22px;
          max-width: 390px;
          color: rgba(21, 21, 31, 0.62);
          font-size: 15px;
          line-height: 1.7;
          font-weight: 600;
        }

        .productText a {
          display: inline-flex;
          padding: 10px 16px;
          border-radius: 999px;
          background: rgba(255, 255, 255, 0.75);
          font-size: 13px;
          font-weight: 900;
        }

        .isometricBox {
          position: relative;
          width: 230px;
          height: 150px;
          margin-left: auto;
          transform: rotateX(58deg) rotateZ(-38deg);
          transform-style: preserve-3d;
        }

        .isometricBox span {
          position: absolute;
          border-radius: 18px;
          background: rgba(140, 91, 255, 0.18);
          border: 1px solid rgba(140, 91, 255, 0.18);
        }

        .isometricBox span:nth-child(1) {
          inset: 20px;
        }

        .isometricBox span:nth-child(2) {
          left: 62px;
          top: 26px;
          width: 96px;
          height: 96px;
          background: rgba(121, 228, 221, 0.38);
        }

        .isometricBox span:nth-child(3) {
          left: 90px;
          top: 54px;
          width: 44px;
          height: 44px;
          background: #8c5bff;
        }

        .deviceSection {
          padding: 82px 24px 96px;
          text-align: center;
          background: #ffffff;
        }

        .deviceSection h2 {
          margin: 0;
          font-size: clamp(30px, 3.4vw, 44px);
          line-height: 1.25;
          letter-spacing: 0;
          font-weight: 700;
        }

        .deviceSection p {
          margin: 14px auto 0;
          max-width: 590px;
          color: rgba(21, 21, 31, 0.62);
          line-height: 1.7;
          font-weight: 600;
        }

        .deviceRow {
          max-width: 760px;
          margin: 54px auto 0;
          display: flex;
          justify-content: center;
          align-items: flex-end;
          gap: 24px;
        }

        .device {
          border-radius: 18px;
          background: linear-gradient(135deg, #1b1d2b, #8c5bff);
          box-shadow: 0 22px 45px rgba(55, 67, 120, 0.16);
        }

        .device.tablet {
          width: 150px;
          height: 112px;
        }

        .device.phone {
          width: 78px;
          height: 150px;
          background: linear-gradient(135deg, #ffffff, #e8edff);
          border: 8px solid #15151f;
        }

        .device.card {
          width: 142px;
          height: 90px;
          background: linear-gradient(135deg, #ffffff, #dffbff);
        }

        .device.board {
          width: 110px;
          height: 160px;
          background: linear-gradient(135deg, #e8edff, #ffffff);
          border: 8px solid #969bac;
        }

        .experienceSection {
          padding: 100px 24px;
          background: #ffffff;
        }

        .experienceGrid {
          max-width: 860px;
          margin: 48px auto 0;
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 18px;
        }

        .experienceCard {
          min-height: 250px;
          padding: 28px;
          border-radius: 24px;
          position: relative;
          overflow: hidden;
        }

        .experienceCard h3 {
          margin: 0;
          font-size: 21px;
          letter-spacing: 0;
          font-weight: 700;
        }

        .experienceCard p {
          margin: 10px 0 0;
          max-width: 320px;
          color: rgba(21, 21, 31, 0.62);
          font-size: 14px;
          line-height: 1.65;
          font-weight: 600;
        }

        .experienceCard.purple {
          background: #edf0ff;
        }

        .experienceCard.mint {
          background: #e6fbf6;
        }

        .experienceCard.orange {
          background: #ffe2bf;
        }

        .experienceCard.blue {
          background: #cfefff;
        }

        .glassMock {
          position: absolute;
          right: 24px;
          bottom: 24px;
          width: 170px;
          height: 88px;
          border-radius: 20px;
          background: rgba(255, 255, 255, 0.38);
          border: 1px solid rgba(255, 255, 255, 0.55);
          transform: rotate(-8deg);
          backdrop-filter: blur(12px);
        }

        .flowSection {
          padding: 112px 24px 126px;
          background:
            radial-gradient(circle at 50% 58%, rgba(121, 228, 221, 0.16), transparent 28%),
            #ffffff;
        }

        .flowIntro {
          max-width: 940px;
          margin: 0 auto 82px;
          text-align: center;
        }

        .flowIntro span {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          height: 44px;
          padding: 0 24px;
          margin-bottom: 24px;
          border-radius: 999px;
          background: #effdfa;
          border: 1px solid #c9f5ee;
          color: #05806f;
          font-size: 16px;
          font-weight: 700;
        }

        .flowIntro h2 {
          max-width: 900px;
          margin-left: auto;
          margin-right: auto;
        }

        .flowMap {
          position: relative;
          max-width: 1160px;
          min-height: 520px;
          margin: 0 auto;
          display: grid;
          grid-template-columns: 1fr 290px 1fr;
          align-items: center;
          gap: 46px;
        }

        .flowColumn {
          display: flex;
          flex-direction: column;
          gap: 22px;
          position: relative;
          z-index: 3;
        }

        .flowColumn.left {
          align-items: flex-end;
        }

        .flowColumn.right {
          align-items: flex-start;
        }

        .flowCard {
          width: min(100%, 420px);
          min-height: 110px;
          padding: 24px 30px;
          border-radius: 24px;
          background: rgba(255, 255, 255, 0.94);
          box-shadow: 0 24px 60px rgba(29, 31, 51, 0.08);
          display: flex;
          align-items: center;
          gap: 22px;
          border: 1px solid rgba(15, 23, 42, 0.04);
          transition:
            transform 0.3s ease,
            box-shadow 0.3s ease;
        }

        .flowCard:hover {
          transform: translateY(-5px);
          box-shadow: 0 30px 74px rgba(29, 31, 51, 0.12);
        }

        .flowIcon {
          width: 58px;
          height: 58px;
          border-radius: 16px;
          flex-shrink: 0;
          background: #effdfa;
          position: relative;
        }

        .flowIcon::before,
        .flowIcon::after {
          content: "";
          position: absolute;
        }

        .flowIcon.square::before {
          inset: 15px;
          border: 6px solid #00c7b2;
          border-radius: 10px;
        }

        .flowIcon.square::after {
          right: 12px;
          top: 11px;
          width: 14px;
          height: 14px;
          border-radius: 50%;
          background: #15151f;
        }

        .flowIcon.circle::before {
          inset: 13px;
          border: 6px solid #15151f;
          border-radius: 50%;
        }

        .flowIcon.circle::after {
          left: 18px;
          bottom: 11px;
          width: 24px;
          height: 24px;
          border-radius: 50%;
          background: #00c7b2;
        }

        .flowIcon.line::before {
          left: 15px;
          right: 15px;
          top: 18px;
          height: 10px;
          border-radius: 999px;
          background: #00c7b2;
          box-shadow: 0 17px 0 #15151f;
        }

        .flowIcon.ring::before {
          inset: 13px;
          border: 7px solid #15151f;
          border-radius: 50%;
        }

        .flowIcon.ring::after {
          inset: 20px;
          border-radius: 50%;
          background: #00c7b2;
        }

        .flowIcon.record::before {
          left: 17px;
          top: 12px;
          width: 25px;
          height: 34px;
          border-radius: 6px;
          border: 6px solid #15151f;
        }

        .flowIcon.record::after {
          left: 22px;
          bottom: 13px;
          width: 28px;
          height: 18px;
          border-radius: 4px;
          background: #00c7b2;
          clip-path: polygon(0 0, 100% 100%, 0 100%);
        }

        .flowCard h3 {
          margin: 0 0 8px;
          font-size: 24px;
          letter-spacing: 0;
          font-weight: 700;
        }

        .flowCard p {
          margin: 0;
          color: rgba(21, 21, 31, 0.6);
          font-size: 15px;
          line-height: 1.55;
          font-weight: 600;
        }

        .flowHub {
          position: relative;
          z-index: 2;
          display: flex;
          justify-content: center;
        }

        .hubGlow {
          width: 250px;
          height: 250px;
          border-radius: 46px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: rgba(214, 255, 250, 0.68);
          border: 1px solid #bff5ed;
          box-shadow: 0 28px 70px rgba(0, 199, 178, 0.18);
        }

        .hubCore {
          width: 150px;
          height: 150px;
          border-radius: 28px;
          background: #07080d;
          color: #ffffff;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          box-shadow: 0 22px 44px rgba(0, 0, 0, 0.18);
        }

        .hubCore span {
          color: #57eadc;
          letter-spacing: 0.22em;
          font-size: 14px;
          font-weight: 700;
          margin-bottom: 12px;
        }

        .hubCore strong {
          font-size: 27px;
          line-height: 1.15;
          letter-spacing: 0;
          text-align: center;
        }

        .line {
          position: absolute;
          top: 50%;
          width: 170px;
          height: 6px;
          border-radius: 999px;
          background: linear-gradient(90deg, #00c7b2, rgba(0, 199, 178, 0.15));
          transform: translateY(-50%);
          z-index: 1;
        }

        .lineLeft {
          left: calc(50% - 310px);
        }

        .lineRight {
          right: calc(50% - 310px);
          transform: translateY(-50%) scaleX(-1);
        }

        .getStarted {
          position: relative;
          padding: 112px 24px 124px;
          text-align: center;
          color: #ffffff;
          overflow: hidden;
          background:
            radial-gradient(circle at 45% 30%, rgba(255, 255, 255, 0.22), transparent 18%),
            linear-gradient(135deg, #8257ff 0%, #7e5fff 48%, #66d7ff 100%);
        }

        .getStarted h2 {
          margin: 0;
          font-size: clamp(70px, 10vw, 136px);
          line-height: 0.84;
          letter-spacing: 0;
          font-weight: 700;
        }

        .getStarted p {
          margin: 26px 0 24px;
          font-size: 17px;
          font-weight: 700;
          opacity: 0.9;
        }

        .startSticker {
          position: absolute;
          left: 50%;
          top: 80px;
          width: 78px;
          height: 78px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 22px;
          background: #15151f;
          color: #79e4dd;
          font-size: 35px;
          font-weight: 700;
          transform: translateX(-50%) rotate(-14deg);
          box-shadow: 0 20px 50px rgba(21, 21, 31, 0.18);
        }

        .footer {
          padding: 52px 24px;
          background: #171128;
          color: #ffffff;
          display: flex;
          justify-content: space-between;
          gap: 24px;
        }

        .footer > * {
          max-width: 1160px;
        }

        .footer strong {
          font-size: 22px;
        }

        .footer p {
          margin: 8px 0 0;
          color: rgba(255, 255, 255, 0.62);
          font-size: 14px;
        }

        .reveal {
          opacity: 0;
          transform: translateY(46px);
          transition:
            opacity 1s ease,
            transform 1s ease;
        }

        .reveal.show {
          opacity: 1;
          transform: translateY(0);
        }

        @keyframes softFloat {
          0%,
          100% {
            transform: translateY(0);
          }
          50% {
            transform: translateY(-12px);
          }
        }

        @keyframes iconDrift {
          0%,
          100% {
            transform: translate3d(0, 0, 0) rotate(0deg);
          }
          50% {
            transform: translate3d(0, -16px, 0) rotate(8deg);
          }
        }

        @keyframes marquee {
          from {
            transform: translateX(0);
          }
          to {
            transform: translateX(-50%);
          }
        }



        /* requested refinements */
        .heroContent h1,
        .sectionTitle h2,
        .flowIntro h2,
        .productText h3,
        .deviceSection h2,
        .getStarted h2 {
          font-weight: 700 !important;
        }

        .productCard {
          transition:
            transform 0.36s ease,
            box-shadow 0.36s ease,
            filter 0.36s ease;
          will-change: transform;
        }

        .productCard:hover {
          transform: translateY(14px);
          box-shadow: 0 26px 70px rgba(120, 92, 255, 0.16);
          filter: saturate(1.04);
        }

        .productCard:hover .productIcon {
          animation: softFloat 2.8s ease-in-out infinite;
        }

        .isometricBox {
          transform: none;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .isometricBox::before {
          content: "";
          position: absolute;
          width: 190px;
          height: 120px;
          border-radius: 34px;
          background: linear-gradient(135deg, rgba(140, 91, 255, 0.22), rgba(121, 228, 221, 0.32));
          transform: rotate(-12deg) skewX(-10deg);
          box-shadow: 0 24px 50px rgba(91, 69, 255, 0.13);
        }

        .isometricBox::after {
          content: "";
          position: absolute;
          width: 82px;
          height: 82px;
          border-radius: 24px;
          background:
            radial-gradient(circle at 50% 50%, #8c5bff 0 18px, transparent 19px),
            linear-gradient(135deg, rgba(255,255,255,0.82), rgba(121, 228, 221, 0.44));
          transform: rotate(-12deg) skewX(-10deg);
        }

        .isometricBox span {
          display: none;
        }

        .experienceCard {
          background: linear-gradient(135deg, #f5f0ff, #ecffff) !important;
          box-shadow: 0 22px 60px rgba(72, 86, 140, 0.09);
          transition: transform 0.34s ease, box-shadow 0.34s ease;
        }

        .experienceCard:hover {
          transform: translateY(-8px);
          box-shadow: 0 30px 76px rgba(72, 86, 140, 0.15);
        }

        .experienceEmoji {
          width: 52px;
          height: 52px;
          margin-bottom: 18px;
          border-radius: 18px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          background: rgba(255, 255, 255, 0.74);
          box-shadow: 0 14px 32px rgba(140, 91, 255, 0.14);
          font-size: 27px;
        }

        .experienceVisual {
          position: absolute;
          right: 22px;
          bottom: 20px;
          width: 176px;
          height: 108px;
          border-radius: 24px;
          background: rgba(255, 255, 255, 0.46);
          border: 1px solid rgba(255, 255, 255, 0.64);
          backdrop-filter: blur(12px);
          overflow: hidden;
        }

        .experienceVisual span {
          position: absolute;
          left: 24px;
          right: 24px;
          height: 10px;
          border-radius: 999px;
          background: rgba(140, 91, 255, 0.26);
        }

        .experienceVisual span:nth-child(1) { top: 26px; }
        .experienceVisual span:nth-child(2) { top: 50px; width: 62%; }
        .experienceVisual span:nth-child(3) {
          top: 74px;
          width: 44%;
          background: rgba(0, 199, 178, 0.36);
        }

        .flowSection {
          background:
            radial-gradient(circle at 50% 58%, rgba(140, 91, 255, 0.10), transparent 26%),
            radial-gradient(circle at 50% 52%, rgba(0, 199, 178, 0.12), transparent 32%),
            #ffffff !important;
        }

        .flowIcon {
          background: linear-gradient(135deg, #f4f0ff, #e9ffff) !important;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          box-shadow: inset 0 0 0 1px rgba(140, 91, 255, 0.08);
        }

        .flowIcon em {
          position: relative;
          z-index: 3;
          font-style: normal;
          font-size: 25px;
        }

        .flowIcon::before,
        .flowIcon::after {
          display: none !important;
        }

        .flowCard {
          box-shadow: 0 24px 60px rgba(91, 69, 255, 0.08) !important;
        }

        .flowCard:hover {
          box-shadow: 0 30px 74px rgba(0, 199, 178, 0.13) !important;
        }

        .line {
          display: none !important;
        }


        /* Handly-style header refinement */
        .siteHeader {
          position: fixed !important;
          top: 0 !important;
          left: 0 !important;
          right: 0 !important;
          z-index: 1100 !important;
          width: 100% !important;
          height: 64px !important;
          background: #ffffff !important;
          border-bottom: 1px solid rgba(15, 23, 42, 0.08) !important;
          backdrop-filter: none !important;
          -webkit-backdrop-filter: none !important;
        }

        .headerInner {
          max-width: 100% !important;
          height: 100%;
          margin: 0 auto;
          padding: 0 42px !important;
          display: grid;
          grid-template-columns: 1fr auto 1fr;
          align-items: center;
        }

        .brandLogo {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          color: #15151f;
          font-size: 20px;
          font-weight: 700;
          letter-spacing: 0;
        }

        .brandLogoText {
          color: #15151f;
          font-size: 20px;
          font-weight: 700;
          line-height: 1;
          letter-spacing: 0;
          font-kerning: normal;
        }

        .brandGlyph {
          position: relative;
          width: 24px;
          height: 22px;
          display: inline-flex;
          align-items: flex-end;
          gap: 4px;
        }

        .brandGlyph::before,
        .brandGlyph::after,
        .brandGlyph i {
          content: "";
          display: block;
          width: 6px;
          border-radius: 999px;
          background: linear-gradient(180deg, #8c5bff 0%, #6d7cff 100%);
        }

        .brandGlyph::before {
          height: 16px;
        }

        .brandGlyph::after {
          height: 10px;
          transform: translateY(-6px);
        }

        .brandGlyph i:first-child {
          height: 20px;
          transform: translateY(2px);
        }

        .brandGlyph i:last-child {
          display: none;
        }

        .navMenu {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 28px;
          font-size: 15px;
          font-weight: 600;
          color: #15151f;
        }

        .navMenu a {
          position: relative;
          opacity: 0.92;
          transition: color 0.24s ease, opacity 0.24s ease;
        }

        .navMenu a:hover,
        .navMenu a.active {
          color: #8c5bff;
          opacity: 1;
        }

        .headerActions {
          justify-self: end;
          display: inline-flex;
          align-items: center;
          gap: 10px;
        }

        .ghostBtn {
          height: 34px;
          padding: 0 18px;
          border-radius: 999px;
          background: #ffffff;
          border: 1px solid rgba(140, 91, 255, 0.28);
          color: #8c5bff;
          font-size: 14px;
          font-weight: 600;
          box-shadow: none;
        }

        .purpleBtn {
          height: 34px;
          padding: 0 20px;
          border-radius: 999px;
          background: linear-gradient(135deg, #8c5bff 0%, #7b61ff 52%, #a779ff 100%);
          color: #ffffff;
          font-size: 14px;
          font-weight: 700;
          box-shadow: 0 10px 22px rgba(140, 91, 255, 0.3);
        }

        .ghostBtn:hover,
        .purpleBtn:hover {
          transform: translateY(-2px);
        }

        .purpleText {
          color: #6b5cff;
        }

        .experienceVisual {
          display: none !important;
        }

        .flowIntro span {
          background: #f4f0ff !important;
          border-color: #ded4ff !important;
          color: #6b5cff !important;
          box-shadow: 0 12px 34px rgba(107, 92, 255, 0.12);
        }

        .getStarted {
          min-height: 420px;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 128px 24px 132px !important;
          background:
            radial-gradient(circle at 50% 18%, rgba(255, 255, 255, 0.34), transparent 20%),
            radial-gradient(circle at 30% 72%, rgba(121, 228, 221, 0.32), transparent 24%),
            linear-gradient(135deg, #865dff 0%, #8c5bff 42%, #62cfff 100%) !important;
        }

        .getStarted::before {
          content: "";
          position: absolute;
          inset: 0;
          background:
            linear-gradient(90deg, rgba(255, 255, 255, 0.12) 1px, transparent 1px),
            linear-gradient(180deg, rgba(255, 255, 255, 0.10) 1px, transparent 1px);
          background-size: 64px 64px;
          opacity: 0.18;
          pointer-events: none;
        }

        .getStarted h2 {
          position: relative;
          z-index: 2;
          font-size: clamp(76px, 11vw, 148px) !important;
          line-height: 0.82 !important;
          letter-spacing: 0;
          color: #ffffff;
          text-shadow: 0 20px 44px rgba(62, 36, 140, 0.16);
        }

        .getStarted p,
        .getStarted .whitePill,
        .startSticker,
        .startOrb,
        .startMiniCard {
          position: relative;
          z-index: 2;
        }

        .getStarted .whitePill {
          color: #6b5cff;
          font-weight: 700;
          box-shadow: 0 18px 36px rgba(44, 34, 100, 0.18);
        }

        .startSticker {
          top: -50px !important;
          left: auto !important;
          right: -200px !important;
          background: #15151f !important;
          color: #ffffff !important;
          animation: startFloat 5.2s ease-in-out infinite;
        }

        .startOrb {
          position: absolute;
          width: 190px;
          height: 190px;
          border-radius: 999px;
          background: rgba(255, 255, 255, 0.18);
          filter: blur(2px);
          animation: startFloat 7s ease-in-out infinite;
        }

        .startOrbOne {
          left: 16%;
          top: 28%;
        }

        .startOrbTwo {
          right: 14%;
          bottom: 18%;
          width: 240px;
          height: 240px;
          animation-delay: 1.1s;
        }

        .startMiniCard {
          position: absolute;
          min-width: 92px;
          height: 42px;
          padding: 0 18px;
          border-radius: 999px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          background: rgba(255, 255, 255, 0.22);
          border: 1px solid rgba(255, 255, 255, 0.34);
          color: #ffffff;
          font-size: 14px;
          font-weight: 700;
          backdrop-filter: blur(14px);
          animation: startFloat 6s ease-in-out infinite;
        }

        .startMiniCardOne {
          left: 35%;
          top: 28%;
          transform: rotate(12deg);
        }

        .startMiniCardTwo {
          right: 35%;
          top: 30%;
          transform: rotate(10deg);
          animation-delay: 1.4s;
        }

        @keyframes startFloat {
          0%, 100% {
            transform: translateY(0) rotate(-10deg);
          }
          50% {
            transform: translateY(-16px) rotate(-4deg);
          }
        }



        /* latest requested refinements */
        .experienceGrid {
          justify-items: center;
        }

        .experienceCard {
          display: flex !important;
          flex-direction: column;
          align-items: center;
          justify-content: flex-start;
          text-align: center;
          padding: 34px 30px !important;
        }

        .experienceEmoji {
          margin: 0 auto 18px !important;
        }

        .experienceCard h3 {
          width: 100%;
          text-align: center;
        }

        .experienceCard p {
          margin: 12px auto 0 !important;
          max-width: 320px;
          text-align: center;
        }

        .flowSection {
          background:
            radial-gradient(circle at 50% 56%, rgba(140, 91, 255, 0.18), transparent 25%),
            radial-gradient(circle at 50% 52%, rgba(107, 92, 255, 0.16), transparent 34%),
            radial-gradient(circle at 50% 63%, rgba(121, 228, 221, 0.10), transparent 30%),
            #ffffff !important;
        }

        .hubGlow {
          background: linear-gradient(135deg, rgba(244, 240, 255, 0.94), rgba(235, 241, 255, 0.86)) !important;
          border: 1px solid rgba(140, 91, 255, 0.24) !important;
          box-shadow: 0 34px 82px rgba(107, 92, 255, 0.24), 0 0 72px rgba(140, 91, 255, 0.18) !important;
        }

        .hubCore {
          background: linear-gradient(135deg, #8c5bff 0%, #6b5cff 58%, #a779ff 100%) !important;
          color: #ffffff !important;
          box-shadow: 0 26px 56px rgba(107, 92, 255, 0.32) !important;
        }

        .hubCore span {
          color: #dffcf8 !important;
        }

        .logoSticker {
          background: #15151f !important;
          color: #ffffff !important;
        }

        .stickerGlyph {
          width: 34px !important;
          height: 32px !important;
          transform: none;
        }

        .stickerGlyph::before,
        .stickerGlyph::after,
        .stickerGlyph i {
          width: 8px !important;
          background: linear-gradient(180deg, #8c5bff 0%, #6d7cff 100%) !important;
        }

        .stickerGlyph::before { height: 22px !important; }
        .stickerGlyph i:first-child { height: 28px !important; }
        .stickerGlyph::after { height: 15px !important; }

        .pageFooter {
          position: relative;
          overflow: hidden;
          padding: 72px 42px 28px;
          background:
            radial-gradient(circle at 16% 0%, rgba(140, 91, 255, 0.24), transparent 30%),
            radial-gradient(circle at 86% 18%, rgba(121, 228, 221, 0.14), transparent 28%),
            linear-gradient(180deg, #171128 0%, #100c1d 100%);
          color: #ffffff;
        }

        .pageFooter::before {
          content: "";
          position: absolute;
          inset: 0;
          pointer-events: none;
          border-top: 1px solid rgba(255, 255, 255, 0.12);
        }

        .footerInner {
          position: relative;
          z-index: 1;
          max-width: 1180px;
          margin: 0 auto;
          display: grid;
          grid-template-columns: minmax(280px, 1.2fr) minmax(180px, 0.7fr) minmax(260px, 0.8fr);
          gap: 72px;
          align-items: start;
        }

        .footerBrand {
          max-width: 440px;
        }

        .footerBrand .brandGlyph {
          width: 32px;
          height: 30px;
        }

        .footerBrand .brandGlyph::before,
        .footerBrand .brandGlyph::after,
        .footerBrand .brandGlyph i {
          background: linear-gradient(180deg, #a68bff 0%, #78a9ff 100%);
        }

        .footerBrand .brandLogoText {
          color: #ffffff;
        }

        .footerTagline {
          margin: 24px 0 0;
          color: #ffffff;
          font-size: 18px;
          font-weight: 900;
          line-height: 1.55;
          letter-spacing: 0;
        }

        .footerDescription {
          margin: 14px 0 0;
          max-width: 410px;
          color: rgba(255, 255, 255, 0.58);
          font-size: 14px;
          font-weight: 600;
          line-height: 1.8;
        }

        .footerNav,
        .footerSupport {
          display: flex;
          flex-direction: column;
          align-items: flex-start;
        }

        .footerNav {
          gap: 13px;
        }

        .footerSupport {
          gap: 15px;
        }

        .footerNav h2,
        .footerSupport h2 {
          margin: 0 0 8px;
          color: #ffffff;
          font-size: 16px;
          font-weight: 900;
          letter-spacing: 0;
        }

        .footerNav a,
        .footerNav span {
          color: rgba(255, 255, 255, 0.62);
          font-size: 14px;
          font-weight: 700;
          transition: color 0.2s ease;
        }

        .footerNav a:hover {
          color: #ffffff;
        }

        .footerSupport p {
          margin: 0;
          color: rgba(255, 255, 255, 0.72);
          font-size: 14px;
          font-weight: 700;
          line-height: 1.6;
        }

        .footerSupport span {
          display: block;
          margin-bottom: 2px;
          color: rgba(255, 255, 255, 0.42);
          font-size: 12px;
          font-weight: 900;
          letter-spacing: 0.02em;
        }

        .footerLogo {
          display: inline-flex;
          align-items: center;
          gap: 12px;
          font-size: 30px;
          font-weight: 900;
          letter-spacing: 0;
        }

        .footerLogo .brandLogoText {
          display: inline !important;
        }

        .footerBottom {
          position: relative;
          z-index: 1;
          max-width: 1180px;
          margin: 56px auto 0;
          padding-top: 24px;
          border-top: 1px solid rgba(255, 255, 255, 0.12);
          display: flex;
          justify-content: space-between;
          gap: 18px;
        }

        .footerBottom p {
          margin: 0;
          color: rgba(255, 255, 255, 0.46);
          font-size: 13px;
          font-weight: 700;
        }



        /* Experience section: stronger gradient background, clearer cards, icon-style badges */
        .experienceSection {
          position: relative;
          overflow: hidden;
          padding: 118px 24px 124px !important;
          background:
            radial-gradient(circle at 50% 8%, rgba(140, 91, 255, 0.22), transparent 30%),
            radial-gradient(circle at 15% 58%, rgba(72, 187, 255, 0.18), transparent 28%),
            radial-gradient(circle at 86% 52%, rgba(121, 228, 221, 0.22), transparent 30%),
            linear-gradient(180deg, #ffffff 0%, #eef4ff 44%, #eafcff 100%) !important;
        }

        .experienceSection::before {
          content: "";
          position: absolute;
          inset: 0;
          background:
            linear-gradient(90deg, rgba(107, 92, 255, 0.075) 1px, transparent 1px),
            linear-gradient(180deg, rgba(0, 199, 178, 0.06) 1px, transparent 1px),
            radial-gradient(circle at 50% 50%, rgba(255, 255, 255, 0.58), transparent 52%);
          background-size: 72px 72px, 72px 72px, auto;
          mask-image: radial-gradient(circle at center, black 0%, transparent 78%);
          pointer-events: none;
        }

        .experienceSection .sectionTitle,
        .experienceGrid {
          position: relative;
          z-index: 1;
        }

        .experienceGrid {
          max-width: 920px !important;
          gap: 26px !important;
        }

        .experienceCard {
          min-height: 260px !important;
          background:
            linear-gradient(180deg, rgba(255, 255, 255, 0.98) 0%, rgba(250, 252, 255, 0.96) 100%) !important;
          border: 1px solid rgba(107, 92, 255, 0.16) !important;
          box-shadow:
            0 34px 86px rgba(72, 86, 140, 0.18),
            0 12px 34px rgba(140, 91, 255, 0.08),
            inset 0 1px 0 rgba(255, 255, 255, 1) !important;
          backdrop-filter: blur(18px);
        }

        .experienceCard::before {
          content: "";
          position: absolute;
          right: -54px;
          bottom: -62px;
          width: 172px;
          height: 172px;
          border-radius: 999px;
          background: radial-gradient(circle, rgba(140, 91, 255, 0.11), transparent 62%);
          pointer-events: none;
        }

        .experienceCard::after {
          content: "";
          position: absolute;
          inset: 0;
          border-radius: inherit;
          background: linear-gradient(135deg, rgba(140, 91, 255, 0.055), transparent 38%, rgba(121, 228, 221, 0.07));
          pointer-events: none;
        }

        .experienceIcon {
          position: relative;
          z-index: 1;
          width: 58px;
          height: 58px;
          margin: 0 auto 20px !important;
          border-radius: 20px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          background: rgba(255, 255, 255, 0.86);
          box-shadow:
            0 16px 34px rgba(91, 69, 255, 0.13),
            inset 0 1px 0 rgba(255, 255, 255, 0.96);
        }

        .experienceIcon svg {
          width: 27px;
          height: 27px;
          stroke-width: 2.45;
        }

        .experienceIcon-consulting svg { color: #6b5cff; }
        .experienceIcon-exchange svg { color: #00a88f; }
        .experienceIcon-demo svg { color: #f97316; }
        .experienceIcon-setting svg { color: #3b82f6; }

        .experienceCard h3,
        .experienceCard p {
          position: relative;
          z-index: 1;
        }

        /* Flow section: replace emoji badges and connect every card to the Baton hub */
        .flowMap {
          isolation: isolate;
          overflow: visible;
        }

        .flowMap::before {
          content: "";
          position: absolute;
          left: 50%;
          top: 50%;
          z-index: 0;
          width: min(760px, 72vw);
          height: 420px;
          border-radius: 999px;
          background: radial-gradient(circle, rgba(140, 91, 255, 0.16), transparent 64%);
          transform: translate(-50%, -50%);
          pointer-events: none;
        }

        .flowColumn,
        .flowHub {
          position: relative;
          z-index: 2;
        }

        .flowCard {
          position: relative;
          overflow: visible;
          border: 1px solid rgba(140, 91, 255, 0.08) !important;
        }

        .flowColumn.left .flowCard::after,
        .flowColumn.right .flowCard::after {
          content: "";
          position: absolute;
          top: 50%;
          z-index: -1;
          width: 58px;
          height: 2px;
          border-radius: 999px;
          background: linear-gradient(90deg, rgba(140, 91, 255, 0), rgba(140, 91, 255, 0.48), rgba(121, 228, 221, 0.44));
          transform: translateY(-50%);
          box-shadow: 0 0 18px rgba(140, 91, 255, 0.12);
        }

        .flowColumn.left .flowCard::after {
          right: -58px;
        }

        .flowColumn.right .flowCard::after {
          left: -58px;
          transform: translateY(-50%) scaleX(-1);
        }

        .hubGlow::before,
        .hubGlow::after {
          content: "";
          position: absolute;
          top: 50%;
          width: 72px;
          height: 2px;
          border-radius: 999px;
          background: linear-gradient(90deg, rgba(121, 228, 221, 0.5), rgba(140, 91, 255, 0.22));
          transform: translateY(-50%);
          pointer-events: none;
        }

        .hubGlow::before {
          left: -68px;
        }

        .hubGlow::after {
          right: -68px;
          transform: translateY(-50%) scaleX(-1);
        }

        .flowIcon {
          color: #6b5cff;
        }

        .flowIcon svg {
          width: 27px;
          height: 27px;
          stroke-width: 2.45;
        }

        .flowIcon-register svg { color: #8c5bff; }
        .flowIcon-request svg { color: #00a88f; }
        .flowIcon-scope svg { color: #3b82f6; }
        .flowIcon-matching svg { color: #6b5cff; }
        .flowIcon-record svg { color: #111827; }

        /* Flow connectors: dotted inputs and solid gradient outputs into the Baton hub */
        .flowConnectors {
          position: absolute;
          inset: 0;
          z-index: 8;
          width: 100%;
          height: 100%;
          overflow: visible;
          pointer-events: none;
          filter:
            drop-shadow(0 10px 18px rgba(107, 92, 255, 0.16))
            drop-shadow(0 0 14px rgba(112, 213, 208, 0.18));
        }

        .flowConnectorBase {
          fill: none;
          stroke-linecap: round;
          stroke-linejoin: round;
          opacity: 1;
          vector-effect: non-scaling-stroke;
        }

        .flowConnectorDotted {
          stroke-width: 4.5;
          stroke-dasharray: 1 10;
        }

        .flowConnectorSolid {
          stroke-width: 8;
        }

        .flowConnectorNode {
          fill: #ffffff;
          stroke: rgba(125, 115, 232, 0.48);
          stroke-width: 3;
          filter: drop-shadow(0 6px 14px rgba(107, 92, 255, 0.16));
          vector-effect: non-scaling-stroke;
        }

        .flowConnectorNode-card {
          fill: #f5ffff;
          stroke: rgba(98, 214, 207, 0.72);
        }

        .flowColumn.left .flowCard::after,
        .flowColumn.right .flowCard::after,
        .hubGlow::before,
        .hubGlow::after {
          display: none !important;
        }

        @media (max-width: 1180px) {
          .headerInner {
            max-width: 100%;
          }

          .storyCards {
            grid-template-columns: repeat(2, 1fr);
          }

          .flowMap {
            grid-template-columns: 1fr;
            min-height: auto;
            gap: 28px;
          }

          .flowColumn.left,
          .flowColumn.right {
            align-items: center;
          }

          .flowHub {
            order: -1;
          }

          .line {
            display: none;
          }

          .flowConnectors,
          .flowColumn.left .flowCard::after,
          .flowColumn.right .flowCard::after,
          .hubGlow::before,
          .hubGlow::after {
            display: none !important;
          }
        }

        @media (max-width: 980px) {
          .siteHeader {
            height: auto;
          }

          .headerInner {
            min-height: 72px;
            grid-template-columns: auto auto;
            justify-content: space-between;
          }

          .navMenu {
            order: 3;
            grid-column: 1 / -1;
            width: 100%;
            justify-content: center;
            padding-bottom: 14px;
            gap: 18px;
          }

          .headerActions {
            justify-self: end;
          }

          .heroSection {
            min-height: auto;
            padding-top: 92px;
          }

          .floatIcon,
          .floatingPanel {
            display: none;
          }

          .serviceGrid,
          .experienceGrid {
            grid-template-columns: 1fr;
            max-width: 560px;
          }

          .productCard {
            grid-template-columns: 1fr;
            gap: 30px;
          }

          .isometricBox {
            margin: 0 auto;
          }

          .deviceRow {
            flex-wrap: wrap;
          }

          .footerInner {
            grid-template-columns: 1fr 1fr;
            gap: 44px;
          }

          .footerBrand {
            grid-column: 1 / -1;
            max-width: 620px;
          }

          .footerBottom {
            flex-direction: column;
          }
        }

        @media (max-width: 760px) {
          .headerInner {
            padding: 0 18px;
          }

          .navMenu {
            overflow-x: auto;
            justify-content: flex-start;
            padding-left: 4px;
          }

          .ghostBtn {
            display: none;
          }

          .heroSection {
            padding: 70px 18px 74px;
          }

          .heroContent h1 {
            font-size: 42px;
          }

          .heroDesc {
            font-size: 16px;
          }

          .laptopStage {
            width: min(620px, 100%);
            height: 390px;
            margin-top: 48px;
          }

          .laptop {
            top: 34px;
            width: min(560px, 92vw);
            padding: 8px 8px 17px;
            border-radius: 16px 16px 7px 7px;
          }

          .laptop::before {
            bottom: -36px;
            width: 118%;
            height: 44px;
            border-radius: 0 0 24px 24px;
          }

          .laptop::after {
            bottom: -17px;
            width: 104px;
            height: 8px;
          }

          .laptopTop {
            top: 8px;
            width: 56px;
            height: 13px;
            border-radius: 0 0 8px 8px;
          }

          .laptopScreen {
            grid-template-columns: 88px 1fr;
            border-radius: 9px 9px 5px 5px;
          }

          .screenMain {
            padding: 44px 16px 16px;
          }

          .screenMain::before {
            left: 15px;
            right: 15px;
            top: 17px;
          }

          .screenMain::after {
            inset: 42px 16px 16px;
          }

          .screenSidebar::before {
            left: 14px;
            top: 22px;
            width: 50px;
          }

          .screenSidebar::after {
            left: 14px;
            top: 118px;
            width: 54px;
            height: 40px;
            border-radius: 12px;
          }

          .calendarGrid {
            grid-auto-rows: minmax(34px, 1fr);
            gap: 7px;
          }

          .calendarGrid i {
            min-height: 34px;
            border-radius: 8px;
          }

          .sectionTitle h2,
          .flowIntro h2 {
            font-size: 34px;
          }

          .storyCards {
            grid-template-columns: 1fr;
          }

          .clientLogos p {
            font-size: 18px;
          }

          .serviceSection,
          .storySection,
          .productSection,
          .experienceSection,
          .flowSection {
            padding: 76px 18px;
          }

          .serviceCard {
            min-height: 300px;
          }

          .productCard {
            padding: 28px;
          }

          .productText h3 {
            font-size: 34px;
          }

          .flowCard {
            flex-direction: column;
            align-items: flex-start;
          }

          .hubGlow {
            width: 210px;
            height: 210px;
          }

          .hubCore {
            width: 132px;
            height: 132px;
          }

          .footer {
            flex-direction: column;
          }

          .pageFooter {
            padding: 58px 22px 26px;
          }

          .footerInner {
            grid-template-columns: 1fr;
            gap: 34px;
          }

          .footerTagline {
            font-size: 17px;
          }

          .footerBottom {
            margin-top: 40px;
          }
        }

        @media (max-width: 480px) {
          .brandLogo strong,
          .brandLogoText {
            display: none;
          }

          .purpleBtn {
            height: 34px;
            padding: 0 12px;
          }

          .heroContent h1 {
            font-size: 34px;
          }

          .heroButtons {
            width: 100%;
          }

          .whitePill,
          .mainPill {
            width: 100%;
          }

          .sectionTitle h2,
          .flowIntro h2 {
            font-size: 29px;
          }

          .laptop::after {
            width: 86px;
          }

          .serviceCard,
          .experienceCard {
            border-radius: 20px;
          }

          .cssVisual {
            width: 150px;
            height: 110px;
          }

          .flowCard {
            padding: 22px;
          }
        }

        /* Header logo hard lock: 메인 페이지 로고도 공통 Header와 완전히 동일하게 고정 */
        .siteHeader .brandLogo {
          justify-self: start !important;
          display: inline-flex !important;
          align-items: center !important;
          gap: 8px !important;
          color: #15151f !important;
          font-family: var(--font-baton) !important;
          font-size: 20px !important;
          font-weight: 700 !important;
          line-height: 1 !important;
          letter-spacing: 0;
          text-decoration: none !important;
          white-space: nowrap !important;
        }

        .siteHeader .brandLogoText,
        .siteHeader .brandLogo strong {
          color: #15151f !important;
          font-family: var(--font-baton) !important;
          font-size: 20px !important;
          font-weight: 700 !important;
          line-height: 1 !important;
          letter-spacing: 0;
          font-kerning: normal !important;
        }

        .siteHeader .brandGlyph {
          position: relative !important;
          width: 24px !important;
          height: 22px !important;
          display: inline-flex !important;
          align-items: flex-end !important;
          gap: 4px !important;
          flex: 0 0 auto !important;
        }

        .siteHeader .brandGlyph::before,
        .siteHeader .brandGlyph::after,
        .siteHeader .brandGlyph i {
          content: "" !important;
          display: block !important;
          width: 6px !important;
          border-radius: 999px !important;
          background: linear-gradient(180deg, #8c5bff 0%, #6d7cff 100%) !important;
        }

        .siteHeader .brandGlyph::before {
          height: 16px !important;
        }

        .siteHeader .brandGlyph::after {
          height: 10px !important;
          transform: translateY(-6px) !important;
        }

        .siteHeader .brandGlyph i:first-child {
          height: 20px !important;
          transform: translateY(2px) !important;
        }

        .siteHeader .brandGlyph i:last-child {
          display: none !important;
        }

        @media (max-width: 760px) {
          .handlyPage {
            padding-top: 60px !important;
            overflow-x: hidden !important;
            width: 100% !important;
            max-width: 100vw !important;
          }

          .siteHeader {
            left: 0 !important;
            right: 0 !important;
            width: 100% !important;
            height: 60px !important;
            overflow: hidden !important;
          }

          .siteHeader .headerInner {
            min-height: 60px !important;
            height: 60px !important;
            padding: 0 18px !important;
            display: grid !important;
            grid-template-columns: minmax(0, 1fr) auto !important;
            gap: 12px !important;
          }

          .siteHeader .brandLogo {
            min-width: 0 !important;
            max-width: 160px !important;
            overflow: hidden !important;
          }

          .siteHeader .brandLogoText,
          .siteHeader .brandLogo strong {
            display: inline !important;
            font-size: 20px !important;
            line-height: 1 !important;
          }

          .siteHeader .navMenu {
            display: none !important;
          }

          .siteHeader .headerActions {
            display: inline-flex !important;
            justify-self: end !important;
            gap: 8px !important;
          }

          .siteHeader .ghostBtn {
            display: none !important;
          }

          .siteHeader .purpleBtn {
            height: 34px !important;
            padding: 0 14px !important;
            font-size: 12px !important;
            white-space: nowrap !important;
          }

          .heroSection {
            min-height: auto !important;
            padding: 0 !important;
            overflow: hidden !important;
          }

          .heroContent,
          .laptopStage,
          .floatIcon,
          .floatingPanel {
            display: none !important;
          }

          .mobileHeroCompact {
            position: relative !important;
            z-index: 4 !important;
            display: flex !important;
            width: 100% !important;
            max-width: 100vw !important;
            min-height: calc(100dvh - 60px) !important;
            flex-direction: column !important;
            align-items: center !important;
            justify-content: flex-start !important;
            padding: 46px 18px 72px !important;
            text-align: center !important;
            overflow: hidden !important;
          }

          .mobileHeroEyebrow {
            margin: 0 0 12px !important;
            color: #6b5cff !important;
            font-size: 12px !important;
            font-weight: 900 !important;
            line-height: 1.2 !important;
            letter-spacing: 0.12em !important;
          }

          .mobileHeroCompact h1 {
            width: min(100%, 350px) !important;
            margin: 0 auto !important;
            color: #15151f !important;
            font-size: clamp(34px, 9.4vw, 42px) !important;
            line-height: 1.18 !important;
            font-weight: 900 !important;
            letter-spacing: 0 !important;
            word-break: keep-all !important;
            overflow-wrap: normal !important;
          }

          .mobileHeroDesc {
            max-width: 320px !important;
            margin: 18px auto 0 !important;
            color: rgba(21, 21, 31, 0.66) !important;
            font-size: 15px !important;
            line-height: 1.65 !important;
            font-weight: 700 !important;
            word-break: keep-all !important;
          }

          .mobileHeroActions {
            width: min(100%, 320px) !important;
            margin: 24px auto 0 !important;
            display: grid !important;
            grid-template-columns: 1fr !important;
            gap: 10px !important;
          }

          .mobileHeroSecondary,
          .mobileHeroPrimary {
            display: inline-flex !important;
            align-items: center !important;
            justify-content: center !important;
            width: 100% !important;
            height: 46px !important;
            padding: 0 18px !important;
            border-radius: 999px !important;
            font-size: 14px !important;
            font-weight: 900 !important;
            line-height: 1 !important;
            text-decoration: none !important;
            white-space: nowrap !important;
          }

          .mobileHeroSecondary {
            background: #ffffff !important;
            color: #15151f !important;
            box-shadow: 0 14px 30px rgba(37, 36, 60, 0.1) !important;
          }

          .mobileHeroPrimary {
            background: linear-gradient(135deg, #8c5bff 0%, #6d7cff 100%) !important;
            color: #ffffff !important;
            box-shadow: 0 16px 34px rgba(120, 92, 255, 0.24) !important;
          }

          .mobileLaptopPreview {
            position: relative !important;
            width: min(100%, 360px) !important;
            margin: 38px auto 0 !important;
            padding: 8px 8px 0 !important;
            border-radius: 18px 18px 8px 8px !important;
            background: linear-gradient(180deg, #2f3440 0%, #080a10 100%) !important;
            box-shadow:
              inset 0 1px 0 rgba(255, 255, 255, 0.32),
              0 22px 48px rgba(38, 52, 88, 0.22),
              0 0 0 4px rgba(255, 255, 255, 0.42) !important;
          }

          .mobileLaptopScreen {
            display: grid !important;
            grid-template-columns: 74px 1fr !important;
            aspect-ratio: 16 / 10.5 !important;
            overflow: hidden !important;
            border-radius: 10px 10px 4px 4px !important;
            background: #ffffff !important;
            border: 1px solid rgba(255, 255, 255, 0.15) !important;
          }

          .mobileLaptopSide {
            position: relative !important;
            background: linear-gradient(180deg, #fbfaff 0%, #f4f6ff 100%) !important;
            border-right: 1px solid #e8ecfb !important;
          }

          .mobileLaptopSide::before {
            content: "" !important;
            position: absolute !important;
            left: 14px !important;
            top: 24px !important;
            width: 44px !important;
            height: 7px !important;
            border-radius: 999px !important;
            background: #dce3f3 !important;
            box-shadow:
              0 26px 0 #edf1fb,
              0 52px 0 #edf1fb,
              0 78px 0 #edf1fb !important;
          }

          .mobileLaptopSide::after {
            content: "" !important;
            position: absolute !important;
            left: 14px !important;
            bottom: 24px !important;
            width: 48px !important;
            height: 40px !important;
            border-radius: 13px !important;
            background: linear-gradient(135deg, #8c5bff, #63d6d0) !important;
          }

          .mobileLaptopBoard {
            display: grid !important;
            grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
            gap: 10px !important;
            padding: 38px 16px 16px !important;
            background:
              linear-gradient(90deg, transparent 0 48%, rgba(245, 247, 252, 0.9) 48% 66%, transparent 66%),
              #ffffff !important;
          }

          .mobileLaptopBoard span {
            min-height: 42px !important;
            border-radius: 12px !important;
            border: 1px solid #e2e8f4 !important;
            background:
              linear-gradient(90deg, #dfe5f0 0 42%, transparent 42%),
              rgba(255, 255, 255, 0.88) !important;
          }

          .mobileLaptopBoard span:nth-child(1),
          .mobileLaptopBoard span:nth-child(4) {
            background: linear-gradient(135deg, #8c5bff, #63d6d0) !important;
            border-color: transparent !important;
          }

          .mobileLaptopBase {
            position: relative !important;
            left: 50% !important;
            width: 100% !important;
            height: 28px !important;
            border-radius: 0 0 18px 18px !important;
            transform: translateX(-50%) !important;
            background: linear-gradient(180deg, #eef3fa 0%, #b8c2d0 100%) !important;
            box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.95) !important;
          }

          .mobileSlideDots {
            display: inline-flex !important;
            gap: 10px !important;
            margin-top: 28px !important;
          }

          .mobileSlideDots span {
            width: 10px !important;
            height: 10px !important;
            border-radius: 999px !important;
            background: #c5c9d3 !important;
          }

          .mobileSlideDots .active {
            width: 42px !important;
            background: #8c5bff !important;
          }
        }

        @media (max-width: 380px) {
          .mobileHeroCompact h1 {
            width: min(100%, 320px) !important;
            font-size: 31px !important;
          }

          .mobileHeroDesc {
            font-size: 14px !important;
          }

          .mobileLaptopPreview {
            width: min(100%, 330px) !important;
          }
        }
      `}</style>
    </main>
  );
}

function FloatingIcon({
  icon,
  className,
}: {
  icon: ReactNode;
  className?: string;
}) {
  return (
    <span className={className} aria-hidden="true">
      {icon}
    </span>
  );
}

function CssVisual({ type }: { type: string }) {
  return <div className={`cssVisual ${type}`} aria-hidden="true" />;
}

function ExperienceIcon({ type }: { type: string }) {
  const iconMap: Record<string, ReactNode> = {
    consulting: <FiCompass />,
    exchange: <FiGift />,
    demo: <FiPlayCircle />,
    setting: <FiSettings />,
  };

  return (
    <span className={`experienceIcon experienceIcon-${type}`} aria-hidden="true">
      {iconMap[type] ?? <FiCompass />}
    </span>
  );
}

function FlowCard({
  title,
  desc,
  icon,
}: {
  title: string;
  desc: string;
  icon: string;
}) {
  return (
    <article className={`flowCard flowCard-${icon}`}>
      <FlowStepIcon type={icon} />
      <div>
        <h3>{title}</h3>
        <p>{desc}</p>
      </div>
    </article>
  );
}

function FlowStepIcon({ type }: { type: string }) {
  const iconMap: Record<string, ReactNode> = {
    register: <FiEdit3 />,
    request: <FiUserPlus />,
    scope: <FiCheckCircle />,
    matching: <FiLink />,
    record: <FiFlag />,
  };

  return (
    <span className={`flowIcon flowIcon-${type}`} aria-hidden="true">
      {iconMap[type] ?? <FiClipboard />}
    </span>
  );
}
