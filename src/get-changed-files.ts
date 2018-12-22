import * as fs from 'fs';
import * as path from 'path';
import * as ts from 'typescript';

export function getChangedFiles(inputFiles: string[]): string[] {
	return inputFiles.filter((file: string) => {
		const ext = path.extname(file);
		if (ext === ts.Extension.Ts || ext === ts.Extension.Tsx) {
			const jsFile = file.substring(0, file.length - ext.length) + ts.Extension.Js;

			try {
				const tsFileChangedTime = fs.statSync(file).mtimeMs;
				const jsFileChangedTime = fs.statSync(jsFile).mtimeMs;

				if (jsFileChangedTime > tsFileChangedTime) {
					return false;
				}
			} catch {
				// do nothing
			}
		}

		return true;
	});
}
