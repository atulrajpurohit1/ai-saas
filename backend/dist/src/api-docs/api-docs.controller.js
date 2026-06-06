"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ApiDocsController = void 0;
const common_1 = require("@nestjs/common");
const openapi_document_1 = require("./openapi-document");
let ApiDocsController = class ApiDocsController {
    openApiJson() {
        return (0, openapi_document_1.buildOpenApiDocument)();
    }
    html() {
        return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Ai Saas Public API Docs</title>
  <style>
    body { margin: 0; font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; background: #0f172a; color: #f8fafc; }
    main { max-width: 1080px; margin: 0 auto; padding: 40px 20px; }
    h1 { margin: 0 0 8px; font-size: 34px; }
    p { color: #94a3b8; line-height: 1.6; }
    a { color: #93c5fd; }
    .grid { display: grid; gap: 14px; }
    .endpoint { border: 1px solid rgba(255,255,255,.1); background: rgba(30,41,59,.7); border-radius: 10px; padding: 16px; }
    .method { display: inline-block; min-width: 52px; font-weight: 800; color: #bfdbfe; }
    code { color: #c4b5fd; }
    pre { overflow: auto; border: 1px solid rgba(255,255,255,.1); border-radius: 10px; background: #020617; padding: 16px; color: #cbd5e1; }
  </style>
</head>
<body>
  <main>
    <h1>Ai Saas Public API</h1>
    <p>OpenAPI 3.0 documentation for V6 Phase 3. Authenticate public API calls with <code>X-API-Key</code>. Webhook deliveries include <code>X-Ai-Saas-Signature</code> for HMAC-SHA256 validation.</p>
    <p><a href="/api-docs/openapi.json">Open raw OpenAPI JSON</a></p>
    <section class="grid" id="endpoints"></section>
    <h2>Webhook Signature</h2>
    <pre>signed_payload = X-Ai-Saas-Timestamp + "." + raw_json_body
expected = HMAC_SHA256(secret_key, signed_payload)
compare with X-Ai-Saas-Signature after removing "sha256="</pre>
  </main>
  <script>
    fetch('/api-docs/openapi.json').then((res) => res.json()).then((doc) => {
      const root = document.getElementById('endpoints');
      Object.entries(doc.paths).forEach(([path, methods]) => {
        Object.entries(methods).forEach(([method, config]) => {
          const item = document.createElement('article');
          item.className = 'endpoint';
          item.innerHTML = '<div><span class="method">' + method.toUpperCase() + '</span><code>/api' + path + '</code></div><p>' + config.summary + '</p><p>' + config.description + '</p>';
          root.appendChild(item);
        });
      });
    });
  </script>
</body>
</html>`;
    }
};
exports.ApiDocsController = ApiDocsController;
__decorate([
    (0, common_1.Get)('openapi.json'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], ApiDocsController.prototype, "openApiJson", null);
__decorate([
    (0, common_1.Get)(),
    (0, common_1.Header)('Content-Type', 'text/html; charset=utf-8'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], ApiDocsController.prototype, "html", null);
exports.ApiDocsController = ApiDocsController = __decorate([
    (0, common_1.Controller)('api-docs')
], ApiDocsController);
//# sourceMappingURL=api-docs.controller.js.map