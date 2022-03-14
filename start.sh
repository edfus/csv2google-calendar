#!/bin/sh

set -e

node scrape.mjs
echo $'\nWaiting for Excels to be converted to CSVs...\n'
set +e
rm -f csvs/*.csv
powershell -Command "start-process excel -Wait -ArgumentList convert-excels2csv.xlsm"
set -e
node convert.js
set +e
code result.csv
powershell -Command "start-process chrome -Wait -ArgumentList 'https://calendar.google.com/calendar/u/0/r/settings/createcalendar'"