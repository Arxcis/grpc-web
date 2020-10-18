import { exec } from "child_process";

export async function appendLineToFile(line, filepath) {
  await execShellCommand(`echo "${line}" >> "${filepath}"`);
}

export async function replaceLine(before, after, path) {
  await execShellCommand(`sed -i "s/${before}/${after}/g" "${path}"`);
}

export async function deleteLine(line, path) {
  `sed -i "/${line}/d" "${path}"`;
}

export async function appendLineToLine(lineToAppendTo, newLine, path) {
  return `sed -i "/${lineToAppendTo}/a ${newLine}" "${path}"`;
}

export function execShellCommand(cmd) {
  return new Promise((resolve, reject) => {
    exec(cmd, (error, stdout, stderr) => {
      if (error) {
        reject(error);
      }
      resolve(stdout ? stdout : stderr);
    });
  });
}
