import { useState } from "react";
import type { Person, Post } from "../people";
import { PostFrame } from "./post-frame";
import { OpenLink } from "./ui";

/** Both widgets stay mounted once opened, so switching views doesn't request the same timeline again. */
export function Invitation({ post, embeds, onEnable, onOpen }: {
  post: Post; embeds: boolean; onEnable: () => void; onOpen: (target: { post?: Post; person?: Person }) => void;
}) {
  const [view, setView] = useState<"invitation" | "profile">("invitation");
  const [profileOpened, setProfileOpened] = useState(false);
  const person = post.person;
  return <div className="invitation">
    {person && <div className="evidence-views" role="group" aria-label="View invitation or profile posts">
      <button aria-pressed={view === "invitation"} onClick={() => setView("invitation")}>Invitation</button>
      <button aria-pressed={view === "profile"} onClick={() => { setProfileOpened(true); setView("profile"); }}>Profile posts</button>
      <span className="evidence-author">@{person.handle}</span>
    </div>}
    <div hidden={view !== "invitation"}>
      <PostFrame id={post.id} embeds={embeds} onEnable={onEnable}
        fallback={<OpenLink post={post} onOpen={(p) => onOpen({ post: p })} className="btn sm" />} />
    </div>
    {profileOpened && person && <div hidden={view !== "profile"}>
      <PostFrame key={person.handle} profile={person.handle} embeds={embeds} onEnable={onEnable}
        fallback={<a className="btn sm" href={person.profileUrl} target="_blank" rel="noopener noreferrer" onClick={() => onOpen({ person })}
          onAuxClick={(event) => { if (event.button === 1) onOpen({ person }); }}>Open @{person.handle} on X <span aria-hidden="true">↗</span></a>} />
    </div>}
  </div>;
}
