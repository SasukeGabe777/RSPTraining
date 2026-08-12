/**
 * RSP TRAINING PORTAL — MODULE MANIFEST
 * ============================================================
 * Add a new module by adding an entry to MODULES below.
 * Each module is its own self-contained HTML file in /modules/.
 *
 * Required fields:
 *   id          — must match the module's MODULE_ID constant
 *   name        — display name in the portal
 *   icon        — emoji shown on the card
 *   path        — path to the module's HTML file
 *   description — one-sentence summary
 *   category    — used for grouping in the portal's training-track home page
 *   xp          — total XP a learner can earn in this module
 *   estTime     — estimated time to complete, in minutes
 *   prerequisite (optional) — id of a module that should be completed first
 *
 * Categories follow the "Mastery Product Education Series" source sheet.
 * Keep them in curriculum order so the hub reads like the training roadmap.
 */

window.RSP_MANIFEST = {
  // Branding
  brand: {
    name: "RSP Industrial",
    portalTitle: "Training Portal",
    tagline: "Your path from new hire to sales master.",
    primaryColor: "#FACC15"
  },

  // Categories (display order)
  categories: [
    { id: "Basics", icon: "⚡", color: "#FACC15" },
    { id: "Enclosures", icon: "📦", color: "#38BDF8" },
    { id: "Motors & Motor Control", icon: "⚙️", color: "#F97316" },
    { id: "Circuit Protection & Isolation", icon: "🧯", color: "#EF4444" },
    { id: "Panel Building & Mechanical Support", icon: "🧱", color: "#22C55E" },
    { id: "Power Conversion & Power Supplies", icon: "🔋", color: "#8B5CF6" },
    { id: "Relays & Control Relays", icon: "🔁", color: "#14B8A6" },
    { id: "Terminal Blocks & Connections", icon: "🔌", color: "#0EA5E9" },
    { id: "Automation & Control Systems", icon: "🤖", color: "#6366F1" },
    { id: "Solar Power & DC Power Systems", icon: "☀️", color: "#EAB308" },
    { id: "Industrial Communications", icon: "📡", color: "#06B6D4" },
    { id: "Structual & Framing Systems", label: "Structural & Framing Systems", icon: "🏗️", color: "#64748B" },
    { id: "Surge Protections", label: "Surge Protection", icon: "⚡", color: "#FB7185" },
    { id: "Energy Storage", icon: "🔋", color: "#10B981" },
    { id: "Wire, Cable & Connectivity", icon: "🪢", color: "#F59E0B" },
    { id: "Plugs, Receptacles & Interface Power", icon: "🔌", color: "#F97316" },
    { id: "Operator Interface & Signaling Devices", icon: "🎛️", color: "#A855F7" },
    { id: "Instrumentation & Sensing", icon: "📏", color: "#0EA5E9" },
    { id: "Industrial Lighting", icon: "💡", color: "#EAB308" },
    { id: "Industrial Networking", icon: "🌐", color: "#3B82F6" },
    { id: "Surveillance & Security", icon: "📷", color: "#EF4444" },
    { id: "Power Distribution & Metering", icon: "📊", color: "#22C55E" },
    { id: "Temperature & Process Measurement", icon: "🌡️", color: "#F97316" },
    { id: "Energy & Electrical Measurement", icon: "📈", color: "#14B8A6" },
    { id: "Logistics & Operations", icon: "📦", color: "#8B5CF6" },
    { id: "Safety & Compliance", icon: "🛡️", color: "#EF4444" }
  ],

  // Modules — add each module's metadata here
  modules: [
    {
      id: "electrical-fundamentals",
      name: "Electrical Fundamentals",
      icon: "⚡",
      path: "modules/electrical-fundamentals.html",
      description: "The mental model every rep needs before quoting anything electrical. Voltage, current, resistance, AC/DC, three-phase, and more.",
      category: "Basics",
      xp: 460,
      estTime: 90,
      published: true
    },
    {
      id: "enclosure-mastery",
      name: "Enclosure Mastery",
      icon: "📦",
      path: "modules/enclosure-mastery.html",
      description: "Three decisions, two matrices, one confident enclosure quote. Materials, NEMA/IP ratings, manufacturer cross-reference, and customer translation.",
      category: "Enclosures",
      xp: 340,
      estTime: 75,
      prerequisite: "electrical-fundamentals",
      published: true
    },
    {
      id: "enclosure-types",
      name: "Enclosure Types",
      icon: "🗂️",
      path: "modules/enclosure-types.html",
      description: "Application first. Size last. The four-category framework (Standard, Operator, Wireway, Specialty) that lets you pick the right enclosure from a one-sentence customer description.",
      category: "Enclosures",
      xp: 280,
      estTime: 60,
      prerequisite: "enclosure-mastery",
      published: true
    },
    {
      id: "enclosure-accessories",
      name: "Enclosure Accessories",
      icon: "⚙️",
      path: "modules/enclosure-accessories.html",
      description: "Five functional groups that turn an empty box into a working system. Mounting, cable management, thermal control, doors, and protection accessories.",
      category: "Enclosures",
      xp: 280,
      estTime: 60,
      prerequisite: "enclosure-types",
      published: true
    },
    {
      id: "motor-mastery",
      name: "Motor Mastery",
      icon: "⚡",
      path: "modules/motor-mastery.html",
      description: "Spin it. Size it. Sell it. Substitute it. Decode nameplates, pick the right enclosure type, match NEMA frames, and quote motors like an engineer.",
      category: "Motors & Motor Control",
      xp: 280,
      estTime: 75,
      prerequisite: "enclosure-accessories",
      published: true
    },
    {
      id: "contactors-overloads",
      name: "Contactors & Overload Relays",
      icon: "🔌",
      path: "modules/contactors-overloads.html",
      description: "Switch it. Protect it. Sell the starter. The two building blocks of every motor control circuit — contactor function, overload sizing by FLA, trip classes, and what a 'starter' really is.",
      category: "Motors & Motor Control",
      xp: 280,
      estTime: 60,
      prerequisite: "motor-mastery",
      published: true
    },
    {
      id: "motor-starter",
      name: "Motor Starter Mastery",
      icon: "▶️",
      path: "modules/motor-starter.html",
      description: "Start it. Protect it. Quote the right starter. The 7 starter types — DOL, Reversing, Manual, Magnetic, Combination, MCP, Soft/VFD — plus the decision path that picks one in six questions.",
      category: "Motors & Motor Control",
      xp: 280,
      estTime: 75,
      prerequisite: "contactors-overloads",
      published: true
    },
    {
      id: "vfd-mastery",
      name: "VFD Mastery",
      icon: "⚡",
      path: "modules/vfd-mastery.html",
      description: "Control it. Size it. Quote the right drive. Constant vs variable torque, single-phase derating, motor compatibility, enclosure selection, accessories, and the decision path that closes every VFD call.",
      category: "Motors & Motor Control",
      xp: 280,
      estTime: 75,
      prerequisite: "motor-starter",
      published: true
    },
    {
      id: "reactor-mastery",
      name: "Line & Load Reactor Mastery",
      icon: "🔌",
      path: "modules/reactor-mastery.html",
      description: "Protect it. Filter it. Quote the right reactor. Line vs load reactors, reflected wave physics, cable length zones, dv/dt and sine wave filters, and the decision path that protects every VFD installation.",
      category: "Motors & Motor Control",
      xp: 280,
      estTime: 60,
      prerequisite: "vfd-mastery",
      published: true
    },
    {
      id: "harmonic-filter-mastery",
      name: "Harmonic Filter Mastery",
      icon: "🌀",
      path: "modules/harmonic-filter-mastery.html",
      description: "Clean it up. Meet compliance. Quote the right filter. Harmonics, THD, IEEE-519, passive vs active filters, and the qualifying logic that turns VFD power-quality complaints into the right mitigation plan.",
      category: "Motors & Motor Control",
      xp: 280,
      estTime: 60,
      prerequisite: "reactor-mastery",
      published: true
    },
    {
      id: "soft-starter-mastery",
      name: "Soft Starter Mastery",
      icon: "📈",
      path: "modules/soft-starter-mastery.html",
      description: "Start smooth. Protect the mechanics. Quote the right ramp. Soft starter vs ATL vs VFD, SCR ramp methods, FLA sizing, bypass, protection, and the decision path that turns hard-start complaints into the right quote.",
      category: "Motors & Motor Control",
      xp: 280,
      estTime: 60,
      prerequisite: "motor-starter",
      published: true
    }
    // The next 60 modules will go here.
    // {
    //   id: "ice-cube-breakers",
    //   name: "Ice Cube Breakers Mastery",
    //   icon: "🧊",
    //   path: "modules/ice-cube-breakers.html",
    //   description: "...",
    //   category: "Products",
    //   xp: 235,
    //   estTime: 60,
    //   prerequisite: "electrical-fundamentals",
    //   published: true
    // },
  ]
};
