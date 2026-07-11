// Seed subset of world-famous LANDMARKS (tourist attractions beyond UNESCO),
// written to public/reference/landmarks.json in the HeritageSite shape —
// they merge into the same "sites & monuments" machinery (map pins, city-page
// nearby, per-country coverage, search). Aggregator-only: real, verifiable
// facts (name / country / coordinates) transcribed with provenance.
// The FULL set comes from Wikidata (tourist attractions with coordinates) via
// a networked machine, like scripts/build-heritage.mjs; this seed makes the
// feature real until then. Category: "landmark".
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

/** [name, ISO2, lat, lon] */
const L = [
["Eiffel Tower","FR",48.8584,2.2945],["Louvre Museum","FR",48.8606,2.3376],
["Notre-Dame de Paris","FR",48.8530,2.3499],["Arc de Triomphe","FR",48.8738,2.2950],
["Sacré-Cœur","FR",48.8867,2.3431],["Château de Chambord","FR",47.6162,1.5170],
["Big Ben","GB",51.5007,-0.1246],["Tower Bridge","GB",51.5055,-0.0754],
["Buckingham Palace","GB",51.5014,-0.1419],["Edinburgh Castle","GB",55.9486,-3.1999],
["Golden Gate Bridge","US",37.8199,-122.4783],["Empire State Building","US",40.7484,-73.9857],
["Times Square","US",40.7580,-73.9855],["Mount Rushmore","US",43.8791,-103.4591],
["Leaning Tower of Pisa","IT",43.7230,10.3966],["Trevi Fountain","IT",41.9009,12.4833],
["Milan Cathedral","IT",45.4642,9.1900],["St Mark's Basilica","IT",45.4345,12.3396],
["Park Güell","ES",41.4145,2.1527],["Plaza de España","ES",37.3772,-5.9869],
["Royal Palace of Madrid","ES",40.4180,-3.7144],
["Brandenburg Gate","DE",52.5163,13.3777],["Neuschwanstein Castle","DE",47.5576,10.7498],
["Belém Tower","PT",38.6916,-9.2160],["Saint Basil's Cathedral","RU",55.7525,37.6231],
["Blue Mosque","TR",41.0054,28.9768],["Galata Tower","TR",41.0256,28.9744],
["Burj Khalifa","AE",25.1972,55.2744],["Terracotta Army","CN",34.3841,109.2785],
["Oriental Pearl Tower","CN",31.2397,121.4998],
["Fushimi Inari Taisha","JP",34.9671,135.7727],["Tokyo Tower","JP",35.6586,139.7454],
["Sensō-ji","JP",35.7148,139.7967],["Mount Fuji","JP",35.3606,138.7274],
["Gyeongbokgung Palace","KR",37.5796,126.9770],
["Grand Palace","TH",13.7500,100.4913],["Wat Arun","TH",13.7437,100.4888],
["Marina Bay Sands","SG",1.2838,103.8591],["Merlion Park","SG",1.2868,103.8545],
["Gateway of India","IN",18.9220,72.8347],["Amber Fort","IN",26.9855,75.8513],
["Christ the Redeemer","BR",-22.9519,-43.2105],["Sugarloaf Mountain","BR",-22.9492,-43.1545],
["Obelisco de Buenos Aires","AR",-34.6037,-58.3816],
["CN Tower","CA",43.6426,-79.3871],["Niagara Falls","CA",43.0962,-79.0377],
["Sydney Harbour Bridge","AU",-33.8523,151.2108],["Uluru","AU",-25.3444,131.0369],
["Table Mountain","ZA",-33.9628,18.4098],["Hassan II Mosque","MA",33.6086,-7.6327],
["Western Wall","IL",31.7767,35.2345],["Rijksmuseum","NL",52.3600,4.8852],
["Charles Bridge","CZ",50.0865,14.4114],["Schönbrunn Palace","AT",48.1858,16.3122],
["Hungarian Parliament","HU",47.5076,19.0458],["Atomium","BE",50.8949,4.3415],
["Chapel Bridge","CH",47.0517,8.3059],["Wawel Castle","PL",50.0540,19.9354],
["Cliffs of Moher","IE",52.9715,-9.4309],["Hallgrímskirkja","IS",64.1417,-21.9266],
["Preikestolen","NO",58.9864,6.1904],["The Little Mermaid","DK",55.6929,12.5993],
["Vasa Museum","SE",59.3280,18.0914],["Helsinki Cathedral","FI",60.1704,24.9522],
];
const slug=(s)=>s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g,"").replace(/[^a-z0-9]+/g,"-").replace(/(^-|-$)/g,"");
const out=L.map(([name,cc,lat,lon])=>({id:`lmk-${slug(name)}`,name,countryIso2:cc,lat,lon,category:"landmark"}))
  .sort((a,b)=>a.name.localeCompare(b.name));
const dir=dirname(fileURLToPath(import.meta.url));
writeFileSync(join(dir,"..","public","reference","landmarks.json"),JSON.stringify(out));
console.log(`wrote ${out.length} landmarks across ${new Set(out.map(x=>x.countryIso2)).size} countries`);
