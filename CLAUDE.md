# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project overview

"字界修仙" (Character Realm Cultivation) — a browser-based Chinese character typing game with cultivation/xianxia theme. Zero dependencies, pure HTML + CSS + vanilla JS (ES6). Game loop driven by `requestAnimationFrame` at 60fps. No build step — open `index.html` directly.

## File structure

```
index.html      — DOM structure (mode select, game container, overlays)
style.css       — all styles, cultivation dark-theme palette
game.js         — all game logic (~920 lines, single file)
levels.json     — cultivation realm config (level name + speed multiplier)
data/
  char-sets.json  — manifest listing available char set files
  *.json          — char set files: { "title": "...", "words": [...] }
```

## Running

No server required. Open `index.html` directly in browser.
To serve locally: `npx serve .` or `python -m http.server 8000`.

## Architecture

### Three game modes

| Mode | Key | Timer | Speed | End condition |
|------|-----|-------|-------|---------------|
| 修炼 (Cultivate) | `'cultivate'` | Elapsed timer (HUD) | User-selected (0.1–5.0×), saved to localStorage | HP ≤ 0 |
| 渡劫 (Tribulation) | `'tribulation'` | 4-min countdown | Level-based (0.5×–4.0× from `levels.json`) | HP ≤ 0 (fail) or timer=0 (success, level+1) |
| 试炼 (Trial) | `'trial'` | None | 0.5× + 0.1× every 15s | HP ≤ 0 |

### Game state machine

```
Mode Select → [speed picker if cultivate] → Game Active → Game Over/Result → Retry or Menu
```

The `state` object (in `game.js`) holds all runtime data: mode, HP, score, activeChars, timers, practice lists, etc. The HUD elements are shown/hidden per mode via `.hidden` class toggling.

### Core systems

**Game loop** (`gameLoop`, rAF-driven): Each frame moves all `activeChars` downward by their speed, checks for off-screen, triggers HP damage. In cultivate mode, also activates pending practice chars after 10s delay.

**Character spawning** (`spawnChar` / `startSpawning`): Hybrid timer (2.5s interval) + on-demand (pop-one-spawn-one). Max 5 chars on screen. Same-char dedup with 10 retries. Speed = `baseSpeed * getSpeedMultiplier()` where baseSpeed is 0.5–1.2 random.

**Input** (`processInput`): IME-aware via `compositionstart`/`compositionend` events. Takes last char of input, exact-matches against activeChars. Match → pop + score + spawn. No match → HP-1 + practice tracking (cultivate only).

**Cultivate practice system**: Wrong input sets `pendingWrong`. Next correct input → that char enters `pendingPractice` (10s delay), then `practiceList` (50% spawn probability). Chars falling off-screen also enter practice. 2 consecutive clean correct inputs clear all practice state.

**Persistence** (`localStorage`): Two keys — `SAVE_KEY` for global prefs (current char set, cultivate speed) and `RECORDS_KEY` for per-char-set records (level, trial high score).

**Char set loading** (`init`): Loads `data/char-sets.json` manifest, then fetches each listed file. The file's `title` field becomes the display name. Adding a new char set requires only adding the JSON file to `data/` and its filename to the manifest — no code changes.

### Overlay system

All overlays use `.hidden` class (`display: none`). Z-index hierarchy: mode-select (200), speed-select (210), game HUD (10), flash (50), pause/tribulation/gameover overlays (100).

## Key patterns

- `state.mode` branches are used throughout to differentiate mode-specific behavior (spawn speed, input handling, game over flows)
- `startMode(mode)` is the universal entry point — stops all timers, resets state, configures mode-specific HUD
- `backToMenu()` returns to mode select without saving game results
- `saveData()` is called only on meaningful events (level up, high score update, settings change) — never during active gameplay
