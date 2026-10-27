import React, { useEffect, useRef, useState } from "react";
import {
  ArrowUpRight,
  ArrowRight,
  ArrowLeft,
  ShieldCheck,
  Heart,
  HeartHandshake,
  HeartPulse,
  Plus,
  Minus,
  Menu,
  X,
  Check,
  Layers3,
  Users,
  Infinity as InfinityIcon,
  Landmark,
} from "lucide-react";
import { createScope, createTimeline, stagger } from "animejs";
import { request } from "./api";
import { MotionToggle, useCalmMotion } from "./ui/animated";
import "./landing.css";

// Products name their "need" icon (need_icon in the database); this maps the name to a component.
const needIcons = {
  Users,
  Infinity: InfinityIcon,
  Heart,
  HeartHandshake,
  HeartPulse,
  Landmark,
  ShieldCheck,
};
const tones = ["sage", "peach", "lilac"];

// The landing cards are the products with a featured_order; the rest are named below the cards.
function splitFeatured(products) {
  const featured = products
    .filter((product) => product.featuredOrder != null)
    .sort((a, b) => a.featuredOrder - b.featuredOrder);
  if (!featured.length) return { featured: products.slice(0, 3), others: products.slice(3) };
  return { featured, others: products.filter((product) => product.featuredOrder == null) };
}

function listNames(names) {
  if (names.length < 2) return names.join("");
  return names.slice(0, -1).join(", ") + " and " + names[names.length - 1];
}

const questions = [
  [
    "How do I choose the right cover?",
    "Start with what matters most to you: support for your family, funeral costs, or everyday expenses during a hospital stay. Explore the options above, then sign in to see the products available to your account. Always review the product terms, eligibility, exclusions, and waiting periods before buying.",
  ],
  [
    "I’m already a customer. Where do I sign in?",
    "Choose Customer login at the top of this page. Use the username and password provided when your customer account was created. Your portal brings together the cover available to you and your existing policies.",
  ],
  [
    "What do I need before I can buy cover?",
    "You need a Nsure customer account and a completed identity check. If your identity check is still pending, your Nsure administrator will need to verify it before you can purchase cover.",
  ],
  [
    "Where can the Nsure team access the workspace?",
    "Choose Admin login at the top of the page. The operations workspace uses your staff account; customers should use Customer login.",
  ],
];

function Brand() {
  return (
    <a className="lp-brand" href="#/home" aria-label="Nsure Life home">
      <img className="lp-brand-logo" src="/brand/nsure-life-logo.svg" alt="Nsure Life" />
    </a>
  );
}

function CoverCard({ item, number, tone }) {
  const [flipped, setFlipped] = useState(false);
  const frontAction = useRef(null);
  const backAction = useRef(null);
  const hasFlipped = useRef(false);
  useEffect(() => {
    if (flipped) {
      hasFlipped.current = true;
      backAction.current?.focus({ preventScroll: true });
    } else if (hasFlipped.current)
      frontAction.current?.focus({ preventScroll: true });
  }, [flipped]);
  const Icon = needIcons[item.icon] || ShieldCheck;
  const headline = (item.tagline || item.highlight || item.name).split("\n");
  return (
    <article
      aria-label={item.name}
      className={`lp-flip-card ${tone} ${flipped ? "is-flipped" : ""}`}
    >
      <div className="lp-flip-inner">
        <div
          className="lp-card-face lp-card-front"
          inert={flipped ? true : undefined}
          aria-hidden={flipped}
        >
          <div className="lp-card-top">
            <span>
              <Icon size={17} />
              {item.name}
            </span>
            <span className="lp-card-number">
              {String(number).padStart(2, "0")}
            </span>
          </div>
          <h3>
            {headline.map((line, i) => (
              <React.Fragment key={i}>
                {i > 0 && <br />}
                {line}
              </React.Fragment>
            ))}
          </h3>
          <div className="lp-card-image">
            {item.image && (
              <img
                src={item.image}
                alt=""
                loading="lazy"
                style={{ objectPosition: item.imageFocus || "center" }}
              />
            )}
          </div>
          <button
            ref={frontAction}
            className="lp-card-action"
            onClick={() => setFlipped(true)}
            aria-label={`Explore ${item.name}`}
            aria-expanded={flipped}
          >
            <span>
              Explore cover
              {item.premium && (
                <small className="lp-card-price">{item.premium} / month</small>
              )}
            </span>
            <span className="lp-round-arrow">
              <ArrowUpRight size={19} />
            </span>
          </button>
        </div>
        <div
          className="lp-card-face lp-card-back"
          inert={!flipped ? true : undefined}
          aria-hidden={!flipped}
        >
          {item.highlight && <span className="lp-kicker">{item.highlight}</span>}
          <Icon size={34} strokeWidth={1.3} />
          <h3>{item.name}</h3>
          <p>{item.summary}</p>
          <ul>
            {item.benefits.map((point) => (
              <li key={point}>
                <Check size={16} />
                {point}
              </li>
            ))}
          </ul>
          <small>
            {item.cover && "Cover " + item.cover + ". "}
            Eligibility, exclusions and policy terms apply.
          </small>
          <a
            ref={backAction}
            className="lp-button lp-button-dark"
            href="#/login/customer"
          >
            View in customer portal <ArrowUpRight size={17} />
          </a>
          <button
            className="lp-text-button"
            onClick={() => setFlipped(false)}
            aria-label={`Back to ${item.name}`}
          >
            <ArrowLeft size={16} /> Back to cover
          </button>
        </div>
      </div>
    </article>
  );
}

function CoverPlaceholder() {
  return (
    <div className="lp-flip-card lp-card-loading" aria-hidden="true">
      <div className="lp-card-face" />
    </div>
  );
}

export default function LandingPage({ section = "home" }) {
  const root = useRef(null);
  const [menu, setMenu] = useState(false);
  const [openQuestion, setOpenQuestion] = useState(0);
  const calm = useCalmMotion();
  // null while loading; the public endpoint needs no sign-in.
  const [products, setProducts] = useState(null);
  const { featured, others } = splitFeatured(products || []);

  useEffect(() => {
    let live = true;
    request(null, "/public/products")
      .then(({ data }) => live && setProducts(Array.isArray(data) ? data : []))
      .catch(() => live && setProducts([]));
    return () => {
      live = false;
    };
  }, []);

  useEffect(() => {
    if (calm) return;
    const scope = createScope({ root }).add(() => {
      createTimeline({ defaults: { ease: "out(3)", duration: 850 } })
        .add(".lp-hero-reveal", {
          opacity: { from: 0, to: 1 },
          y: { from: 22, to: 0 },
          delay: stagger(100),
        })
        .add(
          ".lp-hero-visual",
          {
            opacity: { from: 0, to: 1 },
            y: { from: 30, to: 0 },
            scale: { from: 0.97, to: 1 },
          },
          180,
        )
        .add(
          ".lp-float-note",
          { opacity: { from: 0, to: 1 }, x: { from: -20, to: 0 } },
          650,
        );
    });
    return () => scope.revert();
  }, [calm]);

  useEffect(() => {
    setMenu(false);
    if (["cover", "how-it-works", "questions"].includes(section)) {
      document
        .getElementById(section)
        ?.scrollIntoView({ behavior: calm ? "instant" : "smooth" });
    } else window.scrollTo({ top: 0, behavior: "instant" });
  }, [section]);

  useEffect(() => {
    const close = (e) => {
      if (e.key === "Escape") setMenu(false);
    };
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("keydown", close);
    };
  }, []);

  return (
    <div
      className="lp"
      ref={root}
      onClick={(event) => {
        const anchor = event.target.closest("a");
        const href = anchor?.getAttribute("href");
        if (
          href === location.hash &&
          /^#\/(home|cover|how-it-works|questions)$/.test(href)
        ) {
          event.preventDefault();
          if (href === "#/home")
            window.scrollTo({ top: 0, behavior: calm ? "instant" : "smooth" });
          else
            document
              .getElementById(href.slice(2))
              ?.scrollIntoView({ behavior: calm ? "instant" : "smooth" });
          setMenu(false);
        }
      }}
    >
      <a
        className="lp-skip"
        href="#lp-main"
        onClick={(event) => {
          event.preventDefault();
          document.getElementById("lp-main")?.focus();
        }}
      >
        Skip to content
      </a>
      <header className="lp-header">
        <div className="lp-nav-wrap">
          <Brand />
          <button
            className="lp-menu-toggle"
            aria-label={menu ? "Close navigation" : "Open navigation"}
            aria-expanded={menu}
            aria-controls="landing-navigation"
            onClick={() => setMenu(!menu)}
          >
            {menu ? <X /> : <Menu />}
          </button>
          <nav
            className={"lp-navigation " + (menu ? "is-open" : "")}
            id="landing-navigation"
            aria-label="Main navigation"
          >
            <div className="lp-nav-links">
              <a href="#/cover">Our cover</a>
              <a href="#/how-it-works">How it works</a>
              <a href="#/questions">Good to know</a>
            </div>
            <div className="lp-nav-actions">
              <a className="lp-button lp-button-dark lp-login" href="#/login/admin">
                Admin login <ArrowUpRight size={16} />
              </a>
              <a
                className="lp-button lp-button-dark lp-login"
                href="#/login/customer"
              >
                Customer login <ArrowUpRight size={16} />
              </a>
            </div>
          </nav>
        </div>
      </header>

      <main id="lp-main" tabIndex={-1}>
        <section className="lp-hero lp-container">
          <div className="lp-hero-copy">
            <div className="lp-kicker lp-hero-reveal">
              <span className="lp-small-line" /> INSURANCE, WITH PEOPLE AT HEART
            </div>
            <h1 className="lp-hero-reveal">
              Life happens.
              <br />
              Let’s make
              <br />
              <em>room for it.</em>
              <span className="lp-heading-spark" aria-hidden="true">
                ✳
              </span>
            </h1>
            <p className="lp-hero-reveal lp-hero-description">
              For the everyday moments. And the unexpected ones.
              <br className="lp-desktop-break" /> Discover cover that puts you
              and the people you love first.
            </p>
            <div className="lp-hero-actions lp-hero-reveal">
              <a className="lp-button lp-button-dark" href="#/cover">
                Find your cover <ArrowUpRight size={18} />
              </a>
              <a className="lp-button lp-button-plain" href="#/how-it-works">
                A simpler way to insure <ArrowRight size={17} />
              </a>
            </div>
            <div className="lp-hero-foot lp-hero-reveal">
              <ShieldCheck size={18} />
              <span>Thoughtful protection. A little more peace of mind.</span>
            </div>
          </div>
          <div className="lp-hero-visual">
            <div className="lp-photo-arch">
              {featured[0]?.image && (
                <img src={featured[0].image} alt="" fetchPriority="high" />
              )}
              <div className="lp-photo-caption">
                <span>FOR ALL THAT MAKES LIFE, LIFE.</span>
                <p>
                  The little moments.
                  <br />
                  The whole world.
                </p>
              </div>
            </div>
            <div className="lp-orbit-stamp" aria-hidden="true">
              <span>HERE FOR LIFE</span>
              <Heart size={28} strokeWidth={1.4} />
              <span>HERE FOR YOU</span>
            </div>
            <div className="lp-float-note">
              <span className="lp-note-icon">
                <ShieldCheck size={25} strokeWidth={1.4} />
              </span>
              <div>
                <strong>
                  A little cover.
                  <br />A world of care.
                </strong>
                <span>That’s the Nsure way.</span>
              </div>
              <span className="lp-note-dot" />
            </div>
            <div className="lp-life-label">
              <span /> Built around real life
            </div>
            <div className="lp-geometry" aria-hidden="true">
              <div className="lp-cube">
                <i />
                <i />
                <i />
              </div>
              <div className="lp-cube">
                <i />
                <i />
                <i />
              </div>
              <div className="lp-cube">
                <i />
                <i />
                <i />
              </div>
            </div>
          </div>
        </section>

        <div className="lp-values">
          <div className="lp-container">
            <span>
              Life is full.
              <br />
              <strong>Let’s keep it that way.</strong>
            </span>
            <p>
              <Heart strokeWidth={1.4} /> People before policies
            </p>
            <p>
              <ShieldCheck strokeWidth={1.4} /> Cover with a purpose
            </p>
            <p>
              <Layers3 strokeWidth={1.4} /> All together, in one place
            </p>
          </div>
        </div>

        <section className="lp-cover lp-container" id="cover">
          <div className="lp-section-heading">
            <div>
              <span className="lp-kicker">
                A LITTLE FORESIGHT. A LOT OF LOVE.
              </span>
              <h2>
                Different lives.
                <br />
                <em>Thoughtful protection.</em>
              </h2>
            </div>
            <p>
              Whatever your next chapter looks like,
              <br />
              there’s a good place to start.
              <br />
              <span>Explore a card to find out more.</span>
            </p>
          </div>
          {products && !featured.length ? (
            <p className="lp-cover-empty" role="status">
              Our cover options are not available to show right now. Sign in to
              see the products available to your account.
            </p>
          ) : (
            <div className="lp-cover-grid" aria-busy={!products}>
              {products
                ? featured.map((item, i) => (
                    <CoverCard
                      key={item.name}
                      item={item}
                      number={i + 1}
                      tone={tones[i % tones.length]}
                    />
                  ))
                : tones.map((tone) => <CoverPlaceholder key={tone} />)}
            </div>
          )}
          <div className="lp-cover-bottom">
            <p>
              {!products
                ? null
                : others.length
                ? `Looking further ahead? Explore ${listNames(others.map((p) => p.name))} in your portal.`
                : "Sign in to see all the cover available to your account."}
            </p>
            <a href="#/login/customer">
              See all cover <ArrowUpRight size={17} />
            </a>
          </div>
        </section>

        <section className="lp-how" id="how-it-works">
          <div className="lp-container lp-how-grid">
            <div className="lp-how-heading">
              <span className="lp-kicker">
                LESS COMPLICATED. MORE CONNECTED.
              </span>
              <h2>
                Your next chapter,
                <br />
                <em>in a few simple steps.</em>
              </h2>
              <p>
                A clear path from finding your cover to keeping it all together.
              </p>
              <a className="lp-button lp-button-lime" href="#/login/customer">
                Your space starts here <ArrowUpRight size={18} />
              </a>
              <div className="lp-how-art" aria-hidden="true">
                <span />
                <span />
                <span />
                <Heart size={32} strokeWidth={1} />
              </div>
            </div>
            <div className="lp-steps">
              {[
                [
                  "01",
                  "Find what matters to you.",
                  "Family, health, or the future. Get to know the cover that fits the things you care about.",
                ],
                [
                  "02",
                  "Make yourself at home.",
                  "Sign in to your customer account. Once your identity is verified, explore the options available to you.",
                ],
                [
                  "03",
                  "Take the next step with clarity.",
                  "Review your chosen product and its terms, buy your cover, and see your policies in one place.",
                ],
              ].map(([number, title, text]) => (
                <div className="lp-step" key={number}>
                  <span>{number}</span>
                  <div>
                    <h3>{title}</h3>
                    <p>{text}</p>
                  </div>
                  <ArrowUpRight size={21} />
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="lp-faq lp-container" id="questions">
          <div>
            <span className="lp-kicker">GOOD TO KNOW</span>
            <h2>
              A little clarity
              <br />
              <em>goes a long way.</em>
            </h2>
            <p>A few answers before you take the next step.</p>
          </div>
          <div className="lp-faq-list">
            {questions.map(([q, a], i) => (
              <div
                className={
                  "lp-faq-item " + (openQuestion === i ? "is-open" : "")
                }
                key={q}
              >
                <h3>
                  <button
                    aria-expanded={openQuestion === i}
                    aria-controls={`answer-${i}`}
                    onClick={() =>
                      setOpenQuestion(openQuestion === i ? null : i)
                    }
                  >
                    {q}
                    {openQuestion === i ? (
                      <Minus size={18} />
                    ) : (
                      <Plus size={18} />
                    )}
                  </button>
                </h3>
                <div id={`answer-${i}`} hidden={openQuestion !== i}>
                  <p>{a}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="lp-final lp-container">
          <div>
            <span className="lp-kicker">FOR TODAY. FOR WHAT’S NEXT.</span>
            <h2>
              More living.
              <br />
              <em>A little less worrying.</em>
            </h2>
          </div>
          <div>
            <p>
              Make space for what matters.
              <br />
              Your Nsure journey starts here.
            </p>
            <a className="lp-button lp-button-dark" href="#/login/customer">
              Explore your cover <ArrowUpRight size={18} />
            </a>
          </div>
          <span className="lp-final-flower" aria-hidden="true">
            ✳
          </span>
        </section>
      </main>

      <footer className="lp-footer lp-container">
        <div className="lp-footer-top">
          <div>
            <Brand />
            <p>Made for people who care for people.</p>
          </div>
          <div className="lp-footer-links">
            <a href="#/cover">Our cover</a>
            <a href="#/login/customer">Customer login</a>
            <a href="#/login/admin">Admin login</a>
            <MotionToggle />
          </div>
        </div>
        <div className="lp-footer-bottom">
          <span>© {new Date().getFullYear()} Nsure. Insurance, connected.</span>
          <p>
            Product information is illustrative. Cover is subject to eligibility
            and policy terms.
          </p>
          <a href="#/home">Back to top ↑</a>
        </div>
      </footer>
    </div>
  );
}
