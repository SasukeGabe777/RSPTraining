/**
 * RSP TRAINING PORTAL — MODULE MANIFEST
 * ============================================================
 * The hub still behaves like the original portal, but each card
 * now routes into a generic training launcher / quiz flow instead
 * of directly opening the legacy lesson HTML module.
 *
 * Legacy lesson modules are preserved under `legacy/portal-v1/`.
 * ============================================================
 */

// ============================================================
// TRAINING HUBS — top-level tracks. Every module/category below
// belongs to exactly one hub via its `hub` field. Modules/categories
// written before this field existed are Product Mastery content, so
// every entry below is explicitly tagged (no implicit defaults here) —
// but any code reading a module/category without a `hub` field should
// still treat it as "product_mastery" for backward compatibility.
// ============================================================
window.RSP_HUBS = {
  product_mastery: {
    id: "product_mastery",
    label: "Product Training Mastery",
    shortLabel: "Product Mastery",
    description: "Build product knowledge through category-based training modules, quizzes, mastery checkpoints, and product-specific learning paths.",
    route: "product-mastery.html",
    icon: "📦",
    accent: "#D07A46"
  },
  onboarding: {
    id: "onboarding",
    label: "New Employee Onboarding",
    shortLabel: "Onboarding",
    description: "Start here for company expectations, internal systems, workflows, policies, procedures, culture, and role-specific onboarding.",
    route: "onboarding.html",
    icon: "🧭",
    accent: "#4D7898",
    // Onboarding has no manually-curated prerequisite graph like Product
    // Mastery does — instead it's a straight checklist: admins set the
    // order (module_config.sort_order) and each module locks until the
    // one before it (in that order) is completed. See effectivePrerequisite().
    sequentialLock: true
  }
};

window.RSP_MANIFEST = {
  brand: {
    name: "RSP Industrial",
    portalTitle: "Training Portal",
    tagline: "Your path from new hire to sales master.",
    primaryColor: "#E57225"
  },

  categories: [
    { id: "Basics", icon: "⚡", color: "#D07A46", hub: "product_mastery" },
    { id: "Enclosures", icon: "📦", color: "#38BDF8", hub: "product_mastery" },
    { id: "Motors & Motor Control", icon: "⚙️", color: "#F97316", hub: "product_mastery" },
    { id: "Circuit Protection & Isolation", icon: "🧯", color: "#EF4444", hub: "product_mastery" },
    { id: "Panel Building & Mechanical Support", icon: "🧱", color: "#22C55E", hub: "product_mastery" },
    { id: "Power Conversion & Power Supplies", icon: "🔋", color: "#8B5CF6", hub: "product_mastery" },
    { id: "Relays & Control Relays", icon: "🔁", color: "#14B8A6", hub: "product_mastery" },
    { id: "Terminal Blocks & Connections", icon: "🔌", color: "#0EA5E9", hub: "product_mastery" },
    { id: "Automation & Control Systems", icon: "🤖", color: "#6366F1", hub: "product_mastery" },
    { id: "Solar Power & DC Power Systems", icon: "☀️", color: "#EAB308", hub: "product_mastery" },
    { id: "Industrial Communications", icon: "📡", color: "#06B6D4", hub: "product_mastery" },
    { id: "Structual & Framing Systems", label: "Structural & Framing Systems", icon: "🏗️", color: "#64748B", hub: "product_mastery" },
    { id: "Surge Protections", label: "Surge Protection", icon: "⚡", color: "#FB7185", hub: "product_mastery" },
    { id: "Energy Storage", icon: "🔋", color: "#10B981", hub: "product_mastery" },
    { id: "Wire, Cable & Connectivity", icon: "🪢", color: "#F59E0B", hub: "product_mastery" },
    { id: "Plugs, Receptacles & Interface Power", icon: "🔌", color: "#F97316", hub: "product_mastery" },
    { id: "Operator Interface & Signaling Devices", icon: "🎛️", color: "#A855F7", hub: "product_mastery" },
    { id: "Instrumentation & Sensing", icon: "📏", color: "#0EA5E9", hub: "product_mastery" },
    { id: "Industrial Lighting", icon: "💡", color: "#EAB308", hub: "product_mastery" },
    { id: "Industrial Networking", icon: "🌐", color: "#3B82F6", hub: "product_mastery" },
    { id: "Surveillance & Security", icon: "📷", color: "#EF4444", hub: "product_mastery" },
    { id: "Power Distribution & Metering", icon: "📊", color: "#22C55E", hub: "product_mastery" },
    { id: "Temperature & Process Measurement", icon: "🌡️", color: "#F97316", hub: "product_mastery" },
    { id: "Energy & Electrical Measurement", icon: "📈", color: "#14B8A6", hub: "product_mastery" },
    { id: "Logistics & Operations", icon: "📦", color: "#8B5CF6", hub: "product_mastery" },
    { id: "Safety & Compliance", icon: "🛡️", color: "#EF4444", hub: "product_mastery" },

    // ── New Employee Onboarding categories (starter taxonomy — no modules yet) ──
    { id: "Company & Culture", icon: "🏢", color: "#4D7898", hub: "onboarding" },
    { id: "Systems & Tools", icon: "💻", color: "#6366F1", hub: "onboarding" },
    { id: "Policies & Procedures", icon: "📋", color: "#22C55E", hub: "onboarding" },
    { id: "Role-Specific Training", icon: "🎯", color: "#F97316", hub: "onboarding" },
    { id: "AR", icon: "🤝", color: "#A855F7", hub: "onboarding" },
    { id: "SDR", icon: "📞", color: "#EC4899", hub: "onboarding" }
  ],

  modules: [
    {
      id: "electrical-fundamentals",
      hub: "product_mastery",
      name: "Electrical Fundamentals",
      icon: "⚡",
      path: "training.html?id=electrical-fundamentals",
      legacyPath: "legacy/portal-v1/modules/electrical-fundamentals.html",
      description: "The mental model every rep needs before quoting anything electrical. Voltage, current, resistance, AC/DC, three-phase, and more.",
      category: "Basics",
      xp: 460,
      estTime: 90,
      published: true,
      study: {
        provider: "Flipsnack",
        status: "planned",
        headline: "Flipsnack coming soon.",
        note: "This topic will use the same launcher-page workflow once the new study asset is published.",
        fallbackLabel: "Open archived lesson module"
      },
      quiz: {
        ready: false,
        questionCount: 15,
        passPct: 80,
        badgeLabel: "Electrical Fundamentals",
        codeword: "VOLTAGE"   // ← set this to match the final slide of the Flipsnack
      }
    },
    {
      id: "enclosure-mastery",
      hub: "product_mastery",
      name: "Enclosure Mastery",
      icon: "📦",
      path: "training.html?id=enclosure-mastery",
      legacyPath: "legacy/portal-v1/modules/enclosure-mastery.html",
      description: "Three decisions, two matrices, one confident enclosure quote. Materials, NEMA/IP ratings, manufacturer cross-reference, and customer translation.",
      category: "Enclosures",
      xp: 340,
      estTime: 75,
      prerequisite: "electrical-fundamentals",
      published: true,
      sourceNote: "Pilot training built from Tom's Enclosure Mastery Training doc until Carley's Flipsnack is ready.",
      focusPoints: [
        "Use the discovery order: size first, material second, rating third.",
        "Match the enclosure material to UV, corrosion, washdown, and impact exposure.",
        "Ask the accessory, latch, hinge, and brand-flexibility questions before quoting."
      ],
      resources: [
        {
          label: "Archived lesson module",
          url: "legacy/portal-v1/modules/enclosure-mastery.html",
          kind: "legacy"
        }
      ],
      study: {
        provider: "Flipsnack",
        status: "pending",
        headline: "Flipsnack placeholder wired for Enclosure Mastery.",
        note: "Carley's published Flipsnack URL can drop straight into this launcher page. Until then, the archived lesson module is available as the study fallback.",
        fallbackLabel: "Open archived lesson module"
      },
      quiz: {
        ready: true,
        questionCount: 12,
        passPct: 80,
        badgeLabel: "Enclosure Master",
        codeword: "NEMA4X",   // ← set this to match the final slide of the Flipsnack
        intro: "Pass the Enclosure Mastery assessment to complete the topic, earn 340 XP, and unlock the next enclosure training.",
        bank: [
          {
            id: "enc-order",
            prompt: "What is the correct discovery order for an enclosure recommendation?",
            options: [
              "Rating first, then size, then material",
              "Material first, then accessories, then size",
              "Size first, then material, then rating",
              "Brand first, then price, then environment"
            ],
            answer: 2,
            explanation: "Tom's training repeats the same discovery order throughout: size first so the equipment fits, material second based on environment, and rating third based on protection requirements."
          },
          {
            id: "enc-depth",
            prompt: "If height and width already match the application, which dimension is usually the safest and cheapest to increase?",
            options: [
              "Door swing",
              "Depth",
              "Back-panel thickness",
              "Latch count"
            ],
            answer: 1,
            explanation: "The training's rule of thumb is direct: when height and width match, more depth is almost always acceptable and is the least painful dimension to increase."
          },
          {
            id: "enc-uv",
            prompt: "Which environmental factor should make you cautious about ABS and PVC outdoors?",
            options: [
              "Light oil seepage",
              "Direct UV exposure",
              "Indoor dust only",
              "Large conduit entries"
            ],
            answer: 1,
            explanation: "Tom calls out UV explicitly: direct sunlight can degrade ABS and PVC quickly, so outdoor sun exposure pushes you toward stronger outdoor materials."
          },
          {
            id: "enc-pole",
            prompt: "A customer needs a lightweight enclosure for an outdoor sensor mounted on a pole. What material is the best fit from the training?",
            options: [
              "Painted steel",
              "Polycarbonate",
              "Stainless 304",
              "Cast aluminum"
            ],
            answer: 1,
            explanation: "The material matrix and memory hooks both point to polycarbonate for outdoor sensors, radios, and pole-mounted instrumentation."
          },
          {
            id: "enc-frp",
            prompt: "If the environment is chemically aggressive and the customer is unsure what is in the air, which material is the safest default?",
            options: [
              "ABS",
              "Painted steel",
              "Fiberglass (FRP)",
              "Polyester"
            ],
            answer: 2,
            explanation: "The training says FRP is the safe default for unknown chemical exposure because it is chemically inert and broadly corrosion-resistant."
          },
          {
            id: "enc-4x",
            prompt: "What does NEMA 4X add beyond a standard NEMA 4 washdown rating?",
            options: [
              "Hazardous-location approval",
              "Corrosion resistance",
              "Submersion protection",
              "Pole-mount brackets"
            ],
            answer: 1,
            explanation: "Tom's memory hook is concise: 4X means washdown plus corrosion resistance. That is why 4X shows up in food, pharma, chemical, and marine applications."
          },
          {
            id: "enc-type12",
            prompt: "Which NEMA rating is the workhorse for a standard indoor industrial control panel?",
            options: [
              "Type 3R",
              "Type 4",
              "Type 12",
              "Type 6P"
            ],
            answer: 2,
            explanation: "The cheat sheet labels Type 12 as the standard indoor industrial control-panel rating for dust, dripping non-corrosive liquids, and oil seepage."
          },
          {
            id: "enc-compression",
            prompt: "If the customer says, 'We pressure wash this area,' which latch style should you recommend first?",
            options: [
              "Thumb latch",
              "Quarter-turn latch",
              "Compression latch",
              "Lift-off latch"
            ],
            answer: 2,
            explanation: "Tom's latch tips are blunt here: pressure wash means compression latch because it squeezes the gasket evenly for a better seal."
          },
          {
            id: "enc-three-point",
            prompt: "Which latch style is typically required on tall free-standing enclosures so the door seals evenly from top to bottom?",
            options: [
              "Screw cover",
              "Padlockable quarter-turn",
              "Compression latch",
              "Three-point latch"
            ],
            answer: 3,
            explanation: "The training notes that three-point latching is required on tall floor-standing panels because it prevents warping and keeps the gasket compressed across the full door height."
          },
          {
            id: "enc-hinge",
            prompt: "Which hinge style gives the strongest alignment and sealing on large enclosure doors?",
            options: [
              "Concealed hinge",
              "Continuous / piano hinge",
              "Lift-off hinge",
              "Molded hinge"
            ],
            answer: 1,
            explanation: "Continuous hinges distribute the door weight evenly, which is why Tom highlights them as the strongest option and the best sealing choice."
          },
          {
            id: "enc-316",
            prompt: "Which material does the training recommend for coastal or marine exposure?",
            options: [
              "Stainless 316",
              "Painted steel",
              "ABS",
              "Polyester"
            ],
            answer: 0,
            explanation: "One of the memory hooks is almost a slogan: 316 by the sea. Marine or salt-water exposure belongs in 316 or another very high-corrosion material."
          },
          {
            id: "enc-panel",
            prompt: "Which add-on should you quote with almost every enclosure unless the customer confirms they already have one?",
            options: [
              "Window kit",
              "Padlock",
              "Sub-panel",
              "Sunshield"
            ],
            answer: 2,
            explanation: "The accessory upsell section says to quote a sub-panel by default. Most boxes ship empty, and the back-panel hardware is where a lot of compatibility trouble starts."
          },
          {
            id: "enc-freeze",
            prompt: "What climate-control accessory pair should you suggest for outdoor applications in below-freezing climates?",
            options: [
              "A surge protector and disconnect handle",
              "A heater and thermostat",
              "A window kit and pilot light",
              "A compression latch and lift-off hinge"
            ],
            answer: 1,
            explanation: "Tom's accessory cheat sheet specifically recommends a heater plus thermostat for outdoor 3R, 4, or 4X applications in freezing climates."
          },
          {
            id: "enc-brand",
            prompt: "Which qualifying question tells you whether you can offer a cross-reference brand as a lower-cost or faster-shipping alternate?",
            options: [
              "What latch style do you prefer?",
              "Wall-mount or floor-standing?",
              "Brand-locked or approved equal?",
              "Do you need an HMI on the door?"
            ],
            answer: 2,
            explanation: "The eight-question script ends with the cross-reference question: if the spec says 'approved equal,' you can match dimensions and ratings across brands."
          },
          {
            id: "enc-ip-vs-nema",
            prompt: "Why does the training say you should still quote NEMA in North America even if the customer mentions an IP rating?",
            options: [
              "IP ratings are only for indoor use",
              "NEMA covers corrosion, ice, and hazardous-location details that IP does not",
              "IP ratings always mean the enclosure is too expensive",
              "NEMA ratings never overlap with IP ratings"
            ],
            answer: 1,
            explanation: "Tom points out that IP focuses on ingress while NEMA also covers corrosion, icing, and hazardous-location requirements, which is why NEMA remains the right quoting language in North America."
          }
        ]
      }
    },
    {
      id: "enclosure-types",
      hub: "product_mastery",
      name: "Enclosure Types",
      icon: "🗂️",
      path: "training.html?id=enclosure-types",
      legacyPath: "legacy/portal-v1/modules/enclosure-types.html",
      description: "Application first. Size last. The four-category framework (Standard, Operator, Wireway, Specialty) that lets you pick the right enclosure from a one-sentence customer description.",
      category: "Enclosures",
      xp: 280,
      estTime: 60,
      prerequisite: "enclosure-mastery",
      published: true,
      study: {
        provider: "Flipsnack",
        status: "planned",
        headline: "Flipsnack coming soon.",
        note: "This topic will use the same training launcher pattern once its new study asset is ready.",
        fallbackLabel: "Open archived lesson module"
      },
      quiz: {
        ready: false,
        questionCount: 12,
        passPct: 80,
        badgeLabel: "Enclosure Types",
        codeword: "WIREWAY"   // ← set this to match the final slide of the Flipsnack
      }
    },
    {
      id: "enclosure-accessories",
      hub: "product_mastery",
      name: "Enclosure Accessories",
      icon: "⚙️",
      path: "training.html?id=enclosure-accessories",
      legacyPath: "legacy/portal-v1/modules/enclosure-accessories.html",
      description: "Five functional groups that turn an empty box into a working system. Mounting, cable management, thermal control, doors, and protection accessories.",
      category: "Enclosures",
      xp: 280,
      estTime: 60,
      prerequisite: "enclosure-types",
      published: true,
      study: {
        provider: "Flipsnack",
        status: "planned",
        headline: "Flipsnack coming soon.",
        note: "The archived lesson module stays available until the accessory flipbook and quiz are published.",
        fallbackLabel: "Open archived lesson module"
      },
      quiz: {
        ready: false,
        questionCount: 12,
        passPct: 80,
        badgeLabel: "Enclosure Accessories",
        codeword: "THERMAL"   // ← set this to match the final slide of the Flipsnack
      }
    },
    {
      id: "motor-mastery",
      hub: "product_mastery",
      name: "Motor Mastery",
      icon: "⚡",
      path: "training.html?id=motor-mastery",
      legacyPath: "legacy/portal-v1/modules/motor-mastery.html",
      description: "Spin it. Size it. Sell it. Substitute it. Decode nameplates, pick the right enclosure type, match NEMA frames, and quote motors like an engineer.",
      category: "Motors & Motor Control",
      xp: 280,
      estTime: 75,
      prerequisite: "enclosure-accessories",
      published: true,
      study: {
        provider: "Flipsnack",
        status: "planned",
        headline: "Flipsnack coming soon.",
        note: "The archived lesson module is preserved until the motor flipbook and quiz are ready.",
        fallbackLabel: "Open archived lesson module"
      },
      quiz: {
        ready: false,
        questionCount: 12,
        passPct: 80,
        badgeLabel: "Motor Mastery",
        codeword: "NEMA56"    // ← set this to match the final slide of the Flipsnack
      }
    },
    {
      id: "contactors-overloads",
      hub: "product_mastery",
      name: "Contactors & Overload Relays",
      icon: "🔌",
      path: "training.html?id=contactors-overloads",
      legacyPath: "legacy/portal-v1/modules/contactors-overloads.html",
      description: "Switch it. Protect it. Sell the starter. The two building blocks of every motor control circuit — contactor function, overload sizing by FLA, trip classes, and what a 'starter' really is.",
      category: "Motors & Motor Control",
      xp: 280,
      estTime: 60,
      prerequisite: "motor-mastery",
      published: true,
      study: {
        provider: "Flipsnack",
        status: "planned",
        headline: "Flipsnack coming soon.",
        note: "The archived lesson module is preserved until the contactor / overload flipbook and quiz are ready.",
        fallbackLabel: "Open archived lesson module"
      },
      quiz: {
        ready: false,
        questionCount: 12,
        passPct: 80,
        badgeLabel: "Contactors & Overload Relays",
        codeword: "FLA"       // ← set this to match the final slide of the Flipsnack
      }
    },
    {
      id: "motor-starter",
      hub: "product_mastery",
      name: "Motor Starter Mastery",
      icon: "▶️",
      path: "training.html?id=motor-starter",
      legacyPath: "legacy/portal-v1/modules/motor-starter.html",
      description: "Start it. Protect it. Quote the right starter. The 7 starter types — DOL, Reversing, Manual, Magnetic, Combination, MCP, Soft/VFD — plus the decision path that picks one in six questions.",
      category: "Motors & Motor Control",
      xp: 280,
      estTime: 75,
      prerequisite: "contactors-overloads",
      published: true,
      study: {
        provider: "Flipsnack",
        status: "planned",
        headline: "Flipsnack coming soon.",
        note: "The archived lesson module is preserved until the starter flipbook and quiz are ready.",
        fallbackLabel: "Open archived lesson module"
      },
      quiz: {
        ready: false,
        questionCount: 12,
        passPct: 80,
        badgeLabel: "Motor Starter Mastery",
        codeword: "DOL"       // ← set this to match the final slide of the Flipsnack
      }
    },
    {
      id: "vfd-mastery",
      hub: "product_mastery",
      name: "VFD Mastery",
      icon: "⚡",
      path: "training.html?id=vfd-mastery",
      legacyPath: "legacy/portal-v1/modules/vfd-mastery.html",
      description: "Control it. Size it. Quote the right drive. Constant vs variable torque, single-phase derating, motor compatibility, enclosure selection, accessories, and the decision path that closes every VFD call.",
      category: "Motors & Motor Control",
      xp: 280,
      estTime: 75,
      prerequisite: "motor-starter",
      published: true,
      study: {
        provider: "Flipsnack",
        status: "planned",
        headline: "Flipsnack coming soon.",
        note: "The archived lesson module is preserved until the VFD flipbook and quiz are ready.",
        fallbackLabel: "Open archived lesson module"
      },
      quiz: {
        ready: false,
        questionCount: 12,
        passPct: 80,
        badgeLabel: "VFD Mastery",
        codeword: "TORQUE"    // ← set this to match the final slide of the Flipsnack
      }
    },
    {
      id: "reactor-mastery",
      hub: "product_mastery",
      name: "Line & Load Reactor Mastery",
      icon: "🔌",
      path: "training.html?id=reactor-mastery",
      legacyPath: "legacy/portal-v1/modules/reactor-mastery.html",
      description: "Protect it. Filter it. Quote the right reactor. Line vs load reactors, reflected wave physics, cable length zones, dv/dt and sine wave filters, and the decision path that protects every VFD installation.",
      category: "Motors & Motor Control",
      xp: 280,
      estTime: 60,
      prerequisite: "vfd-mastery",
      published: true,
      study: {
        provider: "Flipsnack",
        status: "planned",
        headline: "Flipsnack coming soon.",
        note: "The archived lesson module is preserved until the reactor flipbook and quiz are ready.",
        fallbackLabel: "Open archived lesson module"
      },
      quiz: {
        ready: false,
        questionCount: 12,
        passPct: 80,
        badgeLabel: "Line & Load Reactor Mastery",
        codeword: "DVDT"      // ← set this to match the final slide of the Flipsnack
      }
    },
    {
      id: "harmonic-filter-mastery",
      hub: "product_mastery",
      name: "Harmonic Filter Mastery",
      icon: "🌀",
      path: "training.html?id=harmonic-filter-mastery",
      legacyPath: "legacy/portal-v1/modules/harmonic-filter-mastery.html",
      description: "Clean it up. Meet compliance. Quote the right filter. Harmonics, THD, IEEE-519, passive vs active filters, and the qualifying logic that turns VFD power-quality complaints into the right mitigation plan.",
      category: "Motors & Motor Control",
      xp: 280,
      estTime: 60,
      prerequisite: "reactor-mastery",
      published: true,
      study: {
        provider: "Flipsnack",
        status: "planned",
        headline: "Flipsnack coming soon.",
        note: "The archived lesson module is preserved until the harmonic filter flipbook and quiz are ready.",
        fallbackLabel: "Open archived lesson module"
      },
      quiz: {
        ready: false,
        questionCount: 12,
        passPct: 80,
        badgeLabel: "Harmonic Filter Mastery",
        codeword: "THD"       // ← set this to match the final slide of the Flipsnack
      }
    },
    {
      id: "soft-starter-mastery",
      hub: "product_mastery",
      name: "Soft Starter Mastery",
      icon: "📈",
      path: "training.html?id=soft-starter-mastery",
      legacyPath: "legacy/portal-v1/modules/soft-starter-mastery.html",
      description: "Start smooth. Protect the mechanics. Quote the right ramp. Soft starter vs ATL vs VFD, SCR ramp methods, FLA sizing, bypass, protection, and the decision path that turns hard-start complaints into the right quote.",
      category: "Motors & Motor Control",
      xp: 280,
      estTime: 60,
      prerequisite: "motor-starter",
      published: true,
      study: {
        provider: "Flipsnack",
        status: "planned",
        headline: "Flipsnack coming soon.",
        note: "The archived lesson module is preserved until the soft starter flipbook and quiz are ready.",
        fallbackLabel: "Open archived lesson module"
      },
      quiz: {
        ready: false,
        questionCount: 12,
        passPct: 80,
        badgeLabel: "Soft Starter Mastery",
        codeword: "RAMP"      // ← set this to match the final slide of the Flipsnack
      }
    }
  ]
};

/**
 * Canonical hub lookup for a module id. A Supabase module_config.hub
 * override wins first — this is what lets an admin move an existing
 * (even manifest-defined) module to a different hub without touching
 * manifest.js. Falls back to the static manifest's hub field, then to
 * module_meta.hub for custom modules, then defaults to "product_mastery"
 * so any module predating the hub field — or any code path that doesn't
 * have moduleConfigs handy — still resolves to the hub all pre-existing
 * content belongs to.
 */
window.RSP_MANIFEST.hubOf = function(moduleId, moduleConfigs){
  const cfg = moduleConfigs && moduleConfigs[moduleId];
  if(cfg && cfg.hub) return cfg.hub;
  const fromManifest = window.RSP_MANIFEST.modules.find(m => m.id === moduleId);
  if(fromManifest && fromManifest.hub) return fromManifest.hub;
  if(cfg && cfg.module_meta && cfg.module_meta.hub) return cfg.module_meta.hub;
  return "product_mastery";
};

// Shared last-known-good module configuration. The learner-facing pages use
// this during brief Supabase/network outages so a transient request failure
// cannot turn a populated curriculum into an empty one. This is deliberately
// additive: it does not alter or remove any learner progress keys.
window.RSP_MANIFEST.moduleConfigCacheKey = "rsp_module_configs_v1";
window.RSP_MANIFEST.readModuleConfigCache = function(){
  try{
    const raw = localStorage.getItem(window.RSP_MANIFEST.moduleConfigCacheKey);
    const cached = raw ? JSON.parse(raw) : null;
    const rows = Array.isArray(cached) ? cached : (cached && cached.rows);
    const map = {};
    (Array.isArray(rows) ? rows : []).forEach(function(row){
      if(row && row.module_id) map[row.module_id] = row;
    });
    return map;
  }catch(e){ return {}; }
};
window.RSP_MANIFEST.cacheModuleConfigs = function(rows){
  if(!Array.isArray(rows)) return window.RSP_MANIFEST.readModuleConfigCache();
  try{
    localStorage.setItem(window.RSP_MANIFEST.moduleConfigCacheKey, JSON.stringify({savedAt:Date.now(), rows:rows}));
  }catch(e){}
  const map = {};
  rows.forEach(function(row){ if(row && row.module_id) map[row.module_id] = row; });
  return map;
};

/**
 * Fetch the live module configuration with retries, returning the same
 * {module_id: row} map readModuleConfigCache() returns. A transient network
 * failure must never collapse a populated curriculum into an empty one, so
 * this rejects rather than resolving with a partial/empty result — callers
 * catch and keep whatever last-known-good map they already had.
 * Pass `current` (the map in hand) so an empty response is treated as a
 * failure only when we know content used to exist.
 */
window.RSP_MANIFEST.loadModuleConfigs = async function(opts){
  opts = opts || {};
  const attempts = opts.attempts || 3;
  const known = opts.current ? Object.keys(opts.current).length : 0;
  let lastError = null;
  for(let attempt = 0; attempt < attempts; attempt++){
    try{
      const rows = await window.RSPCloud.getAllModuleConfigs();
      if(!Array.isArray(rows)) throw new Error('Unexpected module configuration response');
      if(rows.length === 0 && known > 0) throw new Error('Module configuration response was unexpectedly empty');
      return window.RSP_MANIFEST.cacheModuleConfigs(rows);
    }catch(e){
      lastError = e;
      if(attempt < attempts - 1) await new Promise(function(resolve){ setTimeout(resolve, 300 * (attempt + 1)); });
    }
  }
  throw lastError || new Error('Module configuration could not be loaded');
};

// Admin access remains a UI convenience until server-side authentication is
// introduced, but all pages now respect the same locally configured list.
window.RSP_MANIFEST.defaultAdminUsers = ["adminaccess", "admin", "rsp-admin", "admin rsp"];
window.RSP_MANIFEST.adminUsers = function(){
  try{
    const saved = JSON.parse(localStorage.getItem("rsp_admin_users") || "null");
    return Array.isArray(saved) && saved.length ? saved : window.RSP_MANIFEST.defaultAdminUsers.slice();
  }catch(e){ return window.RSP_MANIFEST.defaultAdminUsers.slice(); }
};
window.RSP_MANIFEST.isAdminUser = function(user){
  const name = user && String(user.name || "").trim().toLowerCase();
  return !!name && window.RSP_MANIFEST.adminUsers().some(function(admin){
    return String(admin || "").trim().toLowerCase() === name;
  });
};

// A module_config row is authoritative when it contains the codeword field,
// including an explicit null/blank. This distinction matters for manifest
// modules: null means an admin deliberately removed the legacy/default gate;
// a missing config field means the manifest fallback may still be used.
window.RSP_MANIFEST.effectiveCodeword = function(mod, config){
  const hasConfiguredValue = !!(config && Object.prototype.hasOwnProperty.call(config, "codeword"));
  const value = hasConfiguredValue
    ? config.codeword
    : (mod && mod.quiz ? mod.quiz.codeword : null);
  const normalized = String(value == null ? "" : value).trim().toUpperCase();
  return normalized || null;
};

// Safe rendering helpers for metadata that administrators can edit in the
// cloud. URL fields intentionally accept only normal web URLs.
window.RSP_MANIFEST.escapeHtml = function(value){
  return String(value == null ? "" : value).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#39;");
};
window.RSP_MANIFEST.safeWebUrl = function(value){
  try{
    const url = new URL(String(value || ""), location.href);
    return (url.protocol === "http:" || url.protocol === "https:") ? url.href : "";
  }catch(e){ return ""; }
};

/**
 * All modules (static manifest + admin-created custom modules from
 * module_config) belonging to `hub`, published, sorted for display:
 *   1. An explicit module_config.sort_order wins when set.
 *   2. Older custom modules without sort_order use a lesson number in their
 *      title when present, then their persisted timestamp (rather than their
 *      random module id), then declaration order. Once a hub's legacy positions
 *      are normalized by an admin reorder, new modules receive sort_order too.
 * `moduleConfigs` is the map from RSPCloud.getAllModuleConfigs() (or {}
 * if not loaded yet / not using the cloud).
 */
window.RSP_MANIFEST.hubModulesSorted = function(hub, moduleConfigs, includeUnpublished){
  moduleConfigs = moduleConfigs || {};
  const manifestMods = window.RSP_MANIFEST.modules || [];
  const manifestIds = new Set(manifestMods.map(m => m.id));
  const custom = [];
  Object.keys(moduleConfigs).forEach(function(id){
    const cfg = moduleConfigs[id];
    if(!cfg.module_meta || manifestIds.has(id)) return;
    const meta = cfg.module_meta;
    custom.push({
      id: id,
      hub: cfg.hub || meta.hub || "product_mastery",
      name: meta.name || "New Module",
      icon: meta.icon || "📋",
      category: meta.category || "Basics",
      description: meta.description || "",
      xp: cfg.xp != null ? Number(cfg.xp) : (meta.xp || 100),
      estTime: meta.estTime || 30,
      path: "training.html?id=" + id,
      published: cfg.published !== false && meta.published !== false,
      quiz: {
        ready: Array.isArray(cfg.quiz_bank) && cfg.quiz_bank.length > 0,
        questionCount: Array.isArray(cfg.quiz_bank) ? cfg.quiz_bank.length : 0,
        passPct: cfg.pass_pct != null ? Number(cfg.pass_pct) : 80,
        bank: Array.isArray(cfg.quiz_bank) ? cfg.quiz_bank : []
      },
      _isCustom: true
    });
  });
  // Apply admin-managed metadata to manifest modules too. This matters when
  // an existing module is moved to another hub and assigned a category in
  // the admin panel: the learner page must render the configured category,
  // not the module's original manifest category.
  const configuredManifest = manifestMods.map(function(mod){
    const cfg = moduleConfigs[mod.id];
    const meta = cfg && cfg.module_meta;
    const merged = Object.assign({}, mod);
    if(meta){
      ["name", "icon", "category", "description", "xp", "estTime"].forEach(function(key){
        if(meta[key] !== undefined && meta[key] !== null && meta[key] !== "") merged[key] = meta[key];
      });
    }
    if(cfg && cfg.xp != null) merged.xp = Number(cfg.xp);
    if(cfg && cfg.published != null) merged.published = !!cfg.published;
    if(cfg && cfg.pass_pct != null){
      merged.quiz = Object.assign({}, merged.quiz || {}, { passPct:Number(cfg.pass_pct) });
    }
    return merged;
  });
  const combined = configuredManifest.concat(custom);
  const inHub = combined.filter(function(mod){
    return (includeUnpublished || mod.published) && window.RSP_MANIFEST.hubOf(mod.id, moduleConfigs) === hub;
  });
  const withIndex = inHub.map(function(mod, i){ return { mod: mod, i: i }; });
  withIndex.sort(function(a, b){
    const cfgA = moduleConfigs[a.mod.id], cfgB = moduleConfigs[b.mod.id];
    const hasA = !!(cfgA && cfgA.sort_order != null);
    const hasB = !!(cfgB && cfgB.sort_order != null);
    if(hasA && hasB){
      const byOrder = Number(cfgA.sort_order) - Number(cfgB.sort_order);
      if(byOrder) return byOrder;
      return a.i - b.i;
    }
    if(hasA !== hasB) return hasA ? -1 : 1;

    // Older custom modules may predate sort_order. Supabase returns configs by
    // module_id, which is random and was the source of onboarding lessons being
    // scrambled. Prefer an explicit lesson number embedded in the title, then
    // their persisted timestamp, before the deterministic declaration fallback.
    const lessonA = /\blesson\s+(\d+)\b/i.exec(a.mod.name || "");
    const lessonB = /\blesson\s+(\d+)\b/i.exec(b.mod.name || "");
    if(lessonA && lessonB && Number(lessonA[1]) !== Number(lessonB[1])){
      return Number(lessonA[1]) - Number(lessonB[1]);
    }
    const timeA = cfgA && cfgA.updated_at ? Date.parse(cfgA.updated_at) : NaN;
    const timeB = cfgB && cfgB.updated_at ? Date.parse(cfgB.updated_at) : NaN;
    if(Number.isFinite(timeA) && Number.isFinite(timeB) && timeA !== timeB) return timeA - timeB;
    return a.i - b.i;
  });
  return withIndex.map(function(x){ return x.mod; });
};

/**
 * Every module in the portal (manifest + admin-created), across all hubs,
 * as an ordered array. Each module carries its resolved hub, so callers that
 * cut across hubs — learner paths especially — can look a module up without
 * knowing where it lives.
 */
window.RSP_MANIFEST.allModulesSorted = function(moduleConfigs, includeUnpublished){
  const hubs = Object.keys(window.RSP_HUBS || { product_mastery: 1 });
  const out = [];
  hubs.forEach(function(hub){
    window.RSP_MANIFEST.hubModulesSorted(hub, moduleConfigs, includeUnpublished).forEach(function(mod){
      out.push(mod.hub === hub ? mod : Object.assign({}, mod, { hub: hub }));
    });
  });
  return out;
};

/** The same set keyed by module id, for direct lookup. */
window.RSP_MANIFEST.moduleIndex = function(moduleConfigs, includeUnpublished){
  const index = {};
  window.RSP_MANIFEST.allModulesSorted(moduleConfigs, includeUnpublished).forEach(function(mod){
    index[mod.id] = mod;
  });
  return index;
};

/**
 * The module id that must be completed before `mod` unlocks, or null if
 * nothing gates it. An explicit `mod.prerequisite` (the mechanism
 * Product Mastery's manifest modules use) always wins. Otherwise, for
 * hubs configured with `sequentialLock` (Onboarding), the previous
 * module in `sortedHubModules` (see hubModulesSorted) is the gate — a
 * plain admin-ordered checklist rather than a hand-curated graph.
 * Resolves the module's hub via hubOf() (not mod.hub directly) so a
 * module moved between hubs via the admin panel is gated correctly.
 */
window.RSP_MANIFEST.effectivePrerequisite = function(mod, sortedHubModules, moduleConfigs){
  if(mod.prerequisite) return mod.prerequisite;
  const hub = window.RSP_MANIFEST.hubOf(mod.id, moduleConfigs);
  const hubCfg = window.RSP_HUBS && window.RSP_HUBS[hub];
  if(!hubCfg || !hubCfg.sequentialLock || !sortedHubModules) return null;
  const idx = sortedHubModules.findIndex(function(m){ return m.id === mod.id; });
  if(idx <= 0) return null;
  return sortedHubModules[idx - 1].id;
};

/**
 * Renders a "RSP Training Portal ▸ {Hub} ▸ {Module}" breadcrumb as an
 * HTML string. Style-agnostic (inline styles only, color:inherit) so it
 * drops cleanly into any page's existing header markup regardless of
 * that page's own CSS. `moduleName` is optional — omit it on hub
 * dashboard pages, pass it on module/quiz/results pages.
 */
window.RSP_MANIFEST.breadcrumbHtml = function(hub, moduleName){
  const hubs = window.RSP_HUBS || {};
  const hubCfg = hubs[hub] || hubs.product_mastery || { label: "Training", route: "index.html" };
  const esc = function(s){ return String(s || "").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;"); };
  const sep = '<span style="opacity:.5;margin:0 6px">▸</span>';
  let html = '<a href="index.html" style="color:inherit;text-decoration:none;opacity:.75">RSP Training Portal</a>' + sep;
  html += '<a href="' + esc(hubCfg.route) + '" style="color:inherit;text-decoration:none;opacity:.75">' + esc(hubCfg.shortLabel || hubCfg.label) + '</a>';
  if(moduleName){
    html += sep + '<span>' + esc(moduleName) + '</span>';
  }
  return html;
};
