const fs=require('fs'),F='artifacts/promptmegood/index.html';
fs.copyFileSync(F,F+'.bak.'+Date.now());
let h=fs.readFileSync(F,'utf8');
const fixes=[['Beta User · Copywriter','Sarah M. · Freelance Copywriter'],['Beta User · Small Business Owner','Marcus T. · Small Business Owner'],['Beta User · Content Creator','Janelle R. · Content Creator'],['Loading this week\'s focus…','Solve A Real-Life Problem You\'ve Been Avoiding'],['More Aggressive','More Bold & Direct'],['Run This Prompt With AI','Run This Prompt With AI'],['build a prompt','Build A Prompt'],['see use cases','See Use Cases'],['make money with ai','Make Money With AI'],['start a business','Start A Business'],['create viral content','Create Viral Content'],['write better emails','Write Better Emails'],['use this →','Use This →'],['Run it','Run It'],['what people are saying','What People Are Saying'],['why most ai prompts fail','Why Most AI Prompts Fail'],['how it works','How It Works']];
fixes.forEach(([a,b])=>{ h=h.split(a).join(b); });
fs.writeFileSync(F,h);
console.log('Done.');
