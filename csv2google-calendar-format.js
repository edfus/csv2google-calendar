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
  transform: (chunk, encoding, done) => {
      let result = chunk.toString();
      const weekNum = fileName.match(/\d+/)[0];
      let temp = ''

      result = result.split(`,,,,,,,${lineEnd},,,,,,,`)[1]
            .replace(/\[(.*?),(.*?)\]/g, match => match.replace(',', ' ')) ///\[[^\],]*,[^\[,]*\]/
            .split(/第\d{1,2}-\d{1,2}节,/);
      result.shift();

      done(null, 
          result.map((e_ofWeek, i_whichPeriod) => 
              e_ofWeek.split(',')
                      .map((e_ofDay, i_whichDay) => {
                          try {
                            return `${e_ofDay.split("\"")[1].split(`\n[`)[0]},${temp = getDate(weekNum, i_whichDay + 1)},${temp},${timeTable[i_whichPeriod]},${e_ofDay},${e_ofDay.slice(e_ofDay.lastIndexOf('[')  + 1, e_ofDay.lastIndexOf(']'))}`
                            // Example: course name,09/28/2020,09/28/2020,10:21,10:30,course name[1-4节][-1-15周][Z5608],Z5608
                            // \n[ not the same as lineEnd.
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
  }
});

const beginningLine = new Stream.Readable({
  read() {
      this.push(`Subject,Start date,End Date,Start time,End Time,Description,Location${lineEnd}`);
      this.push(null);
  }
});

const decoder = new TextDecoder("gb2312");
const destination = fs.createWriteStream('result.csv');

(async () => {
  const sources = (
    [
      beginningLine,
      ...(await fs.promises.readdir(path))
        .filter(e => /(\.csv)$/.test(e))
        .map(file => {
          let buffer = '';
          return (
            pipeline(
              fs.createReadStream(path + file),
              new Transform({
                transform (chunk, buffer_enc, cb) {
                  buffer = buffer.concat(decoder.decode(chunk));
                  return cb();
                },
                flush (cb) {
                  return cb(
                    null,
                    buffer.concat(decoder.decode())
                  );
                }
              }),
              convert2googleCsvTransform(file),
              err => {if(err) throw err}
            )
          )
        })
    ]
  );

  try {
    for (const stream of sources) {
      await new Promise((resolve, reject) => 
        stream
          .once("close", reject)
          .once("error", reject)
          .once("end", resolve)
          .pipe(destination, { end: false })
      )
    }
  } catch (err) {
    sources.forEach(stream => stream.destroy(err));
    console.error(err);
  } finally {
    destination.end();
    console.info("done.");
  }
})();