<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Aqualert-AI</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@400;500;700&display=swap" rel="stylesheet">

<style>
  :root{
    --depth:#06141C; --depth-2:#091C26; --panel:#0D2330; --panel-2:#10303F;
    --line:#1B3C4B; --line-soft:#143140;
    --ink:#E7F3F1; --muted:#8BA7B0; --muted-2:#5F818C;
    --signal:#3FE0C5; --signal-deep:#15B9A7; --alert:#FFB454; --alert-deep:#F59E0B;
    --display:'Space Grotesk',system-ui,sans-serif;
    --body:'Inter',system-ui,sans-serif;
    --mono:'JetBrains Mono',ui-monospace,monospace;
    --maxw:820px;
  }
  *{box-sizing:border-box}
  html{scroll-behavior:smooth}
  body{
    margin:0;
    background:radial-gradient(1200px 600px at 50% -200px,#0B2632 0%,transparent 60%),var(--depth);
    color:var(--ink);font-family:var(--body);line-height:1.7;-webkit-font-smoothing:antialiased;
  }
  .wrap{max-width:var(--maxw);margin:0 auto;padding:0 24px}
  strong{color:#fff;font-weight:600}
  em{color:var(--signal);font-style:normal}
  :focus-visible{outline:2px solid var(--signal);outline-offset:3px;border-radius:4px}

  /* HERO */
  .hero{position:relative;overflow:hidden;padding:112px 24px 78px;text-align:center;border-bottom:1px solid var(--line-soft)}
  .hero__inner{position:relative;z-index:2;max-width:680px;margin:0 auto}
  .drop{font-size:13px;letter-spacing:.34em;text-transform:uppercase;color:var(--signal-deep);font-family:var(--mono);font-weight:500;margin-bottom:20px}
  .hero h1{
    font-family:var(--display);font-weight:700;font-size:clamp(48px,9vw,86px);line-height:.98;letter-spacing:-.02em;margin:0 0 24px;
    background:linear-gradient(180deg,#FFFFFF 0%,#BFE9E2 100%);
    -webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent;
  }
  .hero h1 .glyph{-webkit-text-fill-color:initial}
  .tagline{font-size:clamp(17px,2.5vw,20px);color:var(--ink);max-width:600px;margin:0 auto;font-weight:400}
  .tagline strong{color:var(--signal);font-weight:600}

  .wave{position:absolute;left:0;right:0;bottom:0;height:220px;z-index:1;opacity:.55;
    -webkit-mask-image:linear-gradient(90deg,transparent,#000 12%,#000 88%,transparent);
            mask-image:linear-gradient(90deg,transparent,#000 12%,#000 88%,transparent);}
  .wave svg{width:200%;height:100%}
  .wave .scroll{animation:drift 14s linear infinite}
  @keyframes drift{from{transform:translateX(0)}to{transform:translateX(-50%)}}
  .baseline{fill:none;stroke:var(--signal);stroke-width:1.6;opacity:.5}
  .spike{fill:none;stroke:var(--alert);stroke-width:2;filter:drop-shadow(0 0 6px rgba(255,180,84,.55));animation:pulse 2.6s ease-in-out infinite}
  @keyframes pulse{0%,100%{opacity:.55}50%{opacity:1}}

  /* SECTIONS */
  main{padding:18px 0 30px}
  section{padding:50px 0 6px}
  .eyebrow{display:flex;align-items:center;gap:14px;margin-bottom:18px}
  .eyebrow .ico{font-size:20px;line-height:1;width:44px;height:44px;flex:0 0 44px;display:grid;place-items:center;border-radius:12px;background:rgba(63,224,197,.09);border:1px solid rgba(63,224,197,.2)}
  .eyebrow.amber .ico{background:rgba(255,180,84,.09);border-color:rgba(255,180,84,.22)}
  h2{font-family:var(--display);font-weight:600;letter-spacing:-.01em;font-size:clamp(27px,4.6vw,36px);margin:0;line-height:1.1}
  .body p{margin:0;font-size:17px;color:#D7E8E5;max-width:720px}

  .card{background:linear-gradient(180deg,var(--panel) 0%,var(--depth-2) 100%);border:1px solid var(--line);border-radius:16px;padding:24px 26px;box-shadow:0 24px 60px -34px rgba(0,0,0,.8)}

  /* sub grid for software / hardware */
  .subgrid{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-top:20px}
  .subcard{background:var(--depth-2);border:1px solid var(--line);border-radius:14px;padding:20px 22px}
  .subcard .head{display:flex;align-items:center;gap:11px;margin-bottom:12px}
  .subcard .chip{width:34px;height:34px;flex:0 0 34px;display:grid;place-items:center;border-radius:9px;font-size:16px;background:rgba(63,224,197,.08);border:1px solid rgba(63,224,197,.18)}
  .subcard h3{margin:0;font-family:var(--display);font-size:18px;font-weight:600;letter-spacing:-.01em}
  .subcard p{margin:0;font-size:15px;color:var(--ink);line-height:1.65}
  .subcard code{font-family:var(--mono);font-size:.86em;background:rgba(63,224,197,.10);color:var(--signal);padding:.12em .42em;border-radius:5px;border:1px solid rgba(63,224,197,.16)}

  footer{border-top:1px solid var(--line-soft);margin-top:40px;padding:30px 0 60px;text-align:center;color:var(--muted-2);font-family:var(--mono);font-size:12px;letter-spacing:.1em}

  @media (max-width:640px){.subgrid{grid-template-columns:1fr}.hero{padding-top:88px}}
  @media (prefers-reduced-motion:reduce){.wave .scroll,.spike{animation:none}html{scroll-behavior:auto}}
</style>

<header class="hero">
  <div class="wave" aria-hidden="true">
    <svg class="scroll" viewBox="0 0 1600 220" preserveAspectRatio="none">
      <path class="baseline" d="M0,150 Q40,150 60,150 T120,150 T180,150 T240,150 T300,150 T360,150 T420,150 T480,150 T540,150 T600,150 T660,150 T720,150 T780,150 T840,150 T900,150 T960,150 T1020,150 T1080,150 T1140,150 T1200,150 T1260,150 T1320,150 T1380,150 T1440,150 T1500,150 T1560,150 T1600,150"/>
      <path class="spike" d="M0,150 H300 q10,0 14,-10 q14,-44 28,4 q10,40 22,-58 q12,-70 24,40 q10,52 22,-30 q12,-40 24,18 q10,30 26,0 H1600"/>
    </svg>
  </div>
  <div class="hero__inner">
    <div class="drop">Acoustic Edge AI</div>
    <h1><span class="glyph">💧</span> Aqualert-AI</h1>
    <p class="tagline"><strong>Aqualert AI:</strong> An acoustic edge AI tool that reduces a school's water consumption by detecting signs of water leakage before they occur.</p>
  </div>
</header>

<main>
  <section id="problem">
    <div class="wrap">
      <div class="eyebrow amber"><span class="ico">🚨</span><h2>Problem</h2></div>
      <div class="card body">
        <p>Schools quietly lose massive amounts of water (and subsequently money) due to leakages in restrooms, toilets, sinks, showers, etc. Nobody notices the leaks because the pipes are hidden behind school walls, and the school only finds out after either the pipe completely bursts or when they receive an expensive water bill at the month.</p>
      </div>
    </div>
  </section>

  <section id="solution">
    <div class="wrap">
      <div class="eyebrow"><span class="ico">✅</span><h2>Solution</h2></div>
      <div class="card body">
        <p>An acoustic edge AI device attached to the toilet, sink, shower and main bathroom supply pipes, so that it can detect leakages based on how the flow of water sounds. When the AI detects a leak it sends an alert to the school, informing them of the potential leak. The school can then send a custodian to look and see if the leak is legit and immediately hire a plumber to come fix it before the leak causes a massive problem.</p>

        <div class="subgrid">
          <div class="subcard">
            <div class="head"><span class="chip">💻</span><h3>Software</h3></div>
            <p>A binary classifier that can take an audio stream as input and determine if it's a normal water pipe or a leaking water pipe.</p>
          </div>
          <div class="subcard">
            <div class="head"><span class="chip">🛠</span><h3>Hardware</h3></div>
            <p>Raspberry Pi 0 to run model inference + sound sensor module to take in audio input from the pipes + water level sensor to assess the severity of the leak.</p>
          </div>
        </div>
      </div>
    </div>
  </section>
</main>

<footer>💧 AQUALERT-AI</footer>
