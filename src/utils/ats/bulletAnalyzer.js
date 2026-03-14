function analyzeBullets(sentences){

let weak = [];
let strong = [];

const metricRegex = /\d+%|\d+\s?(users|clients|requests|projects)/i;

sentences.forEach(s=>{

const words = s.split(" ");

const hasMetric = metricRegex.test(s);

if(words.length<6 || !hasMetric){

weak.push(s);

}else{

strong.push(s);

}

});

return {weak,strong};

}

module.exports = analyzeBullets;