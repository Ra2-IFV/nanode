import { error } from "console";
import { $ } from "execa";
import { readFile, writeFile } from "fs";
import { access, rmdir } from "fs/promises";
import { cpus, platform } from "os";
import { createOrUpdateRelease, octokit } from "./github.js";
import { minifyJS } from "./minify-undici.js";
import { _main, parseVersion, patchFile } from "./utilities.js";

export interface NanodeBuildOptions {
  icu_mode?: "full" | "small" | "system" | "none";
  v8_opts?: boolean;
  target_arch?: "x64" | "arm64" | "x86";
  no_jit?: boolean;
  use_lto?: boolean;
  win_use_clang_cl?: boolean;
  pointer_compression?: boolean;
  make_upx_build?: boolean;
}

export const buildAndUploadNanode = async (
  version = "v25.x",
  {
    icu_mode = "full",
    v8_opts = false,
    target_arch = "x64",
    no_jit = false,
    use_lto = false,
    win_use_clang_cl = false,
    pointer_compression = false,
    make_upx_build = true,
  }: NanodeBuildOptions,
) => {
  if (win_use_clang_cl && process.platform !== "win32") {
    console.error("win_use_clang_cl is only supported on Windows");
    return;
  } else if (parseVersion(version) < 22) {
    console.error("win_use_clang_cl is only supported on Node.js 22 and above");
    return;
  }

  const root_dir = process.cwd();
  const buildName = `nanode-${version}-icu_${icu_mode}${v8_opts ? "-v8_opts" : ""}${no_jit ? "-nojit" : ""}${use_lto ? "-lto" : ""}${win_use_clang_cl ? "-clang" : ""}${pointer_compression ? "-ptr_compr" : ""}-${target_arch}`;

  // const { data: release } = await octokit.repos.getReleaseByTag({
  //     owner: 'std-microblock',
  //     repo: 'nanode',
  //     tag: version
  // }).catch(e => ({
  //     data: {
  //         assets: []
  //     }
  // }))
  //
  // console.log('Check if release exists: ', buildName)
  // if (release.assets.some(asset => {
  //     if (process.platform === 'win32')
  //         return asset.name === `${buildName}.exe`
  //     else
  //         return asset.name === buildName
  // })) {
  //     console.log('Release already exists, skipping')
  //     return
  // }

  await access("node").catch((e) => {
    console.error("Node.js not found at ./node", e);
  });

  const minify_dirs = ["deps", "lib"];
  for (const dir of minify_dirs) {
    await minifyJS("node/" + dir).catch((e) => {
      console.error("Failed to minify JS", e);
    });
  }

  try {
    const config_args: string[] = ["--without-npm"];

    const icu_arg = {
      none: "none",
      small: "small-icu",
      full: "full-icu",
      system: "system-icu",
    };
    config_args.push("--with-intl=" + icu_arg[icu_mode]);

    if (parseVersion(version) > 20) config_args.push("--without-amaro");

    if (pointer_compression)
      if (parseVersion(version) > 22)
        config_args.push(
          "--experimental-enable-pointer-compression",
          "--experimental-pointer-compression-shared-cage",
        );

    if (v8_opts)
      config_args.push("--v8-disable-object-print", "--without-inspector");
    if (process.platform === "linux") config_args.push("--v8-enable-hugepage");

    if (no_jit) config_args.push("--v8-lite-mode");

    if (use_lto)
      if (platform() === "win32") config_args.push("--with-ltcg");
      else config_args.push("--enable-lto");

    console.info("./configure.py args", config_args);

    process.chdir(root_dir + "/node");

    switch (process.platform) {
      case "win32": {
        // Insert to set %config_flags% to append to %configure_flags%
        readFile("vcbuild.bat", { encoding: "utf-8" }, (err, data) => {
          if (err) {
            console.error(err);
          } else {
            writeFile(
              "vcbuild.bat",
              ["set config_flags=" + config_args.join(" "), data].join("\n"),
              { flag: "w+" },
              (err) => {
                if (err) {
                  console.error(err);
                }
              },
            );
          }
        });

        const build_args: string[] = [];
        if (win_use_clang_cl) build_args.push("clang-cl");

        await $`cmd.exe /c vcbuild.bat ${target_arch} ${build_args}`;

        if (make_upx_build) {
          await $`upx --best --ultra-brute out/Release/node.exe`;
        }
        break;
      }

      case "linux":
        await $`./configure ${config_args}`;
        await $`make -j${cpus().length}`;
        await $`strip out/Release/node`;

        if (make_upx_build) {
          await $`upx --best --ultra-brute out/Release/node`;
        }
      default:
        console.error("Unsupported platform", process.platform);
    }
  } finally {
    process.chdir(root_dir);
    if (process.env.GITHUB_ENV) {
      $`echo BUILD_NAME=${buildName} >> "$GITHUB_ENV"`;
      $`echo BUILD_NAME=${buildName} >> "$Env:GITHUB_ENV"`;
    }
  }
};
