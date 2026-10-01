const packageLoaders = import.meta.glob("./examples/*/index.js");

export async function loadContentPackage(packageId) {
  const loader = packageLoaders[`./examples/${packageId}/index.js`];
  return loader ? loader() : null;
}
