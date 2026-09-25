
import { store } from "./store.js";
import{ supabase } from "./supabaseClient.js";

export class DigitalHandshake {
  constructor() {
    this.html5QrCode = null;
    this.qrRotationInterval = null;
    this.countdownTimer = null;
    this.currentQrToken = null;
    this.qrValidityDuration = 15;
    this.secondsRemaining = 15;
    this.isScanning = false;
  }

  // --- GPS Haversine Distance Calculation ---
  calculateDistance(
    lat1,
    lon1,
    lat2,
    lon2
  ) {
    const R = 6371e3;

    const φ1 =
      (lat1 * Math.PI) / 180;

    const φ2 =
      (lat2 * Math.PI) / 180;

    const Δφ =
      ((lat2 - lat1) * Math.PI) / 180;

    const Δλ =
      ((lon2 - lon1) * Math.PI) / 180;

    const a =
      Math.sin(Δφ / 2) *
        Math.sin(Δφ / 2) +
      Math.cos(φ1) *
        Math.cos(φ2) *
        Math.sin(Δλ / 2) *
        Math.sin(Δλ / 2);

    const c =
      2 *
      Math.atan2(
        Math.sqrt(a),
        Math.sqrt(1 - a)
      );

    return Math.round(R * c);
  }

  // --- Guide Side: Dynamic Rotating QR Code ---
startGuideQrRotation(
  containerId = "guide-qr-canvas",
  countdownElementId = "qr-countdown-badge"
) {
  this.stopGuideQrRotation();

  const generateFreshToken = () => {
    const guide = store.activeGuide;
    const loc = store.currentLocation;

    if (!guide || !loc) {
      console.error("[Verida QR] Driver/location not available.");
      return;
    }

    const driverId = guide.id || guide.uid;

    if (!driverId) {
      console.error("[Verida QR] Driver ID missing.");
      return;
    }

    const now = Date.now();
    const expiresAt = now + 15000;

    const nonce = crypto.randomUUID()
      .replace(/-/g, "")
      .slice(0, 8);

    this.currentQrToken = {
      veridaProtocol: "1.0",
      type: "HANDSHAKE_AUTH",
      guideId: driverId,
      city: store.currentCityId,
      lat: Number(loc.lat),
      lng: Number(loc.lng),
      timestamp: now,
      expiresAt,
      nonce
    };

    // Compact QR payload
    const qrText = [
      "VRD1",
      driverId,
      now,
      expiresAt,
      nonce
    ].join("|");

    console.log("[Verida QR] New token:", this.currentQrToken);
    console.log("[Verida QR] QR payload:", qrText);

    this.renderQrCode(containerId, qrText);

    this.secondsRemaining = 15;
    this.updateCountdownBadge(countdownElementId);
  };

  generateFreshToken();

  this.countdownTimer = setInterval(() => {
    this.secondsRemaining--;

    if (this.secondsRemaining <= 0) {
      generateFreshToken();
    } else {
      this.updateCountdownBadge(countdownElementId);
    }
  }, 1000);
}
  stopGuideQrRotation() {
    if (this.countdownTimer) {
      clearInterval(
        this.countdownTimer
      );
    }

    if (this.qrRotationInterval) {
      clearInterval(
        this.qrRotationInterval
      );
    }

    this.countdownTimer = null;
    this.qrRotationInterval = null;
  }

updateCountdownBadge(elementId) {
  const el = document.getElementById(elementId);

  if (el) {
    el.textContent =
      `Token refreshes in ${this.secondsRemaining}s`;
  }
}

renderQrCode(containerId, payloadString) {
    const container = document.getElementById(containerId);

    if (!container) {
        console.error("[Verida QR] Container not found:", containerId);
        return;
    }

    container.innerHTML = "";

    if (typeof QRCode === "undefined") {
        console.error("[Verida QR] QRCode library is not loaded.");
        return;
    }

    new QRCode(container, {
        text: payloadString,
        width: 220,
        height: 220,
        colorDark: "#000b09",
        colorLight: "#ffffff",

        // Lower error correction = less dense QR
        correctLevel: QRCode.CorrectLevel.L
    });
}

  // --- Traveler Side: Scanner & Verification ---
  async startTravelerScanner(
    readerElementId = "qr-reader",
    onScanSuccess,
    onScanError
  ) {
    if (this.isScanning) return;

    if (
      typeof Html5Qrcode ===
      "undefined"
    ) {
      console.warn(
        "[Verida Handshake] Html5Qrcode library not loaded yet."
      );

      return;
    }

    try {
      this.html5QrCode =
        new Html5Qrcode(
          readerElementId
        );

      this.isScanning = true;

      const config = {
        fps: 10,

        qrbox: {
          width: 250,
          height: 250
        },

        aspectRatio: 1.0
      };

      await this.html5QrCode.start(
        { facingMode: "environment" },

        config,

        (decodedText) => {
          this.processScannedPayload(
            decodedText,
            onScanSuccess
          );
        },

        (errorMessage) => {
          if (onScanError) {
            onScanError(
              errorMessage
            );
          }
        }
      );
    }  catch (err) {
      console.warn("[Verida Scanner] Camera start exception or permission denied:", err);
      this.isScanning = false;
      alert("📷 Camera access is needed to scan a driver's QR code. Please allow camera permission and try again.");
}
  }

  async stopTravelerScanner() {
    if (
      this.html5QrCode &&
      this.isScanning
    ) {
      try {
        await this.html5QrCode.stop();

        this.html5QrCode.clear();
      } catch (err) {
        console.warn(
          "[Verida Scanner] Stop error:",
          err
        );
      }

      this.isScanning = false;
    }
  }
//---Take id from database table--
  async getDriverProfile(driverId) {
    const { data, error } = await supabase
        .from("drivers")
        .select("*")
        .eq("id", driverId)
        .single();

    if (error) {
        console.error("Error fetching driver profile:", error);
        return null;
    }

    return data;
}


  // --- Process decoded QR ---
async processScannedPayload(decodedText, callback = null) {

  console.log("[Verida QR] Scanned:", decodedText);

  let payload = null;

  // ============================================================
  // 1. PARSE COMPACT VERIDA QR
  // ============================================================

  if (typeof decodedText === "string") {

    const parts = decodedText.trim().split("|");

    if (parts.length === 5 && parts[0] === "VRD1") {

      payload = {
        veridaProtocol: "1.0",
        type: "HANDSHAKE_AUTH",
        guideId: parts[1],
        timestamp: Number(parts[2]),
        expiresAt: Number(parts[3]),
        nonce: parts[4]
      };

    } else {

      // Backward compatibility for old JSON QR
      try {
        payload = JSON.parse(decodedText);
      } catch (error) {
        console.error("[Verida QR] Invalid QR:", error);

        alert("Invalid Verida QR code.");
        return null;
      }
    }

  } else if (typeof decodedText === "object") {

    payload = decodedText;

  } else {

    alert("Invalid Verida QR code.");
    return null;
  }


  // ============================================================
  // 2. BASIC VALIDATION
  // ============================================================

  if (!payload.guideId) {
    alert("Driver ID is missing from QR.");
    return null;
  }


  // ============================================================
  // 3. CHECK QR EXPIRY
  // ============================================================

  if (payload.expiresAt) {

    const expiresAt = Number(payload.expiresAt);

    if (
      !Number.isFinite(expiresAt) ||
      Date.now() > expiresAt
    ) {

      alert(
        "⚠️ QR code expired.\nPlease scan the driver's new QR."
      );

      return null;
    }
  }


  // ============================================================
  // 4. FETCH EXACT DRIVER FROM SUPABASE
  // ============================================================

  console.log(
    "[Verida QR] Fetching driver:",
    payload.guideId
  );

  const driverProfile =
    await this.getDriverProfile(payload.guideId);

  if (!driverProfile) {

    alert(
      "Driver profile not found in Verida database."
    );

    return null;
  }

  console.log(
    "[Verida DB] Driver found:",
    driverProfile
  );


  // ============================================================
  // 5. TRAVELER LOCATION
  // ============================================================

  const travelerLocation =
    store.currentLocation || {};

  const travelerLat =
    Number(travelerLocation.lat);

  const travelerLng =
    Number(travelerLocation.lng);

  const driverLat =
    Number(payload.lat);

  const driverLng =
    Number(payload.lng);

  let distanceMeters = 0;


  // ============================================================
  // 6. GPS PROXIMITY
  // ============================================================

  if (
    Number.isFinite(travelerLat) &&
    Number.isFinite(travelerLng) &&
    Number.isFinite(driverLat) &&
    Number.isFinite(driverLng)
  ) {

    distanceMeters =
      this.calculateDistance(
        travelerLat,
        travelerLng,
        driverLat,
        driverLng
      );

  } else {

    console.warn(
      "[Verida GPS] GPS coordinates unavailable."
    );
  }


  const proximityValid =
    distanceMeters <= 500 ||
    store.isSimulatedGps === true;


  if (!proximityValid) {

    alert(
      `⚠️ Proximity verification failed.\n\n` +
      `Driver distance: ${distanceMeters}m\n` +
      `Maximum allowed: 500m`
    );

    return null;
  }


  // ============================================================
  // 7. CREATE HANDSHAKE RECORD
  // ============================================================

  const handshakeData = {

    travelerId:
      store.activeUser?.uid ||
      store.activeUser?.id ||
      null,

    guideId:
      driverProfile.id,

    guideName:
      driverProfile.name,

    guidePhone:
      driverProfile.phone,

    guidePhoto:
      driverProfile.photo,

    guideVehicleRegNo:
      driverProfile.vehicle_reg_no,

    guideVehicleType:
      driverProfile.vehicle_type,

    guideVehicleModel:
      driverProfile.vehicle_model,

    guideRtoLicenseNo:
      driverProfile.rto_license_no,

    guideBadgeNo:
      driverProfile.badge_no,

    guideRating:
      Number(driverProfile.rating) || 0,

    guideTrustScore:
      Number(driverProfile.trust_score) || 0,

    guideEncounterCount:
      Number(driverProfile.total_trips) || 0,

    guideGovtIssuer:
      driverProfile.govt_issuer,

    guideLanguages:
      driverProfile.languages,

    guideEmergencyNumbers:
      driverProfile.emergency_numbers,

    travelerName:
      store.activeUser?.name ||
      "Verified Traveler",

    monumentName:
      travelerLocation.name ||
      "Current Location",

    city:
      payload.city ||
      store.currentCityId ||
      driverProfile.city,

    lat:
      travelerLat,

    lng:
      travelerLng,

    distanceMeters:
      distanceMeters,

    timestamp:
      Date.now(),

    tokenHash:
      payload.nonce
  };


  // ============================================================
  // 8. SAVE HANDSHAKE TO SUPABASE
  // ============================================================

  console.log(
    "[Verida] Saving handshake:",
    handshakeData
  );

  let savedRecord;

  try {

    savedRecord =
      await store.recordHandshake(
        handshakeData
      );

  } catch (error) {

    console.error(
      "[Verida DB] Handshake save failed:",
      error
    );

    alert(
      `Database error while saving handshake:\n${error.message}`
    );

    return null;
  }


  // ============================================================
  // 9. CREATE UI-FRIENDLY RECORD
  // ============================================================

  const result = {

    // Database fields
    ...savedRecord,

    // Driver identity
    guideId:
      driverProfile.id,

    guideName:
      driverProfile.name,

    guidePhone:
      driverProfile.phone,

    guidePhoto:
      driverProfile.photo,

    // Vehicle
    guideVehicleRegNo:
      driverProfile.vehicle_reg_no,

    guideVehicleType:
      driverProfile.vehicle_type,

    guideVehicleModel:
      driverProfile.vehicle_model,

    // Verification
    guideRtoLicenseNo:
      driverProfile.rto_license_no,

    guideLicenseNo:
      driverProfile.rto_license_no,

    guideBadgeNo:
      driverProfile.badge_no,

    guideRating:
      Number(driverProfile.rating) || 0,

    guideTrustScore:
      Number(driverProfile.trust_score) || 0,

    guideEncounterCount:
      Number(driverProfile.total_trips) || 0,

    guideGovtIssuer:
      driverProfile.govt_issuer,

    guideLanguages:
      driverProfile.languages,

    guideEmergencyNumbers:
      driverProfile.emergency_numbers,

    // Traveler
    travelerId:
      store.activeUser?.uid,

    travelerName:
      store.activeUser?.name,

    // GPS
    distanceMeters:
      distanceMeters,

    // QR
    tokenHash:
      payload.nonce,

    qrNonce:
      payload.nonce
  };


  // ============================================================
  // 10. STORE THE SCANNED DRIVER LOCALLY
  // ============================================================

  this.lastScannedDriver =
    driverProfile;

  this.lastScannedPayload =
    payload;


  console.log(
    "[Verida] VERIFIED DRIVER:",
    driverProfile.name,
    driverProfile.id
  );

  console.log(
    "[Verida] Handshake successful:",
    result
  );


  // ============================================================
  // 11. CALLBACK TO APP.JS
  // ============================================================

  if (typeof callback === "function") {
    callback(result);
  }

  return result;
}

  // --- Instant simulator for live demo ---
  simulateLiveHandshake(
    callback
  ) {
    const guide =
      store.activeGuide;

    const token = {
      guideId:
        guide.id ||
        guide.uid,

      name:
        guide.name,

      phone:
        guide.phone,

      photo:
        guide.photo,

      licenseNo:
        guide.licenseNo,

      rtoLicenseNo:
        guide.rtoLicenseNo ||
        guide.licenseNo,

      issuer:
        guide.issuer,

      govtIssuer:
        guide.govtIssuer ||
        guide.issuer,

      category:
        guide.category,

      vehicleRegNo:
        guide.vehicleRegNo,

      vehicleType:
        guide.vehicleType,

      aadharNo:
        guide.aadharNo,

      rating:
        guide.rating,

      trustScore:
        guide.trustScore,

      encounterCount:
        guide.encounterCount,

      city:
        store.currentCityId,

      lat:
        store.currentLocation.lat,

      lng:
        store.currentLocation.lng,

      timestamp:
        Date.now()
    };

    return this.processScannedPayload(
      token,
      callback
    );
  }
}

export const digitalHandshake =
  new DigitalHandshake();
 

/**
 * Verida — Digital Handshake & QR Scanner
 *
 * QR DESIGN:
 * The QR code contains ONLY:
 *
 *     VERIDA_DRIVER:DRV001
 *
 * No phone number, Aadhaar, license number, GPS,
 * rating, or other sensitive information is stored in QR.
 */


/**
 * Verida — Digital Handshake
 * Supabase-backed QR verification system.
 *
 * Database used:
 *   drivers
 *   handshakes
 */

// import { store } from "./store.js";
// import { supabase } from "./supabaseClient.js";

// class DigitalHandshake {
//   constructor() {
//     this.html5QrCode = null;

//     this.countdownTimer = null;

//     this.qrValidityDuration = 15;
//     this.secondsRemaining = 15;

//     this.currentQrToken = null;

//     this.isScanning = false;
//     this.isProcessingScan = false;
//   }

//   // ============================================================
//   // GPS DISTANCE
//   // ============================================================

//   calculateDistance(lat1, lon1, lat2, lon2) {
//     const R = 6371000;

//     const p1 = Number(lat1);
//     const p2 = Number(lat2);

//     const dLat =
//       ((Number(lat2) - Number(lat1)) * Math.PI) / 180;

//     const dLng =
//       ((Number(lon2) - Number(lon1)) * Math.PI) / 180;

//     if (
//       !Number.isFinite(p1) ||
//       !Number.isFinite(p2) ||
//       !Number.isFinite(dLat) ||
//       !Number.isFinite(dLng)
//     ) {
//       return Infinity;
//     }

//     const a =
//       Math.sin(dLat / 2) ** 2 +
//       Math.cos((p1 * Math.PI) / 180) *
//         Math.cos((p2 * Math.PI) / 180) *
//         Math.sin(dLng / 2) ** 2;

//     const c =
//       2 *
//       Math.atan2(
//         Math.sqrt(a),
//         Math.sqrt(1 - a)
//       );

//     return Math.round(R * c);
//   }

//   // ============================================================
//   // DRIVER QR
//   // ============================================================

//   startGuideQrRotation(
//     containerId = "guide-qr-canvas",
//     countdownElementId = "qr-countdown-badge"
//   ) {
//     this.stopGuideQrRotation();

//     const generateFreshToken = () => {
//       const driver = store.activeGuide || {};
//       const location = store.currentLocation || {};

//       const driverId =
//         driver.id ||
//         driver.uid;

//       if (!driverId) {
//         console.error(
//           "[Verida QR] Driver ID is missing."
//         );
//         return;
//       }

//       const now = Date.now();

//       const nonce =
//         globalThis.crypto?.randomUUID?.() ||
//         Math.random()
//           .toString(36)
//           .substring(2, 12);

//       const license =
//         driver.licenseNo ||
//         driver.rtoLicenseNo ||
//         "DRIVER";

//       this.currentQrToken = {
//         veridaProtocol: "1.0",

//         type: "HANDSHAKE_AUTH",

//         guideId: driverId,

//         city:
//           store.currentCityId ||
//           driver.city ||
//           "vadodara",

//         lat:
//           Number(location.lat) || 0,

//         lng:
//           Number(location.lng) || 0,

//         timestamp: now,

//         expiresAt:
//           now +
//           this.qrValidityDuration * 1000,

//         nonce,

//         signature:
//           `VRD-${license.slice(-4)}-${nonce}`
//       };

//       console.log(
//         "[Verida] Generating Driver QR:",
//         driverId
//       );

//       this.renderQrCode(
//         containerId,
//         JSON.stringify(this.currentQrToken)
//       );

//       this.secondsRemaining =
//         this.qrValidityDuration;

//       this.updateCountdownBadge(
//         countdownElementId
//       );
//     };

//     generateFreshToken();

//     this.countdownTimer =
//       setInterval(() => {
//         this.secondsRemaining--;

//         if (this.secondsRemaining <= 0) {
//           generateFreshToken();
//         } else {
//           this.updateCountdownBadge(
//             countdownElementId
//           );
//         }
//       }, 1000);
//   }

//   stopGuideQrRotation() {
//     if (this.countdownTimer) {
//       clearInterval(
//         this.countdownTimer
//       );

//       this.countdownTimer = null;
//     }
//   }

//   updateCountdownBadge(elementId) {
//     const element =
//       document.getElementById(elementId);

//     if (element) {
//       element.textContent =
//         `Token refreshes in ${this.secondsRemaining}s`;
//     }
//   }

//   renderQrCode(containerId, payload) {
//     const container =
//       document.getElementById(containerId);

//     if (!container) {
//       return;
//     }

//     container.innerHTML = "";

//     if (
//       typeof QRCode !== "undefined"
//     ) {
//       new QRCode(container, {
//         text: payload,

//         width: 220,
//         height: 220,

//         colorDark: "#064e3b",
//         colorLight: "#ffffff",

//         correctLevel:
//           QRCode.CorrectLevel.M
//       });

//       return;
//     }

//     console.warn(
//       "[Verida QR] QRCode library is not loaded."
//     );

//     const fallback =
//       document.createElement("div");

//     fallback.style.cssText = `
//       width:220px;
//       height:220px;
//       display:flex;
//       align-items:center;
//       justify-content:center;
//       background:#fff;
//       border:4px solid #047857;
//       border-radius:12px;
//       text-align:center;
//       font-weight:700;
//       padding:20px;
//       box-sizing:border-box;
//     `;

//     fallback.textContent =
//       "Verida QR\n" +
//       (this.currentQrToken?.guideId || "");

//     container.appendChild(
//       fallback
//     );
//   }

//   // ============================================================
//   // DRIVER DATABASE LOOKUP
//   // ============================================================

//   async getDriverProfile(driverId) {
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
//         "[Verida DB] Driver lookup failed:",
//         error
//       );

//       return null;
//     }

//     return data || null;
//   }

//   // ============================================================
//   // QR SCANNER
//   // ============================================================

//   async startTravelerScanner(
//     readerElementId = "qr-reader",
//     onScanSuccess,
//     onScanError
//   ) {
//     if (this.isScanning) {
//       return;
//     }

//     if (
//       typeof Html5Qrcode ===
//       "undefined"
//     ) {
//       console.error(
//         "[Verida Scanner] Html5Qrcode library is not loaded."
//       );

//       return;
//     }

//     const reader =
//       document.getElementById(
//         readerElementId
//       );

//     if (!reader) {
//       console.error(
//         `[Verida Scanner] #${readerElementId} not found.`
//       );

//       return;
//     }

//     try {
//       this.html5QrCode =
//         new Html5Qrcode(
//           readerElementId
//         );

//       this.isScanning = true;
//       this.isProcessingScan = false;

//       await this.html5QrCode.start(
//         {
//           facingMode: "environment"
//         },

//         {
//           fps: 10,

//           qrbox: {
//             width: 250,
//             height: 250
//           },

//           aspectRatio: 1
//         },

//         async (decodedText) => {
//           if (
//             this.isProcessingScan
//           ) {
//             return;
//           }

//           this.isProcessingScan =
//             true;

//           try {
//             const record =
//               await this.processScannedPayload(
//                 decodedText
//               );

//             if (
//               record &&
//               typeof onScanSuccess ===
//                 "function"
//             ) {
//               onScanSuccess(record);
//             }
//           } catch (error) {
//             console.error(
//               "[Verida Scanner] Verification error:",
//               error
//             );

//             if (
//               typeof onScanError ===
//               "function"
//             ) {
//               onScanError(
//                 error.message
//               );
//             }
//           } finally {
//             this.isProcessingScan =
//               false;
//           }
//         },

//         (errorMessage) => {
//           if (
//             typeof onScanError ===
//             "function"
//           ) {
//             onScanError(
//               errorMessage
//             );
//           }
//         }
//       );

//       console.log(
//         "[Verida Scanner] Camera started."
//       );
//     } catch (error) {
//       console.error(
//         "[Verida Scanner] Camera start failed:",
//         error
//       );

//       this.isScanning = false;
//     }
//   }

//   async stopTravelerScanner() {
//     if (!this.html5QrCode) {
//       return;
//     }

//     try {
//       if (this.isScanning) {
//         await this.html5QrCode.stop();
//       }

//       this.html5QrCode.clear();
//     } catch (error) {
//       console.warn(
//         "[Verida Scanner] Stop error:",
//         error
//       );
//     }

//     this.html5QrCode = null;
//     this.isScanning = false;
//     this.isProcessingScan = false;
//   }

//   // ============================================================
//   // PROCESS QR
//   // ============================================================

//   async processScannedPayload(
//     decodedText,
//     callback = null
//   ) {
//     let payload;

//     // ----------------------------------------------------------
//     // Parse QR
//     // ----------------------------------------------------------

//     try {
//       payload =
//         typeof decodedText === "object"
//           ? decodedText
//           : JSON.parse(decodedText);
//     } catch (error) {
//       console.error(
//         "[Verida QR] Invalid QR payload."
//       );

//       alert(
//         "Invalid Verida QR code."
//       );

//       return null;
//     }

//     if (!payload) {
//       return null;
//     }

//     // ----------------------------------------------------------
//     // Protocol validation
//     // ----------------------------------------------------------

//     if (
//       payload.veridaProtocol &&
//       payload.veridaProtocol !== "1.0"
//     ) {
//       alert(
//         "Unsupported Verida QR version."
//       );

//       return null;
//     }

//     if (
//       payload.type &&
//       payload.type !== "HANDSHAKE_AUTH"
//     ) {
//       alert(
//         "This is not a Verida driver QR."
//       );

//       return null;
//     }

//     // ----------------------------------------------------------
//     // Driver ID
//     // ----------------------------------------------------------

//     const driverId =
//       payload.guideId ||
//       payload.driverId;

//     if (!driverId) {
//       alert(
//         "Driver ID is missing from QR."
//       );

//       return null;
//     }

//     // ----------------------------------------------------------
//     // Expiry validation
//     // ----------------------------------------------------------

//     if (payload.expiresAt) {
//       const expiresAt =
//         Number(payload.expiresAt);

//       if (
//         !Number.isFinite(expiresAt) ||
//         Date.now() > expiresAt
//       ) {
//         alert(
//           "⚠️ QR code expired. Please scan the driver's new QR."
//         );

//         return null;
//       }
//     }

//     // ----------------------------------------------------------
//     // Fetch REAL driver from Supabase
//     // ----------------------------------------------------------

//     const driver =
//       await this.getDriverProfile(
//         driverId
//       );

//     if (!driver) {
//       alert(
//         "Driver profile not found in Verida database."
//       );

//       return null;
//     }

//     // ----------------------------------------------------------
//     // Traveler location
//     // ----------------------------------------------------------

//     const travelerLocation =
//       store.currentLocation || {};

//     const travelerLat =
//       Number(travelerLocation.lat);

//     const travelerLng =
//       Number(travelerLocation.lng);

//     const guideLat =
//       Number(payload.lat);

//     const guideLng =
//       Number(payload.lng);

//     let distanceMeters = 0;

//     if (
//       Number.isFinite(travelerLat) &&
//       Number.isFinite(travelerLng) &&
//       Number.isFinite(guideLat) &&
//       Number.isFinite(guideLng)
//     ) {
//       distanceMeters =
//         this.calculateDistance(
//           travelerLat,
//           travelerLng,
//           guideLat,
//           guideLng
//         );
//     }

//     const proximityValid =
//       distanceMeters <= 500 ||
//       store.isSimulatedGps === true;

//     if (!proximityValid) {
//       alert(
//         `⚠️ Proximity verification failed.\nDriver distance: ${distanceMeters}m\nMaximum allowed: 500m`
//       );

//       return null;
//     }

//     // ----------------------------------------------------------
//     // Create DB-compatible handshake
//     // ----------------------------------------------------------

//     const handshakeId =
//       `hs_${Date.now()}_${Math.random()
//         .toString(36)
//         .substring(2, 8)}`;

//     const tokenHash =
//       `0x${this.generateTokenHash()}`;

//     const handshakeRecord = {
//       id: handshakeId,

//       guide_id:
//         driver.id,

//       traveler_id:
//         store.activeUser?.uid ||
//         store.activeUser?.id ||
//         null,

//       guide_name:
//         driver.name ||
//         "Unknown Driver",

//       traveler_name:
//         store.activeUser?.name ||
//         "Verified Traveler",

//       monument_id:
//         null,

//       monument_name:
//         travelerLocation.name ||
//         "Current Location",

//       city:
//         payload.city ||
//         store.currentCityId ||
//         driver.city ||
//         "vadodara",

//       lat:
//         Number.isFinite(travelerLat)
//           ? travelerLat
//           : null,

//       lng:
//         Number.isFinite(travelerLng)
//           ? travelerLng
//           : null,

//       distance_meters:
//         Number.isFinite(distanceMeters)
//           ? distanceMeters
//           : null,

//       // IMPORTANT:
//       // Supabase schema shows int8.
//       timestamp:
//         Date.now(),

//       status:
//         "verified",

//       agreed_price:
//         null,

//       token_hash:
//         tokenHash
//     };

//     console.log(
//       "[Verida] Saving handshake:",
//       handshakeRecord
//     );

//     // ----------------------------------------------------------
//     // INSERT INTO SUPABASE
//     // ----------------------------------------------------------

//     const {
//       data,
//       error
//     } = await supabase
//       .from("handshakes")
//       .insert([
//         handshakeRecord
//       ])
//       .select("*")
//       .single();

//     if (error) {
//       console.error(
//         "[Verida DB] Handshake insert failed:",
//         error
//       );

//       alert(
//         `Database error while saving handshake:\n${error.message}`
//       );

//       throw error;
//     }

//     // ----------------------------------------------------------
//     // Update active driver locally
//     // ----------------------------------------------------------

//     store.activeGuide = {
//       ...store.activeGuide,

//       id: driver.id,
//       uid: driver.id,

//       name:
//         driver.name ||
//         "",

//       city:
//         driver.city ||
//         "",

//       category:
//         driver.category ||
//         "",

//       licenseNo:
//         driver.license_no ||
//         "",

//       rtoLicenseNo:
//         driver.license_no ||
//         "",

//       issuer:
//         driver.issuer ||
//         "",

//       govtIssuer:
//         driver.govt_issuer ||
//         driver.issuer ||
//         "",

//       experienceYears:
//         driver.experience_years ||
//         0,

//       rating:
//         Number(driver.rating) || 0,

//       encounterCount:
//         Number(
//           driver.encounter_count
//         ) || 0,

//       totalTrips:
//         Number(
//           driver.total_trips
//         ) || 0,

//       languages:
//         driver.languages ||
//         [],

//       specialty:
//         driver.specialty ||
//         "",

//       phone:
//         driver.phone ||
//         "",

//       photo:
//         driver.photo ||
//         "",

//       verifiedSince:
//         driver.verified_since ||
//         "",

//       trustScore:
//         Number(
//           driver.trust_score
//         ) || 0,

//       status:
//         driver.status ||
//         "verified"
//     };

//     console.log(
//       "[Verida] Handshake saved successfully:",
//       data
//     );

//     if (
//       typeof confetti ===
//       "function"
//     ) {
//       confetti({
//         particleCount: 50,
//         spread: 60,
//         origin: {
//           y: 0.7
//         }
//       });
//     }

//     if (
//       typeof callback ===
//       "function"
//     ) {
//       callback({
//         ...data,

//         // UI-friendly camelCase
//         guideId:
//           data.guide_id,

//         travelerId:
//           data.traveler_id,

//         guideName:
//           data.guide_name,

//         travelerName:
//           data.traveler_name,

//         monumentName:
//           data.monument_name,

//         distanceMeters:
//           data.distance_meters,

//         tokenHash:
//           data.token_hash,

//         guidePhone:
//           driver.phone,

//         guidePhoto:
//           driver.photo,

//         guideVehicleRegNo:
//           driver.vehicle_reg_no,

//         guideVehicleType:
//           driver.vehicle_type,

//         guideVehicleModel:
//           driver.vehicle_model,

//         guideLicenseNo:
//           driver.license_no,

//         guideRtoLicenseNo:
//           driver.license_no,

//         guideRating:
//           driver.rating,

//         guideTrustScore:
//           driver.trust_score,

//         guideEncounterCount:
//           driver.encounter_count,

//         guideIssuer:
//           driver.issuer,

//         guideGovtIssuer:
//           driver.govt_issuer ||
//           driver.issuer,

//         guideCategory:
//           driver.category,

//         guideAadharNo:
//           driver.aadhar_no
//       });
//     }

//     return {
//       ...data,

//       guideId:
//         data.guide_id,

//       travelerId:
//         data.traveler_id,

//       guideName:
//         data.guide_name,

//       travelerName:
//         data.traveler_name,

//       monumentName:
//         data.monument_name,

//       distanceMeters:
//         data.distance_meters,

//       tokenHash:
//         data.token_hash,

//       guidePhone:
//         driver.phone,

//       guidePhoto:
//         driver.photo,

//       guideVehicleRegNo:
//         driver.vehicle_reg_no,

//       guideVehicleType:
//         driver.vehicle_type,

//       guideVehicleModel:
//         driver.vehicle_model,

//       guideLicenseNo:
//         driver.license_no,

//       guideRtoLicenseNo:
//         driver.license_no,

//       guideRating:
//         driver.rating,

//       guideTrustScore:
//         driver.trust_score,

//       guideEncounterCount:
//         driver.encounter_count,

//       guideIssuer:
//         driver.issuer,

//       guideGovtIssuer:
//         driver.govt_issuer ||
//         driver.issuer,

//       guideCategory:
//         driver.category,

//       guideAadharNo:
//         driver.aadhar_no
//     };
//   }

//   // ============================================================
//   // DEMO / SIMULATION
//   // ============================================================

//   async simulateLiveHandshake(
//     callback = null
//   ) {
//     const driver =
//       store.activeGuide || {};

//     const location =
//       store.currentLocation || {};

//     const token = {
//       veridaProtocol: "1.0",

//       type: "HANDSHAKE_AUTH",

//       guideId:
//         driver.id ||
//         driver.uid,

//       city:
//         store.currentCityId ||
//         driver.city ||
//         "vadodara",

//       lat:
//         Number(location.lat) || 0,

//       lng:
//         Number(location.lng) || 0,

//       timestamp:
//         Date.now(),

//       expiresAt:
//         Date.now() +
//         this.qrValidityDuration *
//           1000,

//       nonce:
//         globalThis.crypto?.randomUUID?.() ||
//         Math.random()
//           .toString(36)
//           .substring(2, 10),

//       signature:
//         "VERIDA-DEMO"
//     };

//     return this.processScannedPayload(
//       token,
//       callback
//     );
//   }

//   generateTokenHash() {
//     const value =
//       globalThis.crypto?.randomUUID?.() ||
//       `${Date.now()}-${Math.random()}`;

//     return value
//       .replaceAll("-", "")
//       .substring(0, 32);
//   }
// }

// export const digitalHandshake =
//   new DigitalHandshake();