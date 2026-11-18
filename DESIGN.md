---
name: DeepSeek 随行
description: LobeChat-inspired mobile chat, grounded in the DeepSeek official demo
colors:
  primary: "#3367e8"
  accent-text: "#765936"
  text: "#302e29"
  secondary: "#686359"
  background: "#f7f4ec"
  sidebar: "#fdfaf3"
  border: "#d9d2c5"
typography:
  heading:
    fontFamily: "-apple-system, BlinkMacSystemFont, Segoe UI, PingFang SC, Microsoft YaHei, sans-serif"
    fontSize: "28px"
    fontWeight: 650
    lineHeight: 1.4
    letterSpacing: "-0.03em"
  body:
    fontFamily: "Songti SC, STSong, Noto Serif CJK SC, SimSun, Georgia, serif"
    fontSize: "16px"
    lineHeight: "28px"
  caption:
    fontSize: "11px"
  small:
    fontSize: "12px"
  label:
    fontSize: "13px"
  ui:
    fontSize: "14px"
  action:
    fontSize: "17px"
  nav:
    fontSize: "18px"
  section:
    fontSize: "20px"
rounded:
  compact: "10px"
  inherited-chip: "18px"
  inherited-modal: "24px"
  control: "12px"
  composer: "16px"
spacing:
  compact: "8px"
  normal: "16px"
  section: "24px"
components:
  send:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.background}"
    rounded: "{rounded.control}"
    height: "44px"
    width: "44px"
---

## Overview

Operate mode. The user explicitly pins LobeChat as the interface reference. Retain familiar neutral surfaces, restrained outlines and blue selected states. The random design challengers do not override this brief. Code-first refinement of the upstream app, not a new visual world or marketing page.

## Colors

Use the upstream semantic token names in `src/app/theme.css`. The selected B direction uses warm paper and ink, with a darker paper surface in dark mode. A filled globe and a check identify active search. Dark colors are in `body[data-ds-dark-theme]`.

## Typography

Use Songti SC for reading and native iPhone typography for controls and explicitly provide PingFang SC / Microsoft YaHei for readable Chinese. This is the narrow system-font exception justified by the existing upstream `--dsw-font-family` and the user's mobile app reference. Input remains 16px to avoid Safari focus zoom. No external font requests.

## Layout

At widths below 768px use a compact top bar, scrollable content and a bottom composer. Safe-area insets protect both ends. Visual viewport controls chat and modal keyboard behavior. Welcome content scrolls independently at short heights. Touch actions target 44px. History is an on-demand drawer; settings use three tabs.

## Elevation & Depth

Inputs and prompt starters use single hairline boundaries, without added shadows. Only overlays use the upstream modal elevation. Focus changes the input border. Reduced-motion preference is respected.

## Shapes

12px starter/control radius; 16px composer; 20px mobile settings sheet top corners. Keep icons consistent with upstream SVGs. The home-screen D monogram identifies this derivative without implying official status.

## Components

Prompt starters populate the editable draft and set the relevant modes; they never auto-send. The connection hint disappears only after a verified, persisted Key. Deep thinking and search remain independent labeled toggles. API connection, appearance and history management have separate settings tabs. Dialogs trap keyboard focus and restore it on closing.

## Do's and Don'ts

Keep chat as the primary task. Keep source citations and official protocol blocks intact. Do not add external AI providers, third-party parsing, server proxies, telemetry, remote fonts, or fake example conversations to the delivered app. Test fixtures never enter the production bundle.
