import { useState } from "react";
import { Keycap, Modal } from "./ui";

/** Settings & privacy: what's stored, the scan's data path, embed consent, letter shortcuts, and clearing your data. */
export function Settings({ embeds, letters, busy, onConsent, onLetters, onClear, onClose }: {
  embeds: boolean; letters: boolean; busy: boolean;
  onConsent: (v: boolean) => void; onLetters: (v: boolean) => void; onClear: () => void; onClose: () => void;
}) {
  const [clearing, setClearing] = useState(false);
  return <Modal label="Settings and privacy" onClose={onClose}>
    <h2>Settings and privacy</h2>
    <details className="access settings-info">
      <summary>Scoring & privacy</summary>
      <p>Relevance compares your X bio with one invitation. Shared interests and related work are separate estimated probabilities. “Tentative” means the evidence is uncertain. These signals don’t establish identity or predict a reply.</p>
      <p>Scans run through Cloudflare and TypeSafe, with requests and results logged in our Cloudflare gateway. Results aren’t cached or stored in the app database. Signing in again refreshes your bio.</p>
      <p>Your identity, bio, choices and opened history are stored for your account. Your linked X profile can show an “On hashtagconnect” badge, based on your last sign-in. Your Stash is private. Only our own links record an opening; clicks inside X’s widgets don’t.</p>
      <p>X receives your IP address and browsing data when embeds load and may set cookies. <a href="https://x.com/en/privacy" target="_blank" rel="noreferrer">X privacy policy ↗</a></p>
    </details>
    <label className="switch"><input type="checkbox" checked={embeds} onChange={(e) => onConsent(e.target.checked)} /><span aria-hidden="true" />Show official X embeds</label>
    <hr />
    <label className="switch"><input type="checkbox" checked={letters} onChange={(e) => onLetters(e.target.checked)} /><span aria-hidden="true" />Letter shortcuts</label>
    <p className="fine shortcuts"><Keycap k="S" /> opens Stash. <Keycap k="←" /> Pass, <Keycap k="→" /> Keep. <Keycap k="Esc" /> closes overlays. Shortcuts pause while typing or using a dialog.</p>
    <hr />
    {clearing
      ? <p>Clear every keep, pass and opened record, for people and posts? <button className="link danger" disabled={busy} onClick={onClear}>Clear</button> <button className="link" onClick={() => setClearing(false)}>Cancel</button></p>
      : <button className="link danger" onClick={() => setClearing(true)}>Clear my Stash and opened history</button>}
  </Modal>;
}
