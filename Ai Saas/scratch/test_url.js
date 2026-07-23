function getBaseUrl(envUrl) {
  const cleanUrl = envUrl.replace(/\/+$/, '').replace(/\/api$/, '');
  return `${cleanUrl}/api/`;
}

console.log("1:", getBaseUrl("https://ai-saas-3.onrender.com/api"));
console.log("2:", getBaseUrl("https://ai-saas-3.onrender.com/api/"));
console.log("3:", getBaseUrl("https://ai-saas-3.onrender.com"));
console.log("4:", getBaseUrl("http://localhost:5000/api"));
