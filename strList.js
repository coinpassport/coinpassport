const fs = require('fs');
// Development tool for automatically generating a translation file template

const strings = fs.readFileSync('src/js/templates.js', 'utf8')
  .match(/__`[^`]+`/g)
  .map(match => match.replace(/\$\{[^}]+\}/g, 'xxx').slice(3, -1));

strings.unshift('English');

const obj = strings.reduce((out, cur) => {
  out[cur] = '';
  return out;
}, {});

console.log(JSON.stringify(obj, null, 2));
