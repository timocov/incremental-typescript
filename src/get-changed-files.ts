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
		if (inputFile.endsWith(ts.Extension.Dts)) {
			return;
		}

		const ext = path.extname(inputFile);
		if (ext === ts.Extension.Ts || ext === ts.Extension.Tsx) {
			const outFile = getOutputFileForInput(inputFile);
			outputToInputPathMap.set(outFile, inputFile);

			try {
				if (isOutputNewer(inputFile, outFile)) {
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
			if (inputFile !== undefined) {
				return changedFiles.indexOf(inputFile) !== -1;
			}

			try {
				// try to find according .ts file
				return !isOutputNewer(getInputFileForOutput(filePath), filePath);
			} catch {
				try {
					// then try to find according .tsx file
					return !isOutputNewer(getInputFileForOutput(filePath, true), filePath);
				} catch {
					// do nothing
				}
			}

			return true;
		},
	}
}

function getOutputFileForInput(inputFile: string): string {
	const ext = path.extname(inputFile);
	return inputFile.substring(0, inputFile.length - ext.length) + ts.Extension.Js;
}

function getInputFileForOutput(outputFile: string, tsx?: boolean): string {
	let ext = path.extname(outputFile);
	if (ext === '.map') {
		ext = '.js.map';
	}

	return outputFile.substring(0, outputFile.length - ext.length) + (tsx ? ts.Extension.Tsx : ts.Extension.Ts);
}

function isOutputNewer(inputFile: string, outputFile: string): boolean {
	const inputFileChangedTime = fs.statSync(inputFile).mtimeMs;
	const outputFileChangedTime = fs.statSync(outputFile).mtimeMs;
	return outputFileChangedTime > inputFileChangedTime;
}
