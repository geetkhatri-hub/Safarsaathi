# 🛡️ Verida
## On-the-Spot Tourism & Transit Trust Protocol

> Turning uncertain street-level tourism interactions into verified, data-backed transactions.

[🌐 **LIVE DEMO**](https://verida-alpha.vercel.app/) ·
[📄 **SIH 2026 PDF**](./Verida_SIH2026_TemplateBased.pdf) ·
[📊 **SIH 2026 PPTX**](./Verida_SIH2026_TemplateBased.pptx)

---

## 🌐 Live Demo

### [Open Verida Prototype →](https://verida-alpha.vercel.app/)

The current prototype demonstrates:

- 🔐 Digital Handshake & QR verification
- 💰 Route Fare Intelligence
- 📍 Scam Hotspot Radar
- 🚕 Driver / Guide Verification
- 🧾 Proof-of-Presence Ledger
- 🆘 Tourist Safety / SOS Evidence Dossier
- 📱 Responsive mobile interface

> **Note:** This is currently a temporary Vercel deployment for demonstration and evaluation.

---

## 📄 SIH 2026 Submission

| Resource | Link |
|---|---|
| 🌐 **Live Prototype** | [Open Demo](https://verida-alpha.vercel.app/) |
| 📄 **SIH 2026 Idea Presentation – PDF** | [View / Download PDF](./Verida_SIH2026_TemplateBased.pdf) |
| 📊 **SIH 2026 Idea Presentation – PPTX** | [Download PPTX](./Verida_SIH2026_TemplateBased.pptx) |

---

# 🚀 About Verida

Verida is a real-time tourism safety and trust platform designed for situations where travelers interact with unknown drivers, guides, and local service providers on the spot, without advance booking.

## Core Idea

> **Verify who you meet. Know what you should pay. Understand the local risk. Create proof if something goes wrong.**

---

# 🎯 Problem

Tourists can face uncertainty during spontaneous local interactions:

- ❌ Unknown driver or guide identity
- ❌ Unclear or inflated fares
- ❌ Tourist-targeted scams and touts
- ❌ Limited trust in real-world reviews
- ❌ Difficulty documenting disputes
- ❌ Limited support during an emergency

Verida brings verification, pricing context, location awareness, encounter records and incident evidence into one platform.

---

# 💡 Proposed Solution

## 🔐 1. Digital Handshake

Passengers can verify a driver or guide using a GPS-linked rotating QR code.

The prototype uses a verification flow involving:

- Driver / guide identity
- Vehicle / license information
- GPS proximity
- Timestamp
- Short-lived rotating QR tokens
- Verified encounter records

This is designed to convert an anonymous interaction into a verifiable encounter.

---

## 💰 2. Route Fare Intelligence

Verida provides route-level pricing context using recent passenger payment data.

### Example

**Vadodara Railway Station → Laxmi Vilas Palace**

```text
Recent payments:
₹100 • ₹90 • ₹100

Fair benchmark:
₹80–₹100
```

This helps passengers identify potentially unreasonable quotes before accepting a ride.

---

## 📍 3. Scam Hotspot Radar

Verida identifies locations with known scam or tout activity and provides proactive safety information.

The prototype includes examples such as:

- Railway station tout zones
- Fake guide locations
- Overcharging hotspots
- Tourist-targeted ticket scams
- Unofficial service providers

---

## 🧾 4. Proof-of-Presence Ledger

Instead of relying only on anonymous reviews, Verida connects reputation with a verified encounter.

```text
Passenger
    ↓
Driver / Guide
    ↓
Location
    ↓
Timestamp
    ↓
Verification Token
    ↓
Review / Encounter Record
```

This creates a stronger basis for trust.

---

## 🆘 5. Tourist Safety SOS

When an incident occurs, Verida can generate a structured evidence dossier containing information such as:

- Incident category
- Suspected operator
- License / vehicle information
- Location
- Quoted price
- Incident description
- Available verification evidence

The goal is to make an incident easier to document and report.

---

# 🛠️ Technology Stack

## Frontend

- HTML5
- CSS3
- JavaScript ES Modules

## APIs & Libraries

- Google Maps JavaScript API
- QRCode.js
- html5-qrcode
- Tesseract.js
- Canvas Confetti

## Backend / Deployment

- Node.js
- Firebase Hosting
- Cloud Firestore
- Firestore Security Rules

---

# 🧠 How It Works

```text
        TOURIST ARRIVES
              ↓
        Select Route
              ↓
     Check Fare Intelligence
              ↓
       Scan Driver QR
              ↓
  Verify Identity + Proximity
              ↓
      DIGITAL HANDSHAKE
              ↓
         Ride / Service
              ↓
      Review + Ledger Entry
              ↓
       SOS IF REQUIRED
```

---

# 🔄 Passenger Flow

```text
Open Verida
     ↓
GPS / Location
     ↓
Route Selection
     ↓
Fare Benchmark
     ↓
Driver Verification
     ↓
Verified Encounter
     ↓
Trip / Service
     ↓
Review
```

---

# 🚕 Driver / Guide Flow

```text
Register Profile
      ↓
Vehicle / License Details
      ↓
Generate Rotating QR
      ↓
Passenger Scans QR
      ↓
Identity / Proximity Check
      ↓
Verified Encounter
      ↓
Trust Ledger
```

---

# 🌍 Prototype Coverage

The current prototype contains tourism and safety seed data for:

- 🇮🇳 Vadodara, Gujarat
- 🇮🇳 Agra, Uttar Pradesh
- 🇮🇳 Delhi NCR
- 🇮🇳 Jaipur, Rajasthan

The dataset includes:

- Tourism locations
- Transit routes
- Fare benchmarks
- Recent passenger payment examples
- Verified guides
- Scam hotspots
- Price-pulse examples

---

# 🧪 Example Scenario

### Vadodara Railway Station → Laxmi Vilas Palace

A tourist is quoted:

```text
₹450
```

The prototype compares this against a fair benchmark:

```text
₹80–₹120
```

The traveler can then:

```text
Check fare
   ↓
Verify driver
   ↓
Accept / reject ride
   ↓
Record encounter
```

---

# ✨ Innovation

## What makes Verida different?

### Traditional travel platforms

```text
BOOK → TRAVEL → REVIEW
```

### Verida

```text
MEET → VERIFY → CHECK PRICE → TRAVEL → PROVE
```

Verida focuses on **unbooked, real-world interactions** where conventional booking-based trust mechanisms may not apply.

### Key innovations

- 🔐 Short-lived rotating verification QR
- 📍 Location-aware verification
- 💰 Real-world fare intelligence
- 🧾 Proof-of-presence reputation
- 🚨 Scam hotspot awareness
- 🆘 Structured incident evidence

---

# 📊 Feasibility

## MVP Feasibility: High

The prototype demonstrates the main user-facing flows.

### Existing prototype capabilities

- Responsive web application
- Passenger mode
- Driver / Guide mode
- QR verification flow
- Route fare interface
- Hotspot radar
- Encounter ledger
- SOS workflow
- Dual-screen presentation mode
- Multi-city seed data

### Production Roadmap

The next stage would add:

- Secure backend synchronization
- Production authentication
- Live government/RTO verification
- Real-time data pipelines
- Stronger privacy controls
- Scalable cloud infrastructure

---

# ⚠️ Challenges & Risks

### Data Accuracy
Incorrect fare or hotspot information could reduce user trust.

### Privacy
Verida may process identity, location and incident-related information.

### Driver Adoption
Informal drivers may be hesitant to register.

### Connectivity
Tourists may experience poor network coverage.

### Identity Fraud
Stolen credentials or QR sharing could create false verification.

### Government Integration
Official verification requires cooperation with relevant authorities.

---

# 🛡️ Mitigation Strategies

- Use rotating, short-lived QR tokens
- Combine QR + GPS + timestamp signals
- Introduce data-confidence and moderation systems
- Minimize personal data collection
- Apply secure backend authorization
- Provide a zero-app / plate-based driver flow
- Partner with tourism departments and transport authorities
- Design for offline-tolerant operation

---

# 🌱 Impact

## 👥 Social

- Safer tourism experiences
- Greater confidence for travelers
- Better accountability

## 💰 Economic

- Reduces tourist overcharging
- Supports legitimate local drivers and guides
- Builds trust in local tourism services

## 🧳 Tourism

- Improves visitor experience
- Encourages responsible tourism
- Strengthens destination reputation

## 🚨 Safety

- Faster identity verification
- Proactive scam awareness
- Better incident documentation

---

# 🔮 Future Scope

### Phase 1
Expand the pilot to major Indian tourist destinations.

### Phase 2
Integrate official RTO / tourism verification systems.

### Phase 3
Introduce AI-assisted:

- Scam detection
- Fare anomaly detection
- Risk prediction
- Incident classification

### Phase 4
Create dashboards for:

- Tourism authorities
- Tourist police
- Transport operators
- Verified service providers

### Long-Term Vision

> **Build India's trusted digital safety layer for spontaneous tourism interactions.**

---

# 📚 Research & References

1. **Ministry of Tourism, Government of India**  
   India Tourism Data & Tourism Data Compendium  
   https://data.tourism.gov.in/

2. **UN Tourism**  
   International Code for the Protection of Tourists  
   https://www.unwto.org/

3. **Government of India**  
   Digital Personal Data Protection Act, 2023  
   https://www.indiacode.nic.in/

4. **OWASP**  
   Mobile Application Security  
   https://mas.owasp.org/

5. **Google Maps Platform**  
   Maps JavaScript API  
   https://developers.google.com/maps/documentation/javascript

6. **Firebase**  
   Cloud Firestore Security Rules  
   https://firebase.google.com/docs/firestore/security/get-started

---

# 📁 Project Structure

```text
Verida/
│
├── index.html
├── app.js
├── authManager.js
├── seedData.js
├── server.js
│
├── main.css
├── components.css
├── responsive.css
│
├── firebase.json
├── firestore.rules
├── package.json
│
├── Verida_SIH2026_TemplateBased.pdf
├── Verida_SIH2026_TemplateBased.pptx
│
└── README.md
```

> Some supporting application modules referenced by `app.js` are not included in the current uploaded source set. The repository should therefore be treated as a **SIH 2026 prototype/demo**, not as a final production deployment.

---

# ▶️ Run Locally

### 1. Clone the repository

```bash
git clone https://github.com/YOUR-USERNAME/verida-tourism-trust.git
cd verida-tourism-trust
```

### 2. Install dependencies

```bash
npm install
```

### 3. Start the application

```bash
npm start
```

### 4. Open in your browser

```text
http://localhost:3000
```

### Hotel photo AI review

The **Add Hotel / Area Photo** flow now sends a resized image to the server-side
`/api/analyze-hotel-photo` endpoint. The browser never receives or stores the
provider key, and a photo cannot be approved into the local evidence gallery
unless the AI endpoint returns a completed review.

Configure the server with a Replit Secret or deployment environment variable:

```text
OPENAI_API_KEY=your-server-side-key
VERIDA_VISION_MODEL=gpt-4.1-mini
```

The default local server and the Vercel serverless handler use the same
validation rules, request-size limit, timeout, and safe error responses. If the
secret is not configured, the UI reports that honestly and does not save the
photo as approved evidence.

---

# 📌 SIH 2026

**Event:** Smart India Hackathon 2026  
**Project:** Verida  
**Category:** Software  
**Theme:** Travel & Tourism  
**Team Name:** FLUX
**Problem Statement ID:** YOUR PS ID  
**Problem Statement Title:** YOUR PS TITLE

---

# 🔗 Important Links

### 🌐 Live Prototype
https://verida-alpha.vercel.app/

### 📄 SIH 2026 Presentation – PDF
[Verida SIH 2026 PDF](./Verida_SIH2026_TemplateBased.pdf)

### 📊 SIH 2026 Presentation – PPTX
[Verida SIH 2026 PPTX](./Verida_SIH2026_TemplateBased.pptx)

---

# 👥 Team

**Team Name:** YOUR TEAM NAME

**Team Members:**

- Member 1 — Role
- Member 2 — Role
- Member 3 — Role
- Member 4 — Role
- Member 5 — Role
- Member 6 — Role

---

## ⭐ Verida in One Sentence

> **Verida transforms uncertain, street-level tourism interactions into verified, transparent and safer experiences.**
