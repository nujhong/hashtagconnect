import type { Person, Post } from "../people";
import { PostFrame } from "./post-frame";
import { OpenLink } from "./ui";

/** The original invitation stays visible below its scan, with a fallback link if X cannot render it. */
export function Invitation({ post, onOpen }: {
  post: Post; onOpen: (target: { post?: Post; person?: Person }) => void;
}) {
  return <PostFrame id={post.id}
    header={<>
      {post.person && <strong>@{post.person.handle}</strong>}
      {post.person?.onPlatform && <span className="member-badge" title="Also here to connect">On hashtagconnect</span>}
      <span className="original-label">Original post</span>
    </>}
    fallback={<OpenLink post={post} onOpen={(p) => onOpen({ post: p })} className="btn sm" />} />;
}
