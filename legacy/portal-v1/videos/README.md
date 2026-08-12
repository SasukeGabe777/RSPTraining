# RSP Training Portal — Video Library

Local video files for the See It (video) buttons and any future inline video blocks. Same convention as `portal/images/` — drop files into the module-matching subfolder and reference them with a **relative path** from any module HTML file.

## How to reference a video

Modules live at `portal/modules/<name>.html`, so a video at `portal/videos/enclosures/demo.mp4` is referenced as:

```
../videos/enclosures/demo.mp4
```

Paste exactly that in the See It (video) dialog (or the regular + Video dialog). The editor recognises the relative path and renders a `<video controls>` block — no YouTube/Vimeo embedding needed for in-house clips.

## Folder structure

```
portal/videos/
├── electrical/      ← Electrical Fundamentals module
├── enclosures/      ← Enclosure Mastery module
├── accessories/     ← Enclosure Accessories module
├── motor-mastery/   ← Motor Mastery module
├── motor-starter/   ← Motor Starter Mastery module
└── contactors-overloads/ ← Contactors & Overloads module
```

If a module is missing here, just create the folder when you have the first video for it — nothing else has to change.

## File-format guidance

- **MP4 (H.264 + AAC)** is the universal sweet spot — every modern browser plays it without a plugin.
- Aim for **1080p or 720p**, max ~2 minutes per clip. Anything longer probably belongs on YouTube/Vimeo, embedded via URL instead of stored locally.
- Keep each clip **under ~15 MB** if possible. The portal is browser-based and ships over corporate networks; large files slow page loads.
- For inline narration / how-to clips, **add captions** as a separate `.vtt` file beside the `.mp4`. The default video block doesn't wire captions yet, but it will when needed.

## When to use a local file vs. YouTube/Vimeo

| Use a local file (`../videos/...`) when… | Use YouTube/Vimeo when… |
| --- | --- |
| RSP filmed it in-house and we own the source | The clip already exists on the manufacturer's channel |
| Short loop, animation, or product demo (≤2 min) | Longer than ~2 minutes |
| You want the See It popup to autoplay on hover without external load | You're OK with the player's branding / "Watch on YouTube" fallback |
| Network/firewall might block external video hosts | The video might be edited or replaced upstream and we want to track that |

Both paths render identically inside the See It (video) popup — the editor picks the right `<iframe>` / `<video>` element automatically based on the URL.
