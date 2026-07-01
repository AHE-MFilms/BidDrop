content = open('index.html').read()

old = (
    'function _estRefreshUnlockUI() {\n'
    '  const wrap = document.getElementById(\'est-unlock-wrap\');\n'
    '  const btn  = document.getElementById(\'est-unlock-btn\');\n'
    '  const status = document.getElementById(\'est-unlock-status\');\n'
    '  if (!wrap) return;\n'
    '  if (!currentEstPinId) { wrap.style.display = \'none\'; return; }\n'
    '  wrap.style.display = \'block\';\n'
    '  // isPinUnlocked requires a pin OBJECT, not an ID string\n'
    '  const _pin = (S.pins||[]).find(function(p){ return p.id === currentEstPinId; });\n'
    '  const unlocked = typeof isPinUnlocked === \'function\' && isPinUnlocked(_pin);\n'
    '  if (unlocked) {\n'
    '    btn.style.display    = \'none\';\n'
    '    status.style.display = \'block\';\n'
    '    if (_pin && _pin.contactData &&\n'
    '        ((_pin.contactData.phones||[]).length + (_pin.contactData.emails||[]).length) > 0) {\n'
    '      // contactData already in memory \u2014 fill immediately\n'
    '      _fillEstimatorContactFields(_pin.contactData);\n'
    '    }\n'
    '    // Show/hide the "Look Up Contact" button based on whether we have data\n'
    '    var lookupBtn = document.getElementById(\'est-contact-lookup-btn\');\n'
    '    if (lookupBtn) {\n'
    '      var hasData = _pin && _pin.contactData &&\n'
    '        ((_pin.contactData.phones||[]).length + (_pin.contactData.emails||[]).length) > 0;\n'
    '      lookupBtn.style.display = hasData ? \'none\' : \'block\';\n'
    '    }\n'
    '  } else {\n'
    '    btn.style.display    = \'flex\';\n'
    '    status.style.display = \'none\';\n'
    '  }\n'
    '}'
)

new = (
    'function _estRefreshUnlockUI() {\n'
    '  const wrap = document.getElementById(\'est-unlock-wrap\');\n'
    '  const btn  = document.getElementById(\'est-unlock-btn\');\n'
    '  const status = document.getElementById(\'est-unlock-status\');\n'
    '  if (!wrap) return;\n'
    '  if (!currentEstPinId) { wrap.style.display = \'none\'; return; }\n'
    '  wrap.style.display = \'block\';\n'
    '  // isPinUnlocked requires a pin OBJECT, not an ID string\n'
    '  const _pin = (S.pins||[]).find(function(p){ return p.id === currentEstPinId; });\n'
    '  const unlocked = typeof isPinUnlocked === \'function\' && isPinUnlocked(_pin);\n'
    '  // Gate the RentCast "Look Up" button behind unlock\n'
    '  var rcLookupBtn = document.getElementById(\'rc-lookup-btn\');\n'
    '  if (rcLookupBtn) rcLookupBtn.style.display = unlocked ? \'\' : \'none\';\n'
    '  if (unlocked) {\n'
    '    btn.style.display    = \'none\';\n'
    '    status.style.display = \'block\';\n'
    '    if (_pin && _pin.contactData &&\n'
    '        ((_pin.contactData.phones||[]).length + (_pin.contactData.emails||[]).length) > 0) {\n'
    '      // contactData already in memory \u2014 fill immediately\n'
    '      _fillEstimatorContactFields(_pin.contactData);\n'
    '    }\n'
    '    // Show/hide the "Look Up Contact" button based on whether we have data\n'
    '    var lookupBtn = document.getElementById(\'est-contact-lookup-btn\');\n'
    '    if (lookupBtn) {\n'
    '      var hasData = _pin && _pin.contactData &&\n'
    '        ((_pin.contactData.phones||[]).length + (_pin.contactData.emails||[]).length) > 0;\n'
    '      lookupBtn.style.display = hasData ? \'none\' : \'block\';\n'
    '    }\n'
    '  } else {\n'
    '    btn.style.display    = \'flex\';\n'
    '    status.style.display = \'none\';\n'
    '    // Also hide the contact lookup button when locked\n'
    '    var lookupBtn2 = document.getElementById(\'est-contact-lookup-btn\');\n'
    '    if (lookupBtn2) lookupBtn2.style.display = \'none\';\n'
    '  }\n'
    '}'
)

if old in content:
    content = content.replace(old, new, 1)
    open('index.html', 'w').write(content)
    print('REPLACED OK')
else:
    # Try to find it with a smaller unique snippet
    snippet = 'function _estRefreshUnlockUI()'
    idx = content.find(snippet)
    print(f'NOT FOUND as exact block. Snippet at index: {idx}')
    if idx >= 0:
        print(repr(content[idx:idx+200]))
