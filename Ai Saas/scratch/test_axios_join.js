// Axios-like path joining simulation
function joinUrls(base, url) {
    if (!base) return url;
    if (!url) return base;
    
    // If url starts with http, return url
    if (url.startsWith('http')) return url;
    
    // If url starts with /
    if (url.startsWith('/')) {
        const domain = base.split('/').slice(0, 3).join('/');
        return domain + url;
    }
    
    // Standard joining
    const cleanBase = base.endsWith('/') ? base : base + '/';
    return cleanBase + url;
}

console.log("Standard logic test:");
console.log("base: .../api/ , url: auth/login =>", joinUrls("https://domain.com/api/", "auth/login"));
console.log("base: .../api , url: auth/login =>", joinUrls("https://domain.com/api", "auth/login"));
console.log("base: .../api/ , url: /auth/login =>", joinUrls("https://domain.com/api/", "/auth/login"));
console.log("base: .../api , url: /auth/login =>", joinUrls("https://domain.com/api", "/auth/login"));
