/** Always-on logs for cover generation (DALL·E / Satori). Prefix grep: `[zettaword:cover]` */

const P = "[zettaword:cover]";

export function coverLog(msg: string, data?: Record<string, unknown>): void {
  if (data && Object.keys(data).length) {
    console.log(P, msg, data);
  } else {
    console.log(P, msg);
  }
}

export function coverWarn(msg: string, err?: unknown): void {
  if (err !== undefined) console.warn(P, msg, err);
  else console.warn(P, msg);
}
