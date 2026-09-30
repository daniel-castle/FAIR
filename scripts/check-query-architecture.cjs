/* eslint-disable @typescript-eslint/no-require-imports -- CommonJS loader stubs keep this offline check free of server and AI calls. */
// Targeted offline checks. No database or OpenAI calls.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const root = path.resolve(__dirname, '..');
const originalLoad = Module._load;
let expanded = false;
let fakeDb;
let aiCalls = 0;
let generated;
let hub;
let testWorkspace;
Module._load = function(id, parent, main) {
  if (id === 'react') return { ...React, useState: initial => expanded && Array.isArray(initial) ? [['Category discovery'], () => {}] : React.useState(initial) };
  if (id === 'server-only') return {};
  if (id === 'next/cache') return { revalidatePath() {} };
  if (id === '@/lib/supabase/server') return { createSupabaseClient: () => fakeDb };
  if (id === '@/app/truth-hub/actions') return { loadTruthHub: async () => hub };
  if (id === '@/lib/queries/generate') return { generateQueries: async () => { aiCalls++; return generated; } };
  if (id === '@/lib/queries/analyze') return { analyzeQuery: () => { throw Error('Unexpected interpretation call'); } };
  if (id === '@/components/workspace/workspace-provider') return { useWorkspace: () => ({ workspace: testWorkspace, updateWorkspace() {} }) };
  if (id.startsWith('@/')) id = path.join(root, 'src', id.slice(2));
  return originalLoad.call(this, id, parent, main);
};
for (const ext of ['.ts', '.tsx']) require.extensions[ext] = (mod, filename) => mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, esModuleInterop: true, target: ts.ScriptTarget.ES2020 } }).outputText, filename);
const { resolveTruthSuggestions, truthFactsForBusiness } = require('../src/lib/queries/evaluation.ts');
const { calculateQueryMetrics } = require('../src/lib/queries/metrics.ts');
const { validateBenchmarkBatch, benchmarkBatchSchema } = require('../src/lib/queries/schema.ts');
const { zodTextFormat } = require('openai/helpers/zod');
const id = n => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
hub = { business: {id:id(1),name:'Demo'}, offerings:[{id:id(2), business_id:id(1),name:'Product A'}], facts:[
  {id:id(3),business_id:id(1),fact_key:'hours',fact_value:'Friday 11 PM',verified:true,offering_id:null},
  {id:id(4),business_id:id(1),fact_key:'price',fact_value:'$14.99',verified:true,offering_id:id(2)},
  {id:id(5),business_id:id(1),fact_key:'warranty',fact_value:'Lifetime',verified:false,offering_id:null},
  {id:id(6),business_id:id(99),fact_key:'location',fact_value:'Other city',verified:true,offering_id:null},
], sources:[],errors:[] };
const suggestions = [{fact_key:'hours',offering_name:null},{fact_key:'price',offering_name:'Product A'},{fact_key:'price',offering_name:null},{fact_key:'invented',offering_name:null},{fact_key:'warranty',offering_name:null},{fact_key:'location',offering_name:null}];
assert.deepEqual(resolveTruthSuggestions(hub,suggestions),[id(3),id(4)]);
assert.deepEqual(resolveTruthSuggestions({...hub,offerings:[...hub.offerings,{...hub.offerings[0],id:id(9)}]},[suggestions[1]]),[]);
assert.deepEqual(resolveTruthSuggestions({...hub,facts:[...hub.facts,{...hub.facts[0],id:id(8)}]},[suggestions[0]]),[]);
assert(!truthFactsForBusiness(hub).some(f => f.id === id(6)));
const query = {id:id(7),query_text:'Which business should I choose?',category:'Category discovery',audience:'New customers',intent:'Discover options',location:null,is_active:true,results:[]};
const scenarios = ['wedding','budget','downtown','family','weekend','delivery','premium','student','accessible','emergency','outdoor','corporate','evening','local','specialty'];
generated = scenarios.map(scenario=>({query_text:`Which business should I choose for a ${scenario} scenario?`,category:query.category,audience:query.audience,intent:query.intent,location:null,evaluation_dimensions:['visibility','factual_accuracy'],truth_suggestions:suggestions}));
assert.equal(validateBenchmarkBatch({queries:generated}).length,15);
assert.throws(()=>validateBenchmarkBatch({queries:[...generated.slice(0,11),generated[0]]}));
assert.throws(()=>validateBenchmarkBatch({queries:generated.map(q=>({...q,evaluation_dimensions:['invented']}))}));
const nearDuplicates = generated.map((item,index)=>index < 2 ? {...item,query_text:index ? 'Where can I find affordable local catering for a large family celebration?' : 'Where can I find affordable local catering for a large family event?'} : item);
assert.throws(()=>validateBenchmarkBatch({queries:nearDuplicates}));
assert.equal(zodTextFormat(benchmarkBatchSchema,'benchmark_queries').type,'json_schema');
const generationSource = fs.readFileSync(path.join(root,'src/lib/queries/generate.ts'),'utf8');
assert(generationSource.includes('6 unbranded category/discovery questions'));
assert(generationSource.includes('3 branded factual questions'));
assert(generationSource.includes('does not already know the business exists'));
const result = {id:id(10),query_id:query.id,ai_platform:'Example',tested_at:'2026-09-29',mentioned:true,recommendation_position:1,claims_checked:4,verified_claims:3,accuracy_percentage:99,conflict_count:1};
const metrics = calculateQueryMetrics([{...query,results:[result,{...result,mentioned:false}]},query]);
assert.equal(metrics.averageAccuracy,75); // Ignore supplied score; derive from evidence.
assert.equal(metrics.mentionRate,100); // Latest result only.
assert.equal(metrics.testCoverage,50);
assert.equal(calculateQueryMetrics([query]).mentionRate,null);
assert.equal(calculateQueryMetrics([{...query,results:[{...result,claims_checked:0,verified_claims:0}]}]).averageAccuracy,null);
const { QueryLibraryView } = require('../src/components/query-library.tsx');
const batch = {id:id(11),created_at:'2026-09-30T03:58:00Z',query_count:15};
const library = {businessName:'Demo',queries:Array.from({length:36},(_,i)=>({...query,id:id(i+20)})),metrics:calculateQueryMetrics([query]),batches:[batch],truthFacts:truthFactsForBusiness(hub)};
const setTestWorkspace = value => { testWorkspace = { truthHub: { business: hub.business, offerings: hub.offerings, facts: hub.facts, sources: [] }, queries: { items: value.queries, batches: value.batches }, monitoring: { runs: [], results: [], claims: [], reviews: [], recommendations: [] }, insights: [] }; };
setTestWorkspace(library);
let html = renderToStaticMarkup(React.createElement(QueryLibraryView));
assert(html.includes('Active benchmark set'));
assert(html.includes('Benchmark Coverage'));
assert(!html.includes(query.query_text));
assert(!html.includes('<form'));
assert(html.includes('Sep 30, 2026'));
expanded = true;
setTestWorkspace({...library,queries:[{...query,origin:'generated',batch,evaluation_dimensions:['factual_accuracy'],truth_links:[]}]});
html = renderToStaticMarkup(React.createElement(QueryLibraryView));
assert(html.includes('Needs Truth Hub link'));
assert(!html.includes('AI Query Understanding'));
assert(!html.includes(batch.id.slice(0,8)));
setTestWorkspace({...library,queries:[{...query,evaluation_dimensions:['visibility'],truth_links:[library.truthFacts[0]]}]});
html = renderToStaticMarkup(React.createElement(QueryLibraryView));
assert(!html.includes('Verified benchmark'));
assert(!html.includes('Manage benchmark'));
assert(html.includes('Ready for monitoring'));
const queryUiSource = fs.readFileSync(path.join(root,'src/components/query-library.tsx'),'utf8');
assert(queryUiSource.includes('Refresh Questions'));
assert(!queryUiSource.includes('BenchmarkDefinition'));
assert(!queryUiSource.includes('EvaluationFields'));
assert(!queryUiSource.includes('{query.category} ·'));
setTestWorkspace({...library,queries:[{...query,evaluation_dimensions:['factual_accuracy'],truth_links:[library.truthFacts[0]]}]});
html = renderToStaticMarkup(React.createElement(QueryLibraryView));
assert(html.includes('Ready for monitoring'));
assert(!html.includes('Manage benchmark'));
const actions = require('../src/app/queries/actions.ts');
let rpcCalls = [];
let preflightError = false;
let saveError = false;
let lastOrigin;
fakeDb = {
  from(table) {
    let selected = ''; let batchFilter = false;
    const chain = { select(columns) {selected=columns;return this;}, eq(key) { if(key==='batch_id') batchFilter=true;return this;}, in(){return this;}, order(){return this;},limit(){return this;},
      maybeSingle:async()=>({data:hub.business,error:null}),
      single:async()=>({data:{id:batch.id,query_count:15},error:null}),
      then(resolve) {return Promise.resolve({data:batchFilter ? generated.map((_,i)=>({id:id(i+20)})) : lastOrigin==='manual' && selected==='id' && table==='benchmark_queries' ? [{id:query.id}] : [],error:preflightError?{message:'Missing migration'}:null}).then(resolve);}
    }; return chain;
  },
  async rpc(name,args) { rpcCalls.push({name,args});lastOrigin=args.p_origin;return {data:{batch_id:batch.id,query_count:15,query_ids:[query.id]},error:saveError?{message:'Failed'}:null}; }
};
(async()=>{
  preflightError=true;
  assert((await actions.generateBenchmarkQueries()).error);
  assert.equal(aiCalls,0);
  preflightError=false;
  assert((await actions.generateBenchmarkQueries()).message);
  assert.equal(aiCalls,1);
  assert.equal(rpcCalls.length,1);
  assert.equal(rpcCalls[0].args.p_origin,'generated');
  assert.deepEqual(rpcCalls[0].args.p_queries[0].fact_ids,[id(3),id(4)]);
  assert(!('truth_suggestions' in rpcCalls[0].args.p_queries[0]));
  const manual={query_text:query.query_text,category:query.category,audience:query.audience,intent:query.intent,location:null,is_active:true};
  assert((await actions.createBenchmarkQuery(manual,{dimensions:['visibility'],fact_ids:[id(6)]})).error);
  assert.equal(rpcCalls.length,1);
  assert((await actions.createBenchmarkQuery(manual,{dimensions:['visibility'],fact_ids:[]})).message);
  assert.equal(rpcCalls[1].args.p_origin,'manual');
  assert((await actions.saveBenchmarkEvaluation(query.id,{dimensions:['factual_accuracy'],fact_ids:[id(3)]})).message);
  assert.equal(rpcCalls[2].name,'set_benchmark_evaluation');
  assert.equal(aiCalls,1);
  saveError=true;
  assert((await actions.saveBenchmarkEvaluation(query.id,{dimensions:['visibility'],fact_ids:[]})).error);
  console.log('Passed: schema, exact fact resolution, tenant/verification/ambiguity rejection, deterministic metrics, generation preflight/single-call persistence, manual edits, and empty/expanded render checks.');
})().catch(error=>{console.error(error);process.exitCode=1;});
