const fs=require('fs'),F='artifacts/promptmegood/index.html';
fs.copyFileSync(F,F+'.bak.'+Date.now());
let h=fs.readFileSync(F,'utf8');
const css=`
    /* PMG Polish */
    .feedback-card-grid{transition:box-shadow 180ms ease,transform 180ms ease}
    .feedback-card-grid:hover{box-shadow:var(--shadow-md);transform:translateY(-2px)}
    .popular-use-card{transition:box-shadow 180ms ease,transform 180ms ease}
    .popular-use-card:hover{box-shadow:var(--shadow-md);transform:translateY(-2px)}
    #generateBtn{transition:opacity 180ms ease,background 180ms ease}
    #generateBtn:disabled{opacity:.65;cursor:not-allowed}
    .strength-score:not([hidden]){animation:pmgFade .3s ease}
    @keyframes pmgFade{from{opacity:0;transform:translateY(4px)}to{opacity:1;transform:none}}
    .run-section{background:color-mix(in srgb,var(--color-primary) 6%,var(--color-surface));border-radius:var(--radius-lg);padding:var(--space-5);margin-top:var(--space-4)}
    .pro-badge{display:inline-block;font-size:11px;font-weight:600;padding:2px 8px;border-radius:9999px;background:#1a6b5e;color:#fff;margin-left:6px;vertical-align:middle}
    @media(max-width:640px){.hero-actions{flex-direction:column}.hero-actions .btn{width:100%;text-align:center}}
    /* End PMG Polish */`;
const si=h.lastIndexOf('</style>',h.indexOf('</head>'));
if(si!==-1)h=h.slice(0,si)+css+h.slice(si);
h=h.replace('>Unlimited AI Runs<','>Unlimited AI Runs<span class="pro-badge">Pro</span><');
h=h.replace('>File & Image Analysis<','>File & Image Analysis<span class="pro-badge">Pro</span><');
h=h.replace('>Custom Personas<','>Custom Personas<span class="pro-badge">Pro</span><');
h=h.replace('>Advanced History<','>Advanced History<span class="pro-badge">Pro</span><');
fs.writeFileSync(F,h);
console.log('Polish done.');
