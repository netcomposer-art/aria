/** Hover help (data-nc-help, nc-ui installHelpTips): at most 200 characters each, short plain sentences. */
export const HELP: Record<string, string> = {
  "page:hold":
    "Freeze what ARIA sends: the Ground table, Energy and your phone's motion stay where they are until you release Hold.",
  "page:save": "Download ARIA's settings (station, Smoothing) as a file.",
  "page:load": "Load an ARIA file.",
  station:
    "The seismometer ARIA listens to, live from EarthScope. Its ground motion becomes the Ground table and Energy.",
  custom: "Any station EarthScope streams, as NET STA LOC CHA (for example IU ANMO 00 BHZ).",
  status:
    "Live: data is arriving. Quiet: connected, nothing for two minutes. Offline: reconnecting; the 2010 recording plays meanwhile.",
  wave: "The last ten minutes at this station. The line is where ARIA is playing; the shaded slice is the table.",
  table: "One cycle of ground motion, mirrored so it loops. ASTRID plays it as its Ground table.",
  energy:
    "How much the ground moves against this station's last 30 minutes: its normal reads 0.5. ASTRID can use it as Ground Energy.",
  smoothing: "How slowly Energy follows the ground, in seconds.",
  // My phone (Peter, 2026-11-14)
  "motion:allow-motion":
    "Your phone asks once. Motion stays on this phone: ARIA turns it into signals for the Studio's instruments.",
  "motion:via":
    "This device: the sensors of the device ARIA runs on. A phone with this Studio: pair a phone and its motion comes here.",
  "remote:end":
    "End the pairing on both sides. The phone stops sending and the instruments hold their last value.",
  "motion:status":
    "Live: motion is arriving. Paused: the screen locked or the page was hidden. Blocked: the phone said no.",
  "motion:tilt-x":
    "Tip the phone left or right. Centre is 0; full tilt is −1 or +1. Instruments see it as Phone Tilt X.",
  "motion:tilt-y":
    "Tip the top of the phone away from you or toward you. Centre is 0. Instruments see it as Phone Tilt Y.",
  "motion:shake":
    "Jumps on a shake, then falls away. Each shake is also an event, e.g. a new phrase in the Generator.",
  "motion:heading":
    "Which way the phone points, 0–360°. It changes slowly. Instruments see it as Phone Heading.",
  "motion:smooth":
    "How gently the signals follow your hand. 0% is instant and jittery; 100% glides.",
  "motion:centre":
    "Hold the phone the way you'll play it and keep it still for two seconds. That angle becomes 0.",
  "motion:invert": "Flip the direction, so tipping the other way raises the value.",
  "motion:off": "Stop reading motion. Instruments hold their last value.",
};
export const helpFor = (key: string) => HELP[key] ?? "";
