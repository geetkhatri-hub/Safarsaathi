/**
 * Verida — Auth & Registration Manager
 * Handles Passenger & Driver onboarding, localStorage persistence,
 * modal bindings, and live profile sync to UI.
 */

import { store } from "./store.js";
import { hotelSafety } from "./hotelSafety.js";

const AUTH_KEY_PASSENGER = "verida_user_profile"; // Must match the key store.js uses to load
const AUTH_KEY_DRIVER = "verida_guide_profile"; // Must match the key store.js uses to load

class AuthManager {
  constructor() {
    this.activeAuthTab = "passenger";
  }

  /* ============================================================
   *  INIT — call once on app boot
   * ============================================================ */
  init() {
    if (this._initialized) return;
    this._initialized = true;
    this._loadSavedProfiles();
    this._bindModal();
    this._bindAuthForms();
    this._bindProfileButton();
    this._bindTripPreferences();
    console.log("[Verida Auth] AuthManager initialized.");
  }

  /* ============================================================
   *  TRIP PREFERENCES ONBOARDING MODAL
   * ============================================================ */
  openTripPreferencesModal() {
    const modal = document.getElementById("trip-preferences-modal");
    if (!modal) return;
    
    // Pre-fill existing preferences if available
    const existing = store.getTripPreferences();
    if (existing) {
      const typeBtns = document.querySelectorAll("#pref-type-grid .pref-chip-btn");
      typeBtns.forEach(btn => {
        btn.classList.toggle("active", btn.getAttribute("data-value") === existing.tripType);
      });

      const interestBtns = document.querySelectorAll("#pref-interests-grid .pref-interest-btn");
      interestBtns.forEach(btn => {
        const val = btn.getAttribute("data-value");
        btn.classList.toggle("active", (existing.interests || []).includes(val));
      });

      const childBtns = document.querySelectorAll(".pref-child-btn");
      childBtns.forEach(btn => {
        btn.classList.toggle("active", btn.getAttribute("data-value") === existing.withChildren);
      });
      const hotelBtns = document.querySelectorAll(".pref-hotel-btn");
      hotelBtns.forEach(btn => {
        btn.classList.toggle("active", btn.getAttribute("data-value") === (existing.hotelBooked ? "Yes" : "No"));
      });
      const note = document.getElementById("pref-hotel-note");
      if (note) note.style.display = existing.hotelBooked ? "block" : "none";
    }

    modal.classList.add("active");
  }

  closeTripPreferencesModal() {
    const modal = document.getElementById("trip-preferences-modal");
    if (modal) modal.classList.remove("active");
  }

  _bindTripPreferences() {
    const closeBtn = document.getElementById("close-pref-modal-btn");
    if (closeBtn) closeBtn.onclick = () => this.closeTripPreferencesModal();

    document.querySelectorAll("#pref-type-grid .pref-chip-btn").forEach(btn => {
      btn.onclick = (e) => {
        e.preventDefault();
        document.querySelectorAll("#pref-type-grid .pref-chip-btn").forEach(b => b.classList.remove("active"));
        btn.classList.add("active");
      };
    });

    document.querySelectorAll("#pref-interests-grid .pref-interest-btn").forEach(btn => {
      btn.onclick = (e) => { e.preventDefault(); btn.classList.toggle("active"); };
    });

    document.querySelectorAll(".pref-child-btn").forEach(btn => {
      btn.onclick = (e) => {
        e.preventDefault();
        document.querySelectorAll(".pref-child-btn").forEach(b => b.classList.remove("active"));
        btn.classList.add("active");
      };
    });

    document.querySelectorAll(".pref-hotel-btn").forEach(btn => {
      btn.onclick = (e) => {
        e.preventDefault();
        document.querySelectorAll(".pref-hotel-btn").forEach(b => b.classList.remove("active"));
        btn.classList.add("active");
        const yes = btn.getAttribute("data-value") === "Yes";
        const note = document.getElementById("pref-hotel-note");
        if (note) note.style.display = yes ? "block" : "none";
      };
    });

    const skipBtn = document.getElementById("skip-pref-btn");
    if (skipBtn) {
      skipBtn.onclick = (e) => {
        e.preventDefault();
        this.closeTripPreferencesModal();
        this._enterMainAppShell("passenger");
      };
    }

    const form = document.getElementById("trip-preferences-form");
    if (form) {
      form.onsubmit = (e) => {
        e.preventDefault();
        const activeTypeBtn = document.querySelector("#pref-type-grid .pref-chip-btn.active");
        const tripType = activeTypeBtn ? activeTypeBtn.getAttribute("data-value") : "Family Trip";
        const selectedInterests = [...document.querySelectorAll("#pref-interests-grid .pref-interest-btn.active")].map(b => b.getAttribute("data-value"));
        const activeChildBtn = document.querySelector(".pref-child-btn.active");
        const withChildren = activeChildBtn ? activeChildBtn.getAttribute("data-value") : "No";
        const activeHotelBtn = document.querySelector(".pref-hotel-btn.active");
        const hotelBooked = activeHotelBtn ? activeHotelBtn.getAttribute("data-value") === "Yes" : false;

        store.saveTripPreferences({ tripType, interests: selectedInterests, withChildren, hotelBooked });
        this.closeTripPreferencesModal();
        this._enterMainAppShell("passenger");
        this._showSuccessToast("✨ Trip Preferences saved — Customizing recommendations!", "green");

        if (hotelBooked) {
          setTimeout(() => hotelSafety.openHotelModal(), 80);
        }
      };
    }
  }

  // role: "passenger" | "driver" — the ONE authenticated role for this
  // session. Persisted so a page refresh reopens the correct experience
  // (Problem 1 / Test 5), and used to lock the app so it can never be
  // switched to the other role after authentication (Problem 2).
  _enterMainAppShell(role) {
    const normalizedRole = role === "driver" ? "driver" : "passenger";

    // App.js is the single owner of authenticated-page visibility. If the
    // module is not ready yet, persist the session and let App.restore...
    // apply it when boot completes. There is no timeout-based routing.
    // Session-scoped authentication prevents stale localStorage from
    // reopening Passenger Mode on a fresh visit.
    sessionStorage.setItem("verida_auth_session_active", "true");
    sessionStorage.setItem("verida_auth_session_role", normalizedRole);
    sessionStorage.setItem("verida_session_version", "2026-09-hotel-safety-v3");
    localStorage.removeItem("verida_user_authenticated");
    localStorage.removeItem("verida_authenticated_role");

    if (window.veridaApp && typeof window.veridaApp.applyAuthenticatedView === "function") {
      window.veridaApp.applyAuthenticatedView(normalizedRole, { persist: false });
    }
  }

  _clearAuthForms() {
    ["passenger-auth-form", "driver-auth-form"].forEach(formId => {
      const form = document.getElementById(formId);
      if (!form) return;
      form.reset();
      form.setAttribute("autocomplete", "off");
      form.querySelectorAll("input, select").forEach(el => {
        el.value = "";
        el.setAttribute("autocomplete", "off");
        el.setAttribute("autocapitalize", "off");
      });
    });
  }

  /* ============================================================
   *  MODAL OPEN / CLOSE
   * ============================================================ */
  openAuthModal(defaultRole = "passenger") {
    const modal = document.getElementById("auth-modal");
    if (!modal) return;
    this._setProfileEditMode(false);
    // Auth is a fresh sign-in/sign-up interaction. Never reopen the form
    // with stale values from a previous profile/session.
    this._clearAuthForms();
    this._switchAuthTab(defaultRole);
    modal.classList.add("active");
  }

  openProfileEdit() {
    const role = store.currentRole === "guide" ? "driver" : "passenger";
    const modal = document.getElementById("auth-modal");
    if (!modal) return;
    this._setProfileEditMode(true);
    this._switchAuthTab(role);
    modal.classList.add("active");
  }

  _setProfileEditMode(editing) {
    const tabs = document.querySelector("#auth-modal .auth-tab-row");
    const title = document.querySelector("#auth-modal h2");
    const subtitle = document.querySelector("#auth-modal h2 + p");
    const passengerSubmit = document.querySelector("#passenger-auth-form button[type='submit']");
    const driverSubmit = document.querySelector("#driver-auth-form button[type='submit']");
    if (tabs) tabs.classList.toggle("hidden", editing);
    if (title) title.textContent = editing ? "Edit Profile Information" : "Verida Identity Setup";
    if (subtitle) subtitle.textContent = editing ? "Update the information for your current mode." : "Your profile is stored locally on this device. No account needed.";
    if (passengerSubmit) passengerSubmit.innerHTML = editing ? '<i class="fas fa-save"></i> Save Passenger Profile' : '<i class="fas fa-check-circle"></i> Save Passenger Profile & Start';
    if (driverSubmit) driverSubmit.innerHTML = editing ? '<i class="fas fa-save"></i> Save Driver Profile' : '<i class="fas fa-qrcode"></i> Activate Driver Profile & Generate QR';
  }

  closeAuthModal() {
    const modal = document.getElementById("auth-modal");
    if (modal) modal.classList.remove("active");
    this._setProfileEditMode(false);
  }

  /* ============================================================
   *  INTERNAL BINDERS
   * ============================================================ */
  _bindModal() {
    // Close button inside modal
    const closeBtn = document.getElementById("close-auth-modal-btn");
    if (closeBtn) closeBtn.onclick = () => this.closeAuthModal();

    // Click outside to close
    const backdrop = document.getElementById("auth-modal");
    if (backdrop) {
      backdrop.addEventListener("click", (e) => {
        if (e.target === backdrop) this.closeAuthModal();
      });
    }

    // Tab switcher buttons
    document.querySelectorAll(".auth-tab-btn").forEach(btn => {
      btn.onclick = () => {
        const tab = btn.getAttribute("data-tab");
        if (tab) this._switchAuthTab(tab);
      };
    });
  }

  _switchAuthTab(tabName) {
    this.activeAuthTab = tabName;
    document.querySelectorAll(".auth-tab-btn").forEach(b => {
      b.classList.toggle("active", b.getAttribute("data-tab") === tabName);
    });
    const passengerPanel = document.getElementById("auth-panel-passenger");
    const driverPanel = document.getElementById("auth-panel-driver");
    if (passengerPanel) passengerPanel.classList.toggle("hidden", tabName !== "passenger");
    if (driverPanel) driverPanel.classList.toggle("hidden", tabName !== "driver");
  }

  _bindProfileButton() {
    const btn = document.getElementById("header-profile-btn");
    if (btn) {
      btn.onclick = (e) => {
        e.preventDefault();
        if (window.veridaApp?.switchTab) {
          window.veridaApp.switchTab("profile");
        }
      };
    }
  }

  _bindAuthForms() {
    const passengerForm = document.getElementById("passenger-auth-form");
      if(passengerForm){
        passengerForm.onsubmit = async (e) => {
        e.preventDefault();
        await this._savePassengerProfile();
      };
    }
    const driverForm = document.getElementById("driver-auth-form");
    if(driverForm){
      driverForm.onsubmit = async (e) => {
          e.preventDefault();
          await this._saveDriverProfile();
        };
    }
    // Passenger form submit
   /**  const passengerForm = document.getElementById("passenger-auth-form");
    if (passengerForm) {
      passengerForm.onsubmit = (e) => {
        e.preventDefault();
        this._savePassengerProfile();
      };
    }

    // Driver form submit
    const driverForm = document.getElementById("driver-auth-form");
    if (driverForm) {
      driverForm.onsubmit = (e) => {
        e.preventDefault();
        this._saveDriverProfile();
      };
    }*/
  }

  /* ============================================================
   *  SAVE PROFILES
   * ============================================================ */
  async _savePassengerProfile() {
    const name = document.getElementById("reg-passenger-name")?.value.trim();
    const phone = document.getElementById("reg-passenger-phone")?.value.trim();
    const origin = document.getElementById("reg-passenger-origin")?.value.trim();
    const emergency = document.getElementById("reg-passenger-emergency")?.value.trim();

    if (!name) {
      this._flashError("reg-passenger-name", "Please enter your full name.");
      return;
    }

    const profile = { name, phone, origin, emergency, createdAt: new Date().toISOString() };

    // Use store.registerPassenger so it persists to the correct localStorage key
    await store.registerPassenger(profile);

    this._syncNamesToUI();
    this.closeAuthModal();

    // Profile data is already in the shared store; the authenticated shell
    // renders from that state when it becomes active.

    const wasEditing = document.querySelector("#auth-modal .auth-tab-row")?.classList.contains("hidden");
    this._showSuccessToast(wasEditing ? `✅ Passenger profile updated — ${name}` : `✅ Passenger profile saved — Welcome, ${name}!`, "green");
    console.log("[Verida Auth] Passenger profile saved:", profile);

    if (wasEditing) {
      this.closeAuthModal();
      window.veridaApp?.renderProfileTab();
      return;
    }

    // Enter the authenticated shell immediately. The onboarding modal is an
    // overlay on the authenticated experience, so there is no transient
    // landing-page redirect/reload while preferences are being collected.
    this._enterMainAppShell("passenger");
    setTimeout(() => this.openTripPreferencesModal(), 80);
  }

async  _saveDriverProfile() {
    const name = document.getElementById("reg-driver-name")?.value.trim();
    const phone = document.getElementById("reg-driver-phone")?.value.trim();
    const plate = document.getElementById("reg-driver-plate")?.value.trim().toUpperCase();
    const lic = document.getElementById("reg-driver-lic")?.value.trim();
     const aadharNo = document.getElementById("reg-adhar-no")?.value.trim();
    const vehicleType = document.getElementById("reg-driver-type")?.value || "Auto-Rickshaw";

    if (!name) {
      this._flashError("reg-driver-name", "Please enter driver name.");
      return;
    }
    if (!plate) {
      this._flashError("reg-driver-plate", "Vehicle registration number is required.");
      return;
    }

    const profile = {
      name,
      phone,
      vehicleRegNo: plate,
      licenseNo: lic || "GJ-RTO-VERIFIED",
      vehicleType,
      aadharNo,
      createdAt: new Date().toISOString()
    };

    // Store registers and updates local state
   await  store.registerDriver(profile);

    // Sync Driver Card UI elements immediately
    this._syncNamesToUI();
    this.closeAuthModal();

    // Driver QR/ledger are initialized by the authenticated role router.

    const wasEditing = document.querySelector("#auth-modal .auth-tab-row")?.classList.contains("hidden");
    this._showSuccessToast(wasEditing ? `✅ Driver profile updated — ${name}` : `✅ Driver profile saved — ${name} (${plate})`, "blue");
    console.log("[Verida Auth] Driver profile saved:", profile);

    if (wasEditing) {
      this.closeAuthModal();
      window.veridaApp?.renderProfileTab();
      return;
    }

    // Drivers skip Trip Preferences entirely (passenger-only flow) and go
    // straight into the Driver experience. This call was previously
    // missing, which is why the Driver page never actually opened after
    // sign-up (Problem 1 / Test 3 & 4).
    this._enterMainAppShell("driver");
  }

  /* ============================================================
   *  LOAD SAVED PROFILES
   * ============================================================ */
  _loadSavedProfiles() {
    // Load passenger
    const savedPassenger = localStorage.getItem(AUTH_KEY_PASSENGER);
    if (savedPassenger) {
      try {
        const p = JSON.parse(savedPassenger);
        store.activeUser = { ...store.activeUser, ...p };
        console.log("[Verida Auth] Passenger profile loaded:", p.name);
      } catch (err) {
        console.warn("[Verida Auth] Could not parse passenger profile.");
      }
    }

    // Load driver
    const savedDriver = localStorage.getItem(AUTH_KEY_DRIVER);
    if (savedDriver) {
      try {
        const d = JSON.parse(savedDriver);
        store.activeGuide = { ...store.activeGuide, ...d };
        console.log("[Verida Auth] Driver profile loaded:", d.name);
        // Pre-fill driver form fields
        this._prefillDriverForm(d);
      } catch (err) {
        console.warn("[Verida Auth] Could not parse driver profile.");
      }
    }

    // Pre-fill passenger form
    if (savedPassenger) {
      try {
        this._prefillPassengerForm(JSON.parse(savedPassenger));
      } catch (_) {}
    }
  }

  _prefillPassengerForm(p) {
    const set = (id, val) => { const el = document.getElementById(id); if (el && val) el.value = val; };
    set("reg-passenger-name", p.name);
    set("reg-passenger-phone", p.phone);
    set("reg-passenger-origin", p.origin);
    set("reg-passenger-emergency", p.emergency);
  }

  _prefillDriverForm(d) {
    const set = (id, val) => { const el = document.getElementById(id); if (el && val) el.value = val; };
    set("reg-driver-name", d.name);
    set("reg-driver-phone", d.phone);
    set("reg-driver-plate", d.vehicleRegNo);
    set("reg-driver-lic", d.licenseNo);
    set("reg-driver-type", d.vehicleType);
    set("reg-adhar-no", d.aadharNo);
  }

  /* ============================================================
   *  SYNC NAMES ACROSS ALL UI ELEMENTS
   * ============================================================ */
_syncNamesToUI() {
    const passengerName = store.activeUser?.name || "Passenger";
    const driverName = store.activeGuide?.name || "Driver";
    const driverPlate = store.activeGuide?.vehicleRegNo || "GJ-06-AU-7892";
    const driverVehicle = store.activeGuide?.vehicleType || "Auto-Rickshaw";
    const driverLic = store.activeGuide?.licenseNo || store.activeGuide?.rtoLicenseNo || "Verified";

    // Header & Dual view elements
    this._setEl("header-user-display-name", passengerName);
    this._setEl("dual-passenger-name", passengerName);
    this._setEl("dual-driver-name", driverName);

    // Main Driver Card UI bindings
    this._setEl("driver-card-name", driverName);
    this._setEl("driver-card-lic", `${driverPlate} • ${driverVehicle}`);
    this._setEl("driver-card-license-no", `License: ${driverLic}`);
    
    // Secondary / Dual Driver Cards
    this._setEl("driver-card-name-dual", driverName);
    this._setEl("driver-card-lic-dual", `${driverPlate} • ${driverVehicle}`);

    if (window.veridaApp?.syncProfileDisplayNames) {
      window.veridaApp.syncProfileDisplayNames();
    }
  }

  /* ============================================================
   *  HELPERS
   * ============================================================ */
  _setEl(id, value) {
    const el = document.getElementById(id);
    if (el) el.textContent = value;
  }

  _flashError(inputId, message) {
    const el = document.getElementById(inputId);
    if (!el) return;
    el.style.border = "1.5px solid var(--danger)";
    el.focus();
    setTimeout(() => { el.style.border = ""; }, 2000);

    // Show inline error
    let errEl = el.parentElement.querySelector(".auth-field-error");
    if (!errEl) {
      errEl = document.createElement("span");
      errEl.className = "auth-field-error";
      errEl.style.cssText = "color:var(--danger);font-size:11px;display:block;margin-top:2px;";
      el.parentElement.appendChild(errEl);
    }
    errEl.textContent = message;
    setTimeout(() => errEl.remove(), 3000);
  }

  _showSuccessToast(message, color = "green") {
    const colorMap = { green: "#059669", blue: "#2563eb", orange: "#d97706" };
    const toast = document.createElement("div");
    toast.style.cssText = `
      position: fixed; bottom: 90px; left: 50%; transform: translateX(-50%) translateY(20px);
      background: ${colorMap[color] || colorMap.green}; color: #fff;
      padding: 12px 24px; border-radius: 50px; font-size: 13px; font-weight: 700;
      box-shadow: 0 8px 24px rgba(0,0,0,0.25); z-index: 9999;
      transition: all 0.3s cubic-bezier(0.4,0,0.2,1); opacity: 0;
    `;
    toast.textContent = message;
    document.body.appendChild(toast);
    requestAnimationFrame(() => {
      toast.style.opacity = "1";
      toast.style.transform = "translateX(-50%) translateY(0)";
    });
    setTimeout(() => {
      toast.style.opacity = "0";
      toast.style.transform = "translateX(-50%) translateY(20px)";
      setTimeout(() => toast.remove(), 400);
    }, 3000);
  }

  /* Public accessor for profile */
  getPassengerProfile() {
    try { return JSON.parse(localStorage.getItem(AUTH_KEY_PASSENGER)) || null; } catch { return null; }
  }

  getDriverProfile() {
    try { return JSON.parse(localStorage.getItem(AUTH_KEY_DRIVER)) || null; } catch { return null; }
  }
}

export const authManager = new AuthManager();

/**
 * Verida — Authentication & Registration Manager
 *
 * Database:
 *   drivers
 *
 * Passenger profile:
 *   LocalStorage only because a passengers table was not
 *   visible in the supplied Supabase schema screenshots.
//  */

// import { store } from "./store.js";
// import { supabase } from "./supabaseClient.js";

// const AUTH_KEY_PASSENGER =
//   "verida_user_profile";

// const AUTH_KEY_DRIVER =
//   "verida_guide_profile";

// class AuthManager {
//   constructor() {
//     this.activeAuthTab =
//       "passenger";

//     this.isInitialized =
//       false;
//   }

//   // ============================================================
//   // INIT
//   // ============================================================

//   init() {
//     if (this.isInitialized) {
//       return;
//     }

//     this.isInitialized = true;

//     this.loadSavedProfiles();

//     this.bindModal();

//     this.bindAuthForms();

//     this.bindProfileButton();

//     console.log(
//       "[Verida Auth] AuthManager initialized."
//     );
//   }

//   // ============================================================
//   // MODAL
//   // ============================================================

//   openAuthModal(
//     defaultRole = "passenger"
//   ) {
//     const modal =
//       document.getElementById(
//         "auth-modal"
//       );

//     if (!modal) {
//       return;
//     }

//     this.switchAuthTab(
//       defaultRole
//     );

//     modal.classList.add(
//       "active"
//     );
//   }

//   closeAuthModal() {
//     const modal =
//       document.getElementById(
//         "auth-modal"
//       );

//     if (modal) {
//       modal.classList.remove(
//         "active"
//       );
//     }
//   }

//   // ============================================================
//   // MODAL BINDING
//   // ============================================================

//   bindModal() {
//     const closeBtn =
//       document.getElementById(
//         "close-auth-modal-btn"
//       );

//     if (closeBtn) {
//       closeBtn.onclick = () =>
//         this.closeAuthModal();
//     }

//     const modal =
//       document.getElementById(
//         "auth-modal"
//       );

//     if (modal) {
//       modal.addEventListener(
//         "click",
//         (event) => {
//           if (
//             event.target === modal
//           ) {
//             this.closeAuthModal();
//           }
//         }
//       );
//     }

//     document
//       .querySelectorAll(
//         ".auth-tab-btn"
//       )
//       .forEach((button) => {
//         button.onclick = () => {
//           const tab =
//             button.getAttribute(
//               "data-tab"
//             );

//           if (tab) {
//             this.switchAuthTab(
//               tab
//             );
//           }
//         };
//       });
//   }

//   switchAuthTab(tabName) {
//     this.activeAuthTab =
//       tabName;

//     document
//       .querySelectorAll(
//         ".auth-tab-btn"
//       )
//       .forEach((button) => {
//         button.classList.toggle(
//           "active",
//           button.getAttribute(
//             "data-tab"
//           ) === tabName
//         );
//       });

//     const passengerPanel =
//       document.getElementById(
//         "auth-panel-passenger"
//       );

//     const driverPanel =
//       document.getElementById(
//         "auth-panel-driver"
//       );

//     if (passengerPanel) {
//       passengerPanel.classList.toggle(
//         "hidden",
//         tabName !== "passenger"
//       );
//     }

//     if (driverPanel) {
//       driverPanel.classList.toggle(
//         "hidden",
//         tabName !== "driver"
//       );
//     }
//   }

//   bindProfileButton() {
//     const button =
//       document.getElementById(
//         "header-profile-btn"
//       );

//     if (button) {
//       button.onclick = () =>
//         this.openAuthModal(
//           store.currentRole === "guide"
//             ? "driver"
//             : "passenger"
//         );
//     }
//   }

//   // ============================================================
//   // FORMS
//   // ============================================================

//   bindAuthForms() {
//     const passengerForm =
//       document.getElementById(
//         "passenger-auth-form"
//       );

//     if (passengerForm) {
//       passengerForm.onsubmit =
//         async (event) => {
//           event.preventDefault();

//           try {
//             await this.savePassengerProfile();
//           } catch (error) {
//             console.error(
//               "[Verida Auth] Passenger save failed:",
//               error
//             );

//             alert(
//               `Passenger save failed:\n${error.message}`
//             );
//           }
//         };
//     }

//     const driverForm =
//       document.getElementById(
//         "driver-auth-form"
//       );

//     if (driverForm) {
//       driverForm.onsubmit =
//         async (event) => {
//           event.preventDefault();

//           try {
//             await this.saveDriverProfile();
//           } catch (error) {
//             console.error(
//               "[Verida Auth] Driver save failed:",
//               error
//             );

//             alert(
//               `Driver save failed:\n${error.message}`
//             );
//           }
//         };
//     }
//   }

//   // ============================================================
//   // PASSENGER
//   // ============================================================

//   async savePassengerProfile() {
//     const name =
//       document
//         .getElementById(
//           "reg-passenger-name"
//         )
//         ?.value
//         ?.trim();

//     const phone =
//       document
//         .getElementById(
//           "reg-passenger-phone"
//         )
//         ?.value
//         ?.trim();

//     const origin =
//       document
//         .getElementById(
//           "reg-passenger-origin"
//         )
//         ?.value
//         ?.trim();

//     const emergency =
//       document
//         .getElementById(
//           "reg-passenger-emergency"
//         )
//         ?.value
//         ?.trim();

//     if (!name) {
//       this.flashError(
//         "reg-passenger-name",
//         "Please enter your full name."
//       );

//       return;
//     }

//     const uid =
//       store.activeUser?.uid ||
//       `trv_${Date.now()}`;

//     const profile = {
//       ...store.activeUser,

//       uid,

//       id: uid,

//       name,

//       phone:
//         phone || "",

//       origin:
//         origin || "",

//       emergency:
//         emergency || "",

//       createdAt:
//         new Date().toISOString()
//     };

//     store.activeUser =
//       profile;

//     localStorage.setItem(
//       AUTH_KEY_PASSENGER,
//       JSON.stringify(profile)
//     );

//     /*
//      * No passengers table was visible in the
//      * Supabase screenshots supplied by you.
//      *
//      * Therefore we do NOT call:
//      * supabase.from("passengers")
//      *
//      * and risk creating an incorrect DB error.
//      */

//     this.syncNamesToUI();

//     this.closeAuthModal();

//     window.veridaApp?.renderProfileTab?.();

//     this.showSuccessToast(
//       `✅ Passenger profile saved — Welcome, ${name}!`,
//       "green"
//     );

//     console.log(
//       "[Verida Auth] Passenger profile saved:",
//       profile
//     );

//     return profile;
//   }

//   // ============================================================
//   // DRIVER
//   // ============================================================

//   async saveDriverProfile() {
//     const name =
//       document
//         .getElementById(
//           "reg-driver-name"
//         )
//         ?.value
//         ?.trim();

//     const phone =
//       document
//         .getElementById(
//           "reg-driver-phone"
//         )
//         ?.value
//         ?.trim();

//     const vehicleRegNo =
//       document
//         .getElementById(
//           "reg-driver-plate"
//         )
//         ?.value
//         ?.trim()
//         ?.toUpperCase();

//     const licenseNo =
//       document
//         .getElementById(
//           "reg-driver-lic"
//         )
//         ?.value
//         ?.trim();

//     const aadharNo =
//       document
//         .getElementById(
//           "reg-adhar-no"
//         )
//         ?.value
//         ?.trim();

//     const vehicleType =
//       document
//         .getElementById(
//           "reg-driver-type"
//         )
//         ?.value ||
//       "Auto-Rickshaw";

//     if (!name) {
//       this.flashError(
//         "reg-driver-name",
//         "Please enter driver name."
//       );

//       return;
//     }

//     if (!vehicleRegNo) {
//       this.flashError(
//         "reg-driver-plate",
//         "Vehicle registration number is required."
//       );

//       return;
//     }

//     if (!licenseNo) {
//       this.flashError(
//         "reg-driver-lic",
//         "RTO license number is required."
//       );

//       return;
//     }

//     /*
//      * Keep existing driver ID.
//      *
//      * This is important because QR contains this ID
//      * and handshake searches:
//      *
//      * drivers.id = QR.guideId
//      */
//     const driverId =
//       store.activeGuide?.id ||
//       store.activeGuide?.uid ||
//       `driver_${Date.now()}`;

//     /*
//      * Use only columns visible in your drivers table.
//      *
//      * Unknown optional values are not invented.
//      */
//     const dbDriver = {
//       id: driverId,

//       name,

//       city:
//         store.currentCityId ||
//         "vadodara",

//       category:
//         store.activeGuide?.category ||
//         "Auto-Rickshaw Transit",

//       license_no:
//         licenseNo,

//       issuer:
//         store.activeGuide?.issuer ||
//         "Vadodara RTO & Police Tourist Syndicate",

//       experience_years:
//         Number(
//           store.activeGuide
//             ?.experienceYears
//         ) || 0,

//       rating:
//         Number(
//           store.activeGuide?.rating
//         ) || 0,

//       encounter_count:
//         Number(
//           store.activeGuide
//             ?.encounterCount
//         ) || 0,

//       languages:
//         Array.isArray(
//           store.activeGuide?.languages
//         )
//           ? store.activeGuide.languages
//           : [],

//       specialty:
//         store.activeGuide?.specialty ||
//         "Vadodara City Transit & Heritage",

//       phone:
//         phone || null,

//       photo:
//         store.activeGuide?.photo ||
//         null,

//       verified_since:
//         store.activeGuide?.verifiedSince ||
//         new Date()
//           .toISOString()
//           .slice(0, 10),

//       trust_score:
//         Number(
//           store.activeGuide
//             ?.trustScore
//         ) || 0,

//       status:
//         "verified",

//       total_trips:
//         Number(
//           store.activeGuide
//             ?.totalTrips
//         ) ||
//         Number(
//           store.activeGuide
//             ?.encounterCount
//         ) ||
//         0,

//       govt_issuer:
//         store.activeGuide
//           ?.govtIssuer ||
//         store.activeGuide
//           ?.issuer ||
//         "Vadodara RTO & Police Tourist Syndicate",

//       vehicle_reg_no:
//         vehicleRegNo,

//       vehicle_type:
//         vehicleType
//     };

//     console.log(
//       "[Verida DB] Updating driver:",
//       dbDriver
//     );

//     // ----------------------------------------------------------
//     // UPSERT INTO SUPABASE
//     // ----------------------------------------------------------

//     const {
//       data,
//       error
//     } = await supabase
//       .from("drivers")
//       .upsert(
//         dbDriver,
//         {
//           onConflict: "id"
//         }
//       )
//       .select("*")
//       .single();

//     if (error) {
//       console.error(
//         "[Verida DB] Driver upsert failed:",
//         error
//       );

//       throw error;
//     }

//     // ----------------------------------------------------------
//     // Update application state
//     // ----------------------------------------------------------

//     store.activeGuide = {
//       ...store.activeGuide,

//       id:
//         data.id,

//       uid:
//         data.id,

//       name:
//         data.name,

//       city:
//         data.city,

//       category:
//         data.category,

//       licenseNo:
//         data.license_no,

//       rtoLicenseNo:
//         data.license_no,

//       issuer:
//         data.issuer,

//       govtIssuer:
//         data.govt_issuer,

//       experienceYears:
//         data.experience_years,

//       rating:
//         data.rating,

//       encounterCount:
//         data.encounter_count,

//       totalTrips:
//         data.total_trips,

//       languages:
//         data.languages,

//       specialty:
//         data.specialty,

//       phone:
//         data.phone,

//       photo:
//         data.photo,

//       verifiedSince:
//         data.verified_since,

//       trustScore:
//         data.trust_score,

//       status:
//         data.status,

//       vehicleRegNo:
//         data.vehicle_reg_no,

//       vehicleType:
//         data.vehicle_type,

//       aadharNo:
//         aadharNo
//     };

//     // Keep only UI convenience data locally.
//     localStorage.setItem(
//       AUTH_KEY_DRIVER,
//       JSON.stringify(
//         store.activeGuide
//       )
//     );

//     this.syncNamesToUI();

//     this.closeAuthModal();

//     window.veridaApp?.renderProfileTab?.();

//     // Restart QR with updated driver
//     if (
//       window.digitalHandshake
//     ) {
//       window.digitalHandshake.stopGuideQrRotation();

//       window.digitalHandshake.startGuideQrRotation(
//         "guide-qr-canvas",
//         "qr-countdown-badge"
//       );
//     }

//     this.showSuccessToast(
//       `✅ Driver profile updated in Supabase — ${data.name}`,
//       "blue"
//     );

//     console.log(
//       "[Verida Auth] Driver profile saved to Supabase:",
//       data
//     );

//     return data;
//   }

//   // ============================================================
//   // LOAD PROFILES
//   // ============================================================

//   loadSavedProfiles() {
//     const savedPassenger =
//       localStorage.getItem(
//         AUTH_KEY_PASSENGER
//       );

//     if (savedPassenger) {
//       try {
//         const passenger =
//           JSON.parse(
//             savedPassenger
//           );

//         store.activeUser = {
//           ...store.activeUser,
//           ...passenger
//         };

//         this.prefillPassengerForm(
//           passenger
//         );

//         console.log(
//           "[Verida Auth] Passenger profile loaded:",
//           passenger.name
//         );
//       } catch (error) {
//         console.warn(
//           "[Verida Auth] Passenger profile could not be loaded."
//         );
//       }
//     }

//     const savedDriver =
//       localStorage.getItem(
//         AUTH_KEY_DRIVER
//       );

//     if (savedDriver) {
//       try {
//         const driver =
//           JSON.parse(
//             savedDriver
//           );

//         store.activeGuide = {
//           ...store.activeGuide,
//           ...driver
//         };

//         this.prefillDriverForm(
//           driver
//         );

//         console.log(
//           "[Verida Auth] Driver profile loaded:",
//           driver.name
//         );
//       } catch (error) {
//         console.warn(
//           "[Verida Auth] Driver profile could not be loaded."
//         );
//       }
//     }
//   }

//   async refreshDriverFromDatabase() {
//     const driverId =
//       store.activeGuide?.id ||
//       store.activeGuide?.uid;

//     if (!driverId) {
//       return null;
//     }

//     const {
//       data,
//       error
//     } = await supabase
//       .from("drivers")
//       .select("*")
//       .eq("id", driverId)
//       .maybeSingle();

//     if (error) {
//       console.error(
//         "[Verida DB] Driver refresh failed:",
//         error
//       );

//       return null;
//     }

//     if (!data) {
//       return null;
//     }

//     store.activeGuide = {
//       ...store.activeGuide,

//       id:
//         data.id,

//       uid:
//         data.id,

//       name:
//         data.name,

//       city:
//         data.city,

//       category:
//         data.category,

//       licenseNo:
//         data.license_no,

//       rtoLicenseNo:
//         data.license_no,

//       issuer:
//         data.issuer,

//       govtIssuer:
//         data.govt_issuer,

//       experienceYears:
//         data.experience_years,

//       rating:
//         data.rating,

//       encounterCount:
//         data.encounter_count,

//       totalTrips:
//         data.total_trips,

//       languages:
//         data.languages,

//       specialty:
//         data.specialty,

//       phone:
//         data.phone,

//       photo:
//         data.photo,

//       verifiedSince:
//         data.verified_since,

//       trustScore:
//         data.trust_score,

//       status:
//         data.status,

//       vehicleRegNo:
//         data.vehicle_reg_no,

//       vehicleType:
//         data.vehicle_type
//     };

//     localStorage.setItem(
//       AUTH_KEY_DRIVER,
//       JSON.stringify(
//         store.activeGuide
//       )
//     );

//     this.syncNamesToUI();

//     return data;
//   }

//   // ============================================================
//   // FORM PREFILL
//   // ============================================================

//   prefillPassengerForm(
//     profile
//   ) {
//     const set = (
//       id,
//       value
//     ) => {
//       const element =
//         document.getElementById(
//           id
//         );

//       if (
//         element &&
//         value !== null &&
//         value !== undefined
//       ) {
//         element.value = value;
//       }
//     };

//     set(
//       "reg-passenger-name",
//       profile.name
//     );

//     set(
//       "reg-passenger-phone",
//       profile.phone
//     );

//     set(
//       "reg-passenger-origin",
//       profile.origin
//     );

//     set(
//       "reg-passenger-emergency",
//       profile.emergency
//     );
//   }

//   prefillDriverForm(
//     driver
//   ) {
//     const set = (
//       id,
//       value
//     ) => {
//       const element =
//         document.getElementById(
//           id
//         );

//       if (
//         element &&
//         value !== null &&
//         value !== undefined
//       ) {
//         element.value = value;
//       }
//     };

//     set(
//       "reg-driver-name",
//       driver.name
//     );

//     set(
//       "reg-driver-phone",
//       driver.phone
//     );

//     set(
//       "reg-driver-plate",
//       driver.vehicleRegNo
//     );

//     set(
//       "reg-driver-lic",
//       driver.licenseNo ||
//         driver.rtoLicenseNo
//     );

//     set(
//       "reg-driver-type",
//       driver.vehicleType
//     );

//     set(
//       "reg-adhar-no",
//       driver.aadharNo
//     );
//   }

//   // ============================================================
//   // UI
//   // ============================================================

//   syncNamesToUI() {
//     const passengerName =
//       store.activeUser?.name ||
//       "Passenger";

//     const driverName =
//       store.activeGuide?.name ||
//       "Driver";

//     const driverPlate =
//       store.activeGuide?.vehicleRegNo ||
//       "Not Provided";

//     const driverVehicle =
//       store.activeGuide?.vehicleType ||
//       "Auto-Rickshaw";

//     const driverLicense =
//       store.activeGuide?.licenseNo ||
//       store.activeGuide?.rtoLicenseNo ||
//       "Not Provided";

//     this.setElement(
//       "header-user-display-name",
//       passengerName
//     );

//     this.setElement(
//       "dual-passenger-name",
//       passengerName
//     );

//     this.setElement(
//       "dual-driver-name",
//       driverName
//     );

//     this.setElement(
//       "driver-card-name",
//       driverName
//     );

//     this.setElement(
//       "driver-card-lic",
//       `${driverPlate} • ${driverVehicle}`
//     );

//     this.setElement(
//       "driver-card-license-no",
//       `License: ${driverLicense}`
//     );

//     this.setElement(
//       "driver-card-name-dual",
//       driverName
//     );

//     this.setElement(
//       "driver-card-lic-dual",
//       `${driverPlate} • ${driverVehicle}`
//     );

//     window.veridaApp?.syncProfileDisplayNames?.();
//   }

//   setElement(
//     id,
//     value
//   ) {
//     const element =
//       document.getElementById(id);

//     if (element) {
//       element.textContent =
//         value;
//     }
//   }

//   // ============================================================
//   // ERROR / SUCCESS
//   // ============================================================

//   flashError(
//     inputId,
//     message
//   ) {
//     const element =
//       document.getElementById(
//         inputId
//       );

//     if (!element) {
//       return;
//     }

//     element.style.border =
//       "1.5px solid var(--danger)";

//     element.focus();

//     let errorElement =
//       element.parentElement
//         ?.querySelector(
//           ".auth-field-error"
//         );

//     if (!errorElement) {
//       errorElement =
//         document.createElement(
//           "span"
//         );

//       errorElement.className =
//         "auth-field-error";

//       errorElement.style.cssText =
//         "color:var(--danger);font-size:11px;display:block;margin-top:2px;";

//       element.parentElement?.appendChild(
//         errorElement
//       );
//     }

//     errorElement.textContent =
//       message;

//     setTimeout(() => {
//       element.style.border = "";

//       errorElement?.remove();
//     }, 3000);
//   }

//   showSuccessToast(
//     message,
//     type = "green"
//   ) {
//     const colors = {
//       green: "#059669",
//       blue: "#2563eb",
//       orange: "#d97706"
//     };

//     const toast =
//       document.createElement(
//         "div"
//       );

//     toast.style.cssText = `
//       position:fixed;
//       bottom:90px;
//       left:50%;
//       transform:translateX(-50%) translateY(20px);
//       background:${colors[type] || colors.green};
//       color:#fff;
//       padding:12px 24px;
//       border-radius:50px;
//       font-size:13px;
//       font-weight:700;
//       box-shadow:0 8px 24px rgba(0,0,0,.25);
//       z-index:9999;
//       opacity:0;
//       transition:all .3s ease;
//     `;

//     toast.textContent =
//       message;

//     document.body.appendChild(
//       toast
//     );

//     requestAnimationFrame(() => {
//       toast.style.opacity = "1";

//       toast.style.transform =
//         "translateX(-50%) translateY(0)";
//     });

//     setTimeout(() => {
//       toast.style.opacity =
//         "0";

//       toast.style.transform =
//         "translateX(-50%) translateY(20px)";

//       setTimeout(
//         () => toast.remove(),
//         400
//       );
//     }, 3000);
//   }

//   // ============================================================
//   // PUBLIC ACCESSORS
//   // ============================================================

//   getPassengerProfile() {
//     try {
//       return (
//         JSON.parse(
//           localStorage.getItem(
//             AUTH_KEY_PASSENGER
//           )
//         ) || null
//       );
//     } catch {
//       return null;
//     }
//   }

//   getDriverProfile() {
//     try {
//       return (
//         JSON.parse(
//           localStorage.getItem(
//             AUTH_KEY_DRIVER
//           )
//         ) || null
//       );
//     } catch {
//       return null;
//     }
//   }
// }

// export const authManager =
//   new AuthManager();