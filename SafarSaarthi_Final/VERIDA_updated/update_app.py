import re

app_path = r'c:\Users\Geet\Documents\VERIDA_all_changes_updated_complete_fixed\js\app.js'

with open(app_path, 'r', encoding='utf-8') as f:
    app_js = f.read()

# Update the init() method to include explicit rendering
old_step7 = '''    // Step 7: Switch to default tab
    try {
      this.switchTab("transit");
    } catch (e) {
      console.warn("[Verida] Initial tab switch error:", e);

      const transitPanel = document.getElementById("tab-transit");
      if (transitPanel) {
        transitPanel.classList.add("active");
      }
    }'''

new_step7 = '''    // Step 7: Switch to default tab and ensure explicit rendering to avoid blank containers
    try {
      this.switchTab("transit");
    } catch (e) {
      console.warn("[Verida] Initial tab switch error:", e);
      const transitPanel = document.getElementById("tab-transit");
      if (transitPanel) transitPanel.classList.add("active");
    }
    
    // Fallback explicit rendering to fix blank containers
    try {
      if (window.transitSafety) transitSafety.initRoutePlanner();
      if (window.hotspotRadar) hotspotRadar.renderHotspotsDirectory();
    } catch (e) {
      console.warn("Error during explicit rendering", e);
    }'''

app_js = app_js.replace(old_step7, new_step7)

with open(app_path, 'w', encoding='utf-8') as f:
    f.write(app_js)

print('Updated app.js')
