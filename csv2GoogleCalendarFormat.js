const fs = require("fs");
const Stream = require('stream');
const iconv = require('iconv-lite');
const MultiStream = require('multistream');

const path = './csvs/';
const lineEnd = '\r\n';

const startDayOfThisTerm = "08/31/2020";

// "Sun Sep 27 2020 GMT+0800 (China Standard Time)"
// "09/27/2020"
// the first day of first week in this semester

const timeTable_morning = [
  "08:30,10:15",
  "10:30,12:15"
]

const timeTable_afternoon = [
  "13:45,15:30",
  "15:45,17:30"
]
const timeTable_evening = [
  "18:30,20:15",
  "20:30,10:15"
]

const timeTable_afternoon_delayed = [
  "14:00,15:45",
  "16:00,17:45"
]

const timeTable_evening_delayed = [
  "18:45,20:30",
  "20:45,22:30"
]
/*
const timeTable_morning = [
  "08:30 AM,10:15 AM",
  "10:30 AM,12:15 PM"
]

const timeTable_afternoon = [
  "01:45 PM,03:30 PM",
  "03:45 PM,05:30 PM"
]
const timeTable_evening = [
  "06:30 PM,08:15 PM",
  "08:30 PM,10:15 PM"
]

const timeTable_afternoon_delayed = [
  "02:00 PM,03:45 PM",
  "04:00 PM,05:45 PM"
]

const timeTable_evening_delayed = [
  "06:45 PM,08:30 PM",
  "08:45 PM,10:30 PM"
]
*/
const timeTable = [
  ...timeTable_morning,
  ...timeTable_afternoon_delayed,
  ...timeTable_evening_delayed
]

const getDate = (theWeek, dayOftheWeek) => {
  const millisecondsOfADay = 86400000;
  const startDate = new Date(startDayOfThisTerm);
  const date = new Date(startDate.getTime() + ( (Number(theWeek) - 1) * 7 + Number(dayOftheWeek) - 1 ) * millisecondsOfADay);
  return date.toLocaleTimeString(
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

      result = result.split(`,,,,,,,${lineEnd},,,,,,,`)[1] // 获取中间部分。
            // .split(`,星期一,星期二,星期三,星期四,星期五,星期六,星期日${lineEnd}`)[1] // 去除头
            .replace(/\[(.*?),(.*?)\]/g, match => match.replace(',', ' ')) ///\[[^\],]*,[^\[,]*\]/
            .split(/第\d{1,2}-\d{1,2}节,/); // 分时间段
      result.shift();

      done(null, 
          result.map((e_ofWeek, i_whichPeriod) => 
              e_ofWeek.split(',')
                      .map((e_ofDay, i_whichDay) => {
                          try {
                            return `${e_ofDay.split("\"")[1].split(`\n[`)[0]},${temp = getDate(weekNum, i_whichDay + 1)},${temp},${timeTable[i_whichPeriod]},${e_ofDay},${e_ofDay.slice(e_ofDay.lastIndexOf('[')  + 1, e_ofDay.lastIndexOf(']'))}`
                            // Example: 精通口嗨,09/28/2020,09/28/2020,10:21,10:30,精通口嗨[1-4节][-1-15周][Z5608],Z5608
                            //NOTE: \n[ not the same as lineEnd. 😶
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
})
const beginningLine = new Stream.Readable({
  read() {
      this.push(`Subject,Start date,End Date,Start time,End Time,Description,Location${lineEnd}`);
      this.push(null);
  }
});
try { 
  new MultiStream([
          beginningLine,
          ...fs.readdirSync(path)
            .filter(e => /(\.csv)$/.test(e))
            .map(file => 
                fs.createReadStream(path + file)
                  .pipe(iconv.decodeStream('gb2312'))
                  .pipe(convert2googleCsvTransform(file))
              )
        ])
        .pipe(fs.createWriteStream('result.csv'))
} catch (err) {
  console.error(err)
}