import { createWriteStream, promises, createReadStream } from "fs";
import { Transform, pipeline } from "stream";
import { Transform as _Transform, Readable } from 'stream';
import { TextDecoder } from "util";
import { createInterface } from "readline";

import * as config from "./config.js";
let { startDayOfThisTerm } = config;
const {
  path = './csvs/', lineEnd = '\r\n', timeTable
} = config;

const lineReader = createInterface({
  input: process.stdin,
  output: process.stdout
});
const question = q => new Promise(cb => lineReader.question(q, cb));

const isCorrect = await question(
  `startDayOfThisTerm: ${startDayOfThisTerm}. Is that correct? (Y/n) `
);

if(!/^y/i.test(isCorrect)) {
  startDayOfThisTerm = await question(
    `startDayOfThisTerm: (e.g. 06/28/2021) `
  ) || startDayOfThisTerm;
}

lineReader.close();

const getDate = (theWeek, dayOftheWeek) => {
  const millisecondsOfADay = 86400000;
  const startDate = new Date(startDayOfThisTerm);
  const date = new Date(startDate.getTime() + ( (Number(theWeek) - 1) * 7 + Number(dayOftheWeek) - 1 ) * millisecondsOfADay);
  return date.toLocaleDateString(
              Intl.DateTimeFormat().resolvedOptions().locale, 
              {
                timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone, 
                dateStyle: "short",
                hour12: false 
              }
            )
}

const convert2googleCsvTransform = fileName => new _Transform({
  decodeStrings: false,
  transform: (csvText, meaningless, write) => {
      const weekNum = fileName.match(/\d+/)[0];

      const csvArray = csvText.split(`,,,,,,,${lineEnd},,,,,,,`)[1]
                            .replace(/\[(.*?),(.*?)\]/g, match => match.replace(',', ' ')) ///\[[^\],]*,[^\[,]*\]/
                            .replace(/\[(.*?),(.*?)\]/g, match => match.replace(',', ' ')) ///\[[^\],]*,[^\[,]*\]/
                            .replace(/\[(.*?),(.*?)\]/g, match => match.replace(',', ' ')) ///\[[^\],]*,[^\[,]*\]/
                            .replace(/\[(.*?),(.*?)\]/g, match => match.replace(',', ' ')) ///\[[^\],]*,[^\[,]*\]/
                            .replace(/\[(.*?),(.*?)\]/g, match => match.replace(',', ' ')) ///\[[^\],]*,[^\[,]*\]/
                            .split(/第\d{1,2}-\d{1,2}节,/);
      csvArray.shift();

      write(null,
          csvArray.map((e_ofWeek, i_whichPeriod) => 
              e_ofWeek.split(',')
                      .map((e_ofDay, i_whichDay) => {
                          let date = ''
                          try {
                            const lastIndexOfOpeningBracket = e_ofDay.lastIndexOf('[');
                            const closingBracketPair = e_ofDay.indexOf(']', lastIndexOfOpeningBracket);
                            const mightBeLocation = e_ofDay.slice(
                              lastIndexOfOpeningBracket + 1, 
                              closingBracketPair
                            ).trim();

                            const location = (
                              /^[A-Z]\d+$/.test(mightBeLocation)
                              ? mightBeLocation
                              : e_ofDay.match(/^[A-Z]\d+$/)?.[0] || ""
                            );

                            return (
                              `${sanitize(e_ofDay.split("\"")[1].split(`\n[`)[0])},` // \n[ instead of \r\n[
                              + `${date = getDate(weekNum, i_whichDay + 1)},`
                              + `${date},`
                              + `${timeTable[i_whichPeriod]},`
                              + `${sanitize(e_ofDay)},`
                              + `${sanitize(location)}`
                            );
                            // Example: course name,09/28/2020,09/28/2020,10:21,10:30,course name[period: 1-4 H][session: 1-15 W][Z5608],Z5608
                          } catch (err) {
                            return '';
                          }
                      })
                      .filter(e => e)
                      .join(lineEnd)
            )
            .filter(e => e)
            .join(lineEnd)
            .concat(lineEnd)
        )
      console.info(`  ${fileName} done`)
  }
});

const beginningLine = new Readable({
  read() {
      this.push(`Subject,Start date,End Date,Start time,End Time,Description,Location${lineEnd}`);
      this.push(null);
  }
});

const fileEncoding = "utf8";
const destinationFilename = "./result.csv";
const decoder = new TextDecoder(fileEncoding);
const destination = createWriteStream(destinationFilename);

console.info(
  [
    `From: ${/\/|\\$/.test(path) ? path : path.concat("/")}*.csv (file encoding: ${fileEncoding})`,
    `To:   ${destinationFilename} (file encoding: utf8)`
  ].join("\n"));

(async () => {
  const sources = (
    [
      beginningLine,
      ...(await promises.readdir(path))
        .filter(e => /\.csv$/.test(e))
        .map(file => {
          let buffer = '';
          return (
            pipeline(
              createReadStream(path + file),
              new Transform({
                objectMode: true,
                transform (chunk, buffer_enc, cb) {
                  buffer = buffer.concat(decoder.decode(chunk, { stream: true }));
                  return cb();
                },
                flush (cb) {
                  return cb(
                    null,
                    buffer.concat(decoder.decode()) // passing as whole
                  );
                }
              }),
              convert2googleCsvTransform(file),
              err => { if(err) throw err }
            )
          )
        })
    ]
  );

  try {
    for (const stream of sources) {
      await new Promise((resolve, reject) => 
        stream
          .once("error", reject)
          .once("end", resolve)
          .pipe(destination, { end: false })
      )
    }
    destination.end(() => console.info("succeeded."));
  } catch (err) {
    sources.forEach(stream => stream.destroy());
    throw err;
  }
})();

function sanitize (name) {
  return name.trim().replace(/,|(\r?\n)+|"|'/g, "-").replace(/^-+|-+$/g, "");
}