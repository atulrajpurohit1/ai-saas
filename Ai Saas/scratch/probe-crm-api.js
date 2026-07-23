const http = require('http');

const baseUrl = 'http://127.0.0.1:5000/api';
const credentials = [
  ['admin@aisaascrm.com', 'Admin123!'],
  ['admin@aisaascrm.com', 'admin123'],
  ['admin@example.com', 'Admin123!'],
  ['admin@example.com', 'admin123'],
  ['test@example.com', 'Admin123!'],
];

function request(method, path, body, token) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : '';
    const url = new URL(`${baseUrl}/${path}`);
    const req = http.request(url, {
      method,
      headers: {
        ...(data ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    }, (res) => {
      let text = '';
      res.on('data', (chunk) => { text += chunk; });
      res.on('end', () => {
        let parsed = text;
        try { parsed = JSON.parse(text); } catch {}
        resolve({ status: res.statusCode, body: parsed });
      });
    });
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

async function main() {
  let token = '';
  let loginUser = '';

  for (const [email, password] of credentials) {
    const res = await request('POST', 'auth/login', { email, password });
    console.log(`login ${email}/${password}: ${res.status}`);
    if (res.status === 201 || res.status === 200) {
      token = res.body.access_token;
      loginUser = email;
      break;
    }
    console.log(res.body);
  }

  if (!token) {
    process.exitCode = 1;
    return;
  }

  console.log(`using ${loginUser}`);
  for (const path of ['users/me', 'leads', 'deals', 'clients']) {
    const res = await request('GET', path, null, token);
    console.log(`${path}: ${res.status}`);
    if (res.status >= 400) console.log(res.body);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
