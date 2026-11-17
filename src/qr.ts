/**
 * The pairing QR code, drawn here (qrcode-generator, MIT): the link never goes to a QR service. An SVG of dark
 * squares on a white tile with the standard quiet zone, so any phone camera reads it in light or dark mode.
 */
import qrcode from "qrcode-generator";

// A QR code is black on white in either theme, or phone cameras can't read it.
const PAPER = "#fff"; // ui-guard: allow QR codes must be black on white
const INK = "#000"; // ui-guard: allow QR codes must be black on white

export function qrSvg(text: string): string {
  const qr = qrcode(0, "M");
  qr.addData(text);
  qr.make();
  const n = qr.getModuleCount();
  const quiet = 4;
  const size = n + quiet * 2;
  let path = "";
  for (let r = 0; r < n; r++)
    for (let c = 0; c < n; c++) if (qr.isDark(r, c)) path += `M${c + quiet} ${r + quiet}h1v1h-1z`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" shape-rendering="crispEdges" role="img" aria-label="Pairing code as a QR code"><rect width="${size}" height="${size}" fill="${PAPER}"/><path d="${path}" fill="${INK}"/></svg>`;
}
