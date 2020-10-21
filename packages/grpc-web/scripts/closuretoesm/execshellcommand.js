import { exec } from "child_process";

export async function appendLineToFile(line, filepath) {
  return await execShellCommand(`echo "${line}" >> "${filepath}"`);
}

export async function replaceLine(before, after, path) {
  return await execShellCommand(`sed -i "s/${before}/${after}/g" "${path}"`);
}

export async function deleteLine(line, path) {
  return await execShellCommand(`sed -i "/${line}/d" "${path}"`);
}

export async function appendLineToLine(lineToAppendTo, newLine, path) {
  return await execShellCommand(
    `sed -i "/${lineToAppendTo}/a ${newLine}" "${path}"`
  );
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
