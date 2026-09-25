import re

with open(r'c:\Users\Geet\Documents\VERIDA_all_changes_updated_complete_fixed\index.html', 'r', encoding='utf-8') as f:
    html = f.read()

# 1. Update app-bottom-nav
nav_start = html.find('<nav class="app-bottom-nav">')
nav_end = html.find('</nav>', nav_start) + 6

new_nav = '''    <!-- Mobile Bottom Nav -->
    <nav class="app-bottom-nav">
      <!-- Passenger Nav Items -->
      <button type="button" class="nav-tab-btn traveler-only" data-tab="radar"><i class="fas fa-map-location-dot"></i><span>Radar</span></button>
      <button type="button" class="nav-tab-btn traveler-only active" data-tab="transit"><i class="fas fa-route"></i><span>Transit</span></button>
      <button type="button" class="nav-tab-btn traveler-only sos-btn" onclick="veridaApp && veridaApp.triggerSosFlow()"><div class="sos-inner">SOS</div></button>
      <button type="button" class="nav-tab-btn traveler-only" data-tab="handshake"><i class="fas fa-shield-check"></i><span>Verify</span></button>
      <button type="button" class="nav-tab-btn traveler-only" data-tab="ledger"><i class="fas fa-book-bookmark"></i><span>Ledger</span></button>

      <!-- Driver Nav Items -->
      <button type="button" class="nav-tab-btn guide-only" data-tab="guide-qr"><i class="fas fa-qrcode"></i><span>QR</span></button>
      <button type="button" class="nav-tab-btn guide-only active" data-tab="transit"><i class="fas fa-route"></i><span>Transit</span></button>
      <button type="button" class="nav-tab-btn guide-only" data-tab="ledger"><i class="fas fa-book-bookmark"></i><span>Ledger</span></button>
      <button type="button" class="nav-tab-btn guide-only" data-tab="profile"><i class="fas fa-user-circle"></i><span>Profile</span></button>
    </nav>'''

if nav_start != -1:
    html = html[:nav_start] + new_nav + html[nav_end:]
else:
    print('Nav not found')


# 2. Update Header Dropdown
header_actions_start = html.find('<div class="app-header-actions">')
header_actions_end = html.find('</div>', html.find('</button>', html.find('mobile-app-menu-btn', header_actions_start))) + 6

new_header_actions = '''<div class="app-header-actions">
          <div class="city-select-box">
            <select id="header-city-selector" aria-label="Select City"></select>
          </div>
          <div class="dropdown-wrapper" style="position:relative;">
            <button type="button" class="mobile-app-menu-btn" id="mobile-app-menu-btn" aria-label="Open app menu" aria-expanded="false" onclick="document.getElementById('header-dropdown').classList.toggle('hidden')">
              <i class="fas fa-ellipsis-v"></i>
            </button>
            <div class="dropdown-menu hidden" id="header-dropdown" style="position:absolute;right:0;top:100%;background:#fff;border:1px solid #e2e8f0;border-radius:8px;box-shadow:0 10px 15px -3px rgba(0,0,0,0.1);z-index:1000;min-width:160px;padding:8px 0;display:flex;flex-direction:column;gap:4px;">
              <button type="button" class="dropdown-item" data-tab="profile" style="padding:10px 16px;text-align:left;background:none;border:none;width:100%;font-size:14px;color:#1e293b;cursor:pointer;"><i class="fas fa-user-circle" style="margin-right:8px;color:#64748b;"></i> Profile</button>
              <button type="button" class="dropdown-item" style="padding:10px 16px;text-align:left;background:none;border:none;width:100%;font-size:14px;color:#1e293b;cursor:pointer;"><i class="fas fa-language" style="margin-right:8px;color:#64748b;"></i> English</button>
              <div style="height:1px;background:#e2e8f0;margin:4px 0;"></div>
              <button type="button" class="dropdown-item text-danger" id="header-signout-btn" style="padding:10px 16px;text-align:left;background:none;border:none;width:100%;font-size:14px;color:#ef4444;cursor:pointer;"><i class="fas fa-sign-out-alt" style="margin-right:8px;"></i> Sign Out</button>
            </div>
          </div>
        </div>'''

if header_actions_start != -1:
    html = html[:header_actions_start] + new_header_actions + html[header_actions_end:]
else:
    print('Header actions not found')


# Write back
with open(r'c:\Users\Geet\Documents\VERIDA_all_changes_updated_complete_fixed\index.html', 'w', encoding='utf-8') as f:
    f.write(html)

print('Updated index.html')
