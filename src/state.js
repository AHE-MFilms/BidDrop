// BidDrop — Global state, constants, and lookup helpers
// Loaded before all other modules.

const SUPABASE_URL = 'https://gtwbhxnrmfmdenogzuea.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd0d2JoeG5ybWZtZGVub2d6dWVhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ4MDIwMDEsImV4cCI6MjA5MDM3ODAwMX0.BsQ16dnGb4xKIgIPxvgqjdGUnZ9H374car1_4e1Umbs';
let sb; // Supabase client — initialized after page load
let masterLobKey = '';      // Fetched at login from AHE agency account — never exposed to client UI
let masterRentcastKey = ''; // Fetched at login from AHE agency account — never exposed to client UI

// ── Secure API helper — all privileged operations go through /api/admin ──────
async function adminAPI(action, body={}, queryParams={}, _retried=false) {
  // Always get the freshest session — Supabase auto-refreshes if the token is close to expiry
  let { data: { session } } = await sb.auth.getSession();
  // If session looks expired or missing, force a refresh
  if (!session || (session.expires_at && session.expires_at * 1000 < Date.now() + 5000)) {
    const refreshed = await sb.auth.refreshSession();
    session = refreshed.data.session;
  }
  const token = session ? session.access_token : '';
  const qs = new URLSearchParams({ action, ...queryParams }).toString();
  const res = await fetch('/api/admin?' + qs, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + token
    },
    body: JSON.stringify(body)
  });
  // If 401, try once more with a forced token refresh
  if (res.status === 401 && !_retried) {
    const refreshed = await sb.auth.refreshSession();
    if (refreshed.data.session) return adminAPI(action, body, queryParams, true);
  }
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || data.message || data.msg || (Array.isArray(data.errors) ? data.errors.map(e=>e.message||e).join(', ') : null) || JSON.stringify(data) || 'API error ' + res.status);
  return data;
}
const AGENCY_ACCOUNT_ID = 'ab08643f-3d71-4f47-abac-31599cf10d25'; // AHE master account row
const OWNER_EMAIL = 'john@mongoosefilms.com'; // Primary owner — cannot be deleted by any other super_admin

const DEFAULTS = {
  companyName:'Your Roofing Co', companyAddr:'123 Main St, Detroit MI 48000', companyPhone:'(313) 555-0100',
  costArchitectural:300, cost3Tab:220, costDesigner:420, costImpact:380, costMetal:680, costFlat:320, costTile:950,
  pricingMode:'detailed', pricePerSquare:450,
  ppsArchitectural:450, ppsDesigner:580, ppsImpact:520, ppsMetal:950, ppsFlat:400, ppsTile:1400,
  costTearoff:75, costIceWater:42, costFelts:22, costDumpster:450,
  costSkylight:375, costChimney:295, costGutter:9,
  overhead:15, margin:20, brandColor:'#F25C05', lobKey:'',
  ghlApiKey:'', ghlLocationId:'gz85VU6SxGXS7lqHAQGx', ghlPipelineId:'bxskBIBdbklHry0B63qx', ghlStageId:'',
  ghlSmsTpl:'Hi {name}! This is {rep} from {company}. Following up about your roof at {address}. Free assessment available this week — reply YES to schedule!',
  jnApiKey:'', jnRecordType:'Customer', jnStatus:'Lead', jobberApiKey:'', webhookUrl:'',
  ghlEmailTpl:'Hi {name},\n\nI hope this message finds you well! I\'m {rep} from {company}. I recently visited your property at {address} and noticed your roof may need attention.\n\nWe\'re offering free storm damage assessments this week. Would you like to schedule a time?\n\nBest,\n{rep}\n{company}',
  // Letter & pitch
  repName:'', repVideoUrl:'', licenseNum:'', yearsInBusiness:'5+', warrantyYears:'10',
  hookLetter:'Most homeowners are tired of door-knockers, pushy salespeople, and high prices when it comes to getting a new roof. I won\'t bother you by knocking on the door — instead, I skip the hassle and lead with my price.',
  whyReceived:'We assessed your neighborhood and identified your home as a candidate for roof replacement. We look for things like missing shingles, moss, algae, buckling, granule loss, and age. The average roof lasts 18–20 years.',
  postcardHook:'Most homeowners dread the pushy roofing salesman. I do things differently — I lead with my price, no pressure, no games. Your estimate is ready.',
  postcardWhy:'We assessed your neighborhood and identified your home as a candidate for roof replacement. We look for things like missing shingles, moss, algae, buckling, granule loss, and age. The average roof lasts 18–20 years.',
  postcardQuote:'"They replaced our roof in one day, no mess, no drama." — Mike D., Canton MI',
  postcardGuarantee:'No door-knocking. No pressure. Just your price.',
  financingEnabled:true, financingApr:9.99, financingTerm:60, financingDown:0,
  // Comparison table (company values; competitor col is hardcoded)
  diff1:'Licensed, Bonded & Insured', diff2:'Manufacturer Certified', diff3:'Itemized Pricing', diff4:'Workmanship Warranty', diff5:'Financing Available', diff6:'Local Crews',
  // Services for page 4
  offerSiding:true, offerWindows:false, offerGutters:true, offerSolar:false, offerCustom:'',
  costSolarPerWatt:3.50,
  // Referral
  referralAmt:'250', referralText:'For every customer you send our way who moves forward with a project, we\'ll send you a Visa gift card as a thank you.',
  // Billing
};

let S = { pins:[], queue:[], estimates:[], team:[], activity:[], cfg:{...DEFAULTS}, offlineQueue:[] };
let _appInitialized = false; // true once onSignedIn has fully completed
let map, markers={}, tempLL=null, curFilter='pipeline', curView='pipeline', actChart=null;
let clusterGroup = null;          // Leaflet.markercluster group
let totalPinCount = 0;            // server-side count (may exceed S.pins.length)
let pinListPage = 0;              // current page for sidebar pin list (50 per page)
let _viewportLoadTimer = null;    // debounce timer for moveend loading
let _lastViewportBounds = null;   // last loaded viewport bounds

// ── AUTH STATE ────────────────────────────────
let currentUser = null;   // Supabase auth user
let currentProfile = null; // user_profiles row
let currentAccount = null; // accounts row
let realtimeChannel = null;

// ─── Structure engine ───
let structures = [];

const PITCH_OPTS = [
  {v:'1.054',l:'4/12 — Low'},{v:'1.083',l:'5/12'},{v:'1.118',l:'6/12 — Standard'},
  {v:'1.158',l:'7/12'},{v:'1.202',l:'8/12 — Moderate'},{v:'1.250',l:'9/12'},
  {v:'1.302',l:'10/12 — Steep'},{v:'1.357',l:'11/12'},{v:'1.414',l:'12/12 — Very Steep'}
];
const MAT_OPTS = [
  {v:'1.3',l:'Architectural Shingle'},
  {v:'1.8',l:'Designer / Premium'},
  {v:'1.5',l:'Impact-Resistant (Class 4)'},
  {v:'2.5',l:'Metal Roofing'},
  {v:'0.9',l:'Flat Roof (TPO/EPDM)'},
  {v:'3.2',l:'Tile (Clay/Concrete)'}
];  // 3-Tab hidden — not commonly used
const COMPLEX_OPTS = [
  {v:'1.0',l:'Simple — Gable, few angles'},{v:'1.12',l:'Moderate — Some hips/valleys'},
  {v:'1.25',l:'Complex — Many angles, dormers'},{v:'1.40',l:'Very Complex'}
];
const STORIES_OPTS = [
  {v:'1',l:'1 Story'},{v:'1.5',l:'1.5 Stories'},{v:'2',l:'2 Stories'},{v:'2.5',l:'2+ Stories'}
];

const PITCHLBL = {'1.054':'4/12 Low','1.083':'5/12','1.118':'6/12 Std','1.158':'7/12','1.202':'8/12 Mod','1.250':'9/12','1.302':'10/12 Steep','1.357':'11/12','1.414':'12/12 Steep',
  // legacy keys kept for old saved estimates
  '1.0':'4/12 Low','1.07':'5/12','1.15':'6/12 Std','1.23':'7/12','1.31':'8/12 Mod','1.40':'9/12','1.50':'10/12 Steep','1.65':'11/12','1.80':'12/12 Steep'};
const MATLBL  = {'1.0':'3-Tab Shingle','1.3':'Architectural Shingle','1.8':'Designer/Premium','1.5':'Impact-Resistant','2.5':'Metal Roofing','0.9':'Flat Roof (TPO/EPDM)','3.2':'Tile (Clay/Concrete)'}; // 1.0 kept for legacy display only

function sColor(s){return{needs_roof:'#F25C05',interested:'#EAB308',contacted:'#A855F7',quoted:'#3B82F6',signed:'#22C55E',converted:'#22C55E',bid_sent:'#3B82F6',not_interested:'#3D5269',lost:'#EF4444'}[s]||'#3D5269';}
function sLabel(s){return{needs_roof:'Needs Roof',interested:'Interested',contacted:'Contacted',quoted:'Quoted',signed:'Signed',converted:'Converted',bid_sent:'Bid Sent',not_interested:'Not Interested',lost:'Lost'}[s]||s;}
