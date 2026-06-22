#!/usr/bin/env python3
sections = [
    (4046, 'STATE'),
    (4053, 'PERSIST'),
    (4058, 'TABS'),
    (5125, 'CLOUD STORAGE'),
    (5175, 'LOGO/PHOTO'),
    (6459, 'MAP SEARCH'),
    (6591, 'MAP'),
    (6598, 'ROOF MEASUREMENT'),
    (7949, 'HOMEOWNER FOLLOW-UP'),
    (8262, 'STRUCTURES ENGINE'),
    (8414, 'VIDEO HELPERS (residual)'),
    (8448, 'MAILER PREVIEW'),
    (9356, 'MAIL QUEUE'),
    (10649, 'DASHBOARD'),
    (10652, 'AGENCY VIEW'),
    (11164, 'ANALYTICS DASHBOARD'),
    (11484, 'OFFLINE PIN QUEUE & PWA'),
    (11590, 'SETTINGS'),
    (12268, 'MODAL/TOAST/UTILS'),
    (12275, 'LOOKUP CREDITS'),
    (12282, 'GHL INTEGRATION'),
    (12288, 'AUTH HELPERS'),
    (12330, 'COMPANY SWITCHER'),
    (13036, 'SUPER ADMIN MGMT'),
    (13198, 'DELETE CLIENT ACCOUNT'),
    (13279, 'INIT'),
    (13921, 'STORM EVENTS'),
    (14332, 'HAMBURGER NAV'),
    (14418, 'HOMEOWNER QUOTE PAGE'),
    (15176, 'HOMEOWNER ESTIMATE PAGE'),
    (15746, 'GOOD/BETTER/BEST'),
    (15779, 'PROPOSAL MODAL'),
    (16492, 'SUBSCRIPTION & BILLING'),
    (16878, 'END'),
]
print('%-40s %6s %6s' % ('Section', 'Start', 'Lines'))
print('-' * 55)
for i in range(len(sections)-1):
    start, name = sections[i]
    end = sections[i+1][0]
    lines = end - start
    print('%-40s %6d %6d' % (name, start, lines))
