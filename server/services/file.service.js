const fs = require("fs");
const fsp = require("fs/promises");

async function readFile(filePath, encoding = null) {
  return encoding ? fsp.readFile(filePath, encoding) : fsp.readFile(filePath);
}

async function writeFile(filePath, data, encoding = null) {
  return encoding ? fsp.writeFile(filePath, data, encoding) : fsp.writeFile(filePath, data);
}

async function unlink(filePath) {
  return fsp.unlink(filePath);
}

async function readdir(dirPath) {
  return fsp.readdir(dirPath);
}

async function stat(targetPath) {
  return fsp.stat(targetPath);
}

function createReadStream(filePath, options) {
  return fs.createReadStream(filePath, options);
}

function existsSync(filePath) {
  return fs.existsSync(filePath);
}

async function exists(filePath) {
  try {
    await fsp.access(filePath, fs.constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

module.exports = {
  readFile,
  writeFile,
  unlink,
  readdir,
  stat,
  createReadStream,
  existsSync,
  exists
};
