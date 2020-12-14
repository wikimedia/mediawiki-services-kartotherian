'use strict';

let Promise = require('bluebird'),
    pathLib = require('path'),

    /** @namespace fs.statAsync */
    /** @namespace fs.accessAsync */
    /** @namespace fs.readFileAsync */
    /** @namespace fs.writeFileAsync */
    /** @namespace fs.readdirAsync */
    fs = Promise.promisifyAll(require('fs')),
    glob = require('glob'),
    Err = require('@wikimedia/err'),
    core = require('@wikimedia/kartotherian-core'),
    fileParser = require('./fileParser');

/**
 * Receives an array of files and filter out the files that shouldn't be processed
 * @param {Array} files Array of file names
 * @param {string} expDirPath path to the expired tile directory
 * @param {string} lastFileParsed file name of the last parsed file
 * @param {string} mask string to create regex for filtering
 * @returns {*}
 */
const filterFilesForProcessing = (files, expDirPath, lastFileParsed, mask) => {
    let re = new RegExp(mask);
    return files.filter(file => {
        return re.test(file) && file.replace(`${expDirPath}/`, '') > lastFileParsed
    });
}

/**
 * Parse given file and enqueue the jobs
 * @param {string} expDirPath
 * @param {string} stateFile
 * @param {string} mask
 * @param {object} options
 * @param {Function} addJobCallback
 * @returns {Promise}
 */
function processAll(expDirPath, stateFile, mask, options, addJobCallback) {
    let lastFileParsed, parsedFiles;
    return fs.statAsync(stateFile).then(stat => {
        if (!stat.isFile()) throw new Err(stateFile + ' is not a file');
        return fs.accessAsync(stateFile, fs.R_OK + fs.W_OK);
    }, err => {
        if (err.code !== 'ENOENT') throw err;
        // File does not exist, try to create an empty one
        return fs.writeFileAsync(stateFile, '');
    }).then(() => {
        // File now exists, all checks have passed
        return fs.readFileAsync(stateFile, {encoding: 'utf8'});
    }).then(content => {
        lastFileParsed = content.trim();
        return glob.sync(`${expDirPath}/**/*`, { nodir: true });
    }).then(files => {
        files = filterFilesForProcessing(files, expDirPath, lastFileParsed, mask)

        if (files.length === 0) {
            return files;
        }
        return Promise.map(files, file => {
            file = pathLib.resolve(expDirPath, file);
            return fs.statAsync(file).then(stat => {
                if (!stat.isFile()) throw new Err(file + ' is not a file');
                return fs.accessAsync(file, fs.R_OK);
            }).return(file);
        });
    }).then(files => {
        if (files.length === 0) return files;
        parsedFiles = files.sort();
        return fileParser(parsedFiles, options, addJobCallback);
    }).then(parseResult => {
        if (!parseResult || !parseResult.lastParsedFile) return parseResult;
        return fs.writeFileAsync(stateFile, parseResult.lastParsedFile.replace(`${expDirPath}/`, '')).return(parseResult);
    });
};

module.exports = {
    filterFilesForProcessing,
    processAll
}
