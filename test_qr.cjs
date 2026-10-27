const LZString = require('lz-string');

const activeInventory = [
  { name: "Coke", price: 20, stock: 50, sku: "123", category: "Drinks", unitPrices: [] }
];

const syncPayload = {
  v: 5,
  t: 'SC',
  storeName: "My Store",
  i: activeInventory.map((item) => [
    item.name,
    item.price,
    item.stock,
    item.sku || '',
    item.category || 'General',
    item.unitPrices || [],
  ]),
};

const rawString = LZString.compressToEncodedURIComponent(JSON.stringify(syncPayload));
console.log("Raw String:", rawString);

const jsonStr = LZString.decompressFromEncodedURIComponent(rawString);
const parsed = JSON.parse(jsonStr);

console.log("Parsed i:", parsed.i);
