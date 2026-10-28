import { defineHandler } from "void";
import { requireAuth } from "void/auth";
import { listPosts } from "~/server/discovery";

export const GET = defineHandler(async (c) => listPosts(requireAuth(c).id));
