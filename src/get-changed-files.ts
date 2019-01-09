import * as ts from 'typescript';

import { isJsOutputFileNewer } from './is-file-newer';

export function getChangedFiles(inputFiles: string[]): string[] {
	return inputFiles.filter((inputFile: string) => {
		if (inputFile.endsWith(ts.Extension.Dts)) {
			return false;
		}

		if (isJsOutputFileNewer(inputFile)) {
			return false;
		}

		return true;
	});
}
