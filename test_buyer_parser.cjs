const parsed = {
  v: 5,
  t: 'SC',
  storeName: 'My Store',
  i: [ [ 'Coke', 20, 50, '123', 'Drinks', [] ] ],
  ts: 123456789
};

const incomingItems = (parsed.i || parsed.items || []).map((tuple) => {
  if (!Array.isArray(tuple)) {
    return {
      name: String(tuple.name || ''),
      price: Number(tuple.price || 0),
      stock: Number(tuple.stock || 0),
      sku: tuple.sku ? String(tuple.sku) : undefined,
      category: tuple.category ? String(tuple.category) : undefined,
      variants: tuple.variants,
    };
  }
  const [name, price, stock, sku, category, rawVariants] = tuple;
  let variants = undefined;
  if (Array.isArray(rawVariants) && rawVariants.length > 0) {
    variants = rawVariants.map((v) =>
      Array.isArray(v)
        ? { label: String(v[0]), price: Number(v[1]) }
        : { label: String(v.label), price: Number(v.price) }
    );
  }
  return {
    name: String(name || ''),
    price: Number(price || 0),
    stock: Number(stock || 0),
    sku: sku ? String(sku) : undefined,
    category: category ? String(category) : undefined,
    variants,
  };
});

console.log(incomingItems);
