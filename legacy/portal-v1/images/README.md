# RSP Training Portal — Image Library

Drop product photos into the matching subfolder using the exact filename listed below. Anything missing automatically renders as a clean **"📸 Photo coming soon"** placeholder, so you can ship modules incrementally.

## How the system works

- All image references in the modules use **relative paths** like `../images/electrical/contactor.jpg`.
- A small JS helper (`imgFail`) catches any broken image and swaps it for a styled placeholder div that matches the surrounding layout. No broken-image icons.
- CSS classes used on `<img>` tags:
  - `.hero-img` — wide 32:9 banner at the top of a topic page, height-capped so pages don't get pushed too long (~best for category overview / installation shots)
  - `.prod-img` — 4:3 product card photo (available, currently unused — reserve for full-bleed product shots)
  - `.mfr-photo` — wide 4:1 manufacturer banner (available, currently unused — reserve for full-width brand banners)
  - `.prod-thumb` — compact 110×80 thumbnail floated right inside a card; text wraps around it. Used on accessory product cards, enclosure brand cards, and electrical component cards (smaller 70×55 variant)

## File-format guidance

- **JPG** for photos (smaller, faster). PNG only if you need transparency.
- Aim for **1200–1600 px wide** — the page renders at 8.5 inches but high-DPI screens benefit from larger source.
- Keep each image under **300 KB** if possible. The portal is browser-based; large images slow page loads.
- Use **descriptive alt text** in the source photo (the HTML already has `alt="..."` set, but quality alt text helps accessibility).

## Where to source

1. **Manufacturer marketing kits.** As an authorized RSP reseller you almost certainly have direct access to Hoffman/nVent, Rittal, Stahlin/Robroy, Schneider, Phoenix Contact, etc. media libraries. These are the cleanest source — proper studio shots, licensed for distributor use. Ask each rep for a media-asset link if you don't have one.
2. **In-house photos.** Snap shop-floor shots of cabinets RSP has built or warehouse stock. Best option for "real installation" hero images. iPhone photos in good light are fine.
3. **Free stock services** as a last resort: Unsplash, Pexels, Pixabay (all free for commercial use). Search "industrial control panel," "circuit breaker," "data rack." Generic but usable for hero images.
4. **AVOID** hotlinking from manufacturer or stock sites — links break, terms vary, and quality is inconsistent.

---

## Folder structure

```
portal/images/
├── electrical/      ← Electrical Fundamentals module
├── enclosures/      ← Enclosure Mastery module
└── accessories/     ← Enclosure Accessories module
```

---

## ✅ Image checklist

### electrical/  (Electrical Fundamentals)

| Filename | Where it appears | What to show |
| --- | --- | --- |
| `hero-water-analogy.jpg` | LEARN · voltage/current intro | Water-pipe + electrical schematic side-by-side, OR studio shot of a control panel meter |
| `hero-ac-dc.jpg` | LEARN · AC vs DC | A wall outlet next to a battery / DC power supply |
| `hero-three-phase.jpg` | LEARN · three-phase power | An industrial 3-phase motor or a panel showing 3-pole breakers |
| `hero-grounding.jpg` | LEARN · grounding & bonding | Green ground wire connection on a panel, or grounding rod |
| `hero-ul-breakers.jpg` | LEARN · UL 489 vs UL 1077 | A breaker bank with mixed UL 489 + ice cube breakers visible |
| `hero-relay-contactor.jpg` | APPLY · relays vs contactors | A control relay next to a contactor on the same DIN rail |
| `hero-motor-nameplate.jpg` | APPLY · motors 101 / nameplate | Close-up of a motor nameplate (FLA, voltage, RPM legible) |
| `hero-vfd.jpg` | APPLY · starter / soft start / VFD | A wall-mount VFD with HMI keypad visible |
| `hero-ladder-schematic.jpg` | APPLY · reading schematics | A real ladder diagram on paper or screen |
| `ice-cube-breaker.jpg` | Component lineup card · BREAKER | UL 1077 ice cube breaker (DIN-rail thermal-magnetic) |
| `contactor.jpg` | Component lineup card · CONTACTOR | A 3-pole motor contactor, side angle |
| `relay.jpg` | Component lineup card · RELAY | An ice-cube relay in its socket |
| `power-supply-24vdc.jpg` | Component lineup card · POWER SUPPLY | DIN-rail 24 VDC power supply |

### enclosures/  (Enclosure Mastery)

| Filename | Where it appears | What to show |
| --- | --- | --- |
| `hero-enclosure-basics.jpg` | LEARN · what is an enclosure | A control cabinet open showing PLCs/breakers inside |
| `hero-enclosure-jobs.jpg` | LEARN · protection/compliance/reliability | A cabinet in a harsh real environment (factory, outdoor) |
| `hero-rsp-brands.jpg` | LEARN · RSP enclosure line | Line-up of cabinets from multiple brands (Hoffman, Rittal, Stahlin) |
| `hero-three-decisions.jpg` | LEARN · the 3 core decisions | A wall-mount cabinet with a person quoting / annotating |
| `hero-steel-cabinet.jpg` | LEARN · steel matrix | Painted-steel and stainless-steel cabinets side-by-side |
| `hero-nonmetallic-cabinet.jpg` | LEARN · non-metallic matrix | Polycarbonate/fiberglass cabinets, ideally outdoor |
| `hero-nema-rated.jpg` | LEARN · NEMA matrix | A NEMA 4X cabinet under hose-down or coastal exposure |
| `mfr-hoffman.jpg` | Brand card | Painted-steel or stainless Hoffman wall-mount cabinet |
| `mfr-rittal.jpg` | Brand card | Rittal AX or VX cabinet |
| `mfr-stahlin.jpg` | Brand card | Stahlin polycarbonate or fiberglass enclosure |
| `mfr-allied-moulded.jpg` | Brand card | Allied Moulded fiberglass enclosure |
| `mfr-schneider.jpg` | Brand card | Schneider/Square D enclosure (Spacial S3D etc.) |
| `mfr-killark.jpg` | Brand card | Killark cast-aluminum hazardous-location enclosure |
| `mfr-adalet.jpg` | Brand card | Adalet hazardous junction box |
| `mfr-phoenix-contact.jpg` | Brand card | Phoenix Contact small DIN-rail housing |

### accessories/  (Enclosure Accessories)

| Filename | Where it appears | What to show |
| --- | --- | --- |
| `hero-five-groups.jpg` | LEARN · big picture | An open cabinet with mounting + cable + thermal accessories visible |
| `hero-mounting-1.jpg` | LEARN · mounting & org part 1 | A backplate fully populated with PLCs, breakers, terminals |
| `hero-mounting-2.jpg` | LEARN · mounting & org part 2 | A rack with shelves/drawers and rack-mount equipment |
| `hero-cable-1.jpg` | LEARN · cable mgmt part 1 | Slotted wire duct routed through a control panel |
| `hero-cable-2.jpg` | LEARN · cable mgmt part 2 | A gland plate with multiple cables entering, sealed |
| `hero-thermal-1.jpg` | LEARN · thermal part 1 | A filter fan or AC unit mounted on a cabinet door |
| `hero-thermal-2.jpg` | LEARN · thermal part 2 + doors | An outdoor cabinet with a sun shield visible |
| `hero-protection.jpg` | LEARN · protection & longevity | An outdoor cabinet on a pedestal with rain hood, weathered |
| `gland-plate.jpg` | Inline product card | Removable gasketed gland plate with cable knockouts |
| `swing-out-panel.jpg` | Inline product card | A swing-out panel pivoting open inside a cabinet |
| `latch-handle.jpg` | Inline product card | Compression latch / quarter-turn keyed handle |
| `wire-duct-slotted.jpg` | Inline product card | Slotted wire duct with cover, or open with wires |
| `cable-manager-vertical.jpg` | Inline product card | Vertical cable manager on a rack side-rail |
| `grommets-hole-seals.jpg` | Inline product card | Variety of grommets / hole-seal plugs |
| `filter-fan.jpg` | Inline product card | A filter fan with grille (front view) |
| `enclosure-ac.jpg` | Inline product card | A side-mount enclosure air conditioner |
| `enclosure-heater.jpg` | Inline product card | A small DIN-rail enclosure heater |
| `sun-shield.jpg` | Inline product card | A sun shield mounted over an outdoor cabinet |

---

## Summary

- **46 images total** across the 3 modules:
  - 18 in `accessories/` (8 hero + 10 inline thumbnails)
  - 15 in `enclosures/` (7 hero + 8 brand thumbnails)
  - 13 in `electrical/` (9 hero + 4 component thumbnails)
- All `<img>` tags already exist in the HTML — you just need to drop matching files into the folders.
- Modules ship and look professional out of the box even with zero images (placeholder shows where photos go).
- Replacing or updating images later is just a file swap — no HTML edits needed.
