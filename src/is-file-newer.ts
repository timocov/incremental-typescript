import * as fs from 'fs';
import * as path from 'path';
import * as ts from 'typescript';

export function isJsOutputFileNewer(inputTsFile: string): boolean {
	return isTsInputFile(inputTsFile) && isOutputNewer(inputTsFile, ts.Extension.Js);
}

export function isDtsOutputFileNewer(inputTsFile: string): boolean {
	return isTsInputFile(inputTsFile) && isOutputNewer(inputTsFile, ts.Extension.Dts);
}

function isOutputNewer(inputFile: string, ext: ts.Extension.Js | ts.Extension.Dts): boolean {
	const outputFilePath = getOutputFileForInput(inputFile, ext);

	try {
		return isFileOlder(inputFile, outputFilePath);
	} catch {
		return false;
	}
}

const mtimeCache = new Map<string, number>();

function getChangedTime(filePath: string): number {
	let mtime = mtimeCache.get(filePath);
	if (mtime === undefined) {
		mtime = fs.statSync(filePath).mtimeMs;
		mtimeCache.set(filePath, mtime);
	}

	return mtime;
}

function isFileOlder(filePath: string, thanFilePath: string): boolean {
	const fileChangedTime = getChangedTime(filePath);
	const thanFileChangedTime = getChangedTime(thanFilePath);
	return thanFileChangedTime > fileChangedTime;
}

function getOutputFileForInput(inputFile: string, outputExt: ts.Extension.Js | ts.Extension.Dts): string {
	const inputExt = path.extname(inputFile);
	return inputFile.substring(0, inputFile.length - inputExt.length) + outputExt;
}

/**
 * @returns true if input file path has .ts or .tsx extension
 */
function isTsInputFile(filePath: string): boolean {
	if (filePath.endsWith(ts.Extension.Dts)) {
		return false;
	}

	const ext = path.extname(filePath);
	return ext === ts.Extension.Ts || ext === ts.Extension.Tsx;
}
