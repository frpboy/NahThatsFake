
export function isOwner(ctx: any): boolean {
  return ctx.from?.id.toString() === process.env.OWNER_TELEGRAM_ID;
}
