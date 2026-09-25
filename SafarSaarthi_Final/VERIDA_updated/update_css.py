import re
import os

css_path = r'c:\Users\Geet\Documents\VERIDA_all_changes_updated_complete_fixed\css\components.css'

with open(css_path, 'r', encoding='utf-8') as f:
    css = f.read()

# Add mobile viewport constraints to single-app-shell
mobile_css = '''
/* Mobile Viewport Constraints */
#single-app-shell {
  max-width: 480px;
  margin: 0 auto;
  position: relative;
  height: 100vh;
  display: flex;
  flex-direction: column;
  background: #f8fafc;
  box-shadow: 0 0 20px rgba(0,0,0,0.1);
  overflow: hidden;
}

.app-content-scroll {
  flex: 1;
  overflow-y: auto;
  padding-bottom: 80px; /* space for bottom nav */
}

/* Ensure bottom nav is fixed within the mobile shell */
.app-bottom-nav {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  height: 65px;
  background: #fff;
  border-top: 1px solid #e2e8f0;
  display: flex;
  justify-content: space-around;
  align-items: center;
  z-index: 100;
}
'''

if 'Mobile Viewport Constraints' not in css:
    css += mobile_css
    with open(css_path, 'w', encoding='utf-8') as f:
        f.write(css)
    print('Updated components.css')
else:
    print('CSS already updated')
