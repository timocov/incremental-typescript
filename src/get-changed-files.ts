import * as fs from 'fs';
import * as path from 'path';
import * as ts from 'typescript';

export interface ChangedFilesResult {
	changedFiles: string[];
	shouldWriteFile: (fileName: string) => boolean;
}

export function getChangedFiles(inputFiles: string[]): ChangedFilesResult {
	const outputToInputPathMap = new Map<string, string>();
	const changedFiles: string[] = [];

	inputFiles.forEach((inputFile: string) => {
		const ext = path.extname(inputFile);
		if (ext === ts.Extension.Ts || ext === ts.Extension.Tsx) {
			const outFile = inputFile.substring(0, inputFile.length - ext.length) + ts.Extension.Js;
			outputToInputPathMap.set(outFile, inputFile);

			try {
				const inputFileChangedTime = fs.statSync(inputFile).mtimeMs;
				const outputFileChangedTime = fs.statSync(outFile).mtimeMs;

				if (outputFileChangedTime > inputFileChangedTime) {
					return;
				}
			} catch {
				// do nothing
			}
		}

		changedFiles.push(inputFile);
	});

	return {
		changedFiles,
		shouldWriteFile: (filePath: string) => {
			const inputFile = outputToInputPathMap.get(filePath);
			return inputFile === undefined || changedFiles.indexOf(inputFile) !== -1;
		},
	}
}
