// seed_canvas_templates.js
// Generates the 6 seed canvas_templates as Fabric.js JSON
// Run: node seed_canvas_templates.js > seed_templates.json

const W = 900, H = 600;

// Helper: locked text object
function lockedText(text, opts) {
  return {
    type: 'textbox', version: '5.3.1',
    originX: 'left', originY: 'top',
    ...opts,
    text,
    bdLock: opts.bdLock || 'locked',
    bdZoneLabel: opts.bdZoneLabel || null,
    editable: opts.bdLock === 'editable',
    selectable: opts.bdLock === 'editable',
    evented: opts.bdLock === 'editable',
    lockMovementX: true, lockMovementY: true,
    lockScalingX: true, lockScalingY: true,
    lockRotation: true,
    hasControls: false, hasBorders: opts.bdLock === 'editable',
    borderColor: '#22c55e',
  };
}

// Helper: locked rect (background block)
function lockedRect(opts) {
  return {
    type: 'rect', version: '5.3.1',
    originX: 'left', originY: 'top',
    ...opts,
    bdLock: 'locked',
    selectable: false, evented: false,
    hasControls: false, hasBorders: false,
  };
}

// Helper: editable image zone (placeholder rect with label)
function editableImageZone(opts) {
  return {
    type: 'rect', version: '5.3.1',
    originX: 'left', originY: 'top',
    ...opts,
    bdLock: 'editable',
    selectable: true, evented: true,
    lockMovementX: true, lockMovementY: true,
    lockScalingX: true, lockScalingY: true,
    lockRotation: true,
    hasControls: false, hasBorders: true,
    borderColor: '#22c55e',
    strokeDashArray: [6, 4],
    stroke: '#22c55e',
    strokeWidth: 2,
    fill: 'rgba(34,197,94,0.06)',
  };
}

// ── Template 1: Storm / Wind ──────────────────────────────────────────────────
const stormFront = {
  version: '5.3.1',
  objects: [
    // Dark background
    lockedRect({ left:0, top:0, width:W, height:H, fill:'#1a1a2e', rx:0, ry:0 }),
    // Hero image zone (right 45%)
    editableImageZone({ left:495, top:0, width:405, height:H, bdZoneLabel:'heroImage' }),
    // Orange accent bar top
    lockedRect({ left:0, top:0, width:495, height:8, fill:'#F25C05' }),
    // "YOU HAVE" label
    lockedText('YOU HAVE', {
      left:40, top:40, width:400, fontSize:16, fontFamily:'Oswald', fontWeight:'400',
      fill:'#F25C05', letterSpacing:4, textTransform:'uppercase',
    }),
    // "WIND DAMAGE" headline
    lockedText('WIND DAMAGE', {
      left:40, top:60, width:420, fontSize:72, fontFamily:'Oswald', fontWeight:'700',
      fill:'#FFFFFF', lineHeight:1.0,
      bdLock:'editable', bdZoneLabel:'headline1',
    }),
    // Subtext
    lockedText('We tapped your home on the map and built this estimate based on your property data.', {
      left:40, top:175, width:420, fontSize:15, fontFamily:'Barlow', fontWeight:'400',
      fill:'#C8D8E8', lineHeight:1.5,
      bdLock:'editable', bdZoneLabel:'subtext',
    }),
    // Logo zone
    editableImageZone({ left:40, top:440, width:180, height:60, bdZoneLabel:'logo' }),
    // Phone
    lockedText('555-555-5555', {
      left:40, top:515, width:300, fontSize:20, fontFamily:'Oswald', fontWeight:'600',
      fill:'#F25C05',
      bdLock:'editable', bdZoneLabel:'phone',
    }),
    // Website
    lockedText('www.yourcompany.com', {
      left:40, top:545, width:300, fontSize:13, fontFamily:'Barlow', fontWeight:'400',
      fill:'#96B0C8',
      bdLock:'editable', bdZoneLabel:'website',
    }),
    // Gradient overlay hint text on hero zone
    lockedText('📷 Upload House Photo', {
      left:510, top:270, width:380, fontSize:14, fontFamily:'Barlow', fontWeight:'400',
      fill:'rgba(34,197,94,0.7)', textAlign:'center',
    }),
  ],
  background: '#1a1a2e',
};

// ── Template 2: Solar ─────────────────────────────────────────────────────────
const solarFront = {
  version: '5.3.1',
  objects: [
    lockedRect({ left:0, top:0, width:W, height:H, fill:'#0d1b2a' }),
    // Hero image zone (full bleed, behind content)
    editableImageZone({ left:0, top:0, width:W, height:H, bdZoneLabel:'heroImage', opacity:0.4 }),
    // Dark overlay
    lockedRect({ left:0, top:0, width:W, height:H, fill:'rgba(13,27,42,0.65)' }),
    // Yellow sun accent
    lockedRect({ left:0, top:0, width:W, height:6, fill:'#F59E0B' }),
    // "YOUR HOME IS" label
    lockedText('YOUR HOME IS', {
      left:60, top:120, width:500, fontSize:18, fontFamily:'Oswald', fontWeight:'400',
      fill:'#F59E0B', letterSpacing:3, textAlign:'center',
    }),
    // "SOLAR READY" headline
    lockedText('SOLAR READY', {
      left:60, top:150, width:780, fontSize:96, fontFamily:'Oswald', fontWeight:'700',
      fill:'#FFFFFF', textAlign:'center',
      bdLock:'editable', bdZoneLabel:'headline1',
    }),
    // Subtext
    lockedText('Our satellite analysis shows your roof has the ideal orientation and minimal shading for maximum solar production.', {
      left:120, top:290, width:660, fontSize:15, fontFamily:'Barlow', fontWeight:'400',
      fill:'#C8D8E8', lineHeight:1.6, textAlign:'center',
      bdLock:'editable', bdZoneLabel:'subtext',
    }),
    // Logo zone
    editableImageZone({ left:360, top:390, width:180, height:60, bdZoneLabel:'logo' }),
    // Phone
    lockedText('555-555-5555', {
      left:300, top:470, width:300, fontSize:22, fontFamily:'Oswald', fontWeight:'600',
      fill:'#F59E0B', textAlign:'center',
      bdLock:'editable', bdZoneLabel:'phone',
    }),
    // Website
    lockedText('www.yourcompany.com', {
      left:300, top:500, width:300, fontSize:13, fontFamily:'Barlow', fontWeight:'400',
      fill:'#96B0C8', textAlign:'center',
      bdLock:'editable', bdZoneLabel:'website',
    }),
  ],
  background: '#0d1b2a',
};

// ── Template 3: Gutters ───────────────────────────────────────────────────────
const guttersFront = {
  version: '5.3.1',
  objects: [
    lockedRect({ left:0, top:0, width:W, height:H, fill:'#1c2b1c' }),
    editableImageZone({ left:480, top:0, width:420, height:H, bdZoneLabel:'heroImage' }),
    lockedRect({ left:0, top:0, width:480, height:6, fill:'#22c55e' }),
    lockedText('CLOGGED GUTTERS?', {
      left:40, top:40, width:400, fontSize:13, fontFamily:'Oswald', fontWeight:'400',
      fill:'#22c55e', letterSpacing:3,
    }),
    lockedText('FREE GUTTER\nINSPECTION', {
      left:40, top:65, width:420, fontSize:64, fontFamily:'Oswald', fontWeight:'700',
      fill:'#FFFFFF', lineHeight:1.05,
      bdLock:'editable', bdZoneLabel:'headline1',
    }),
    lockedText('✓ Licensed & Insured\n✓ Free Estimates\n✓ Same-Day Service Available', {
      left:40, top:230, width:400, fontSize:16, fontFamily:'Barlow', fontWeight:'500',
      fill:'#C8D8E8', lineHeight:1.7,
      bdLock:'editable', bdZoneLabel:'subtext',
    }),
    editableImageZone({ left:40, top:400, width:180, height:60, bdZoneLabel:'logo' }),
    lockedText('555-555-5555', {
      left:40, top:475, width:300, fontSize:20, fontFamily:'Oswald', fontWeight:'600',
      fill:'#22c55e',
      bdLock:'editable', bdZoneLabel:'phone',
    }),
    lockedText('www.yourcompany.com', {
      left:40, top:505, width:300, fontSize:13, fontFamily:'Barlow', fontWeight:'400',
      fill:'#96B0C8',
      bdLock:'editable', bdZoneLabel:'website',
    }),
    lockedText('📷 Upload House Photo', {
      left:495, top:270, width:390, fontSize:14, fontFamily:'Barlow', fontWeight:'400',
      fill:'rgba(34,197,94,0.7)', textAlign:'center',
    }),
  ],
  background: '#1c2b1c',
};

// ── Template 4: Roofing Inspection ────────────────────────────────────────────
const roofingFront = {
  version: '5.3.1',
  objects: [
    lockedRect({ left:0, top:0, width:W, height:H, fill:'#1a0a00' }),
    editableImageZone({ left:480, top:0, width:420, height:H, bdZoneLabel:'heroImage' }),
    lockedRect({ left:0, top:0, width:480, height:6, fill:'#F25C05' }),
    lockedText('FREE ROOF', {
      left:40, top:40, width:400, fontSize:16, fontFamily:'Oswald', fontWeight:'400',
      fill:'#F25C05', letterSpacing:3,
    }),
    lockedText('INSPECTION', {
      left:40, top:65, width:420, fontSize:80, fontFamily:'Oswald', fontWeight:'700',
      fill:'#FFFFFF', lineHeight:1.0,
      bdLock:'editable', bdZoneLabel:'headline1',
    }),
    // Star badge
    lockedRect({ left:40, top:190, width:200, height:40, fill:'#F25C05', rx:20, ry:20 }),
    lockedText('★  NO OBLIGATION', {
      left:48, top:199, width:184, fontSize:14, fontFamily:'Oswald', fontWeight:'700',
      fill:'#FFFFFF', textAlign:'center',
    }),
    lockedText('We identify missing shingles, moss, algae, buckling, granule loss, and age damage — at no cost to you.', {
      left:40, top:255, width:410, fontSize:15, fontFamily:'Barlow', fontWeight:'400',
      fill:'#C8D8E8', lineHeight:1.6,
      bdLock:'editable', bdZoneLabel:'subtext',
    }),
    editableImageZone({ left:40, top:400, width:180, height:60, bdZoneLabel:'logo' }),
    lockedText('555-555-5555', {
      left:40, top:475, width:300, fontSize:20, fontFamily:'Oswald', fontWeight:'600',
      fill:'#F25C05',
      bdLock:'editable', bdZoneLabel:'phone',
    }),
    lockedText('www.yourcompany.com', {
      left:40, top:505, width:300, fontSize:13, fontFamily:'Barlow', fontWeight:'400',
      fill:'#96B0C8',
      bdLock:'editable', bdZoneLabel:'website',
    }),
    lockedText('📷 Upload House Photo', {
      left:495, top:270, width:390, fontSize:14, fontFamily:'Barlow', fontWeight:'400',
      fill:'rgba(242,92,5,0.7)', textAlign:'center',
    }),
  ],
  background: '#1a0a00',
};

// ── Template 5: Neighborhood Alert ───────────────────────────────────────────
const alertFront = {
  version: '5.3.1',
  objects: [
    lockedRect({ left:0, top:0, width:W, height:H, fill:'#0f0f0f' }),
    editableImageZone({ left:0, top:0, width:W, height:H, bdZoneLabel:'heroImage', opacity:0.35 }),
    lockedRect({ left:0, top:0, width:W, height:H, fill:'rgba(15,15,15,0.55)' }),
    // Left accent stripe
    lockedRect({ left:0, top:0, width:8, height:H, fill:'#ef4444' }),
    // Alert badge
    lockedRect({ left:40, top:40, width:220, height:36, fill:'#ef4444', rx:4, ry:4 }),
    lockedText('🚨 NEIGHBORHOOD ALERT', {
      left:48, top:49, width:204, fontSize:12, fontFamily:'Oswald', fontWeight:'700',
      fill:'#FFFFFF', letterSpacing:1,
    }),
    lockedText('STORM\nDAMAGE\nDETECTED', {
      left:40, top:100, width:500, fontSize:88, fontFamily:'Oswald', fontWeight:'700',
      fill:'#FFFFFF', lineHeight:0.95,
      bdLock:'editable', bdZoneLabel:'headline1',
    }),
    lockedText('Your neighbors are filing claims. Get a FREE inspection before your window closes.', {
      left:40, top:380, width:500, fontSize:16, fontFamily:'Barlow', fontWeight:'400',
      fill:'#C8D8E8', lineHeight:1.6,
      bdLock:'editable', bdZoneLabel:'subtext',
    }),
    editableImageZone({ left:40, top:460, width:160, height:50, bdZoneLabel:'logo' }),
    lockedText('555-555-5555', {
      left:220, top:468, width:280, fontSize:22, fontFamily:'Oswald', fontWeight:'700',
      fill:'#ef4444',
      bdLock:'editable', bdZoneLabel:'phone',
    }),
    lockedText('📷 Upload House Photo (full bleed background)', {
      left:200, top:270, width:500, fontSize:13, fontFamily:'Barlow', fontWeight:'400',
      fill:'rgba(239,68,68,0.6)', textAlign:'center',
    }),
  ],
  background: '#0f0f0f',
};

// ── Template 6: Estimate Ready ────────────────────────────────────────────────
const estimateFront = {
  version: '5.3.1',
  objects: [
    lockedRect({ left:0, top:0, width:W, height:H, fill:'#0a0a1a' }),
    editableImageZone({ left:0, top:0, width:W, height:H, bdZoneLabel:'heroImage', opacity:0.3 }),
    lockedRect({ left:0, top:0, width:W, height:H, fill:'rgba(10,10,26,0.6)' }),
    lockedRect({ left:0, top:0, width:W, height:5, fill:'#F25C05' }),
    lockedText('YOUR ESTIMATE IS', {
      left:60, top:100, width:780, fontSize:20, fontFamily:'Oswald', fontWeight:'400',
      fill:'#F25C05', letterSpacing:4, textAlign:'center',
    }),
    lockedText('READY', {
      left:60, top:130, width:780, fontSize:130, fontFamily:'Oswald', fontWeight:'700',
      fill:'#FFFFFF', textAlign:'center', letterSpacing:8,
      bdLock:'editable', bdZoneLabel:'headline1',
    }),
    lockedText('We\'ve completed our assessment of your property.\nYour no-obligation estimate is waiting.', {
      left:120, top:310, width:660, fontSize:16, fontFamily:'Barlow', fontWeight:'400',
      fill:'#C8D8E8', lineHeight:1.7, textAlign:'center',
      bdLock:'editable', bdZoneLabel:'subtext',
    }),
    editableImageZone({ left:360, top:390, width:180, height:55, bdZoneLabel:'logo' }),
    lockedText('555-555-5555', {
      left:300, top:460, width:300, fontSize:22, fontFamily:'Oswald', fontWeight:'700',
      fill:'#F25C05', textAlign:'center',
      bdLock:'editable', bdZoneLabel:'phone',
    }),
    lockedText('www.yourcompany.com', {
      left:300, top:492, width:300, fontSize:13, fontFamily:'Barlow', fontWeight:'400',
      fill:'#96B0C8', textAlign:'center',
      bdLock:'editable', bdZoneLabel:'website',
    }),
  ],
  background: '#0a0a1a',
};

// ── Shared back card ──────────────────────────────────────────────────────────
function buildBackCard(accentColor = '#F25C05') {
  return {
    version: '5.3.1',
    objects: [
      lockedRect({ left:0, top:0, width:W, height:H, fill:'#FFFFFF' }),
      // Accent header bar
      lockedRect({ left:0, top:0, width:W, height:80, fill:accentColor }),
      // Logo zone in header
      editableImageZone({ left:20, top:10, width:200, height:60, bdZoneLabel:'logo', stroke:'rgba(255,255,255,0.4)', fill:'rgba(255,255,255,0.1)' }),
      // Phone in header
      lockedText('555-555-5555', {
        left:560, top:25, width:300, fontSize:22, fontFamily:'Oswald', fontWeight:'700',
        fill:'#FFFFFF', textAlign:'right',
        bdLock:'editable', bdZoneLabel:'phone',
      }),
      // Website in header
      lockedText('www.yourcompany.com', {
        left:560, top:52, width:300, fontSize:12, fontFamily:'Barlow', fontWeight:'400',
        fill:'rgba(255,255,255,0.8)', textAlign:'right',
        bdLock:'editable', bdZoneLabel:'website',
      }),
      // Left column: copy
      lockedText('"Your roof estimate is already built. No sales visit, no pressure, no surprises — just a real number for your home."', {
        left:30, top:105, width:390, fontSize:15, fontFamily:'Barlow', fontStyle:'italic', fontWeight:'400',
        fill:'#1F2C3E', lineHeight:1.6,
        bdLock:'editable', bdZoneLabel:'headline1',
      }),
      lockedText('We tapped your home on the map and built this estimate based on your property data. We look for missing shingles, moss, algae, buckling, granule loss, and age. The average roof lasts 18-20 years.', {
        left:30, top:210, width:390, fontSize:13, fontFamily:'Barlow', fontWeight:'400',
        fill:'#3D5269', lineHeight:1.6,
        bdLock:'editable', bdZoneLabel:'subtext',
      }),
      // Guarantee line
      lockedRect({ left:30, top:360, width:390, height:36, fill:accentColor, rx:4, ry:4 }),
      lockedText('🚫 No door-knocking. No pressure. Just your price.', {
        left:38, top:370, width:374, fontSize:13, fontFamily:'Barlow', fontWeight:'700',
        fill:'#FFFFFF',
        bdLock:'editable', bdZoneLabel:'guarantee',
      }),
      // Divider
      lockedRect({ left:440, top:90, width:1, height:H-100, fill:'#E2EAF0' }),
      // Right column: mailing address area
      lockedText('MAILING ADDRESS', {
        left:460, top:110, width:410, fontSize:11, fontFamily:'Oswald', fontWeight:'600',
        fill:'#96B0C8', letterSpacing:2, textAlign:'center',
      }),
      lockedRect({ left:480, top:135, width:370, height:80, fill:'#F5F8FA', rx:6, ry:6 }),
      lockedText('HOMEOWNER NAME\n123 Sample Street\nYour City, MI 48000', {
        left:480, top:148, width:370, fontSize:14, fontFamily:'Barlow', fontWeight:'600',
        fill:'#1F2C3E', textAlign:'center', lineHeight:1.6,
      }),
      // QR code placeholder
      lockedRect({ left:595, top:250, width:110, height:110, fill:'#E2EAF0', rx:6, ry:6 }),
      lockedText('QR Code', {
        left:595, top:295, width:110, fontSize:12, fontFamily:'Barlow', fontWeight:'400',
        fill:'#96B0C8', textAlign:'center',
      }),
      // Hero image zone (right side background)
      editableImageZone({ left:440, top:400, width:460, height:H-400, bdZoneLabel:'heroImage', stroke:'rgba(34,197,94,0.4)', fill:'rgba(34,197,94,0.04)' }),
    ],
    background: '#FFFFFF',
  };
}

const templates = [
  { name:'Storm / Wind', trade:'roofing', front_json: stormFront, back_json: buildBackCard('#F25C05'), published: true },
  { name:'Solar', trade:'solar', front_json: solarFront, back_json: buildBackCard('#F59E0B'), published: true },
  { name:'Gutters', trade:'gutters', front_json: guttersFront, back_json: buildBackCard('#22c55e'), published: true },
  { name:'Roofing Inspection', trade:'roofing', front_json: roofingFront, back_json: buildBackCard('#F25C05'), published: true },
  { name:'Neighborhood Alert', trade:'roofing', front_json: alertFront, back_json: buildBackCard('#ef4444'), published: true },
  { name:'Estimate Ready', trade:'roofing', front_json: estimateFront, back_json: buildBackCard('#F25C05'), published: true },
];

console.log(JSON.stringify(templates, null, 2));
