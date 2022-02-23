#!/bin/sh

set -e

node scrape.mjs
read -p $'\nWaiting for Excels to be converted to CSVs...\n'
node convert.js
