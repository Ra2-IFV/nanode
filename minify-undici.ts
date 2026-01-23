import { build } from "esbuild"
import { readdir } from "fs/promises"

export const minifyJS = async (mdir: string) => {
    const readdirRecursive = async (dir: string) => {
        let result: string[] = []
        for (const dirent of await readdir(dir, { withFileTypes: true })) {
            if (dirent.isDirectory()) {
                if (dirent.name.startsWith('test')) {
                    // Skip directories named test*
                    continue
                } else {
                    result = result.concat(await readdirRecursive(`${dir}/${dirent.name}`))
                }
            } else {
                result.push(`${dir}/${dirent.name}`)
            }
        }
        return result
    }

    const files = await readdirRecursive(mdir)
    for (const file of files.filter(v => v.endsWith('.js') || v.endsWith('.mjs'))) {
        try {
            await build({
                entryPoints: [file],
                minify: true,
                treeShaking: true,
                outfile: file,
                allowOverwrite: true,
                bundle: false
             })
        }
        catch (e) {
            console.warn('Skip minifying: ', file)
        }
    }
}