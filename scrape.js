import { createWriteStream, existsSync, promises as fsp } from "fs";
import { request } from "http";
import { stringify } from "querystring";
import { pipeline } from "stream";

import {
  host,
  path,
  report_path,
  student_id
} from "./scrape.config.js";

const [semester_year, which_semester]
      = ["2020-2021", "2"];
// which_semester: 1 - autumn, 2 -spring, 3 - summer

const num2zc = index => 
  "0".repeat(index)
    .concat("1")
    .concat(
      "0".repeat(31 - index)
    )
;

const query = [
  {
    reportlet: report_path,
    xn: semester_year,  // 学年
    xq: which_semester, // 学期
    dm: student_id,     // 代码
    zc: num2zc(1)       // 周次
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

  Promise.allSettled (
    new Array(16) // 15 weeks
      .fill(void 0)
      .map(
        (und, i) => {
          i = i + startFrom;
          query[0].zc = num2zc(i);
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
                  err => err ? reject(err) : resolve(i)
                )
            ).on('error', reject)
            .end(stringify(params))
          )
        }
      )
  ).then(() => console.info("done."));
})()