import type { Person, Post } from "../people";
import { PostFrame } from "./post-frame";
import { OpenLink } from "./ui";

/** The original invitation stays visible below its scan, with a fallback link if X cannot render it. */
export function Invitation({ post, embeds, onEnable, onOpen }: {
  post: Post; embeds: boolean; onEnable: () => void; onOpen: (target: { post?: Post; person?: Person }) => void;
}) {
  return <PostFrame id={post.id} embeds={embeds} onEnable={onEnable}
    fallback={<OpenLink post={post} onOpen={(p) => onOpen({ post: p })} className="btn sm" />} />;
}
