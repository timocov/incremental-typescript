import * as ts from 'typescript';

import { isDtsOutputFileNewer } from './is-file-newer';

export function patchCompilerHost(host: ts.CompilerHost, compilerOptions: ts.CompilerOptions): void {
	if (!compilerOptions.declaration) {
		// if declarations are disabled then we don't need to check if there is newer d.ts file for .ts file
		// in the same way as ts projects does it (medium-sized projects)
		// see https://github.com/Microsoft/TypeScript/issues/3469#issuecomment-400439520
		return;
	}

	// see https://github.com/Microsoft/TypeScript/blob/fcd502502a0d37fa462bd4ae2bd1a67ecee5890b/src/compiler/program.ts#L767-L769
	const moduleResolutionCache = ts.createModuleResolutionCache(host.getCurrentDirectory(), (x: string) => host.getCanonicalFileName(x));
	host.resolveModuleNames = (moduleNames: string[], containingFile: string, reusedNames?: string[], redirectedReference?: ts.ResolvedProjectReference) => {
		return moduleNames.map((moduleName: string) => {
			const resolvedModule = ts.resolveModuleName(moduleName, containingFile, compilerOptions, host, moduleResolutionCache, redirectedReference).resolvedModule;

			// if we have .d.ts file newer than original .ts file
			// we won't compile unchanged .ts files again
			// so let's "fallback" it from .ts to .d.ts
			if (resolvedModule !== undefined && isDtsOutputFileNewer(resolvedModule.resolvedFileName)) {
				resolvedModule.extension = ts.Extension.Dts;
				resolvedModule.resolvedFileName = changeExtension(resolvedModule.resolvedFileName, ts.Extension.Dts);
			}

			return resolvedModule;
		});
	};
}

function changeExtension(path: string, newExtension: ts.Extension): string {
	interface TsWithChangeExtension {
		changeExtension(path: string, newExtension: ts.Extension): string;
	}

	return (ts as unknown as TsWithChangeExtension).changeExtension(path, newExtension);
}
