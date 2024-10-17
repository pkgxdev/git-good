import Path from "./Path.ts";

export function platform_cache_default() {
  switch (Deno.build.os) {
  case 'darwin':
    return Path.home().join('Library/Caches')
  case 'windows':
    return flatmap(Deno.env.get("LOCALAPPDATA"), Path.abs) ?? Path.home().join('AppData/Local')
  default:
    return Path.home().join('.cache')
  }
}

export function platform_data_default() {
  switch (Deno.build.os) {
    case 'darwin':
      return Path.home().join("Library/Application Support");
    case 'windows':
      return flatmap(Deno.env.get("LOCALAPPDATA"), Path.abs) ?? Path.home().join("AppData/Local");
    default:
      return Path.home().join(".local/share")
    }
}

type Falsy = false | 0 | '' | null | undefined;

export function flatmap<S, T>(t: T | Falsy, body: (t: T) => S | Falsy, opts?: {rescue: boolean}): S | undefined;
export function flatmap<S, T>(t: Promise<T | Falsy>, body: (t: T) => Promise<S | Falsy>, opts?: {rescue: boolean}): Promise<S | undefined>;
export function flatmap<S, T>(t: Promise<T | Falsy> | (T | Falsy), body: (t: T) => (S | Falsy) | Promise<S | Falsy>, opts?: {rescue: boolean}): Promise<S | undefined> | (S | undefined) {
  try {
    if (t instanceof Promise) {
      const foo = t.then(t => {
        if (!t) return
        const s = body(t) as Promise<S | Falsy>
        if (!s) return
        const bar = s.then(body => body || undefined)
        if (opts?.rescue) {
          return bar.catch(() => { return undefined })
        } else {
          return bar
        }
      })
      return foo
    } else {
      if (t) return body(t) as (S | Falsy) || undefined
    }
  } catch (err) {
    if (!opts?.rescue) throw err
  }
}

export function wrap(text: string, maxLength: number = 72): string {
  return text
    .split("\n") // Split the text into existing lines
    .map(line => {
      if (line.length <= maxLength) {
        return line; // Leave short lines as they are
      }
      // Split long lines into chunks of maxLength
      const chunks = [];
      for (let i = 0; i < line.length; i += maxLength) {
        chunks.push(line.slice(i, i + maxLength));
      }
      return chunks.join("\n"); // Join chunks with newlines
    })
    .join("\n"); // Join all lines back into a single string
}

export async function run(cmd: string, opts?: {cwd?: string, args: string[]}): Promise<number> {
  const status = await new Deno.Command("git", opts).spawn().status
  if (status.code != 0) throw Error(`cmd failed: \`${cmd} ${opts?.args.join(" ")}\``)
  return status.code
}

export function kv_path() {
  const path = flatmap(Deno.env.get("XDG_DATA_HOME"), Path.abs) ?? platform_data_default();
  return path.join("git-gud").mkdir("p").join("db.sqlite3");
}

export function kv() {
  return Deno.openKv(kv_path().string);
}
