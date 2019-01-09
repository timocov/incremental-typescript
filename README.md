# Incremental Typescript

This tool allows you make something like "incremental" compilations.
For example, if you change only 1 file, you don't need to rebuild the whole project to compile only changed file.
Yeah, you can use "watch" mode for that, but sometimes you cannot (or don't want) to use it due some reasons:

- RAM usage of `tsc --watch` (for one project where I'm working on it used ~800MB-1GB)
- If you change files time to time - you won't to have tsc to be run to monitor changes all time
- _(place your reason here)_

In my local tests with only 1 changed file (of 2k+ files in total) I got the following results:

- `tsc` takes ~45 seconds
- `tsci` takes ~5 seconds (~10x faster)

But result of `tsci` depends on what file you've changed and how many dependencies this files has (with transitive dependencies).

So, **sometimes** it can be very useful tool to compile part of your project.

It is drop-in replacement for `tsc` - everywhere you used `tsc` you can use `tsci`.
All you need to do - just replace `tsc` with `tsci`.

## How it works

This tool is built on top of `tsc` from `npm` - [tsci.js](./lib/tsci.js) is `tsc.js` from `typescript` package, but with removed top part with compiler part, which it takes from `typescript` package.
So the tool will use your version of the `typescript` package.

The tool takes files which `tsc` want to compile and removed files which aren't changed against their output file.
Also, if you have enabled `declaration` compiler option, and TypeScript tries resolves `.ts` file the tool checks if there is corresponding to this file `.d.ts` file _with newest last modified date_, and if it exists, resolves `.d.ts` instead.
So, we don't compile unchanged files (only loads their declaration files).
That's it.

This algorithm is quite similar to how [TypeScript's build mode](http://www.typescriptlang.org/docs/handbook/project-references.html#build-mode-for-typescript) works. But:

1. We can say that the tool "marks each file as separate composite project" (actually it doesn't, but the behavior is very similar).
1. It doesn't follow upstream modules to mark they as "dirty" (or "should-be-compiled"), because for that we need to store dependencies tree somewhere
  (maybe for now, and in the future we'll fix it).

## Known restrictions

1. It doesn't work with `outDir` compiler option.

    There is a chicken and egg problem: to get output path for some file we need to have created program, but to create the program we need to have list of files.

    _(but it seems that it can be fixed via setting `rootDir` compiler option [in the same way as tsbuild](http://www.typescriptlang.org/docs/handbook/project-references.html#composite))_

## Versioning

The version of the package is the same as version of the base compiler.

For example, `3.2.2-0` version of `incremental-typescript` means that the tool is built on top of `3.2.2` TypeScript.
