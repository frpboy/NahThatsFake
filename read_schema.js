
const fs = require('fs');
const path = 'd:\\K4NN4N\\tg bot\\NahThatsFake\\Documents\\BSChecker_Doc10_Schema.html';
const content = fs.readFileSync(path, 'utf8');

let startIndex = 0;
let count = 0;
while (true) {
  startIndex = content.indexOf('CREATE TABLE', startIndex);
  if (startIndex === -1) break;
  
  count++;
  if (count >= 3) {
      console.log(`\n--- FOUND CREATE TABLE #${count} AT ${startIndex} ---\n`);
      console.log(content.substring(startIndex, startIndex + 1500));
  }
  
  startIndex += 1;
}
