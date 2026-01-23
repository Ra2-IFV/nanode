import { NanodeBuildOptions } from "./build.js"

export const strategies: {
    [key: string]: NanodeBuildOptions
} = {
    none_lto: { icu_mode: 'none', use_lto: true },
    none_v8_nojit_lto: { icu_mode: 'none', v8_opts: true, no_jit: true, use_lto: true },
    none_v8_lto_ptrcomp: { icu_mode: 'none', v8_opts: true, use_lto: true, pointer_compression: true },
    full_v8_lto: { icu_mode: 'full', v8_opts: true, use_lto: true },
    full_v8_lto_ptrcomp: { icu_mode: 'full', v8_opts: true, use_lto: true, pointer_compression: true },
    system_lto: { icu_mode: 'system', use_lto: true },
    system_v8_lto_ptrcomp: { icu_mode: 'system', v8_opts: true, use_lto: true },
}
