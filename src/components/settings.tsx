import { useState } from "react";
import { ProjectProfileEditor } from "./project-profile";
import type { ProjectProfile } from "../project-profile";
import { BioContext } from "./community";
import { Keycap, Modal } from "./ui";

/** Settings & privacy: what's stored, the scan's data path, embed privacy, letter shortcuts, and clearing your data. */
export function Settings({ context, letters, busy, onLetters, onClear, onClose }: {
  context?: { bio: string | null; sentence: string; project: ProjectProfile | null };
  letters: boolean; busy: boolean;
  onLetters: (v: boolean) => void; onClear: () => void; onClose: () => void;
}) {
  const [clearing, setClearing] = useState(false);
  return <Modal label="Settings and privacy" onClose={onClose}>
    <h2>{context ? "Your profile" : "Settings and privacy"}</h2>
    {context && <><ProjectProfileEditor bio={context.bio} project={context.project} /><BioContext bio={context.bio} sentence={context.sentence} /></>}
    <details className="access settings-info">
      <summary>Scoring & privacy</summary>
      <p>Relevance compares your X bio, saved project and any optional context with one invitation. The explanation summarizes Jev’s relevance rubric; it does not invent facts about a person. Shared interests and related work are separate estimated probabilities. “Tentative” means the evidence is uncertain. These signals don’t establish identity or predict a reply.</p>
      <p>Scans run through Cloudflare and TypeSafe, with requests and results logged in our Cloudflare gateway. Production results may be reused for the configured cache lifetime when inputs are unchanged; local scans stay fresh. Project pages are read by Cloudflare Browser Run; Gemini drafts the project description through the same logged gateway. The full page is not stored in our database. Signing in again refreshes your bio.</p>
      <p>Your identity, bio, saved project description and source link, optional context, choices and opened history are stored for your account. First-party measurement records your first Keep, first opening, active UTC days and optional feedback. Your linked X profile can show an “On hashtagconnect” badge, showing that you’re also here to connect. Your Stash is private. Only our own links record an opening; clicks inside X’s widgets don’t.</p>
      <p>X receives your IP address and browsing data when embeds load and may set cookies. <a href="https://x.com/en/privacy" target="_blank" rel="noreferrer">X privacy policy ↗</a></p>
    </details>
    <hr />
    <label className="switch"><input type="checkbox" checked={letters} onChange={(e) => onLetters(e.target.checked)} /><span aria-hidden="true" />Letter shortcuts</label>
    <p className="fine shortcuts"><Keycap k="S" /> opens Stash. <Keycap k="←" /> Pass, <Keycap k="→" /> Keep. <Keycap k="Esc" /> closes overlays. Shortcuts pause while typing or using a dialog.</p>
    <hr />
    {clearing
      ? <p>Clear every keep, pass and opened record, for people and posts? <button className="link danger" disabled={busy} onClick={onClear}>Clear</button> <button className="link" onClick={() => setClearing(false)}>Cancel</button></p>
      : <button className="link danger" onClick={() => setClearing(true)}>Clear my Stash and opened history</button>}
  </Modal>;
}
