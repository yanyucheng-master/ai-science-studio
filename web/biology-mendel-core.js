/* One autosomal locus, complete dominance, independent offspring. No AI. */
(() => {
  'use strict';
  const GENOTYPES=Object.freeze(['AA','Aa','aa']);
  const CONDITIONS=Object.freeze({autosomal:true,completeDominance:true,equalGametes:true,randomFertilization:true,independentOffspring:true,noSelection:true});
  const integer=(n,min,max)=>Number.isSafeInteger(n)&&n>=min&&n<=max;
  function validate(input){
    if(!input||Object.keys(CONDITIONS).some(k=>input[k]!==true))throw new RangeError('必须明确常染色体、完全显性、配子等概率、随机受精、后代独立及无选择差异。');
    const {parent1,parent2,n,seed}=input;
    if(!GENOTYPES.includes(parent1)||!GENOTYPES.includes(parent2))throw new RangeError('亲本仅支持AA、Aa、aa；不反推未知亲本。');
    if(!integer(n,1,2000)||!integer(seed,1,9999))throw new RangeError('后代数须为1–2000整数，种子须为1–9999整数。');
  }
  function model(input){
    validate(input);
    const {parent1,parent2,n,seed}=input;
    const combine=(a,b)=>a===b?a+a:'Aa';
    const slots=[...parent1].flatMap(a=>[...parent2].map(b=>({a,b,genotype:combine(a,b),probability:.25})));
    const probabilities=Object.fromEntries(GENOTYPES.map(g=>[g,slots.filter(s=>s.genotype===g).length/4]));
    const expected=Object.fromEntries(GENOTYPES.map(g=>[g,n*probabilities[g]]));
    // Park-Miller v1. Two draws per offspring, even for homozygotes. Local
    // immutable sequence means replay, resize and restore cannot resample.
    let state=seed;const random=()=>{state=state*16807%2147483647;return (state-1)/2147483646;};
    // Discard the correlated first small-seed outputs once, then use the same
    // sequence prefix for every N. This is a teaching PRNG, not measured data.
    for(let i=0;i<16;i++)random();
    const counts={AA:0,Aa:0,aa:0},prefix=[Object.freeze({...counts})],samples=[];
    for(let i=0;i<n;i++){
      const a=parent1[Math.floor(random()*2)],b=parent2[Math.floor(random()*2)],g=combine(a,b);
      samples.push(Object.freeze({a,b,genotype:g}));counts[g]++;prefix.push(Object.freeze({...counts}));
    }
    return Object.freeze({version:1,parent1,parent2,n,seed,slots:Object.freeze(slots.map(Object.freeze)),probabilities:Object.freeze(probabilities),expected:Object.freeze(expected),dominant:1-probabilities.aa,recessive:probabilities.aa,counts:Object.freeze({...counts}),samples:Object.freeze(samples),prefix:Object.freeze(prefix)});
  }
  function frame(m,progress){
    if(!Number.isFinite(progress))throw new RangeError('进度必须为有限数。');
    const shown=Math.floor(Math.max(0,Math.min(1,progress))*m.n);
    return {shown,counts:m.prefix[shown],last:shown?m.samples[shown-1]:null};
  }
  window.MasterLabMendel=Object.freeze({version:1,GENOTYPES,CONDITIONS,validate,model,frame});
})();
