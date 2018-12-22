/*! *****************************************************************************
Copyright (c) Microsoft Corporation. All rights reserved.
Licensed under the Apache License, Version 2.0 (the "License"); you may not use
this file except in compliance with the License. You may obtain a copy of the
License at http://www.apache.org/licenses/LICENSE-2.0

THIS CODE IS PROVIDED ON AN *AS IS* BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
KIND, EITHER EXPRESS OR IMPLIED, INCLUDING WITHOUT LIMITATION ANY IMPLIED
WARRANTIES OR CONDITIONS OF TITLE, FITNESS FOR A PARTICULAR PURPOSE,
MERCHANTABLITY OR NON-INFRINGEMENT.

See the Apache Version 2.0 License for specific language governing permissions
and limitations under the License.
***************************************************************************** */


// This file is from https://github.com/Microsoft/TypeScript/blob/release-3.2/lib/tsc.js
// but with removed compiler's part (top of the file)
// because we need to have code from https://github.com/Microsoft/TypeScript/blob/v3.2.2/src/tsc/tsc.ts only
// to use installed in the project compiler

var ts = require('typescript');
var getChangedFiles = require('./get-changed-files').getChangedFiles;

(function (ts) {
    function countLines(program) {
        var count = 0;
        ts.forEach(program.getSourceFiles(), function (file) {
            count += ts.getLineStarts(file).length;
        });
        return count;
    }
    var reportDiagnostic = ts.createDiagnosticReporter(ts.sys);
    function updateReportDiagnostic(options) {
        if (shouldBePretty(options)) {
            reportDiagnostic = ts.createDiagnosticReporter(ts.sys, /*pretty*/ true);
        }
    }
    function defaultIsPretty() {
        return !!ts.sys.writeOutputIsTTY && ts.sys.writeOutputIsTTY();
    }
    function shouldBePretty(options) {
        if (!options || typeof options.pretty === "undefined") {
            return defaultIsPretty();
        }
        return options.pretty;
    }
    function padLeft(s, length) {
        while (s.length < length) {
            s = " " + s;
        }
        return s;
    }
    function padRight(s, length) {
        while (s.length < length) {
            s = s + " ";
        }
        return s;
    }
    function getOptionsForHelp(commandLine) {
        // Sort our options by their names, (e.g. "--noImplicitAny" comes before "--watch")
        return !!commandLine.options.all ?
            ts.sort(ts.optionDeclarations, function (a, b) { return ts.compareStringsCaseInsensitive(a.name, b.name); }) :
            ts.filter(ts.optionDeclarations.slice(), function (v) { return !!v.showInSimplifiedHelpView; });
    }
    function executeCommandLine(args) {
        if (args.length > 0 && args[0].charCodeAt(0) === 45 /* minus */) {
            var firstOption = args[0].slice(args[0].charCodeAt(1) === 45 /* minus */ ? 2 : 1).toLowerCase();
            if (firstOption === "build" || firstOption === "b") {
                return performBuild(args.slice(1));
            }
        }
        var commandLine = ts.parseCommandLine(args);
        if (commandLine.options.build) {
            reportDiagnostic(ts.createCompilerDiagnostic(ts.Diagnostics.Option_build_must_be_the_first_command_line_argument));
            return ts.sys.exit(ts.ExitStatus.DiagnosticsPresent_OutputsSkipped);
        }
        // Configuration file name (if any)
        var configFileName;
        if (commandLine.options.locale) {
            ts.validateLocaleAndSetLanguage(commandLine.options.locale, ts.sys, commandLine.errors);
        }
        // If there are any errors due to command line parsing and/or
        // setting up localization, report them and quit.
        if (commandLine.errors.length > 0) {
            commandLine.errors.forEach(reportDiagnostic);
            return ts.sys.exit(ts.ExitStatus.DiagnosticsPresent_OutputsSkipped);
        }
        if (commandLine.options.init) {
            writeConfigFile(commandLine.options, commandLine.fileNames);
            return ts.sys.exit(ts.ExitStatus.Success);
        }
        if (commandLine.options.version) {
            ts.printVersion();
            return ts.sys.exit(ts.ExitStatus.Success);
        }
        if (commandLine.options.help || commandLine.options.all) {
            ts.printVersion();
            ts.printHelp(getOptionsForHelp(commandLine));
            return ts.sys.exit(ts.ExitStatus.Success);
        }
        if (commandLine.options.project) {
            if (commandLine.fileNames.length !== 0) {
                reportDiagnostic(ts.createCompilerDiagnostic(ts.Diagnostics.Option_project_cannot_be_mixed_with_source_files_on_a_command_line));
                return ts.sys.exit(ts.ExitStatus.DiagnosticsPresent_OutputsSkipped);
            }
            var fileOrDirectory = ts.normalizePath(commandLine.options.project);
            if (!fileOrDirectory /* current directory "." */ || ts.sys.directoryExists(fileOrDirectory)) {
                configFileName = ts.combinePaths(fileOrDirectory, "tsconfig.json");
                if (!ts.sys.fileExists(configFileName)) {
                    reportDiagnostic(ts.createCompilerDiagnostic(ts.Diagnostics.Cannot_find_a_tsconfig_json_file_at_the_specified_directory_Colon_0, commandLine.options.project));
                    return ts.sys.exit(ts.ExitStatus.DiagnosticsPresent_OutputsSkipped);
                }
            }
            else {
                configFileName = fileOrDirectory;
                if (!ts.sys.fileExists(configFileName)) {
                    reportDiagnostic(ts.createCompilerDiagnostic(ts.Diagnostics.The_specified_path_does_not_exist_Colon_0, commandLine.options.project));
                    return ts.sys.exit(ts.ExitStatus.DiagnosticsPresent_OutputsSkipped);
                }
            }
        }
        else if (commandLine.fileNames.length === 0) {
            var searchPath = ts.normalizePath(ts.sys.getCurrentDirectory());
            configFileName = ts.findConfigFile(searchPath, ts.sys.fileExists);
        }
        if (commandLine.fileNames.length === 0 && !configFileName) {
            ts.printVersion();
            ts.printHelp(getOptionsForHelp(commandLine));
            return ts.sys.exit(ts.ExitStatus.Success);
        }
        var commandLineOptions = commandLine.options;
        if (configFileName) {
            var configParseResult = ts.parseConfigFileWithSystem(configFileName, commandLineOptions, ts.sys, reportDiagnostic); // TODO: GH#18217
            if (commandLineOptions.showConfig) {
                // tslint:disable-next-line:no-null-keyword
                ts.sys.write(JSON.stringify(ts.convertToTSConfig(configParseResult, configFileName, ts.sys), null, 4) + ts.sys.newLine);
                return ts.sys.exit(ts.ExitStatus.Success);
            }
            updateReportDiagnostic(configParseResult.options);
            if (ts.isWatchSet(configParseResult.options)) {
                reportWatchModeWithoutSysSupport();
                createWatchOfConfigFile(configParseResult, commandLineOptions);
            }
            else {
                performCompilation(configParseResult.fileNames, configParseResult.projectReferences, configParseResult.options, ts.getConfigFileParsingDiagnostics(configParseResult));
            }
        }
        else {
            if (commandLineOptions.showConfig) {
                // tslint:disable-next-line:no-null-keyword
                ts.sys.write(JSON.stringify(ts.convertToTSConfig(commandLine, ts.combinePaths(ts.sys.getCurrentDirectory(), "tsconfig.json"), ts.sys), null, 4) + ts.sys.newLine);
                return ts.sys.exit(ts.ExitStatus.Success);
            }
            updateReportDiagnostic(commandLineOptions);
            if (ts.isWatchSet(commandLineOptions)) {
                reportWatchModeWithoutSysSupport();
                createWatchOfFilesAndCompilerOptions(commandLine.fileNames, commandLineOptions);
            }
            else {
                performCompilation(commandLine.fileNames, /*references*/ undefined, commandLineOptions);
            }
        }
    }
    ts.executeCommandLine = executeCommandLine;
    function reportWatchModeWithoutSysSupport() {
        if (!ts.sys.watchFile || !ts.sys.watchDirectory) {
            reportDiagnostic(ts.createCompilerDiagnostic(ts.Diagnostics.The_current_host_does_not_support_the_0_option, "--watch"));
            ts.sys.exit(ts.ExitStatus.DiagnosticsPresent_OutputsSkipped);
        }
    }
    function performBuild(args) {
        var _a = ts.parseBuildCommand(args), buildOptions = _a.buildOptions, projects = _a.projects, errors = _a.errors;
        if (errors.length > 0) {
            errors.forEach(reportDiagnostic);
            return ts.sys.exit(ts.ExitStatus.DiagnosticsPresent_OutputsSkipped);
        }
        if (buildOptions.help) {
            ts.printVersion();
            ts.printHelp(ts.buildOpts, "--build ");
            return ts.sys.exit(ts.ExitStatus.Success);
        }
        // Update to pretty if host supports it
        updateReportDiagnostic();
        if (projects.length === 0) {
            ts.printVersion();
            ts.printHelp(ts.buildOpts, "--build ");
            return ts.sys.exit(ts.ExitStatus.Success);
        }
        if (!ts.sys.getModifiedTime || !ts.sys.setModifiedTime || (buildOptions.clean && !ts.sys.deleteFile)) {
            reportDiagnostic(ts.createCompilerDiagnostic(ts.Diagnostics.The_current_host_does_not_support_the_0_option, "--build"));
            return ts.sys.exit(ts.ExitStatus.DiagnosticsPresent_OutputsSkipped);
        }
        if (buildOptions.watch) {
            reportWatchModeWithoutSysSupport();
        }
        // TODO: change this to host if watch => watchHost otherwiue without watch
        var buildHost = buildOptions.watch ?
            ts.createSolutionBuilderWithWatchHost(ts.sys, reportDiagnostic, ts.createBuilderStatusReporter(ts.sys, shouldBePretty()), createWatchStatusReporter()) :
            ts.createSolutionBuilderHost(ts.sys, reportDiagnostic, ts.createBuilderStatusReporter(ts.sys, shouldBePretty()), createReportErrorSummary(buildOptions));
        buildHost.beforeCreateProgram = enableStatistics;
        buildHost.afterProgramEmitAndDiagnostics = reportStatistics;
        var builder = ts.createSolutionBuilder(buildHost, projects, buildOptions);
        if (buildOptions.clean) {
            return ts.sys.exit(builder.cleanAllProjects());
        }
        if (buildOptions.watch) {
            builder.buildAllProjects();
            return builder.startWatching();
        }
        return ts.sys.exit(builder.buildAllProjects());
    }
    function createReportErrorSummary(options) {
        return shouldBePretty(options) ?
            function (errorCount) { return ts.sys.write(ts.getErrorSummaryText(errorCount, ts.sys.newLine)); } :
            undefined;
    }
    function performCompilation(rootNames, projectReferences, options, configFileParsingDiagnostics) {
        // this part is different from original tsc.js file (start)
        var originalRootNames = rootNames;
        var changedFilesResult = getChangedFiles(rootNames);
        rootNames = changedFilesResult.changedFiles;
        if (rootNames.length === 0) {
            ts.sys.write('No changes detected' + ts.sys.newLine);
            return ts.sys.exit(ts.ExitStatus.Success);
        }

        ts.sys.write('Compiling ' + rootNames.length + ' of ' + originalRootNames.length + ' file(s)...' + ts.sys.newLine);
        function writeFile(host) {
            return function (fileName, data, writeByteOrderMark, onError, sourceFiles) {
                if (!changedFilesResult.shouldWriteFile(fileName)) {
                    return;
                }

                return host.writeFile(fileName, data, writeByteOrderMark, onError, sourceFiles);
            }
        }
        // this part is different from original tsc.js file (end)

        var host = ts.createCompilerHost(options);
        var currentDirectory = host.getCurrentDirectory();
        var getCanonicalFileName = ts.createGetCanonicalFileName(host.useCaseSensitiveFileNames());
        ts.changeCompilerHostToUseCache(host, function (fileName) { return ts.toPath(fileName, currentDirectory, getCanonicalFileName); }, /*useCacheForSourceFile*/ false);
        enableStatistics(options);
        var programOptions = {
            rootNames: rootNames,
            options: options,
            projectReferences: projectReferences,
            host: host,
            configFileParsingDiagnostics: configFileParsingDiagnostics
        };
        var program = ts.createProgram(programOptions);
        var exitStatus = ts.emitFilesAndReportErrors(program, reportDiagnostic, function (s) { return ts.sys.write(s + ts.sys.newLine); }, createReportErrorSummary(options), writeFile(host));
        reportStatistics(program);
        return ts.sys.exit(exitStatus);
    }
    function updateWatchCompilationHost(watchCompilerHost) {
        var compileUsingBuilder = watchCompilerHost.createProgram;
        watchCompilerHost.createProgram = function (rootNames, options, host, oldProgram, configFileParsingDiagnostics, projectReferences) {
            ts.Debug.assert(rootNames !== undefined || (options === undefined && !!oldProgram));
            if (options !== undefined) {
                enableStatistics(options);
            }
            return compileUsingBuilder(rootNames, options, host, oldProgram, configFileParsingDiagnostics, projectReferences);
        };
        var emitFilesUsingBuilder = watchCompilerHost.afterProgramCreate; // TODO: GH#18217
        watchCompilerHost.afterProgramCreate = function (builderProgram) {
            emitFilesUsingBuilder(builderProgram);
            reportStatistics(builderProgram.getProgram());
        };
    }
    function createWatchStatusReporter(options) {
        return ts.createWatchStatusReporter(ts.sys, shouldBePretty(options));
    }
    function createWatchOfConfigFile(configParseResult, optionsToExtend) {
        var watchCompilerHost = ts.createWatchCompilerHostOfConfigFile(configParseResult.options.configFilePath, optionsToExtend, ts.sys, /*createProgram*/ undefined, reportDiagnostic, createWatchStatusReporter(configParseResult.options)); // TODO: GH#18217
        updateWatchCompilationHost(watchCompilerHost);
        watchCompilerHost.configFileParsingResult = configParseResult;
        ts.createWatchProgram(watchCompilerHost);
    }
    function createWatchOfFilesAndCompilerOptions(rootFiles, options) {
        var watchCompilerHost = ts.createWatchCompilerHostOfFilesAndCompilerOptions(rootFiles, options, ts.sys, /*createProgram*/ undefined, reportDiagnostic, createWatchStatusReporter(options));
        updateWatchCompilationHost(watchCompilerHost);
        ts.createWatchProgram(watchCompilerHost);
    }
    function enableStatistics(compilerOptions) {
        if (compilerOptions.diagnostics || compilerOptions.extendedDiagnostics) {
            ts.performance.enable();
        }
    }
    function reportStatistics(program) {
        var statistics;
        var compilerOptions = program.getCompilerOptions();
        if (compilerOptions.diagnostics || compilerOptions.extendedDiagnostics) {
            statistics = [];
            var memoryUsed = ts.sys.getMemoryUsage ? ts.sys.getMemoryUsage() : -1;
            reportCountStatistic("Files", program.getSourceFiles().length);
            reportCountStatistic("Lines", countLines(program));
            reportCountStatistic("Nodes", program.getNodeCount());
            reportCountStatistic("Identifiers", program.getIdentifierCount());
            reportCountStatistic("Symbols", program.getSymbolCount());
            reportCountStatistic("Types", program.getTypeCount());
            if (memoryUsed >= 0) {
                reportStatisticalValue("Memory used", Math.round(memoryUsed / 1000) + "K");
            }
            var programTime = ts.performance.getDuration("Program");
            var bindTime = ts.performance.getDuration("Bind");
            var checkTime = ts.performance.getDuration("Check");
            var emitTime = ts.performance.getDuration("Emit");
            if (compilerOptions.extendedDiagnostics) {
                ts.performance.forEachMeasure(function (name, duration) { return reportTimeStatistic(name + " time", duration); });
            }
            else {
                // Individual component times.
                // Note: To match the behavior of previous versions of the compiler, the reported parse time includes
                // I/O read time and processing time for triple-slash references and module imports, and the reported
                // emit time includes I/O write time. We preserve this behavior so we can accurately compare times.
                reportTimeStatistic("I/O read", ts.performance.getDuration("I/O Read"));
                reportTimeStatistic("I/O write", ts.performance.getDuration("I/O Write"));
                reportTimeStatistic("Parse time", programTime);
                reportTimeStatistic("Bind time", bindTime);
                reportTimeStatistic("Check time", checkTime);
                reportTimeStatistic("Emit time", emitTime);
            }
            reportTimeStatistic("Total time", programTime + bindTime + checkTime + emitTime);
            reportStatistics();
            ts.performance.disable();
        }
        function reportStatistics() {
            var nameSize = 0;
            var valueSize = 0;
            for (var _i = 0, statistics_1 = statistics; _i < statistics_1.length; _i++) {
                var _a = statistics_1[_i], name = _a.name, value = _a.value;
                if (name.length > nameSize) {
                    nameSize = name.length;
                }
                if (value.length > valueSize) {
                    valueSize = value.length;
                }
            }
            for (var _b = 0, statistics_2 = statistics; _b < statistics_2.length; _b++) {
                var _c = statistics_2[_b], name = _c.name, value = _c.value;
                ts.sys.write(padRight(name + ":", nameSize + 2) + padLeft(value.toString(), valueSize) + ts.sys.newLine);
            }
        }
        function reportStatisticalValue(name, value) {
            statistics.push({ name: name, value: value });
        }
        function reportCountStatistic(name, count) {
            reportStatisticalValue(name, "" + count);
        }
        function reportTimeStatistic(name, time) {
            reportStatisticalValue(name, (time / 1000).toFixed(2) + "s");
        }
    }
    function writeConfigFile(options, fileNames) {
        var currentDirectory = ts.sys.getCurrentDirectory();
        var file = ts.normalizePath(ts.combinePaths(currentDirectory, "tsconfig.json"));
        if (ts.sys.fileExists(file)) {
            reportDiagnostic(ts.createCompilerDiagnostic(ts.Diagnostics.A_tsconfig_json_file_is_already_defined_at_Colon_0, file));
        }
        else {
            ts.sys.writeFile(file, ts.generateTSConfig(options, fileNames, ts.sys.newLine));
            reportDiagnostic(ts.createCompilerDiagnostic(ts.Diagnostics.Successfully_created_a_tsconfig_json_file));
        }
        return;
    }
})(ts || (ts = {}));
if (ts.Debug.isDebugging) {
    ts.Debug.enableDebugInfo();
}
if (ts.sys.tryEnableSourceMapsForHost && /^development$/i.test(ts.sys.getEnvironmentVariable("NODE_ENV"))) {
    ts.sys.tryEnableSourceMapsForHost();
}
if (ts.sys.setBlocking) {
    ts.sys.setBlocking();
}
ts.executeCommandLine(ts.sys.args);
