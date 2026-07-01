#!/usr/bin/env python3
"""Extract src/proposal.js — Good/Better/Best tier logic + Proposal modal.

Both sections are in the same script block and tightly coupled, so they
are extracted together as one module.
"""
import sys, re

with open('index.html', 'r', encoding='utf-8') as f:
    html = f.read()

# Start at GOOD / BETTER / BEST TIER LOGIC header
START_MARKER = '// ═══════════════════════════════════════════════════════════════════════\n//  GOOD / BETTER / BEST TIER LOGIC\n// ═══════════════════════════════════════════════════════════════════════\n'
# End at the closing </script> tag that closes the block containing buildProposalHTML
# The block ends with: }\n</script>\n<!-- ── DRIP SEQUENCE MODAL
END_MARKER = '\n</script>\n<!-- ── DRIP SEQUENCE MODAL'

si = html.find(START_MARKER)
ei = html.find(END_MARKER, si)
if si == -1 or ei == -1:
    print('ERROR: markers not found')
    print('  START found:', si != -1)
    print('  END found:', ei != -1)
    sys.exit(1)

# The section is everything from START_MARKER up to (but not including) </script>
section = html[si:ei + 2]  # include the trailing \n}
print(f'Found GOOD/BETTER/BEST + PROPOSAL MODAL: {section.count(chr(10))} lines')

module = ('// src/proposal.js\n'
          '// Good/Better/Best tier logic + Proposal modal (e-sign, print, email).\n'
          '// Depends on: sb, S.cfg, S.pins, currentAccount, adminAPI(), toast(),\n'
          '//             calcStructPrice(), getMatCost() (estimates-calc.js)\n'
          '// Extracted from index.html — Tier 3 modularization\n\n'
          + section[len(START_MARKER):])

with open('src/proposal.js', 'w', encoding='utf-8') as f:
    f.write(module)
print(f'Wrote src/proposal.js ({module.count(chr(10))} lines)')

# Remove section from index.html — replace from START_MARKER through the \n} before </script>
modified = html[:si] + html[ei + 2:]  # skip the section, keep </script> onward

# Insert script tag after last src/*.js tag
matches = list(re.finditer(r'(<script src="/src/[^"]+"></script>)', modified))
if not matches: print('ERROR: no src tags'); sys.exit(1)
lm = matches[-1]
modified = modified[:lm.end()] + '\n  <script src="/src/proposal.js"></script>' + modified[lm.end():]
print(f'Inserted script tag after {lm.group()}')

with open('index.html', 'w', encoding='utf-8') as f:
    f.write(modified)

print(f'index.html: {html.count(chr(10))} → {modified.count(chr(10))} lines (removed {html.count(chr(10)) - modified.count(chr(10))})')
