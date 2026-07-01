content = open('index.html').read()
changes = []

# 1. Hide the Proposal preview tab button (add display:none)
old1 = '<button id="preview-tab-proposal" onclick="setPreviewMode(\'proposal\')" style="flex:1;padding:10px 0;font-family:var(--font-b);font-size:12px;font-weight:700;border:none;cursor:pointer;background:var(--card2);color:var(--muted);letter-spacing:.4px;">&#128203; Proposal</button>'
new1 = '<button id="preview-tab-proposal" onclick="setPreviewMode(\'proposal\')" style="flex:1;padding:10px 0;font-family:var(--font-b);font-size:12px;font-weight:700;border:none;cursor:pointer;background:var(--card2);color:var(--muted);letter-spacing:.4px;display:none;">&#128203; Proposal</button>'
if old1 in content:
    content = content.replace(old1, new1, 1)
    changes.append('1. Proposal preview tab button hidden')
else:
    changes.append('1. MISS: Proposal preview tab button')

# 2. Hide the 📋 Proposal button in the estimator sticky bar
old2 = '<button onclick="if(!isPlanAtLeast(\'pro\')){showPlanUpgradePrompt(\'Proposal\',\'pro\');}else{openProposalModal();}" style="background:linear-gradient(135deg,#1a3a6b,#0f2040);border:1px solid rgba(59,130,246,.5);border-radius:8px;padding:10px;color:#60a5fa;font-family:var(--font-b);font-size:11px;font-weight:700;cursor:pointer;">&#128203; Proposal</button>'
new2 = '<button onclick="if(!isPlanAtLeast(\'pro\')){showPlanUpgradePrompt(\'Proposal\',\'pro\');}else{openProposalModal();}" style="background:linear-gradient(135deg,#1a3a6b,#0f2040);border:1px solid rgba(59,130,246,.5);border-radius:8px;padding:10px;color:#60a5fa;font-family:var(--font-b);font-size:11px;font-weight:700;cursor:pointer;display:none;">&#128203; Proposal</button>'
if old2 in content:
    content = content.replace(old2, new2, 1)
    changes.append('2. Proposal sticky bar button hidden')
else:
    changes.append('2. MISS: Proposal sticky bar button')

# 3. Remove "📋 Sales Proposal PDF" from unlock modal bullet list in ui.js (handled separately)
# For now just report

print('\n'.join(changes))
open('index.html', 'w').write(content)
print('Done.')
