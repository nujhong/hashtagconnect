import "void/handler";

/** Custom bindings use Wrangler's generated interface; secrets remain defined by Void. */
declare module "void/handler" {
  interface CloudBindings extends Pick<Cloudflare.Env, "BROWSER"> {}
}
