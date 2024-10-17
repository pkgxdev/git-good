#!/usr/bin/env -S pkgx +git +bash deno~2.0 run -A --unstable-kv

import { platform_cache_default, flatmap, wrap, run, kv, kv_path } from "./utils.ts";
import { parse } from "jsr:@std/yaml@~1.0";
import Path from "./Path.ts";

const manifests_d = (
  flatmap(Deno.env.get("GIT_GUD_PATH"), Path.abs) ?? (
    flatmap(Deno.env.get("XDG_CACHE_HOME"), Path.abs) ??
    platform_cache_default()
  ).join("git-gud/manifests")
).join("addons");

switch (Deno.args[0]) {
  case 'i':
  case 'install': {
    await ensure_manifests();
    const code = await run_script('install');
    if (code != 0) Deno.exit(code);
    await (await kv()).set(['installed', Deno.args[1]], true);
  } break;

  case 'uninstall': {
    await ensure_manifests({quick: true});
    const code = await run_script('uninstall');
    if (code != 0) Deno.exit(code);
    await (await kv()).delete(['installed', Deno.args[1]]);
  } break;

  case 'factory-reset': {
    if (Deno.args[1]) Deno.exit(1);
    Deno.removeSync(kv_path().string);
  } //FALLTHROUGH

  case 'sniff': {
    const db = await kv();

    if (Deno.args[1]) {
      await ensure_manifests({quick: true});
      Deno.exit(await sniff(Deno.args[1], db));
    } else {
      await ensure_manifests();

      for await (const [path, {isFile}] of manifests_d.ls()) {
        if (isFile) {
          const name = path.basename().replace(/\.[^/.]+$/, "");
          await sniff(name, db);
        }
      }
    }

  } break;

  case 'info': {
    await ensure_manifests({quick: true});

    const data = await get_manifest(Deno.args[1])

    if (Deno.args[2] == '--json') {
      console.log(JSON.stringify(data, null, 2));
    } else {
      delete data['install'];
      delete data['uninstall'];
      delete data['sniff'];

      for (const key in data) {
        if (Array.isArray(data[key])) {
          data[key] = data[key].join("\n");
        }
        if (typeof data[key] === 'string') {
          data[key] = wrap(data[key]);
        }

        console.log(key);
        console.log(data[key]);
        console.log();
      }
    }

  } break;

  case 'update':
    await ensure_manifests();
    break

  case 'list':
  case 'ls':
  case 'lsi':
    if (Deno.args[1] == '--installed' || Deno.args[1] == '-i' || Deno.args[0] == 'lsi') {
      const ee = (await kv()).list({ prefix: ["installed"] });
      for await (const entry of ee) {
        console.log(entry.key[1]);
      }
    } else {
      await ensure_manifests();

      for await (const [path, {isFile}] of manifests_d.ls()) {
        if (isFile) {
          console.log(path.basename().replace(/\.[^/.]+$/, ""));
        }
      }
    }
    break;

  case 'lsj': {
    await ensure_manifests({quick: true});
    const out = [];
    for await (let [, {isFile, name}] of manifests_d.ls()) {
      if (isFile) {
        name = name.replace(/\.[^/.]+$/, "");
        const {description} = await get_manifest(name);
        out.push({name, description});
      }
    }
    console.log(JSON.stringify(out, null, 2));
  } break;

  case 'lsij': {
    const ee = (await kv()).list({ prefix: ["installed"] });
    const out = [];
    for await (const {key} of ee) {
      const name = key[1] as string;
      const {description} = await get_manifest(name);
      out.push({name, description});
    }
    console.log(JSON.stringify(out, null, 2));
  } break;

  case 'edit': {
    await ensure_manifests();

    let editor = Deno.env.get("EDITOR");
    if (!Deno.args[1]) {
      const args = [manifests_d.parent().string]
      let cmd = "open";
      if (editor == "code" || editor == "code_wait" || editor == "mate") {
        cmd = editor;
      }
      await new Deno.Command(cmd, { args }).spawn().status
    } else {
      const args = [manifests_d.join(`${Deno.args[1]}.yaml`).string]
      if (!editor) {
        editor = "open";
        args.unshift("-t");
      }
      await new Deno.Command(editor, { args }).spawn().status
    }
  } break;

  case 'vet':
    await new Deno.Command("open", {
      args: [`https://github.com/pkgxdev/git-gud/blob/main/addons/${Deno.args[1]}.yaml`]
    }).spawn().status
    break;

  default:
    usage();
    Deno.exit(1)
}

async function ensure_manifests(options?: {quick: boolean}) {
  if (Deno.env.get("GIT_GUD_PATH")) {
    // user has taken responsibility for updates
    return;
  }

  if (!manifests_d.isDirectory()) {
    await run("git", {
      args: ["clone", "https://github.com/pkgxdev/git-gud", manifests_d.parent().string, "--quiet"]
    });
  } else if (!options?.quick) {
    await run("git", {
      args: ["pull", "--rebase=merges", "--autostash", "--quiet"],
      cwd: manifests_d.parent().string
    });
  }
}

async function get_manifest(addon: string) {
  const txt = await manifests_d.join(`${addon}.yaml`).read();
  //deno-lint-ignore no-explicit-any
  return parse(txt) as Record<string, any>;
}

function usage() {
  let exe = Deno.execPath();
  if (Path.abs(exe)?.basename() == "deno") exe = "git-gud";
  console.log(`usage: ${exe} <command> <addon>`);
  console.log('commands: list, info, vet, install, sniff, uninstall, edit');
}

async function run_script(key: string, name = Deno.args[1]) {
  const yml = await get_manifest(name);
  let cmds = yml[key];
  if (!Array.isArray(cmds)) cmds = [cmds];
  //deno-lint-ignore no-explicit-any
  cmds = cmds.map((cmd: any) => `${cmd}`);

  // make a temporary file of the commands
  const tmp = await Deno.makeTempFile();
  const content = `set -exo pipefail\n\n${cmds.join("\n")}\n`;
  Deno.writeTextFileSync(tmp, content);

  const proc = new Deno.Command("bash", {
    args: [tmp]
  }).spawn()

  const status = await proc.status;

  return status.code
}

async function sniff(name: string, db: Deno.Kv) {
  const code = await run_script('sniff', name);
  if (code == 0) {
    await db.set(['installed', name], true);
  } else {
    await db.delete(['installed', name]);
  }
  return code;
}
