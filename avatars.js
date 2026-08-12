/**
 * RSP TRAINING PORTAL — DEFAULT AVATARS
 * ============================================================
 * 10 themed avatars reps can choose from when setting up their
 * profile. Each is an inline SVG so it works offline / in PDFs.
 *
 * Add a custom avatar by appending to AVATARS below. The id must
 * be unique. renderAvatar() returns SVG markup at any size.
 */

window.RSP_AVATARS = [
  {
    id: "sparky", name: "Sparky", tagline: "The lightning rod",
    bg1: "#FACC15", bg2: "#CA8A04",
    svg: '<path d="M55 18 L32 56 L48 56 L40 84 L70 50 L52 50 L62 18 Z" fill="#0F172A" stroke="#fff" stroke-width="2"/>'
  },
  {
    id: "voltage", name: "Voltage", tagline: "The big push",
    bg1: "#3B82F6", bg2: "#1E40AF",
    svg: '<rect x="38" y="28" width="24" height="38" rx="4" fill="#fff" stroke="#1E40AF" stroke-width="2"/><rect x="44" y="20" width="4" height="12" fill="#fff"/><rect x="52" y="20" width="4" height="12" fill="#fff"/><circle cx="46" cy="46" r="3" fill="#1E40AF"/><circle cx="54" cy="46" r="3" fill="#1E40AF"/><path d="M44 58 L56 58" stroke="#1E40AF" stroke-width="2" stroke-linecap="round"/>'
  },
  {
    id: "breaker", name: "Breaker", tagline: "Always trips at the right time",
    bg1: "#EF4444", bg2: "#7F1D1D",
    svg: '<rect x="38" y="22" width="24" height="56" rx="3" fill="#fff" stroke="#7F1D1D" stroke-width="2"/><rect x="44" y="38" width="12" height="14" rx="2" fill="#7F1D1D"/><rect x="46" y="42" width="8" height="6" rx="1" fill="#FACC15"/><text x="50" y="68" text-anchor="middle" font-family="Inter,sans-serif" font-size="8" fill="#7F1D1D" font-weight="800">10A</text>'
  },
  {
    id: "wirewise", name: "Wirewise", tagline: "Tangle-free since day one",
    bg1: "#10B981", bg2: "#047857",
    svg: '<path d="M22 50 Q34 30 46 50 T70 50 T82 50" stroke="#fff" stroke-width="6" fill="none" stroke-linecap="round"/><path d="M22 50 Q34 70 46 50 T70 50 T82 50" stroke="#FACC15" stroke-width="3" fill="none" stroke-linecap="round" opacity=".7"/>'
  },
  {
    id: "rivet", name: "Rivet", tagline: "Hands-on energy",
    bg1: "#F97316", bg2: "#9A3412",
    svg: '<rect x="42" y="20" width="16" height="44" rx="3" fill="#fff" stroke="#9A3412" stroke-width="2" transform="rotate(35 50 50)"/><rect x="38" y="56" width="24" height="8" rx="2" fill="#fff" stroke="#9A3412" stroke-width="2" transform="rotate(35 50 50)"/><circle cx="50" cy="74" r="6" fill="#fff" stroke="#9A3412" stroke-width="2"/>'
  },
  {
    id: "phase", name: "Phase", tagline: "All three, all the time",
    bg1: "#06B6D4", bg2: "#155E75",
    svg: '<path d="M14 50 Q26 30 38 50 T62 50 T86 50" stroke="#EF4444" stroke-width="3" fill="none"/><path d="M14 50 Q26 50 38 50 T62 50 T86 50" stroke="#FACC15" stroke-width="3" fill="none"/><path d="M14 50 Q26 70 38 50 T62 50 T86 50" stroke="#fff" stroke-width="3" fill="none"/>'
  },
  {
    id: "pulse", name: "Pulse", tagline: "The signal everyone trusts",
    bg1: "#8B5CF6", bg2: "#5B21B6",
    svg: '<path d="M14 50 L30 50 L34 38 L42 62 L50 30 L58 70 L66 50 L86 50" stroke="#fff" stroke-width="3" fill="none" stroke-linecap="round" stroke-linejoin="round"/>'
  },
  {
    id: "ground", name: "Ground", tagline: "Keeps everyone safe",
    bg1: "#84CC16", bg2: "#3F6212",
    svg: '<rect x="46" y="20" width="8" height="34" fill="#fff"/><rect x="32" y="54" width="36" height="5" fill="#fff"/><rect x="38" y="62" width="24" height="5" fill="#fff"/><rect x="44" y="70" width="12" height="5" fill="#fff"/>'
  },
  {
    id: "coil", name: "Coil", tagline: "Wound for action",
    bg1: "#EC4899", bg2: "#9D174D",
    svg: '<ellipse cx="50" cy="32" rx="20" ry="6" fill="none" stroke="#fff" stroke-width="3"/><ellipse cx="50" cy="42" rx="20" ry="6" fill="none" stroke="#fff" stroke-width="3"/><ellipse cx="50" cy="52" rx="20" ry="6" fill="none" stroke="#fff" stroke-width="3"/><ellipse cx="50" cy="62" rx="20" ry="6" fill="none" stroke="#fff" stroke-width="3"/><ellipse cx="50" cy="72" rx="20" ry="6" fill="none" stroke="#fff" stroke-width="3"/>'
  },
  {
    id: "watt", name: "Watt", tagline: "Pure power",
    bg1: "#F59E0B", bg2: "#78350F",
    svg: '<text x="50" y="68" text-anchor="middle" font-family="Bricolage Grotesque,sans-serif" font-size="58" font-weight="800" fill="#fff">W</text>'
  }
];

window.renderAvatar = function(id, size){
  const av = window.RSP_AVATARS.find(a => a.id === id) || window.RSP_AVATARS[0];
  size = size || 60;
  const gradId = 'bg-' + av.id + '-' + Math.random().toString(36).slice(2,8);
  return '<svg width="'+size+'" height="'+size+'" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">'+
    '<defs><radialGradient id="'+gradId+'" cx=".3" cy=".3" r=".8"><stop offset="0%" stop-color="'+av.bg1+'"/><stop offset="100%" stop-color="'+av.bg2+'"/></radialGradient></defs>'+
    '<circle cx="50" cy="50" r="48" fill="url(#'+gradId+')" stroke="rgba(255,255,255,.2)" stroke-width="2"/>'+
    av.svg+
  '</svg>';
};
