/**
 * Verida — State Store & Data Repository
 * Coordinates reactive state, city benchmarks, handshakes, price pulses, reviews, and GPS coordinates.
 */

import { supabase } from "./supabaseClient.js";
import { hybridStore } from "./firebase-config.js";
import {
  SEED_CITIES,
  SEED_MONUMENTS,
  SEED_HOTSPOTS,
  SEED_GUIDES,
  SEED_DRIVERS,
  SEED_ROUTES,
  SEED_PRICE_PULSES,
  SEED_HANDSHAKES,
  SEED_REVIEWS
} from "../data/seedData.js";

class Store {
  constructor() {
    this.currentCityId = "vadodara"; // Default to Vadodara
    this.currentRole = "traveler"; // 'traveler' or 'guide'
    this.currentLocation = {
      lat: 22.2937, // Laxmi Vilas Palace default
      lng: 73.1916,
      name: "Laxmi Vilas Palace, Vadodara",
      fromLocation: "", // Fix: Explicit From location
      toLocation: "",
      accuracy: 5
    };
    this.isSimulatedGps = true;
    this.activeUser = {
      uid: "trv_devanshi_01",
      name: "Devanshi Sharma",
      phone: "+91 98765 43210",
      origin: "Tourist / Vadodara, Gujarat",
      emergencyContact: "Family (+91 98765 11223)",
      role: "traveler",
      photo: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80"
    };
    this.activeGuide = {
      uid: "driver-vad-001",
      id: "driver-vad-001",
      name: "Mehul Bhai Solanki",
      phone: "+91 94260 55321",
      licenseNo: "GJ-06-2018-009124",
      badgeNo: "VAD-AUTO-772",
      vehicleRegNo: "GJ-06-AU-7892",
      vehicleType: "Green CNG Auto-Rickshaw",
      issuer: "Vadodara RTO & Police Tourist Syndicate",
      category: "Auto-Rickshaw Transit",
      city: "vadodara",
      rating: 4.92,
      encounterCount: 640,
      specialty: "Vadodara City Transit & Gaekwad Heritage",
      photo: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80"
    };

    this.loadSavedProfiles();
    this.initSeedData();
  }

  // --- Trip Preferences & Personalized Recommendation Engine ---
  saveTripPreferences(prefs) {
    if (!this.activeUser) return;
    this.activeUser.tripPreferences = {
      tripType: prefs.tripType || "Family Trip",
      interests: prefs.interests || ["Food", "History & Culture", "Nature"],
      withChildren: prefs.withChildren || "No",
      hotelBooked: Boolean(prefs.hotelBooked),
      updatedAt: new Date().toISOString()
    };
    localStorage.setItem("verida_user_profile", JSON.stringify(this.activeUser));

    // Optional Supabase synchronization
    try {
      if (supabase && typeof supabase.from === "function") {
        supabase.from("trip_preferences").upsert({
          passenger_id: this.activeUser.uid || this.activeUser.phone,
          trip_type: this.activeUser.tripPreferences.tripType,
          interests: this.activeUser.tripPreferences.interests,
          with_children: this.activeUser.tripPreferences.withChildren,
          hotel_booked: this.activeUser.tripPreferences.hotelBooked,
          updated_at: this.activeUser.tripPreferences.updatedAt
        }).catch(err => console.warn("[Verida Supabase] trip_preferences sync offline:", err));
      }
    } catch (e) {
      console.warn("[Verida Store] Supabase sync skipped:", e);
    }
    return this.activeUser.tripPreferences;
  }

  getTripPreferences() {
    return this.activeUser?.tripPreferences || null;
  }

  calculatePlaceScore(place, userLoc) {
    const prefs = this.getTripPreferences();
    if (!prefs || !prefs.tripType) {
      return { totalScore: 50, explanation: "", matchingFactors: [] };
    }

    let tripMatchScore = 0;
    let interestScore = 0;
    let childScore = 0;
    let distanceScore = 0;
    const matchingFactors = [];

    // 1. Trip Type Match (+40 pts)
    const tripType = prefs.tripType;
    const typeMap = {
      "Family Trip": ["family", "Family", "Parks", "Zoo", "Museum", "Heritage"],
      "Business Trip": ["business", "Business", "Hotel", "Station", "Airport"],
      "Solo Trip": ["solo", "Solo", "Market", "Heritage", "Temples", "Food"],
      "Couple Trip": ["couple", "Couple", "Palace", "Gardens", "Nature", "Heritage"],
      "Friends Trip": ["friends", "Friends", "Food", "Shopping", "Day Trips", "Market"],
      "Cultural / Heritage Trip": ["cultural", "Heritage", "Monuments", "Museum", "Temples"],
      "Adventure / Nature Trip": ["adventure", "Nature", "Gardens", "Park", "Day Trips"]
    };

    const typeKeywords = typeMap[tripType] || [];
    let isTripMatch = false;
    if (place.scores && place.scores[typeKeywords[0] + "_score"] > 50) isTripMatch = true;
    if (typeKeywords.some(k => (place.category || "").toLowerCase().includes(k.toLowerCase()) || (place.typeLabel || "").toLowerCase().includes(k.toLowerCase()))) isTripMatch = true;

    if (isTripMatch) {
      tripMatchScore = 40;
      matchingFactors.push(tripType.replace(" Trip", ""));
    }

    // 2. Matching Interests (+10 pts per matching interest, max +30 cap)
    const userInterests = prefs.interests || [];
    let matchedInterestsCount = 0;
    const interestMap = {
      "Food": ["Food", "Restaurant", "Café", "Dining", "Bazaar"],
      "Shopping": ["Shopping", "Market", "Bazaar", "Textile", "Handicrafts"],
      "History & Culture": ["History", "Culture", "Heritage", "Museum", "Palace", "Mandir"],
      "Nature": ["Nature", "Gardens", "Park", "Zoo", "Lake"],
      "Entertainment": ["Entertainment", "Zoo", "Park", "Cinema", "Activities"],
      "Local Experiences": ["Local", "Walking", "Market", "Gate", "Bazaar"]
    };

    userInterests.forEach(interest => {
      const keywords = interestMap[interest] || [interest];
      let match = false;
      if (keywords.some(k => (place.category || "").toLowerCase().includes(k.toLowerCase()) || (place.highlights || "").toLowerCase().includes(k.toLowerCase()) || (place.description || "").toLowerCase().includes(k.toLowerCase()))) {
        match = true;
      }
      if (place.scores && keywords.some(k => place.scores[k.toLowerCase() + "_score"] > 50)) match = true;

      if (match) {
        matchedInterestsCount++;
        matchingFactors.push(interest);
      }
    });

    interestScore = Math.min(matchedInterestsCount * 10, 30);

    // 3. Child Friendly Match (+20 pts)
    if (prefs.withChildren === "Yes" && place.child_friendly) {
      childScore = 20;
      matchingFactors.push("Child Friendly");
    }

    // 4. Distance Proximity Score (+0 to +20 pts)
    const dist = place.distKm || 0;
    if (dist < 2) distanceScore = 20;
    else if (dist < 5) distanceScore = 15;
    else if (dist < 10) distanceScore = 10;
    else if (dist < 20) distanceScore = 5;
    else distanceScore = 0;

    const totalScore = tripMatchScore + interestScore + childScore + distanceScore;

    // Formulate explainable recommendation text
    let explanation = "";
    if (matchingFactors.length > 0) {
      explanation = `${matchingFactors.slice(0, 3).join(" • ")} Match`;
    } else if (distanceScore >= 15) {
      explanation = "Nearby Landmark";
    } else {
      explanation = "Recommended";
    }

    return { totalScore, explanation, matchingFactors };
  }

loadSavedProfiles() {
    try {
      const savedUser = localStorage.getItem("verida_user_profile");
      if (savedUser) this.activeUser = { ...this.activeUser, ...JSON.parse(savedUser) };
      
      const savedGuide = localStorage.getItem("verida_guide_profile");
      if (savedGuide) this.activeGuide = { ...this.activeGuide, ...JSON.parse(savedGuide) };
    } catch (e) {
      console.warn("[Verida Store] Profile load error:", e);
    }
  }
  setFromLocation(fromName, coords = null) {
    this.currentLocation.fromLocation = fromName;
    if (coords) {
      this.currentLocation.lat = coords.lat;
      this.currentLocation.lng = coords.lng;
    }
    console.log("[Verida Store] Explicit From Location updated:", fromName);
    this._notifyLocationChange();
  }

  setToLocation(toName) {
    this.currentLocation.toLocation = toName;
    console.log("[Verida Store] Explicit To Location updated:", toName);
    this._notifyLocationChange();
  }

  setRouteLocations(fromName, toName) {
    this.currentLocation.fromLocation = fromName;
    this.currentLocation.toLocation = toName;
    console.log(`[Verida Store] Explicit Route set: ${fromName} ➔ ${toName}`);
    this._notifyLocationChange();
  }

  _notifyLocationChange() {
    if (typeof window !== "undefined" && window.veridaApp?.renderApp) {
      window.veridaApp.renderApp();
    }
  }

  registerPassenger(profile) {
    this.activeUser = {
      ...this.activeUser,
      ...profile,
      uid: `trv_${Date.now()}`
    };
    localStorage.setItem("verida_user_profile", JSON.stringify(this.activeUser));
    return this.activeUser;
  }

  registerDriver(profile) {
    const existingId = this.activeGuide.id || this.activeGuide.uid || `driver_${Date.now()}`;
    this.activeGuide = {
      ...this.activeGuide,
      ...profile,
      uid: existingId,
      id: existingId
    };
    localStorage.setItem("verida_guide_profile", JSON.stringify(this.activeGuide));
    return this.activeGuide;
  }

  clearPassengerSession() {
    this.activeUser = { uid: "", name: "", phone: "", origin: "", emergency: "", role: "traveler" };
    localStorage.removeItem("verida_user_profile");
  }

  clearDriverSession() {
    this.activeGuide = { uid: "", id: "", name: "", phone: "", role: "guide" };
    localStorage.removeItem("verida_guide_profile");
  }

  initSeedData(forceReset = false) {
    const existingMonuments = hybridStore.getCollection("monuments") || [];
    const existingHotspots = hybridStore.getCollection("hotspots") || [];
    const existingRoutes = hybridStore.getCollection("routes") || [];

    // Map existing monuments by ID
    const monumentMap = new Map(existingMonuments.map(m => [m.id, m]));
    let needsSave = forceReset || existingMonuments.length < SEED_MONUMENTS.length || existingHotspots.length < SEED_HOTSPOTS.length || existingRoutes.length === 0;

    // Merge SEED_MONUMENTS into existing collection so updated place properties (dayInfo, nightInfo, imageUrl, etc.) are always present
    const updatedMonuments = SEED_MONUMENTS.map(seedMon => {
      const existing = monumentMap.get(seedMon.id);
      if (!existing) {
        needsSave = true;
        return seedMon;
      }
      // Always update seed properties while retaining user-added runtime flags if any
      return { ...existing, ...seedMon };
    });

    // Merge SEED_HOTSPOTS so image URLs and latest fields are active
    const hotspotMap = new Map(existingHotspots.map(h => [h.id, h]));
    const updatedHotspots = SEED_HOTSPOTS.map(seedH => {
      const existing = hotspotMap.get(seedH.id);
      if (!existing) return seedH;
      return { ...existing, ...seedH };
    });

    if (needsSave || updatedMonuments.length !== existingMonuments.length || !existingMonuments.some(m => m.id === "vad-grand-mercure") || !existingHotspots.some(h => h.imageUrl)) {
      hybridStore.saveCollection("monuments", updatedMonuments);
      hybridStore.saveCollection("hotspots", updatedHotspots);
      hybridStore.saveCollection("guides", SEED_GUIDES);
      hybridStore.saveCollection("drivers", SEED_DRIVERS);
      hybridStore.saveCollection("routes", SEED_ROUTES);
      hybridStore.saveCollection("pricePulse", SEED_PRICE_PULSES);
      hybridStore.saveCollection("handshakes", SEED_HANDSHAKES);
      hybridStore.saveCollection("reviews", SEED_REVIEWS);
      console.log("[Verida Store] Seed data refreshed with complete place objects.");
    }
  }

  // --- City & Location Accessors ---
  getCities() {
    return SEED_CITIES;
  }

  getCurrentCity() {
    return SEED_CITIES[this.currentCityId] || SEED_CITIES.vadodara;
  }

setCity(cityId) {
    if (SEED_CITIES[cityId]) {
      this.currentCityId = cityId;
      const city = SEED_CITIES[cityId];
      
      this.currentLocation = {
        ...this.currentLocation,
        lat: city.center.lat,
        lng: city.center.lng,
        name: `${city.name} City Center`
        // Note: fromLocation and toLocation are NOT overwritten automatically here
      };

      const cityGuides = this.getGuidesForCity(cityId);
      if (cityGuides.length > 0) {
        this.activeGuide = {  ...cityGuides[0], uid: cityGuides[0].id };
      }
    }
        
      // Force UI updates if app instance exists
      if (typeof window !== "undefined" && window.veridaApp?.renderApp) {
        window.veridaApp.renderApp();
      }
}
  

  getMonumentsForCity(cityId = this.currentCityId) {
    const all = hybridStore.getCollection("monuments");
    return all.filter(m => m.city === cityId);
  }

  getHotspotsForCity(cityId = this.currentCityId) {
    const all = hybridStore.getCollection("hotspots");
    return all.filter(h => h.city === cityId);
  }

  getGuidesForCity(cityId = this.currentCityId) {
    const all = hybridStore.getCollection("guides");
    return all.filter(g => g.city === cityId);
  }

  // Enhanced Guide Lookup across both guides and drivers
  getGuideById(guideId) {
    if (!guideId) return this.activeGuide;
    const guides = hybridStore.getCollection("guides") || [];
    const drivers = hybridStore.getCollection("drivers") || [];
    const allEntities = [...guides, ...drivers];

    const found = allEntities.find(g => 
      g.id === guideId || 
      g.uid === guideId || 
      g.licenseNo === guideId || 
      g.vehicleRegNo === guideId ||
      g.phone === guideId
    );
    if (found) return found;

    if (
      this.activeGuide && (
        this.activeGuide.id === guideId ||
        this.activeGuide.uid === guideId ||
        this.activeGuide.vehicleRegNo === guideId ||
        this.activeGuide.phone === guideId ||
        this.activeGuide.licenseNo === guideId
      )
    ) {
      return this.activeGuide;
    }

    return null;
  }

  getDriverById(driverId) {
    return this.getGuideById(driverId);
  }

  // --- Handshakes Ledger ---
  getHandshakes() {
    return hybridStore.getCollection("handshakes");
  }

async recordHandshake(handshakeData = {}) {

  const handshakeRecord = {

    guide_id:
      handshakeData.guideId,

    traveler_id:
      handshakeData.travelerId,

    guide_name:
      handshakeData.guideName,

    traveler_name:
      handshakeData.travelerName,

    timestamp:
      Number(handshakeData.timestamp) || Date.now(),

    status:
      "verified",

    agreed_price:
      handshakeData.agreedPrice ?? null,

    token_hash:
      handshakeData.tokenHash ?? null,

    monument_id:
      handshakeData.monumentId ?? null,

    monument_name:
      handshakeData.monumentName ?? null,

    city:
      handshakeData.city ?? this.currentCityId,

    lat:
      Number(handshakeData.lat),

    lng:
      Number(handshakeData.lng),

    distance_meters:
      Number(handshakeData.distanceMeters)
  };


  console.log(
    "[Verida] Saving handshake to Supabase:",
    handshakeRecord
  );


  const { data, error } =
    await supabase
      .from("handshakes")
      .insert([handshakeRecord])
      .select("*")
      .single();


  if (error) {

    console.error(
      "[Verida DB] Handshake insert failed:",
      error
    );

    throw error;
  }


  console.log(
    "[Verida DB] Handshake saved:",
    data
  );


  return data;
}

hasHandshakeWithGuide(guideId, travelerId = this.activeUser.uid) {
    const handshakes = this.getHandshakes();
    if (!handshakes || handshakes.length === 0) return false;

    const targetGuide = this.getGuideById(guideId);
    const targetName = targetGuide?.name || targetGuide?.guideName || guideId;
    const targetVehicle = targetGuide?.vehicleRegNo;

    return handshakes.some(h => {
      // Match Driver / Guide
      const matchesGuide = 
        h.guideId === guideId ||
        h.guideId === targetGuide?.id ||
        h.guideId === targetGuide?.uid ||
        (targetName && h.guideName === targetName) ||
        (targetVehicle && h.vehicleRegNo === targetVehicle);

      // Match Passenger / User
      const matchesUser = 
        h.travelerId === travelerId ||
        h.travelerId === this.activeUser.uid ||
        h.passengerName === this.activeUser.name ||
        h.travelerName === this.activeUser.name ; // Any completed handshake with this guide unlocks access

      return matchesGuide && matchesUser;
    });
  }

  // --- Price Pulse Engine ---
  getPricePulses(cityId = this.currentCityId) {
    const pulses = hybridStore.getCollection("pricePulse");
    if (!cityId) return pulses;
    return pulses.filter(p => p.city === cityId);
  }

  async recordPricePulse(pulseData) {
    return await hybridStore.addDocument("pricePulse", {
      ...pulseData,
      city: pulseData.city || this.currentCityId,
      createdAt: Date.now()
    });
  }

  getFairRateBenchmark(monumentId, serviceCategory = "Official Guide") {
    const monuments = hybridStore.getCollection("monuments");
    const mon = monuments.find(m => m.id === monumentId);
    if (!mon || !mon.fairRates) {
      return { min: 100, median: 250, max: 500, unit: "standard" };
    }

    for (const [key, rate] of Object.entries(mon.fairRates)) {
      if (key.toLowerCase().includes(serviceCategory.toLowerCase()) || serviceCategory.toLowerCase().includes(key.toLowerCase())) {
        return { key, ...rate };
      }
    }

    const firstKey = Object.keys(mon.fairRates)[0];
    return { key: firstKey, ...mon.fairRates[firstKey] };
  }

  // --- Proof-of-Presence Reviews ---
  getReviewsForGuide(guideId) {
    const all = hybridStore.getCollection("reviews") || [];
    if (!guideId) return all;

    const target = this.getGuideById(guideId) || this.activeGuide;
    const vehicleRegNo = target?.vehicleRegNo;
    const driverPhone = target?.phone;
    const driverName = target?.name;

    return all.filter(r => 
      r.guideId === guideId || 
      r.driverId === guideId ||
      (target?.id && (r.guideId === target.id || r.driverId === target.id)) ||
      (target?.uid && (r.guideId === target.uid || r.driverId === target.uid)) ||
      (vehicleRegNo && r.vehicleRegNo === vehicleRegNo) ||
      (driverPhone && r.driverPhone === driverPhone) ||
      (driverName && r.driverName === driverName)
    );
  }

  async recordReview(reviewData) {
    const newDoc = await hybridStore.addDocument("reviews", {
      ...reviewData,
      presenceVerified: true,
      createdAt: Date.now()
    });
    return newDoc;
  }

  // Alias helper for reviews.js compatibility
  async addReview(reviewData) {
    return await this.recordReview(reviewData);
  }

  // --- Transit Routes & Last 3 Passengers Paid ---
  getRoutesForCity(cityId = this.currentCityId) {
    const all = hybridStore.getCollection("routes");
    const filtered = all.filter(r => r.city === cityId);
    return filtered.length > 0 ? filtered : SEED_ROUTES.filter(r => r.city === "vadodara");
  }

  getDriversForCity(cityId = this.currentCityId) {
    const all = hybridStore.getCollection("drivers");
    const filtered = all.filter(d => d.city === cityId);
    return filtered.length > 0 ? filtered : SEED_DRIVERS;
  }

 async recordDigitalFootprint(footprintData) {
    const activeDriver = this.activeGuide || this.activeDriver;
    
    const enrichedFootprint = {
      id: `fp_${Date.now()}`,
      passengerName: footprintData.passengerName || this.activeUser.name,
      driverId: footprintData.driverId || activeDriver?.id || activeDriver?.uid,
      driverName: footprintData.driverName || activeDriver?.name,
      vehicleRegNo: footprintData.vehicleRegNo || activeDriver?.vehicleRegNo || "GJ-06-AU-7892",
      route: footprintData.route || "Vadodara Transit Route",
      amountPaid: footprintData.amountPaid || footprintData.fare || 50,
      footprintHash: footprintData.footprintHash || `0x${Math.random().toString(16).substring(2, 10)}`,
      timestamp: Date.now(),
      createdAt: new Date().toISOString(),
      ...footprintData
    };

    return await hybridStore.addDocument("digitalFootprints", enrichedFootprint);
  }

  getDigitalFootprints() {
    return hybridStore.getCollection("digitalFootprints") || [];
  }

  
  // --- Incidents & SOS ---
  async recordIncident(incidentData) {
    return await hybridStore.addDocument("incidents", {
      ...incidentData,
      timestamp: Date.now(),
      status: "forwarded_to_police"
    });
  }

  getIncidents() {
    return hybridStore.getCollection("incidents") || [];
  }
}

export const store = new Store();

/**
 * Verida — State Store & Data Repository
 * Coordinates reactive state, city benchmarks, handshakes, price pulses, reviews, and GPS coordinates.
 */

// 

/**
 * Verida — Supabase State Store & Data Repository
 *
 * Supabase = primary database
 * localStorage = only for temporary UI/profile state
 *
 * Main tables used:
 * cities
 * drivers
 * guides
 * monuments
 * hotspots
 * routes
 * handshakes
 * reviews
 * price_pulses
 * passengers
 */

// import { supabase } from "./supabaseClient.js";

// import {
//   SEED_CITIES,
//   SEED_MONUMENTS,
//   SEED_HOTSPOTS,
//   SEED_GUIDES,
//   SEED_DRIVERS,
//   SEED_ROUTES,
//   SEED_PRICE_PULSES,
//   SEED_HANDSHAKES,
//   SEED_REVIEWS
// } from "../data/seedData.js";


// class Store {

//   constructor() {

//     // ---------------------------------------------------------
//     // BASIC APP STATE
//     // ---------------------------------------------------------

//     this.currentCityId = "vadodara";
//     this.currentRole = "traveler";

//     this.currentLocation = {
//       lat: 22.2937,
//       lng: 73.1916,
//       name: "Laxmi Vilas Palace, Vadodara",
//       fromLocation: "",
//       toLocation: "",
//       accuracy: 5
//     };

//     this.isSimulatedGps = true;


//     // ---------------------------------------------------------
//     // DEFAULT PASSENGER
//     // ---------------------------------------------------------

//     this.activeUser = {
//       uid: "trv_devanshi_01",
//       name: "Devanshi Sharma",
//       phone: "+91 98765 43210",
//       origin: "Tourist / Vadodara, Gujarat",
//       emergencyContact: "Family (+91 98765 11223)",
//       role: "traveler",
//       photo:
//         "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80"
//     };


//     // ---------------------------------------------------------
//     // DEFAULT DRIVER
//     // ---------------------------------------------------------

//     this.activeGuide = {
//       uid: "driver-vad-001",
//       id: "driver-vad-001",

//       name: "Mehul Bhai Solanki",

//       phone: "+91 94260 55321",

//       licenseNo: "GJ-06-2018-009124",

//       badgeNo: "VAD-AUTO-772",

//       vehicleRegNo: "GJ-06-AU-7892",

//       vehicleType: "Green CNG Auto-Rickshaw",

//       issuer: "Vadodara RTO & Police Tourist Syndicate",

//       category: "Auto-Rickshaw Transit",

//       city: "vadodara",

//       rating: 4.92,

//       trustScore: 98,

//       encounterCount: 640,

//       specialty: "Vadodara City Transit & Gaekwad Heritage",

//       photo:
//         "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80"
//     };


//     // ---------------------------------------------------------
//     // LOCAL CACHE
//     //
//     // This cache prevents existing synchronous UI functions
//     // from throwing "is not a function" or undefined errors.
//     //
//     // Supabase remains the real database.
//     // ---------------------------------------------------------

//     this.cache = {
//       cities: [],
//       monuments: [],
//       hotspots: [],
//       guides: [],
//       drivers: [],
//       routes: [],
//       price_pulses: [],
//       handshakes: [],
//       reviews: []
//     };


//     // Load saved browser profile.
//     this.loadSavedProfiles();

//     // Start database synchronization.
//     this.initializeDatabase();

//   }


//   // =========================================================
//   // INITIALIZATION
//   // =========================================================

//   async initializeDatabase() {

//     try {

//       console.log("[Verida Store] Connecting to Supabase...");

//       await this.refreshAll();

//       console.log("[Verida Store] Supabase data loaded successfully.");

//       // Refresh UI after database data arrives.
//       this.notifyApp();

//     } catch (error) {

//       console.error(
//         "[Verida Store] Supabase initialization failed:",
//         error
//       );

//       // Do NOT crash the whole application.
//       // Seed data is used only as UI fallback.
//       this.loadSeedFallback();

//       this.notifyApp();
//     }

//   }


//   // =========================================================
//   // LOAD ALL IMPORTANT DATA FROM SUPABASE
//   // =========================================================

//   async refreshAll() {

//     const results = await Promise.allSettled([

//       this.refreshCities(),

//       this.refreshMonuments(),

//       this.refreshHotspots(),

//       this.refreshDrivers(),

//       this.refreshGuides(),

//       this.refreshRoutes(),

//       this.refreshPricePulses(),

//       this.refreshHandshakes(),

//       this.refreshReviews()

//     ]);


//     results.forEach((result, index) => {

//       if (result.status === "rejected") {

//         console.warn(
//           `[Verida Store] Database section ${index} failed:`,
//           result.reason
//         );

//       }

//     });

//   }


//   // =========================================================
//   // FALLBACK DATA
//   // =========================================================

//   loadSeedFallback() {

//     try {

//       if (SEED_CITIES) {

//         if (Array.isArray(SEED_CITIES)) {

//           this.cache.cities = SEED_CITIES;

//         } else {

//           this.cache.cities = Object.values(SEED_CITIES);

//         }

//       }

//       this.cache.monuments =
//         Array.isArray(SEED_MONUMENTS)
//           ? SEED_MONUMENTS
//           : [];

//       this.cache.hotspots =
//         Array.isArray(SEED_HOTSPOTS)
//           ? SEED_HOTSPOTS
//           : [];

//       this.cache.guides =
//         Array.isArray(SEED_GUIDES)
//           ? SEED_GUIDES
//           : [];

//       this.cache.drivers =
//         Array.isArray(SEED_DRIVERS)
//           ? SEED_DRIVERS
//           : [];

//       this.cache.routes =
//         Array.isArray(SEED_ROUTES)
//           ? SEED_ROUTES
//           : [];

//       this.cache.price_pulses =
//         Array.isArray(SEED_PRICE_PULSES)
//           ? SEED_PRICE_PULSES
//           : [];

//       this.cache.handshakes =
//         Array.isArray(SEED_HANDSHAKES)
//           ? SEED_HANDSHAKES
//           : [];

//       this.cache.reviews =
//         Array.isArray(SEED_REVIEWS)
//           ? SEED_REVIEWS
//           : [];

//       console.log("[Verida Store] Seed fallback loaded.");

//     } catch (error) {

//       console.error(
//         "[Verida Store] Seed fallback failed:",
//         error
//       );

//     }

//   }


//   // =========================================================
//   // PROFILE STORAGE
//   // =========================================================

//   loadSavedProfiles() {

//     try {

//       const savedUser =
//         localStorage.getItem("verida_user_profile");

//       if (savedUser) {

//         this.activeUser = {
//           ...this.activeUser,
//           ...JSON.parse(savedUser)
//         };

//       }


//       const savedGuide =
//         localStorage.getItem("verida_guide_profile");

//       if (savedGuide) {

//         this.activeGuide = {
//           ...this.activeGuide,
//           ...JSON.parse(savedGuide)
//         };

//       }

//     } catch (error) {

//       console.warn(
//         "[Verida Store] Profile loading failed:",
//         error
//       );

//     }

//   }


//   // =========================================================
//   // APP/UI NOTIFICATION
//   // =========================================================

//   notifyApp() {

//     try {

//       if (
//         typeof window !== "undefined" &&
//         window.veridaApp &&
//         typeof window.veridaApp.renderApp === "function"
//       ) {

//         window.veridaApp.renderApp();

//       }

//     } catch (error) {

//       console.warn(
//         "[Verida Store] UI refresh failed:",
//         error
//       );

//     }

//   }


//   // =========================================================
//   // LOCATION
//   // =========================================================

//   setFromLocation(fromName, coords = null) {

//     this.currentLocation.fromLocation =
//       fromName || "";

//     if (coords) {

//       this.currentLocation.lat =
//         Number(coords.lat) || this.currentLocation.lat;

//       this.currentLocation.lng =
//         Number(coords.lng) || this.currentLocation.lng;

//     }

//     this.notifyApp();

//   }


//   setToLocation(toName) {

//     this.currentLocation.toLocation =
//       toName || "";

//     this.notifyApp();

//   }


//   setRouteLocations(fromName, toName) {

//     this.currentLocation.fromLocation =
//       fromName || "";

//     this.currentLocation.toLocation =
//       toName || "";

//     this.notifyApp();

//   }


//   // =========================================================
//   // CITY
//   // =========================================================

//   getCities() {

//     if (this.cache.cities.length > 0) {

//       return this.cache.cities;

//     }

//     if (Array.isArray(SEED_CITIES)) {

//       return SEED_CITIES;

//     }

//     return Object.values(SEED_CITIES || {});

//   }


//   getCurrentCity() {

//     const cities = this.getCities();

//     let city = null;


//     if (Array.isArray(cities)) {

//       city = cities.find(
//         c =>
//           c.id === this.currentCityId ||
//           c.city === this.currentCityId
//       );

//     }


//     if (!city && SEED_CITIES?.[this.currentCityId]) {

//       city = SEED_CITIES[this.currentCityId];

//     }


//     return (
//       city || {
//         id: this.currentCityId,
//         name: this.currentCityId,
//         center: {
//           lat: this.currentLocation.lat,
//           lng: this.currentLocation.lng
//         },
//         zoom: 13
//       }
//     );

//   }


//   async refreshCities() {

//     const { data, error } =
//       await supabase
//         .from("cities")
//         .select("*");

//     if (error) {

//       console.error(
//         "[Verida] Cities load failed:",
//         error
//       );

//       throw error;

//     }

//     this.cache.cities =
//       Array.isArray(data) ? data : [];

//     return this.cache.cities;

//   }


//   async setCity(cityId) {

//     if (!cityId) return;

//     this.currentCityId = cityId;


//     const city = this.getCurrentCity();


//     if (city?.center) {

//       this.currentLocation.lat =
//         Number(city.center.lat) ||
//         this.currentLocation.lat;

//       this.currentLocation.lng =
//         Number(city.center.lng) ||
//         this.currentLocation.lng;

//       this.currentLocation.name =
//         `${city.name || cityId} City Center`;

//     }


//     const cityDrivers =
//       this.getDriversForCity(cityId);

//     if (cityDrivers.length > 0) {

//       this.activeGuide = {
//         ...this.activeGuide,
//         ...cityDrivers[0],
//         id: cityDrivers[0].id,
//         uid: cityDrivers[0].id,

//         licenseNo:
//           cityDrivers[0].license_no ||
//           cityDrivers[0].licenseNo,

//         vehicleRegNo:
//           cityDrivers[0].vehicle_reg_no ||
//           cityDrivers[0].vehicleRegNo,

//         trustScore:
//           cityDrivers[0].trust_score ??
//           cityDrivers[0].trustScore ??
//           0
//       };

//     }


//     this.notifyApp();

//   }


//   // =========================================================
//   // MONUMENTS
//   // =========================================================

//   getMonumentsForCity(
//     cityId = this.currentCityId
//   ) {

//     const all = this.cache.monuments || [];

//     return all.filter(
//       monument =>
//         monument.city === cityId
//     );

//   }


//   async refreshMonuments() {

//     const { data, error } =
//       await supabase
//         .from("monuments")
//         .select("*");

//     if (error) {

//       console.error(
//         "[Verida] Monuments load failed:",
//         error
//       );

//       throw error;

//     }

//     this.cache.monuments =
//       Array.isArray(data) ? data : [];

//     return this.cache.monuments;

//   }


//   // =========================================================
//   // HOTSPOTS
//   // =========================================================

//   getHotspotsForCity(
//     cityId = this.currentCityId
//   ) {

//     const all = this.cache.hotspots || [];

//     return all.filter(
//       hotspot =>
//         hotspot.city === cityId
//     );

//   }


//   async refreshHotspots() {

//     const { data, error } =
//       await supabase
//         .from("hotspots")
//         .select("*");

//     if (error) {

//       console.error(
//         "[Verida] Hotspots load failed:",
//         error
//       );

//       throw error;

//     }

//     this.cache.hotspots =
//       Array.isArray(data) ? data : [];

//     return this.cache.hotspots;

//   }


//   // =========================================================
//   // GUIDES
//   // =========================================================

//   getGuidesForCity(
//     cityId = this.currentCityId
//   ) {

//     const all = this.cache.guides || [];

//     return all.filter(
//       guide =>
//         guide.city === cityId
//     );

//   }


//   async refreshGuides() {

//     const { data, error } =
//       await supabase
//         .from("guides")
//         .select("*");

//     if (error) {

//       console.warn(
//         "[Verida] Guides table load warning:",
//         error
//       );

//       // Do not stop application.
//       this.cache.guides = [];

//       return [];

//     }

//     this.cache.guides =
//       Array.isArray(data) ? data : [];

//     return this.cache.guides;

//   }


//   // =========================================================
//   // DRIVER LOOKUP
//   // =========================================================

//   getGuideById(guideId) {

//     if (!guideId) {

//       return this.activeGuide;

//     }


//     const drivers =
//       this.cache.drivers || [];

//     const guides =
//       this.cache.guides || [];


//     const allEntities = [
//       ...guides,
//       ...drivers
//     ];


//     const found =
//       allEntities.find(entity => {

//         return (

//           entity.id === guideId ||

//           entity.uid === guideId ||

//           entity.guide_id === guideId ||

//           entity.driver_id === guideId ||

//           entity.license_no === guideId ||

//           entity.licenseNo === guideId ||

//           entity.vehicle_reg_no === guideId ||

//           entity.vehicleRegNo === guideId

//         );

//       });


//     if (found) {

//       return found;

//     }


//     if (
//       this.activeGuide?.id === guideId ||
//       this.activeGuide?.uid === guideId
//     ) {

//       return this.activeGuide;

//     }


//     return null;

//   }


//   getDriverById(driverId) {

//     return this.getGuideById(driverId);

//   }


//   async getDriverFromDatabase(driverId) {

//     if (!driverId) {

//       return this.activeGuide;

//     }


//     const { data, error } =
//       await supabase
//         .from("drivers")
//         .select("*")
//         .eq("id", driverId)
//         .maybeSingle();


//     if (error) {

//       console.error(
//         "[Verida] Driver lookup failed:",
//         error
//       );

//       return null;

//     }


//     if (data) {

//       this.updateDriverCache(data);

//     }


//     return data;

//   }


//   updateDriverCache(driver) {

//     if (!driver?.id) return;


//     const index =
//       this.cache.drivers.findIndex(
//         d => d.id === driver.id
//       );


//     if (index >= 0) {

//       this.cache.drivers[index] = {
//         ...this.cache.drivers[index],
//         ...driver
//       };

//     } else {

//       this.cache.drivers.push(driver);

//     }

//   }


//   async refreshDrivers() {

//     const { data, error } =
//       await supabase
//         .from("drivers")
//         .select("*");

//     if (error) {

//       console.error(
//         "[Verida] Drivers load failed:",
//         error
//       );

//       throw error;

//     }


//     this.cache.drivers =
//       Array.isArray(data) ? data : [];


//     return this.cache.drivers;

//   }


//   getDriversForCity(
//     cityId = this.currentCityId
//   ) {

//     const all =
//       this.cache.drivers || [];


//     return all.filter(
//       driver =>
//         driver.city === cityId
//     );

//   }


//   // =========================================================
//   // REGISTER PASSENGER
//   // =========================================================

//   async registerPassenger(profile = {}) {

//     this.activeUser = {

//       ...this.activeUser,

//       ...profile,

//       uid:
//         profile.uid ||
//         this.activeUser.uid ||
//         `trv_${Date.now()}`

//     };


//     localStorage.setItem(
//       "verida_user_profile",
//       JSON.stringify(this.activeUser)
//     );


//     const passengerRow = {

//       id: this.activeUser.uid,

//       name:
//         this.activeUser.name || null,

//       phone:
//         this.activeUser.phone || null,

//       origin:
//         this.activeUser.origin || null,

//       emergency:
//         this.activeUser.emergency ||
//         this.activeUser.emergencyContact ||
//         null

//     };


//     console.log(
//       "[Verida] Saving passenger:",
//       passengerRow
//     );


//     const { data, error } =
//       await supabase
//         .from("passengers")
//         .upsert(
//           passengerRow,
//           {
//             onConflict: "id"
//           }
//         )
//         .select()
//         .maybeSingle();


//     if (error) {

//       console.error(
//         "[Verida] Passenger save failed:",
//         error
//       );

//       throw error;

//     }


//     console.log(
//       "[Verida] Passenger saved:",
//       data
//     );


//     return data || this.activeUser;

//   }


//   // =========================================================
//   // REGISTER DRIVER
//   // =========================================================

//   async registerDriver(profile = {}) {

//     const existingId =

//       profile.id ||

//       profile.uid ||

//       this.activeGuide.id ||

//       this.activeGuide.uid ||

//       `driver_${Date.now()}`;


//     this.activeGuide = {

//       ...this.activeGuide,

//       ...profile,

//       id: existingId,

//       uid: existingId

//     };


//     localStorage.setItem(
//       "verida_guide_profile",
//       JSON.stringify(this.activeGuide)
//     );


//     /*
//      * IMPORTANT:
//      * These are the columns visible in your Supabase
//      * drivers table.
//      */

//     const driverRow = {

//       id: existingId,

//       name:
//         this.activeGuide.name || null,

//       city:
//         this.activeGuide.city ||
//         this.currentCityId,

//       category:
//         this.activeGuide.category || null,

//       license_no:
//         this.activeGuide.licenseNo ||
//         this.activeGuide.license_no ||
//         null,

//       issuer:
//         this.activeGuide.issuer || null,

//       experience_years:
//         Number(
//           this.activeGuide.experienceYears ??
//           this.activeGuide.experience_years ??
//           0
//         ),

//       rating:
//         Number(
//           this.activeGuide.rating ?? 0
//         ),

//       encounter_count:
//         Number(
//           this.activeGuide.encounterCount ??
//           this.activeGuide.encounter_count ??
//           0
//         ),

//       languages:
//         this.activeGuide.languages || [],

//       specialty:
//         this.activeGuide.specialty || null,

//       phone:
//         this.activeGuide.phone || null,

//       photo:
//         this.activeGuide.photo || null,

//       verified_since:
//         this.activeGuide.verifiedSince ||
//         this.activeGuide.verified_since ||
//         null,

//       trust_score:
//         Number(
//           this.activeGuide.trustScore ??
//           this.activeGuide.trust_score ??
//           0
//         ),

//       status:
//         this.activeGuide.status ||
//         "active"

//     };


//     console.log(
//       "[Verida] Saving driver to Supabase:",
//       driverRow
//     );


//     const { data, error } =
//       await supabase
//         .from("drivers")
//         .upsert(
//           driverRow,
//           {
//             onConflict: "id"
//           }
//         )
//         .select()
//         .maybeSingle();


//     if (error) {

//       console.error(
//         "[Verida] Driver save failed:",
//         error
//       );

//       throw error;

//     }


//     if (data) {

//       this.updateDriverCache(data);

//       this.activeGuide = {
//         ...this.activeGuide,
//         ...data,

//         licenseNo:
//           data.license_no,

//         trustScore:
//           data.trust_score,

//         encounterCount:
//           data.encounter_count

//       };

//     }


//     console.log(
//       "[Verida] Driver saved successfully:",
//       data
//     );


//     return data || this.activeGuide;

//   }


//   // =========================================================
//   // HANDSHAKES
//   // =========================================================

//   getHandshakes() {

//     return this.cache.handshakes || [];

//   }


//   async refreshHandshakes() {

//     const { data, error } =
//       await supabase
//         .from("handshakes")
//         .select("*")
//         .order(
//           "timestamp",
//           {
//             ascending: false
//           }
//         );


//     if (error) {

//       console.error(
//         "[Verida] Handshakes load failed:",
//         error
//       );

//       throw error;

//     }


//     this.cache.handshakes =
//       Array.isArray(data) ? data : [];


//     return this.cache.handshakes;

//   }


//   async recordHandshake(handshakeData = {}) {

//     const guideId =
//       handshakeData.guideId ||
//       handshakeData.driverId ||
//       this.activeGuide?.id ||
//       this.activeGuide?.uid ||
//       null;


//     const travelerId =
//       handshakeData.travelerId ||
//       handshakeData.passengerId ||
//       this.activeUser?.uid ||
//       null;


//     const handshakeRecord = {

//       id:
//         handshakeData.id ||
//         `hs_${Date.now()}`,

//       guide_id:
//         guideId,

//       traveler_id:
//         travelerId,

//       guide_name:
//         handshakeData.guideName ||
//         handshakeData.driverName ||
//         this.activeGuide?.name ||
//         null,

//       traveler_name:
//         handshakeData.travelerName ||
//         handshakeData.passengerName ||
//         this.activeUser?.name ||
//         null,

//       monument_id:
//         handshakeData.monumentId ||
//         null,

//       monument_name:
//         handshakeData.monumentName ||
//         null,

//       city:
//         handshakeData.city ||
//         this.currentCityId,

//       lat:
//         Number(
//           handshakeData.lat ??
//           this.currentLocation.lat
//         ),

//       lng:
//         Number(
//           handshakeData.lng ??
//           this.currentLocation.lng
//         ),

//       distance_meters:
//         handshakeData.distanceMeters ??
//         handshakeData.distance_meters ??
//         handshakeData.physicalProximity ??
//         null,

//       timestamp:
//         Number(
//           handshakeData.timestamp
//         ) || Date.now(),

//       status:
//         "verified",

//       agreed_price:
//         handshakeData.agreedPrice ??
//         handshakeData.agreed_price ??
//         null,

//       token_hash:
//         handshakeData.tokenHash ||
//         handshakeData.token_hash ||
//         null

//     };


//     console.log(
//       "[Verida] Saving handshake:",
//       handshakeRecord
//     );


//     const { data, error } =
//       await supabase
//         .from("handshakes")
//         .insert([handshakeRecord])
//         .select()
//         .single();


//     if (error) {

//       console.error(
//         "[Verida] Handshake insert failed:",
//         error
//       );

//       throw error;

//     }


//     this.cache.handshakes.unshift(data);


//     console.log(
//       "[Verida] Handshake saved successfully:",
//       data
//     );


//     this.notifyApp();


//     return data;

//   }


//   hasHandshakeWithGuide(
//     guideId,
//     travelerId = this.activeUser?.uid
//   ) {

//     if (!guideId) return false;


//     const handshakes =
//       this.getHandshakes();


//     const targetGuide =
//       this.getGuideById(guideId);


//     const targetName =
//       targetGuide?.name ||
//       guideId;


//     return handshakes.some(handshake => {

//       const handshakeGuide =
//         handshake.guide_id ||
//         handshake.guideId;


//       const handshakeTraveler =
//         handshake.traveler_id ||
//         handshake.travelerId;


//       const matchesGuide =

//         handshakeGuide === guideId ||

//         handshakeGuide ===
//         targetGuide?.id ||

//         handshakeGuide ===
//         targetGuide?.uid ||

//         handshake.guide_name ===
//         targetName;


//       const matchesTraveler =

//         handshakeTraveler ===
//         travelerId ||

//         handshakeTraveler ===
//         this.activeUser?.uid ||

//         handshake.traveler_name ===
//         this.activeUser?.name;


//       return (
//         matchesGuide &&
//         matchesTraveler
//       );

//     });

//   }


//   // =========================================================
//   // REVIEWS
//   // =========================================================

//   async refreshReviews() {

//     const { data, error } =
//       await supabase
//         .from("reviews")
//         .select("*")
//         .order(
//           "timestamp",
//           {
//             ascending: false
//           }
//         );


//     if (error) {

//       console.error(
//         "[Verida] Reviews load failed:",
//         error
//       );

//       throw error;

//     }


//     this.cache.reviews =
//       Array.isArray(data) ? data : [];


//     return this.cache.reviews;

//   }


//   getReviewsForGuide(guideId) {

//     const all =
//       this.cache.reviews || [];


//     if (!guideId) {

//       return all;

//     }


//     const target =
//       this.getGuideById(guideId);


//     const targetId =
//       target?.id ||
//       target?.uid ||
//       guideId;


//     return all.filter(review => {

//       const reviewGuide =
//         review.guide_id ||
//         review.guideId;


//       return (

//         reviewGuide === guideId ||

//         reviewGuide === targetId

//       );

//     });

//   }


//   async recordReview(reviewData = {}) {

//     const guideId =

//       reviewData.guideId ||

//       reviewData.driverId ||

//       reviewData.guide_id ||

//       this.activeGuide?.id ||

//       this.activeGuide?.uid ||

//       null;


//     const row = {

//       id:
//         reviewData.id ||
//         `rev_${Date.now()}`,

//       handshake_id:
//         reviewData.handshakeId ||
//         reviewData.handshake_id ||
//         null,

//       guide_id:
//         guideId,

//       traveler_name:
//         reviewData.travelerName ||
//         reviewData.passengerName ||
//         reviewData.traveler_name ||
//         this.activeUser?.name ||
//         null,

//       rating:
//         Number(
//           reviewData.rating
//         ) || 0,

//       monument_name:
//         reviewData.monumentName ||
//         reviewData.monument_name ||
//         null,

//       presence_verified:
//         reviewData.presenceVerified !== false,

//       timestamp:
//         Number(
//           reviewData.timestamp
//         ) || Date.now(),

//       comment:
//         reviewData.comment ||
//         ""

//     };


//     console.log(
//       "[Verida] Saving review:",
//       row
//     );


//     const { data, error } =
//       await supabase
//         .from("reviews")
//         .insert([row])
//         .select()
//         .single();


//     if (error) {

//       console.error(
//         "[Verida] Review insert failed:",
//         error
//       );

//       throw error;

//     }


//     this.cache.reviews.unshift(data);


//     // ---------------------------------------------------------
//     // Update driver rating/trust statistics
//     // ---------------------------------------------------------

//     if (guideId) {

//       await this.recalculateDriverRating(
//         guideId
//       );

//     }


//     console.log(
//       "[Verida] Review saved successfully:",
//       data
//     );


//     this.notifyApp();


//     return data;

//   }


//   async addReview(reviewData = {}) {

//     return await this.recordReview(
//       reviewData
//     );

//   }


//   // =========================================================
//   // DRIVER RATING CALCULATION
//   // =========================================================

//   async recalculateDriverRating(driverId) {

//     if (!driverId) return null;


//     const { data: reviews, error } =
//       await supabase
//         .from("reviews")
//         .select("rating")
//         .eq("guide_id", driverId);


//     if (error) {

//       console.warn(
//         "[Verida] Driver rating calculation failed:",
//         error
//       );

//       return null;

//     }


//     const validRatings =
//       (reviews || [])

//         .map(r =>
//           Number(r.rating)
//         )

//         .filter(
//           rating =>
//             Number.isFinite(rating) &&
//             rating >= 0 &&
//             rating <= 5
//         );


//     if (validRatings.length === 0) {

//       return null;

//     }


//     const average =

//       validRatings.reduce(
//         (sum, rating) =>
//           sum + rating,
//         0
//       ) / validRatings.length;


//     const roundedRating =
//       Math.round(
//         average * 100
//       ) / 100;


//     /*
//      * Keep trust score in 0–100 range.
//      *
//      * 5-star rating -> 100 trust
//      */

//     const trustScore =
//       Math.round(
//         (roundedRating / 5) * 100
//       );


//     const { data, error: updateError } =
//       await supabase
//         .from("drivers")
//         .update({

//           rating:
//             roundedRating,

//           encounter_count:
//             validRatings.length,

//           trust_score:
//             trustScore

//         })
//         .eq("id", driverId)
//         .select()
//         .maybeSingle();


//     if (updateError) {

//       console.warn(
//         "[Verida] Driver rating update failed:",
//         updateError
//       );

//       return null;

//     }


//     if (data) {

//       this.updateDriverCache(data);

//     }


//     return data;

//   }


//   // =========================================================
//   // ROUTES
//   // =========================================================

//   getRoutesForCity(
//     cityId = this.currentCityId
//   ) {

//     const routes =
//       this.cache.routes || [];


//     const filtered =
//       routes.filter(
//         route =>
//           route.city === cityId
//       );


//     if (filtered.length > 0) {

//       return filtered;

//     }


//     // UI fallback only.
//     return (SEED_ROUTES || [])
//       .filter(
//         route =>
//           route.city === cityId
//       );

//   }


//   async refreshRoutes() {

//     const { data, error } =
//       await supabase
//         .from("routes")
//         .select("*");


//     if (error) {

//       console.error(
//         "[Verida] Routes load failed:",
//         error
//       );

//       throw error;

//     }


//     this.cache.routes =
//       Array.isArray(data) ? data : [];


//     return this.cache.routes;

//   }


//   // =========================================================
//   // PRICE PULSES
//   // =========================================================

//   getPricePulses(
//     cityId = this.currentCityId
//   ) {

//     const all =
//       this.cache.price_pulses || [];


//     if (!cityId) {

//       return all;

//     }


//     return all.filter(
//       pulse =>
//         pulse.city === cityId
//     );

//   }


//   async refreshPricePulses() {

//     const { data, error } =
//       await supabase
//         .from("price_pulses")
//         .select("*")
//         .order(
//           "created_at",
//           {
//             ascending: false
//           }
//         );


//     if (error) {

//       console.error(
//         "[Verida] Price pulses load failed:",
//         error
//       );

//       throw error;

//     }


//     this.cache.price_pulses =
//       Array.isArray(data)
//         ? data
//         : [];


//     return this.cache.price_pulses;

//   }


//   async recordPricePulse(
//     pulseData = {}
//   ) {

//     const row = {

//       id:
//         pulseData.id ||
//         `pulse_${Date.now()}`,

//       monumentId:
//         pulseData.monumentId ||
//         pulseData.monument_id ||
//         null,

//       city:
//         pulseData.city ||
//         this.currentCityId,

//       service_type:
//         pulseData.serviceType ||
//         pulseData.service_type ||
//         null,

//       service_category:
//         pulseData.serviceCategory ||
//         pulseData.service_category ||
//         null,

//       amount:
//         Number(
//           pulseData.amount
//         ) || 0,

//       range_tag:
//         pulseData.rangeTag ||
//         pulseData.range_tag ||
//         null,

//       guide_id:
//         pulseData.guideId ||
//         pulseData.guide_id ||
//         null,

//       guide_name:
//         pulseData.guideName ||
//         pulseData.guide_name ||
//         null,

//       traveler_name:
//         pulseData.travelerName ||
//         pulseData.traveler_name ||
//         this.activeUser?.name ||
//         null,

//       minutes_ago:
//         Number(
//           pulseData.minutesAgo ??
//           pulseData.minutes_ago ??
//           0
//         ),

//       created_at:
//         Number(
//           pulseData.createdAt ??
//           pulseData.created_at
//         ) || Date.now(),

//       location_label:
//         pulseData.locationLabel ||
//         pulseData.location_label ||
//         null

//     };


//     console.log(
//       "[Verida] Saving price pulse:",
//       row
//     );


//     const { data, error } =
//       await supabase
//         .from("price_pulses")
//         .insert([row])
//         .select()
//         .single();


//     if (error) {

//       console.error(
//         "[Verida] Price pulse insert failed:",
//         error
//       );

//       throw error;

//     }


//     this.cache.price_pulses.unshift(
//       data
//     );


//     this.notifyApp();


//     return data;

//   }


//   // =========================================================
//   // FAIR RATE BENCHMARK
//   // =========================================================

//   getFairRateBenchmark(
//     monumentId,
//     serviceCategory = "Official Guide"
//   ) {

//     const monuments =
//       this.cache.monuments || [];


//     const monument =
//       monuments.find(
//         m =>
//           m.id === monumentId
//       );


//     if (
//       !monument ||
//       !monument.fair_rates &&
//       !monument.fairRates
//     ) {

//       return {

//         min: 100,

//         median: 250,

//         max: 500,

//         unit: "standard"

//       };

//     }


//     const fairRates =
//       monument.fair_rates ||
//       monument.fairRates;


//     for (
//       const [key, rate]
//       of Object.entries(fairRates)
//     ) {

//       if (

//         key
//           .toLowerCase()
//           .includes(
//             serviceCategory.toLowerCase()
//           )

//         ||

//         serviceCategory
//           .toLowerCase()
//           .includes(
//             key.toLowerCase()
//           )

//       ) {

//         return {

//           key,

//           ...rate

//         };

//       }

//     }


//     const firstKey =
//       Object.keys(fairRates)[0];


//     return {

//       key: firstKey,

//       ...fairRates[firstKey]

//     };

//   }


//   // =========================================================
//   // DIGITAL FOOTPRINT
//   // =========================================================

//   /*
//    * Your screenshots did not show a digitalFootprints
//    * Supabase table.
//    *
//    * Therefore this method checks the table and reports
//    * the database error instead of silently pretending
//    * that the data was saved.
//    */

//   async recordDigitalFootprint(
//     footprintData = {}
//   ) {

//     const activeDriver =
//       this.activeGuide;


//     const row = {

//       id:
//         footprintData.id ||
//         `fp_${Date.now()}`,

//       passenger_name:
//         footprintData.passengerName ||
//         this.activeUser?.name ||
//         null,

//       driver_id:
//         footprintData.driverId ||
//         activeDriver?.id ||
//         activeDriver?.uid ||
//         null,

//       driver_name:
//         footprintData.driverName ||
//         activeDriver?.name ||
//         null,

//       vehicle_reg_no:
//         footprintData.vehicleRegNo ||
//         activeDriver?.vehicleRegNo ||
//         null,

//       route:
//         footprintData.route ||
//         "Vadodara Transit Route",

//       amount_paid:
//         Number(
//           footprintData.amountPaid ??
//           footprintData.fare ??
//           50
//         ),

//       footprint_hash:
//         footprintData.footprintHash ||
//         `0x${Math.random()
//           .toString(16)
//           .substring(2, 10)}`,

//       timestamp:
//         Number(
//           footprintData.timestamp
//         ) || Date.now(),

//       created_at:
//         footprintData.createdAt ||
//         new Date().toISOString()

//     };


//     const { data, error } =
//       await supabase
//         .from("digitalFootprints")
//         .insert([row])
//         .select()
//         .single();


//     if (error) {

//       console.error(
//         "[Verida] Digital footprint insert failed:",
//         error
//       );

//       throw error;

//     }


//     return data;

//   }


//   async getDigitalFootprints() {

//     const { data, error } =
//       await supabase
//         .from("digitalFootprints")
//         .select("*")
//         .order(
//           "timestamp",
//           {
//             ascending: false
//           }
//         );


//     if (error) {

//       console.error(
//         "[Verida] Digital footprint load failed:",
//         error
//       );

//       return [];

//     }


//     return data || [];

//   }


//   // =========================================================
//   // INCIDENTS / SOS
//   // =========================================================

//   async recordIncident(
//     incidentData = {}
//   ) {

//     const row = {

//       ...incidentData,

//       timestamp:
//         Number(
//           incidentData.timestamp
//         ) || Date.now(),

//       status:
//         "forwarded_to_police"

//     };


//     const { data, error } =
//       await supabase
//         .from("incidents")
//         .insert([row])
//         .select()
//         .single();


//     if (error) {

//       console.error(
//         "[Verida] Incident insert failed:",
//         error
//       );

//       throw error;

//     }


//     return data;

//   }


//   async getIncidents() {

//     const { data, error } =
//       await supabase
//         .from("incidents")
//         .select("*")
//         .order(
//           "timestamp",
//           {
//             ascending: false
//           }
//         );


//     if (error) {

//       console.error(
//         "[Verida] Incidents load failed:",
//         error
//       );

//       return [];

//     }


//     return data || [];

//   }


//   // =========================================================
//   // DISTANCE CALCULATION
//   // =========================================================

//   calculateDistance(
//     lat1,
//     lng1,
//     lat2,
//     lng2
//   ) {

//     const R = 6371000;


//     const dLat =
//       (Number(lat2) - Number(lat1)) *
//       Math.PI / 180;


//     const dLng =
//       (Number(lng2) - Number(lng1)) *
//       Math.PI / 180;


//     const a =

//       Math.sin(dLat / 2) *
//       Math.sin(dLat / 2)

//       +

//       Math.cos(
//         Number(lat1) *
//         Math.PI / 180
//       )

//       *

//       Math.cos(
//         Number(lat2) *
//         Math.PI / 180
//       )

//       *

//       Math.sin(dLng / 2) *
//       Math.sin(dLng / 2);


//     const c =
//       2 *
//       Math.atan2(
//         Math.sqrt(a),
//         Math.sqrt(1 - a)
//       );


//     return R * c;

//   }


//   // =========================================================
//   // DATABASE HEALTH CHECK
//   // =========================================================

//   async testDatabaseConnection() {

//     try {

//       const { data, error } =
//         await supabase
//           .from("cities")
//           .select("id")
//           .limit(1);


//       if (error) {

//         console.error(
//           "[Verida] Supabase connection test failed:",
//           error
//         );

//         return false;

//       }


//       console.log(
//         "[Verida] Supabase connection OK:",
//         data
//       );


//       return true;

//     } catch (error) {

//       console.error(
//         "[Verida] Supabase connection exception:",
//         error
//       );

//       return false;

//     }

//   }

// }


// // =============================================================
// // SINGLE STORE INSTANCE
// // =============================================================

// export const store = new Store();