'use strict';

var Promise = require("bluebird");
const fs = Promise.promisifyAll(require("fs-extra"));
const path = require("path");
const chalk = require("chalk");
const _ = require('lodash');
// var conf = require('rc')('nativeloop', {});
const pathExists = require('path-exists');
const npm = require('@geek/npm');
const temp = require("temp");
const module_name = path.parse(module.id).name;
// const debug = require('debug')('nativeloop');
const Spinner = require('@geek/spinner');
const figures = require('figures');

// debug logger
var logger = (func_name) => {
	var prefix = func_name ? `[${module_name}.${func_name}] ` : `[${module_name}`;
	return _.wrap(require('debug')('nativeloop'), (func, msg) => func(chalk.blue(prefix) + msg));
}
var debug = logger();

// exports.command = 'create <App Name> [--path <Directory>] [--id <App ID>] [--template <Template Name>]'
exports.desc = 'Creates a new project for native development with {nativeloop}.'

var builder = {

	"template": {
		alias: "t",
		default: "@nativeloop/template-default",
		describe: "Template to use for creating your new app",
		demand: false,
		type: "string",
	},
	"name": {
		alias: "n",
		describe: "Name of your project",
		demand: false,
		type: "string"
	},
	"id": {
		//The bundle ID string must be a uniform type identifier (UTI) that contains only alphanumeric 
		//characters (A-Z,a-z,0-9), hyphen (-), and period (.)
		alias: "i",
		describe: "ID for your project",
		demand: false,
		type: "string"
	},
	"publisher": {
		default: "my-company",
		describe: "Publisher for your project",
		demand: false,
		type: "string"
	},
	"copyright": {
		alias: "c",
		default: "",
		describe: "Copyright for your project",
		demand: false,
		type: "string"
	},
	"description": {
		alias: "d",
		default: "Another awesome nativeloop app!",
		describe: "Description for your project",
		demand: false,
		type: "string"
	},
	"guid": {
		alias: "g",
		default: "00000000-0000-0000-0000-000000000000",
		describe: "Guid for your project",
		demand: false,
		type: "string"
	},
	"url": {
		alias: "u",
		default: "",
		describe: "Url for your project",
		demand: false,
		type: "string"
	},
	"path": {
		alias: "p",
		describe: "Specifies the directory where you want to initialize the project, if different from the current directory. The directory must already exist.",
		demand: false,
		type: "string"
	},
	"force": {
		alias: "f",
		describe: "If set, applies the default project configuration and does not show the interactive prompt. ",
		demand: false,
		type: "string"
	}

}
var execute = function(argv) {
	let debug = logger('execute');
	var appc_directory;

	debug("argv: " + JSON.stringify(argv, null, 2));
	debug("__dirname: " + __dirname);
	debug("process.cwd(): " + process.cwd());

	var project_directory = argv["path"];
	debug("project_directory: " + project_directory);
	debug("project_directory.exists: " + pathExists.sync(project_directory));

	var template_appc = function(filename) {
		let debug = logger('template_appc');
		var filename = path.join(appc_directory, filename);
		// debug("templating file: " + filename);
		spinner.start("Templating file: " + filename);
		return fs.readFileAsync(filename)
			.then((source) => fs.writeFileAsync(filename, _.template(source)(argv)))
			.then(() => spinner.succeed());
	}

	var template_nativeloop = function(filename) {
		// let debug = logger('template_nativeloop');
		var filename = path.join(project_directory, filename);
		// debug("templating file: " + filename);
		spinner.start("Templating file: " + filename);
		return fs.readFileAsync(filename)
			.then((source) => fs.writeFileAsync(filename, _.template(source)(argv)))
			.then(() => spinner.succeed());
	}

	var template_files = function() {
		// let debug = logger('template_files');
		spinner.stopAndPersist(figures.arrowRight, "Templating files");
		spinner.column += 4;

		return Promise.all(_.map(['tiapp.xml'], template_appc))
			.then(() => Promise.all(_.map(['readme.md'], template_nativeloop)))
			.then(() => {
				spinner.column -= 4;
				return true;
			});
	}

	var findTiappXml = function(root) {
		let debug = logger('findTiappXml');
		return new Promise((resolve, reject) => {
			spinner.start("Looking for Appcelerator project folder");
			debug("looking for tiapp.xml in: " + root);
			var finder = require('findit')(root);
			var path = require('path');

			finder.on('file', function(file, stat) {
				var filepath = path.parse(file);
				if (filepath.base === "tiapp.xml") {
					spinner.succeed();
					resolve(filepath.dir);
					finder.stop();
				}
			});
		});
	}

	var install_nativeloop_mobile = function() {
		let debug = logger('install_nativeloop_mobile');
		debug("installing nativeloop mobile");
		return pathExists(path.join(project_directory, "node_modules", "@nativeloop", "mobile"))
			.then(exists => {
				spinner.start("Installing @nativeloop/mobile");
				if (exists) {
					debug("skipping installation of @nativeloop/mobile:  directory already exists");
					spinner.text += chalk.gray(" [skipped]");
					spinner.stopAndPersist(chalk.gray(figures.cross));
					spinner.column += 4;
					spinner.stopAndPersist(figures.pointerSmall, chalk.gray("Directory already exists"));
					spinner.column -= 4;
					return true;
				} else {
					debug("installing @nativeloop/mobile in directory: " + project_directory);
					return npm.install(['@nativeloop/mobile'], {
							cwd: project_directory,
							silent: true,
						})
						.then(() => spinner.succeed());
				}
			});
	}

	var cleanup = function() {
		let debug = logger('cleanup');
		spinner.start("Cleaning up temporary files");
		return fs.removeAsync(temp_directory)
			//.then(() => spinner.succeed())
			.catch(err => {
				spinner.fail();
				debug("Error cleaning up: " + err.message || err);
				console.error("Error cleaning up: " + err.message || err);
			});
	}

	var configure_package_json = function() {
		spinner.start("Configuring package.json");
		var pkg = _.defaults({
			name: argv.name,
			description: argv.description,
			author: {
				name: argv.publisher
			},
			version: "1.0.0-revision.0"
		}, _.omitBy(require(path.join(project_directory, "package.json")), (value, key) => {
			return _.startsWith(key, "_") || (_.includes(["gitHead", "readme"], key));
		}));

		return fs.writeJsonAsync(path.join(project_directory, "package.json"), pkg)
			.then(() => spinner.succeed());
	}

	const spinner = new Spinner().start();

	var copy_template = function(name) {
		// let debug = logger('copy_template');
		spinner.stopAndPersist(figures.arrowRight, "Installing template");
		var source = path.resolve(argv.template);
		debug("source: " + source);
		spinner.column += 4;
		spinner.start("Checking for local template");
		return pathExists(source)
			.then(exists => {
				spinner.succeed();
				debug("pathExists.sync(source): " + exists);
				if (exists) {
					return source;
				} else {
					debug("installing template to: " + project_directory);
					spinner.start("Installing template to temp directory");
					return npm.install([argv.template, "--ignore-scripts", "--global-style"], {
							cwd: temp_directory,
							silent: true,
						})
						.then(() => {
							spinner.succeed();
							spinner.start("Examining template");
							var first = _.first(fs.readdirSync(nodeModulesDir));
							spinner.succeed();
							return path.join(nodeModulesDir, first);
						});
				}
			})
			.then((template_source) => {
				debug("copying files to project directory: " + project_directory);
				spinner.start("Copying template to project folder");
				return fs.copyAsync(template_source, project_directory, {
						clobber: true
					})
					.then(() => spinner.succeed());
			})
			.then(() => {
				debug("renaming template.json file: " + project_directory);
				spinner.start("Renaming template.json");
				return pathExists(path.join(project_directory, "template.json"))
					.then((exists) => {
						if (!exists) {
							debug("skipping rename of template.json:  file does not exist");
							spinner.text += chalk.gray(" [skipped]");
							spinner.stopAndPersist(chalk.gray(figures.cross));
							spinner.column += 4;
							spinner.stopAndPersist(figures.pointerSmall, chalk.gray("File does not exist"));
							spinner.column -= 4;
							return true;
						} else {
							return fs.copyAsync(path.join(project_directory, "template.json"), path.join(project_directory, "package.json"), {
									clobber: true
								})
								.then(() => spinner.succeed());
						}
					})
			})
			.then(() => {
				debug("renaming template.md file: " + project_directory);
				spinner.start("Renaming template.md");
				return pathExists(path.join(project_directory, "template.md"))
					.then((exists) => {
						if (!exists) {
							debug("skipping rename of template.md:  file does not exist");
							spinner.text += chalk.gray(" [skipped]");
							spinner.stopAndPersist(chalk.gray(figures.cross));
							spinner.column += 4;
							spinner.stopAndPersist(figures.pointerSmall, chalk.gray("File does not exist"));
							spinner.column -= 4;
							return true;
						} else {
							return fs.copyAsync(path.join(project_directory, "template.md"), path.join(project_directory, "readme.md"), {
									clobber: true
								})
								.then(() => spinner.succeed())
						}
					})
			})
			.then(() => {
				spinner.column -= 4;
			});

	}
	const temp_directory = temp.path({
		prefix: "nativeloop"
	});
	fs.emptyDirSync(temp_directory);

	const nodeModulesDir = path.join(temp_directory, "node_modules");

	debug('temp_directory: ' + JSON.stringify(temp_directory, null, 2));


	Promise.resolve(fs.ensureDirAsync(project_directory))
		.then(() => copy_template(argv.template))
		.then(() => findTiappXml(project_directory))
		.then(result => {
			appc_directory = result;
			if (!appc_directory) {
				spinner.text = chalk.red("Appcelerator directory not found");
				spinner.fail();
				return false;
			}

			spinner.column += 4;
			spinner.stopAndPersist(figures.pointerSmall, chalk.gray(appc_directory));
			spinner.column -= 4;
			// debug("appc_directory: " + appc_directory);
		})
		.then(() => configure_package_json())
		.then(() => {
			spinner.start("Installing npm dependencies");
			npm.install({
					cwd: project_directory,
					silent: true,
				})
				.then(() => spinner.succeed());
		})
		.then(() => install_nativeloop_mobile())
		.then(() => {
			spinner.start("Running npm dedupe");
			return npm.dedupe({
					cwd: project_directory
				})
				.then(() => spinner.succeed());
		})
		.then(() => template_files())
		.finally(() => {
			//TODO: Figure out why the last spinner entry is output twice
			cleanup();
			// spinner.stop();
		})
		.catch(err => console.error("Error occurred: " + err));
}

var handler = function(argv) {

	argv.name = argv.name || argv._[2] || "My App";
	argv.id = argv.id || _.kebabCase(argv.publisher.trim()).toLowerCase() + "." + _.kebabCase(argv.name.trim()).toLowerCase();
	argv.path = argv.path || path.join(process.cwd(), argv.name);

	execute(argv);
}

exports.handler = handler;
exports.builder = builder;