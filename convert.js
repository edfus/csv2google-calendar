const fs = require("fs");
const { Transform, pipeline } = require("stream");
const Stream = require('stream');
const { TextDecoder } = require("util");

const { 
  path = './csvs/', 
  lineEnd = '\r\n',
  startDayOfThisTerm,
  timeTable
} = require("./config.js");

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

const convert2googleCsvTransform = fileName => new Stream.Transform({
  decodeStrings: false,
  transform: (csvText, meaningless, write) => {
      const weekNum = fileName.match(/\d+/)[0];

      const csvArray = csvText.split(`,,,,,,,${lineEnd},,,,,,,`)[1]
                            .replace(/\[(.*?),(.*?)\]/g, match => match.replace(',', ' ')) ///\[[^\],]*,[^\[,]*\]/
                            .split(/第\d{1,2}-\d{1,2}节,/);
      csvArray.shift();

      write(null,
          csvArray.map((e_ofWeek, i_whichPeriod) => 
              e_ofWeek.split(',')
                      .map((e_ofDay, i_whichDay) => {
                          let date = ''
                          try {
                            return (
                              `${e_ofDay.split("\"")[1].split(`\n[`)[0]},` // \n[ instead of \r\n[
                              + `${date = getDate(weekNum, i_whichDay + 1)},`
                              + `${date},`
                              + `${timeTable[i_whichPeriod]},`
                              + `${e_ofDay},`
                              + `${e_ofDay.slice(e_ofDay.lastIndexOf('[')  + 1, e_ofDay.lastIndexOf(']'))}`
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
        )
      console.info(`  ${fileName} done`)
  }
});

const beginningLine = new Stream.Readable({
  read() {
      this.push(`Subject,Start date,End Date,Start time,End Time,Description,Location${lineEnd}`);
      this.push(null);
  }
});

const fileEncoding = "utf8";
const destinationFilename = "./result.csv";
const decoder = new TextDecoder(fileEncoding);
const destination = fs.createWriteStream(destinationFilename);

console.info(
  [
    `From: ${/\/|\\$/.test(path) ? path : path.concat("/")}*.csv (file encoding: ${fileEncoding})`,
    `To:   ${destinationFilename} (file encoding: utf8)`
  ].join("\n"));

(async () => {
  const sources = (
    [
      beginningLine,
      ...(await fs.promises.readdir(path))
        .filter(e => /\.csv$/.test(e))
        .map(file => {
          let buffer = '';
          return (
            pipeline(
              fs.createReadStream(path + file),
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