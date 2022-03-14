import { createWriteStream, existsSync, promises as fsp } from "fs";
import { request } from "http";
import { stringify } from "querystring";
import { pipeline } from "stream";
import { createInterface } from "readline";

import {
  host,
  path,
  api_path,
  student_id
} from "./scrape.config.mjs";

const lineReader = createInterface({
  input: process.stdin,
  output: process.stdout
});
const question = q => new Promise(cb => lineReader.question(q, cb));

import * as envfile from "envfile";
import { readFile, writeFile } from "fs/promises";

const variables = envfile.parse(await readFile(".env", "utf-8").catch(_ => ""));

const env = name => variables[name] || process.env[name];

let [ academic_year, which_semester ]
      = [ env("academic_year") ||  "2021-2022", env("which_semester") || "1"];
// which_semester: 1 - autumn semester, 2 - spring semester, 3 - summer session

const isCorrect = await question(
  `academic_year: ${academic_year}, which_semester: ${
    which_semester
  }. (Y/n) `
);

if(isCorrect && !/^y/i.test(isCorrect)) {
  academic_year = await question(
    `academic_year: (e.g. 2020-2021) `
  ) || academic_year;

  which_semester = await question(
    `which_semester: (1: autumn semester, 2: spring semester, 3: summer session) `
  ) || which_semester;
}

lineReader.close();

variables["academic_year"] = academic_year;
variables["which_semester"] = which_semester;

try {
  await writeFile(".env", envfile.stringify(variables), "utf-8");
} catch {}

const week = index => 
  "0".repeat(index)
    .concat("1")
    .concat(
      "0".repeat(31 - index)
    )
;

const query = [
  {
    reportlet: api_path,
    xn: academic_year, 
    xq: which_semester,
    dm: student_id,    
    zc: week(1)        
  }
];

const params = {
  "reportlets": encodeURIComponent(JSON.stringify(query)),
  "format": "excel",
  "__filename__": "whatever"
};

const dest = "./_excels/";
const startFrom = 1;

(async () => {
  if(!existsSync(dest))
    await fsp.mkdir(dest);

  console.info(`${dest}:`);

  Promise.all (
    new Array(16) // startFrom ~ startFrom + 15 weeks
      .fill(void 0)
      .map(
        (und, i) => {
          i = i + startFrom;
          query[0].zc = week(i);
          params.reportlets = encodeURIComponent(JSON.stringify(query));

          return new Promise((resolve, reject) => 
            request (
              {
                method: "POST",
                port: 80,
                path,
                host,
                headers: {
                  "Content-Type": "application/x-www-form-urlencoded"
                },
              }, res => 
                pipeline (
                  res,
                  createWriteStream(`${dest}${i}.xlsx`),
                  err => err ? reject(err) : resolve(console.info(`\tweek(${i}) - ${i}.xlsx done`))
                )
            ).on('error', reject)
            .end(stringify(params))
          )
        }
      )
  ).then(() => console.info("succeeded"));
})()