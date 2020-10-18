import { exec } from "child_process";

export async function appendLineToFile(line, filepath) {
  await execShellCommand(`echo "${line}" >> "${filepath}"`);
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
